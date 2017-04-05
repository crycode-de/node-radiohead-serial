/*
 * Node.js RadioHead Serial
 *
 * Copyright (c) 2017 Peter Müller <peter@crycode.de> (https://crycode.de/)
 *
 * Node.js Addon for communication between some RadioHead nodes and Node.js using
 * the RH_Serial driver and the RHReliableDatagram manager of the RadioHead library.
 */

#include <nan.h>

#include <uv.h>

#include <unistd.h>

#include <RHGenericDriver.h>
#include <RHReliableDatagram.h>
#include <RH_Serial.h>
#include <RHutil/HardwareSerial.h>

#include <sys/time.h>

#include "rh-serial.h"
#include "functions.h"

/**
 * Persistent function as constructor for new instances.
 */
Nan::Persistent<v8::Function> RadioHeadSerial::constructor;

/**
 * Constructor
 */
RadioHeadSerial::RadioHeadSerial(void){
  // set pointers to nullpointer
  work = 0;
  hardwareserial = 0;
  driver = 0;
  manager = 0;

  // set the worker as inactive
  workerActive = false;
}

/**
 * Destructor
 * Deletes the objects and set all pointers to nullpointer.
 */
RadioHeadSerial::~RadioHeadSerial(){
  delete work;
  work = 0;

  delete manager;
  manager = 0;

  delete driver;
  driver = 0;

  delete hardwareserial;
  hardwareserial = 0;
}

/**
 * Init for the Node.js addon.
 * Called from addon.cpp
 */
void RadioHeadSerial::Init(v8::Local<v8::Object> exports){
  Nan::HandleScope scope;

  // Prepare constructor template
  v8::Local<v8::FunctionTemplate> tpl = Nan::New<v8::FunctionTemplate>(New);
  tpl->SetClassName(Nan::New("RadioHeadSerial").ToLocalChecked());
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  // Prototype
  Nan::SetPrototypeMethod(tpl, "start", StartAsyncWork);
  Nan::SetPrototypeMethod(tpl, "stop", StopAsyncWork);
  Nan::SetPrototypeMethod(tpl, "send", Send);
  Nan::SetPrototypeMethod(tpl, "setAddress", SetAddress);
  Nan::SetPrototypeMethod(tpl, "setRetries", SetRetries);
  Nan::SetPrototypeMethod(tpl, "getRetries", GetRetries);
  Nan::SetPrototypeMethod(tpl, "setTimeout", SetTimeout);
  Nan::SetPrototypeMethod(tpl, "getRetransmissions", GetRetransmissions);
  Nan::SetPrototypeMethod(tpl, "resetRetransmissions", ResetRetransmissions);
  Nan::SetPrototypeMethod(tpl, "setPromiscuous", SetPromiscuous);
  Nan::SetPrototypeMethod(tpl, "destroy", Destroy);

  constructor.Reset(tpl->GetFunction());
  exports->Set(Nan::New("RadioHeadSerial").ToLocalChecked(), tpl->GetFunction());
}

/**
 * Constructor for the Node.js part.
 * Initialisation of the RadioHead library.
 *
 * Parameters for the Node.js call:
 *  port - String with the device used for the serial communiation (e.g. /dev/ttyUSB0)
 *  baud - Baud rate for the serial communiation. (e.g. 9600)
 *  addr - Address of this node in the RadioHead network. (e.g. 0x01)
 */
