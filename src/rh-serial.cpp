/*
 * NodeJS RadioHead Serial
 *
 * Copyright (C) 2016 Peter Müller <peter@crycode.de> (https://crycode.de/)
 *
 * NodeJS Addon for communication between some RadioHead nodes and NodeJS using
 * the RH_Serial driver of the RadioHead library.
 */

#include <nan.h>

#include <uv.h>

#include <unistd.h>

#include <RHReliableDatagram.h>
#include <RH_Serial.h>
#include <RHutil/HardwareSerial.h>

#include <sys/time.h>

#include "rh-serial.h"
#include "functions.h"


namespace radioHeadSerialAddon {

  /**
   * Initialisation of the RadioHead library.
   *
   * Parameters for the Node.js call:
   *  port - String with the device used for the serial communiation (e.g. /dev/ttyUSB0)
   *  baud - Baud rate for the serial communiation. (e.g. 9600)
   *  addr - Address of this node in the RadioHead network. (e.g. 0x01)
   */
  void Init(const Nan::FunctionCallbackInfo<v8::Value>& info){

    if (info.Length() < 3) {
      Nan::ThrowError("Wrong number of arguments");
      return;
    }

    if (!info[0]->IsString()) {
      Nan::ThrowError("Args[0] (Port) must be a string");
      return;
    }

    if (!info[1]->IsNumber()) {
      Nan::ThrowError("Args[1] (Baud) must be a number");
      return;
    }

    if (!info[2]->IsNumber()) {
      Nan::ThrowError("Args[2] (Address) must be a number");
      return;
    }

    // get arguments
    v8::String::Utf8Value port(info[0]->ToString());
    int baud = info[1]->NumberValue();
    uint8_t ownAddress = info[2]->NumberValue();

    // init RadioHead
    hardwareserial = new HardwareSerial((char*)*port);
    driver = new RH_Serial(*hardwareserial);
    manager = new RHReliableDatagram(*driver, ownAddress);

    // start serial communication
    driver->serial().begin(baud);

    // init the RadioHead manager
    if (!manager->init()){
      Nan::ThrowError("Init failed");
      return;
    }

    info.GetReturnValue().Set(Nan::Undefined());
  }

  /**
   * Send a message through the RadioHead network.
   *
   * Parameters for the Node.js call:
   *  addr - Recipient address. Use 255 for broadcast messages. (e.g. 0x05)
   *  len  - Number ob bytes to send from the buffer.
   *  data - Buffer containing the message to send.
   *  cb   - Callback called after the message is send. First argument is a possible Error object.
   */
  void Send(const Nan::FunctionCallbackInfo<v8::Value>& info){

    if(info.Length() < 4){
      Nan::ThrowError("Wrong number of arguments");
      return;
    }

    if(!info[0]->IsNumber()){
      Nan::ThrowError("Args[0] (Address) must be a number");
      return;
    }

    if(!info[1]->IsNumber()){
      Nan::ThrowError("Args[1] (Len) must be a number");
      return;
    }

    if(!info[2]->IsObject()){
      Nan::ThrowError("Args[2] (Data) must be a buffer");
      return;
    }

    if(!info[3]->IsFunction()){
      Nan::ThrowError("Args[3] (Callback) must be a function");
      return;
    }

    // get callback function, receiver address and length of data
    v8::Local<v8::Function> callback = info[3].As<v8::Function>();
    work->txAddr = (uint8_t) info[0]->NumberValue();
    uint8_t txLen = (uint8_t) info[1]->NumberValue();

    // check if data is too long
    if(txLen > RH_SERIAL_MAX_MESSAGE_LEN){
      // too long... call the callback with an error
      info.GetReturnValue().Set(Nan::Undefined());
      const unsigned argc = 1;
      v8::Local<v8::Value> argv[argc] = {
        Nan::Error("data too long")
      };
      Nan::MakeCallback(Nan::GetCurrentContext()->Global(), callback, argc, argv);
      return;
    }

    // copy data from the Node.js buffer to the TX buffer
    char* buffer = (char*) node::Buffer::Data(info[2]->ToObject());
    memcpy(&bufTx[0], buffer, txLen);

    // persist callback function
    work->txCallback.Reset(callback);

    // set length, so that the worker knows that there is some data to send
    work->txLen = txLen;

    info.GetReturnValue().Set(Nan::Undefined());
  }

  /**
   * Worker for the asynchronous "main" loop.
   * Checks periodically if a new message has been received.
   * Also sends the data from the tx buffer, if txLen is greater than zero.
   * If some data has been received or sent a flag is set and the loop is exited.
   */
  static void WorkAsync(uv_work_t *req){

    // main loop watching for actions
    while(!work->stop && !work->rxRunCallback && !work->txRunCallback){

      // data received?
      if(manager->available()){
        // data received...
        work->rxLen = sizeof(bufRx);

        // get the received data
        if(manager->recvfromAck(bufRx, &work->rxLen, &work->rxAddr)){
          // received data is ok...
          // length of the data is in work->rxLen
          // sender address is in work->rxAddr

          // set the flag, to run the rx callback
          work->rxRunCallback = true;

        }else{
          // data is NOT ok (e.g. checksumerror)...

          // set length to zero and set the flag, to run the rx callback
          work->rxLen = 0;
          work->rxRunCallback = true;

        }

      // is there data to send?
      }else if(work->txLen > 0){
        // send data
        if(manager->sendtoWait(bufTx, work->txLen, work->txAddr)){
          // ok... set flag
          work->txOk = true;
        }else{
          // error... set flag
          work->txOk = false;
        }

        // set txLen to zero, because the actual data is already sent
        work->txLen = 0;

        // set the flag, to run the tx callback
        work->txRunCallback = true;

      }else {
        // nothing to do... just wait 50ms
        usleep(50000);
      }

    }
  }

  /**
   * Asynchronous work done.
   * Call the callback functions with the corresponding arguments.
   * Then stop the work or start is again.
   */
  static void WorkAsyncComplete(uv_work_t *req, int status){
    // HandleScope explicit needed, because this isnt is real NaN-method
    Nan::HandleScope scope;

    // run rx callback if the flag is set
    if(work->rxRunCallback){
      // 4 arguments for the callback function
      // error, sender address, length and data
      // error and data are undefined if not present
      const unsigned argc = 4;
      v8::Local<v8::Value> argv[argc] = {
        Nan::Undefined(),
        Nan::New(work->rxAddr),
        Nan::New(work->rxLen),
        Nan::Undefined()
      };

      if(work->rxLen > 0){
        // received some data... set argument of the callback

        // Return a Node.js Buffer, so that binary data can be used.
        // Use CopyBuffer because NewBuffer takes the pointer, so that rxBuf will be
        // delete by the garbage collector.
        // see https://github.com/nodejs/nan/blob/master/doc/buffers.md#nannewbuffer
        argv[3] = Nan::CopyBuffer((char*) bufRx, work->rxLen).ToLocalChecked();

      }else{
        // no data received
        argv[0] = Nan::Error("nothing received");
      }

      // call the callback
      v8::Local<v8::Function> callback = Nan::New(work->rxCallback);
      Nan::MakeCallback(Nan::GetCurrentContext()->Global(), callback, argc, argv);

    }

    // run tx callback if the flag is set
    if(work->txRunCallback){
      // 1 argument for the callback
      // error (undefined, if not present)
      const unsigned argc = 1;
      v8::Local<v8::Value> argv[argc] = {
        Nan::Undefined()
      };

      // set error, if sending was not ok
      if(!work->txOk){
        argv[0] = Nan::Error("sendToWait failed");
      }

      // call the callback
      v8::Local<v8::Function> callback = Nan::New(work->txCallback);
      Nan::MakeCallback(Nan::GetCurrentContext()->Global(), callback, argc, argv);

      // reset the callback, because it has been triggert
      work->txCallback.Reset();
    }

    // stop the work or restart it?
    if(work->stop){
      // stop the work
      work->rxCallback.Reset();
      work->txCallback.Reset();

      // run the callback
      const unsigned argc = 1;
      v8::Local<v8::Value> argv[argc] = {Nan::Undefined()};
      v8::Local<v8::Function> callback = Nan::New(work->stopCallback);
      Nan::MakeCallback(Nan::GetCurrentContext()->Global(), callback, argc, argv);

      delete work;
    }else{
      // restart the work
      // reset flags
      work->rxRunCallback = false;
      work->rxLen = 0;
      work->txRunCallback = false;

      // start the work using libuv
      uv_queue_work(uv_default_loop(), &work->request, WorkAsync, WorkAsyncComplete);
    }
  }