void RadioHeadSerial::New(const Nan::FunctionCallbackInfo<v8::Value>& info){
  if (info.IsConstructCall()) {
    // Invoked as constructor: `new RadioHeadSerial()`

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

    // create new instance
    RadioHeadSerial* rhs = new RadioHeadSerial();

    // init RadioHead
    rhs->hardwareserial = new HardwareSerial((char*)*port);
    rhs->driver = new RH_Serial(*rhs->hardwareserial);
    rhs->manager = new RHReliableDatagram(*rhs->driver, ownAddress);

    // start serial communication
    rhs->driver->serial().begin(baud);

    // init the RadioHead manager
    if (!rhs->manager->init()){
      Nan::ThrowError("Init failed");
      return;
    }

    // create the worker
    rhs->work = new Work();
    rhs->work->rhs = rhs;
    rhs->work->request.data = rhs->work;

    // Wrap for Node.js
    rhs->Wrap(info.This());

    // Ref() to keep save from garbage collector
    rhs->Ref();

    info.GetReturnValue().Set(info.This());
  } else {
    // Invoked as plain function `RadioHeadSerial()`, turn into construct call.
    Nan::ThrowError("Must invoke as constructor: `new RadioHeadSerial()`");
    return;
  }
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
void RadioHeadSerial::Send(const Nan::FunctionCallbackInfo<v8::Value>& info){
  // Get the instance of the RadioHeadSerial
  RadioHeadSerial* rhs = ObjectWrap::Unwrap<RadioHeadSerial>(info.Holder());

  if(!rhs->workerActive){
    Nan::ThrowError("Worker not active");
    return;
  }

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
  rhs->work->txTo = (uint8_t) info[0]->NumberValue();
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
  memcpy(&rhs->bufTx[0], buffer, txLen);

  // persist callback function
  rhs->work->txCallback.Reset(callback);

  // set length, so that the worker knows that there is some data to send
  rhs->work->txLen = txLen;

  info.GetReturnValue().Set(Nan::Undefined());
}

/**
 * Worker for the asynchronous "main" loop.
 * Checks periodically if a new message has been received.
 * Also sends the data from the tx buffer, if txLen is greater than zero.
 * If some data has been received or sent a flag is set and the loop is exited.
 */
void RadioHeadSerial::WorkAsync(uv_work_t *req){

  // Get the Work from request
  Work * work = (Work*) &req->data;

  // main loop watching for actions
  while(!work->stop && !work->rxRunCallback && !work->txRunCallback){

    // data received?
    if(work->rhs->manager->available()){
      // data received...
      work->rxLen = sizeof(work->rhs->bufRx);
      work->rxFrom = 0;
      work->rxTo = 0;
      work->rxId = 0;
      work->rxFlags = RH_FLAGS_NONE;

      // get the received data
      if(work->rhs->manager->recvfromAck(work->rhs->bufRx, &work->rxLen, &work->rxFrom, &work->rxTo, &work->rxId, &work->rxFlags)){
        // received data is ok...

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
      if(work->rhs->manager->sendtoWait(work->rhs->bufTx, work->txLen, work->txTo)){
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
void RadioHeadSerial::WorkAsyncComplete(uv_work_t *req, int status){
  // HandleScope explicit needed, because this isnt is real NaN-method
  Nan::HandleScope scope;

  // Get the Work from request
  Work * work = (Work*) &req->data;

  // run rx callback if the flag is set
  if(work->rxRunCallback){
    // 7 arguments for the callback function
    const unsigned argc = 7;
    v8::Local<v8::Value> argv[argc] = {
      Nan::Undefined(),        // error (undefined if not present)
      Nan::New(work->rxLen),   // length
      Nan::New(work->rxFrom),  // from address
      Nan::New(work->rxTo),    // to address
      Nan::New(work->rxId),    // message id
      Nan::New(work->rxFlags), // message flags
      Nan::Undefined()         // data (undefined if not present)
    };

    if(work->rxLen > 0){
      // received some data... set argument of the callback

      // Return a Node.js Buffer, so that binary data can be used.
      // Use CopyBuffer because NewBuffer takes the pointer, so that rxBuf will be
      // delete by the garbage collector.
      // see https://github.com/nodejs/nan/blob/master/doc/buffers.md#nannewbuffer
      argv[6] = Nan::CopyBuffer((char*) work->rhs->bufRx, work->rxLen).ToLocalChecked();

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

    // Reset the callback
    work->stopCallback.Reset();

    // set the worker as inactive
    work->rhs->workerActive = false;

  }else{
    // restart the work
    // reset flags
    work->rxRunCallback = false;
    work->rxLen = 0;
    work->txRunCallback = false;

    // start the work using libuv
    uv_queue_work(uv_default_loop(), &work->request, work->rhs->WorkAsync, work->rhs->WorkAsyncComplete);
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
void RadioHeadSerial::StartAsyncWork(const Nan::FunctionCallbackInfo<v8::Value>& info){
  // Get the instance of the RadioHeadSerial
  RadioHeadSerial* rhs = ObjectWrap::Unwrap<RadioHeadSerial>(info.Holder());

  // check if already active
  if(rhs->workerActive){
    Nan::ThrowError("The worker is already active");
    return;
  }

  if (!info[0]->IsFunction()) {
    Nan::ThrowError("Args[0] (Callback) must be a function");
    return;
  }

  // read and discard all the old trash in cache
  while(rhs->manager->available()){
    uint8_t len = sizeof(rhs->bufRx);
    rhs->manager->recvfromAck(rhs->bufRx, &len);
  }

  // init work
  rhs->work->stop = false;
  rhs->work->rxRunCallback = false;
  rhs->work->rxLen = 0;
  rhs->work->txRunCallback = false;
  rhs->work->txLen = 0;
  rhs->work->txOk = false;

  // persist the rx callback function
  v8::Local<v8::Function> callback = info[0].As<v8::Function>();
  rhs->work->rxCallback.Reset(callback);

  // start the work using libuv
  uv_queue_work(uv_default_loop(), &rhs->work->request, rhs->WorkAsync, rhs->WorkAsyncComplete);

  // set the worker as active
  rhs->workerActive = true;

  info.GetReturnValue().Set(Nan::Undefined());
}

/**
 * Stop the worker for receiving and sending data.
 * Sets a flag for the worker, that the worker should stop.
 *
 * Parameters for the Node.js call:
 *  cb - Callback funktion, which is called when the work has been stopped.
 */
void RadioHeadSerial::StopAsyncWork(const Nan::FunctionCallbackInfo<v8::Value>& info){
  // Get the instance of the RadioHeadSerial
  RadioHeadSerial* rhs = ObjectWrap::Unwrap<RadioHeadSerial>(info.Holder());

  if (!info[0]->IsFunction()) {
    Nan::ThrowError("Args[0] (Callback) must be a function");
    return;
  }

  // persist callback function
  v8::Local<v8::Function> callback = info[0].As<v8::Function>();
  rhs->work->stopCallback.Reset(callback);

  // set the flag
  rhs->work->stop = true;

  info.GetReturnValue().Set(Nan::Undefined());
}

/**
 * Set the address of this node in the RadioHead network.
 *
 * Parameters for the Node.js call:
 *  addr - The new address (e.g. 0x05)
 */
void RadioHeadSerial::SetAddress(const Nan::FunctionCallbackInfo<v8::Value>& info){
  // Get the instance of the RadioHeadSerial
  RadioHeadSerial* rhs = ObjectWrap::Unwrap<RadioHeadSerial>(info.Holder());

  if (!info[0]->IsNumber()) {
    Nan::ThrowError("Args[0] (Address) must be a number");
    return;
  }

  uint8_t ownAddress = info[0]->NumberValue();
  rhs->manager->setThisAddress(ownAddress);

  info.GetReturnValue().Set(Nan::Undefined());
}

/**
 * Sets the maximum number of retries.
 * If set to 0, each message will only ever be sent once.
 *
 * Parameters for the Node.js call:
 *  retries - New number of retries. (default 3)
 */
void RadioHeadSerial::SetRetries(const Nan::FunctionCallbackInfo<v8::Value>& info){
  // Get the instance of the RadioHeadSerial
  RadioHeadSerial* rhs = ObjectWrap::Unwrap<RadioHeadSerial>(info.Holder());

  if (!info[0]->IsNumber()) {
    Nan::ThrowError("Args[0] (Retries) must be a number");
    return;
  }

  uint8_t retries = info[0]->NumberValue();
  rhs->manager->setRetries(retries);

  info.GetReturnValue().Set(Nan::Undefined());
}

/**
 * Returns the currently configured maximum retries count. Can be changed with setRetries().
 */
void RadioHeadSerial::GetRetries(const Nan::FunctionCallbackInfo<v8::Value>& info){
  // Get the instance of the RadioHeadSerial
  RadioHeadSerial* rhs = ObjectWrap::Unwrap<RadioHeadSerial>(info.Holder());

  uint8_t retries = rhs->manager->retries();

  info.GetReturnValue().Set(Nan::New(retries));
}

/**
 * Sets the minimum retransmit timeout in milliseconds.
 *
 * Parameters for the Node.js call:
 *  timeout - New timeout in milliseconds. (default 200)
 */
void RadioHeadSerial::SetTimeout(const Nan::FunctionCallbackInfo<v8::Value>& info){
  // Get the instance of the RadioHeadSerial
  RadioHeadSerial* rhs = ObjectWrap::Unwrap<RadioHeadSerial>(info.Holder());

  if (!info[0]->IsNumber()) {
    Nan::ThrowError("Args[0] (Timeout) must be a number");
    return;
  }

  uint16_t timeout = info[0]->NumberValue();
  rhs->manager->setTimeout(timeout);

  info.GetReturnValue().Set(Nan::Undefined());
}

/*
 * Returns the number of retransmissions we have had to send since starting or since the last call to resetRetransmissions().
 */
void RadioHeadSerial::GetRetransmissions(const Nan::FunctionCallbackInfo<v8::Value>& info){
  // Get the instance of the RadioHeadSerial
  RadioHeadSerial* rhs = ObjectWrap::Unwrap<RadioHeadSerial>(info.Holder());

  uint8_t retransmissions = rhs->manager->retransmissions();

  info.GetReturnValue().Set(Nan::New(retransmissions));
}

/*
 * Resets the count of the number of retransmissions to 0.
 */
void RadioHeadSerial::ResetRetransmissions(const Nan::FunctionCallbackInfo<v8::Value>& info){
  // Get the instance of the RadioHeadSerial
  RadioHeadSerial* rhs = ObjectWrap::Unwrap<RadioHeadSerial>(info.Holder());

  rhs->manager->resetRetransmissions();

  info.GetReturnValue().Set(Nan::Undefined());
}

/**
 * Tells the receiver to accept messages with any TO address, not just messages addressed to thisAddress or the broadcast address.
 *
 * Parameters for the Node.js call:
 *  promiscuous - true if you wish to receive messages with any TO address. (default false)
 */
void RadioHeadSerial::SetPromiscuous(const Nan::FunctionCallbackInfo<v8::Value>& info){
  // Get the instance of the RadioHeadSerial
  RadioHeadSerial* rhs = ObjectWrap::Unwrap<RadioHeadSerial>(info.Holder());

  if (!info[0]->IsBoolean()) {
    Nan::ThrowError("Args[0] (Promiscuous) must be a boolean");
    return;
  }

  bool promiscuous = info[0]->BooleanValue();
  rhs->driver->setPromiscuous(promiscuous);

  info.GetReturnValue().Set(Nan::Undefined());
}

/**
 * Releases the reference to the current instance of this class.
 * If no other reference exists (e.g. the Node.js variable is also deleted) the
 * garbage collector can destroy this instance.
 * After destroy is called, no interaction with this class should be made.
 * This should be used to free up memory if this instance will not be used again.
 */
void RadioHeadSerial::Destroy(const Nan::FunctionCallbackInfo<v8::Value>& info){
  // Get the instance of the RadioHeadSerial
  RadioHeadSerial* rhs = ObjectWrap::Unwrap<RadioHeadSerial>(info.Holder());

  // check if the worker is active
  if(rhs->workerActive){
    Nan::ThrowError("Worker still active, you must stop it first");
    return;
  }

  // Unref() to let the garbage collector do his job
  rhs->Unref();

  info.GetReturnValue().Set(Nan::Undefined());
}