  /**
   * Start the worker for receiving and sending data.
   *
   * Parameters for the Node.js call:
   *  cb - Callback funktion, which is called when data is received with the following arguments:
   *         err  - A possible occurred error.
   *         from - Sender address of the message.
   *         len  - Length of the message in bytes.
   *         data - The received data as a Node.js Buffer.
   */
  void StartAsyncWork(const Nan::FunctionCallbackInfo<v8::Value>& info){

    if (!info[0]->IsFunction()) {
      Nan::ThrowError("Args[0] (Callback) must be a function");
      return;
    }

    // init work
    work = new Work();
    work->request.data = work;
    work->stop = false;
    work->rxRunCallback = false;
    work->rxLen = 0;
    work->txRunCallback = false;
    work->txLen = 0;
    work->txOk = false;

    // read and discard all the old trash in cache
    while(manager->available()){
      manager->recvfromAck(bufRx, &work->rxLen);
    }

    // reset the rxLen to 0
    work->rxLen = 0;

    // persist the rx callback function
    v8::Local<v8::Function> callback = info[0].As<v8::Function>();
    work->rxCallback.Reset(callback);

    // start the work using libuv
    uv_queue_work(uv_default_loop(), &work->request, WorkAsync, WorkAsyncComplete);

    info.GetReturnValue().Set(Nan::Undefined());
  }

  /**
   * Stop the worker for receiving and sending data.
   * Sets a flag for the worker, that the worker should stop.
   *
   * Parameters for the Node.js call:
   *  cb - Callback funktion, which is called when the work has been stopped.
   */
  void StopAsyncWork(const Nan::FunctionCallbackInfo<v8::Value>& info){

    if (!info[0]->IsFunction()) {
      Nan::ThrowError("Args[0] (Callback) must be a function");
      return;
    }

    // persist callback function
    v8::Local<v8::Function> callback = info[0].As<v8::Function>();
    work->stopCallback.Reset(callback);

    // set the flag
    work->stop = true;

    info.GetReturnValue().Set(Nan::Undefined());
  }

  /**
   * Set the address of this node in the RadioHead network.
   *
   * Parameters for the Node.js call:
   *  addr - The new address (e.g. 0x05)
   */
  void SetAddress(const Nan::FunctionCallbackInfo<v8::Value>& info){
    if (!info[0]->IsNumber()) {
      Nan::ThrowError("Args[0] (Address) must be a number");
      return;
    }

    uint8_t ownAddress = info[0]->NumberValue();
    manager->setThisAddress(ownAddress);

    info.GetReturnValue().Set(Nan::Undefined());
  }

  /**
   * Sets the maximum number of retries.
   * If set to 0, each message will only ever be sent once.
   *
   * Parameters for the Node.js call:
   *  retries - New number of retries. (default 3)
   */
  void SetRetries(const Nan::FunctionCallbackInfo<v8::Value>& info){
    if (!info[0]->IsNumber()) {
      Nan::ThrowError("Args[0] (Retries) must be a number");
      return;
    }

    uint8_t retries = info[0]->NumberValue();
    manager->setRetries(retries);

    info.GetReturnValue().Set(Nan::Undefined());
  }

  /**
   * Returns the currently configured maximum retries count. Can be changed with setRetries().
   */
  void GetRetries(const Nan::FunctionCallbackInfo<v8::Value>& info){
    uint8_t retries = manager->retries();

    info.GetReturnValue().Set(Nan::New(retries));
  }

  /**
   * Sets the minimum retransmit timeout in milliseconds.
   *
   * Parameters for the Node.js call:
   *  timeout - New timeout in milliseconds. (default 200)
   */
  void SetTimeout(const Nan::FunctionCallbackInfo<v8::Value>& info){
    if (!info[0]->IsNumber()) {
      Nan::ThrowError("Args[0] (Timeout) must be a number");
      return;
    }

    uint16_t timeout = info[0]->NumberValue();
    manager->setTimeout(timeout);

    info.GetReturnValue().Set(Nan::Undefined());
  }

  /*
   * Returns the number of retransmissions we have had to send since starting or since the last call to resetRetransmissions().
   */
  void GetRetransmissions(const Nan::FunctionCallbackInfo<v8::Value>& info){
    uint8_t retransmissions = manager->retransmissions();

    info.GetReturnValue().Set(Nan::New(retransmissions));
  }

  /*
   * Resets the count of the number of retransmissions to 0.
   */
  void ResetRetransmissions(const Nan::FunctionCallbackInfo<v8::Value>& info){
    manager->resetRetransmissions();

    info.GetReturnValue().Set(Nan::Undefined());
  }

  /**
   * Hook for addon exit.
   * Deletes the RadioHead objects.
   */
  static void atExit(void*){
    delete manager;
    delete driver;
    delete hardwareserial;
  }

  /**
  * Initialisation of the addon.
  * Defines what is visible to Node.js
  */
  void initNode(v8::Local<v8::Object> exports){
    // set the start time (needed for RadioHead)
    start_millis = time_in_millis();

    // export functions
    exports->Set(Nan::New("init").ToLocalChecked(), Nan::New<v8::FunctionTemplate>(Init)->GetFunction());
    exports->Set(Nan::New("send").ToLocalChecked(), Nan::New<v8::FunctionTemplate>(Send)->GetFunction());
    exports->Set(Nan::New("start").ToLocalChecked(), Nan::New<v8::FunctionTemplate>(StartAsyncWork)->GetFunction());
    exports->Set(Nan::New("stop").ToLocalChecked(), Nan::New<v8::FunctionTemplate>(StopAsyncWork)->GetFunction());
    exports->Set(Nan::New("setAddress").ToLocalChecked(), Nan::New<v8::FunctionTemplate>(SetAddress)->GetFunction());
    exports->Set(Nan::New("setRetries").ToLocalChecked(), Nan::New<v8::FunctionTemplate>(SetRetries)->GetFunction());
    exports->Set(Nan::New("getRetries").ToLocalChecked(), Nan::New<v8::FunctionTemplate>(GetRetries)->GetFunction());
    exports->Set(Nan::New("setTimeout").ToLocalChecked(), Nan::New<v8::FunctionTemplate>(SetTimeout)->GetFunction());
    exports->Set(Nan::New("getRetransmissions").ToLocalChecked(), Nan::New<v8::FunctionTemplate>(GetRetransmissions)->GetFunction());
    exports->Set(Nan::New("resetRetransmissions").ToLocalChecked(), Nan::New<v8::FunctionTemplate>(ResetRetransmissions)->GetFunction());

    // reister AtExit-Hook
    node::AtExit(atExit);
  }

  // Init of the Addons
  // Attention: No ; at the End!
  NODE_MODULE(radiohead, initNode)
}
