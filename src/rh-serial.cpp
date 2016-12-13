#include <node.h>
#include <node_buffer.h>
#include <v8.h>

#include <uv.h>

#include <unistd.h>
#include <iostream>
#include <iomanip>

#include <RHReliableDatagram.h>
#include <RH_Serial.h>
#include <RHutil/HardwareSerial.h>

#include <sys/time.h>

#include "rh-serial.h"
#include "functions.h"


namespace radioHeadAddon {
  // TODO check if needed
  using v8::Exception;
  using v8::Function;
  using v8::FunctionCallbackInfo;
  using v8::HandleScope;
  using v8::Isolate;
  using v8::Local;
  using v8::Object;
  using v8::Boolean;
  using v8::String;
  using v8::Value;
  using v8::Persistent;
  using v8::Null;

  using node::AtExit;

  //HardwareSerial globalhardwareserial("/dev/ttyUSB0");
  //RH_Serial globaldriver(globalhardwareserial);
  //RHReliableDatagram globalmanager(globaldriver,0x01);

  //Persistent<Function> txCallback;

  //uint8_t dataToSend[RH_SERIAL_MAX_MESSAGE_LEN];

  //uint8_t dataToSendLen = 0;

  //uint8_t sendToAddr = 0x00;

  // Dont put this on the stack:
  //uint8_t buf[RH_SERIAL_MAX_MESSAGE_LEN];

  uint8_t bufRx[RH_SERIAL_MAX_MESSAGE_LEN];
  uint8_t bufTx[RH_SERIAL_MAX_MESSAGE_LEN];


  struct Work {
    uv_work_t request;
    Persistent<Function> rxCallback;
    Persistent<Function> txCallback;

    bool rxRunCallback;
    bool txRunCallback;

    uint8_t rxLen;
    uint8_t txLen;

    uint8_t rxAddr;
    uint8_t txAddr;

    bool txOk;

    bool stop;
  };

  Work * work;

  /*void mainLoop(Isolate * isolate){
    // Main Loop
    while(true){
      if(dataToSendLen > 0){
        Local<Function> cb = Local<Function>::New(isolate, txCallback);

        // Send a message to manager_server
        if (manager->sendtoWait(dataToSend, dataToSendLen, sendToAddr))
        {
          // Now wait for a reply from the server
          uint8_t len = sizeof(buf);
          uint8_t from;
          if (manager->recvfromAckTimeout(buf, &len, 2000, &from))
          {
            std::cout << std::showbase << std::internal << std::setfill('0');
            std::cout << "replay from "
              << std::hex << std::setw(4) << (int)from << std::dec
              << ": " << (char*)buf << std::endl;

            const unsigned argc = 2;
            Local<Value> argv[argc] = { Null(isolate), String::NewFromUtf8(isolate, (char*)buf) };

            cb->Call(isolate->GetCurrentContext()->Global(), argc, argv);
          }
          else
          {
            //isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "no reply")));
            const unsigned argc = 2;
            Local<Value> argv[argc] = { String::NewFromUtf8(isolate, "no reply"), Null(isolate) };
            cb->Call(isolate->GetCurrentContext()->Global(), argc, argv);
          }
        }
        else
        {
          //isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "sendtoWait failed")));
          const unsigned argc = 2;
          Local<Value> argv[argc] = { String::NewFromUtf8(isolate, "sendtoWait failed"), Null(isolate) };
          cb->Call(isolate->GetCurrentContext()->Global(), argc, argv);
        }
      }

      dataToSendLen = 0;
    }
  }*/

  void Init(const FunctionCallbackInfo<Value>& args){
    Isolate* isolate = Isolate::GetCurrent();
    HandleScope scope(isolate);

    if (args.Length() < 3) {
      isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Wrong number of arguments")));
      return;
    }

    if (!args[0]->IsString()) {
      isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Args[0] (Port) must be a string")));
      return;
    }

    if (!args[1]->IsNumber()) {
      isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Args[1] (Baud) must be a number")));
      return;
    }

    if (!args[2]->IsNumber()) {
      isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Args[2] (Adress) must be a number")));
      return;
    }

    String::Utf8Value port(args[0]->ToString());
    int baud = args[1]->NumberValue();
    int ownAddress = args[2]->NumberValue();

    hardwareserial = new HardwareSerial((char*)*port);
    driver = new RH_Serial(*hardwareserial);
    manager = new RHReliableDatagram(*driver, ownAddress);

    //manager.setThisAddress(ownAddress);

    driver->serial().begin(baud);

    if (!manager->init()){
      isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Init failed")));
      return;
    }

    args.GetReturnValue().Set(Undefined(isolate));
  }

  void Send(const FunctionCallbackInfo<Value>& args){
    Isolate* isolate = Isolate::GetCurrent();
    HandleScope scope(isolate);

    if (args.Length() < 4) {
      isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Wrong number of arguments")));
      return;
    }

    if (!args[0]->IsNumber()) {
      isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Args[0] (Address) must be a number")));
      return;
    }

    if (!args[1]->IsNumber()) {
      isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Args[1] (Len) must be a number")));
      return;
    }

    if (!args[2]->IsString() && !args[1]->IsObject()) {
      isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Args[2] (Message) must be a string or a buffer")));
      return;
    }

    if (!args[3]->IsFunction()) {
      isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Args[3] (Callback) must be a function")));
      return;
    }

    work->txAddr = (uint8_t) args[0]->NumberValue();
    uint8_t txLen = (uint8_t) args[1]->NumberValue();
    if(txLen > RH_SERIAL_MAX_MESSAGE_LEN){
      // Daten zu lang... Callback mit Fehlermeldung aufrufen
      args.GetReturnValue().Set(Undefined(isolate));
      const unsigned argc = 1;
      Local<Value> argv[argc] = {
        String::NewFromUtf8(isolate, "data too long")
      };
      Local<Function>::Cast(args[3])->Call(isolate->GetCurrentContext()->Global(), argc, argv);
      return;
    }

    // TODO Buffer verwenden
    String::Utf8Value string(args[2]->ToString());
    memcpy(&bufTx[0], (char*) *string, txLen);
    //std::cout << "dataToSend: " << unsigned(txLen) << " bytes -> " << *string << std::endl;

    // Länge übernehmen, damit die Daten gesendet werden
    work->txLen = txLen;

    //Local<Function> cb = Local<Function>::Cast(args[3]);
    work->txCallback.Reset(isolate, Local<Function>::Cast(args[3]));

    args.GetReturnValue().Set(Undefined(isolate));
  }


  void Available(const FunctionCallbackInfo<Value>& args){
    Isolate* isolate = Isolate::GetCurrent();
    HandleScope scope(isolate);

    args.GetReturnValue().Set(Boolean::New(isolate, manager->available()));
  }

  static void WorkAsync(uv_work_t *req){

    while(!work->stop && !work->rxRunCallback && !work->txRunCallback){
      //std::cout << "WorkAsync" << std::endl;

      if(manager->available()){
        // Daten empfangen
        //std::cout << "available" << std::endl;
        work->rxLen = sizeof(bufRx);
        if(manager->recvfromAck(bufRx, &work->rxLen, &work->rxAddr)){
          //std::cout << std::showbase << std::internal << std::setfill('0');
          //std::cout << "message from " << std::hex << std::setw(4) << (int)work->rxAddr << std::dec << " len(" << (int)work->rxLen << ")"
          //  << ": " << (char*)bufRx << std::endl;

          work->rxRunCallback = true;

        }else{
          // Empfangen der verfügbaren Daten nicht erfolgreich
          //std::cout << "invalid message" << std::endl;
          work->rxLen = 0;
          work->rxRunCallback = true;
        }

      }else if(work->txLen > 0){
        //std::cout << "sending " << (char*)bufTx << std::endl;
        // Daten senden
        if(manager->sendtoWait(bufTx, work->txLen, work->txAddr)){
          // erfolgreich gesendet
          //std::cout << "send ok" << std::endl;
          work->txOk = true;
        }else{
          // Senden fehlgeschlagen
          //std::cout << "send err" << std::endl;
          work->txOk = false;
        }
        work->txRunCallback = true;

        // Länge der zu sendenden Daten auf 0 setzen, da bereits gesendet
        work->txLen = 0;

      }else {
        // nichts zu tun... 50ms warten
        usleep(50000);
      }


    }
  }

  /**
   * Async-Arbeit abgeschlossen.
   * Callback-Funktion aufrufen mit entsprechenden Argumenten. (Error und Data)
   * Die Arbeit anschließend einstellen oder neu starten.
   */
  static void WorkAsyncComplete(uv_work_t *req, int status){
    Isolate * isolate = Isolate::GetCurrent();
    HandleScope scope(isolate);

    // ggf. RX-Callback ausführen
    if(work->rxRunCallback){
      // 4 Argumente für die Callback-Funktion...
      // Error, Sender-Adresse, Länge und Daten
      const unsigned argc = 4;
      Local<Value> argv[argc] = {
        Undefined(isolate),
        v8::Number::New(isolate, work->rxAddr),
        v8::Number::New(isolate, work->rxLen),
        Null(isolate)
      };

      if(work->rxLen > 0){
        // Daten empfangen
        //std::cout << "work->dataRx: " << work->dataRx << std::endl;
        argv[3] = String::NewFromUtf8(isolate, (char*) bufRx);
        //argv[2] = v8::ArrayBuffer::New(isolate, /*&bufRx,*/ work->rxLen);
        /*node::Buffer *slowBuffer = node::Buffer::New(RH_SERIAL_MAX_MESSAGE_LEN);
        memcpy(node::Buffer::Data(slowBuffer), bufRx, RH_SERIAL_MAX_MESSAGE_LEN);
        Local<Object> globalObj = v8::Context::GetCurrent()->Global();

        Local<Function> bufferConstructor = Local<Function>::Cast(globalObj->Get(String::NewFromUtf8("Buffer")));
        v8::Handle<v8::Value> constructorArgs[3] = { slowBuffer->handle_, v8::Integer::New(RH_SERIAL_MAX_MESSAGE_LEN), v8::Integer::New(0) };
        v8::Local<v8::Object> actualBuffer = bufferConstructor->NewInstance(3, constructorArgs);

        argv[2] = actualBuffer;*/

      }else{
        // Keine Daten empfangen
        argv[0] = String::NewFromUtf8(isolate, "nothing revcived");
      }

      // Callback-Funktion aufrufen
      Local<Function>::New(isolate, work->rxCallback)->
        Call(isolate->GetCurrentContext()->Global(), argc, argv);

    }

    // ggf. TX-Callback ausführen
    if(work->txRunCallback){
      const unsigned argc = 1;
      Local<Value> argv[argc] = {
        Undefined(isolate)
      };
      if(!work->txOk){
        argv[0] = String::NewFromUtf8(isolate, "sendToWait failed");
      }
      // Callback-Funktion aufrufen
      // TODO check if callback is set
      Local<Function>::New(isolate, work->txCallback)->
        Call(isolate->GetCurrentContext()->Global(), argc, argv);

      work->txCallback.Reset();
    }

    // Arbeit beenden oder erneut starten?
    if(work->stop){
      // Arbeit einstellen
      work->rxCallback.Reset();
      work->txCallback.Reset();
      delete work;
    }else{
      // Arbeit erneut starten
      work->rxRunCallback = false;
      work->rxLen = 0;
      work->txRunCallback = false;
      uv_queue_work(uv_default_loop(), &work->request, WorkAsync, WorkAsyncComplete);
    }
  }


  void StartAsyncWork(const FunctionCallbackInfo<Value>& args){
    Isolate* isolate = Isolate::GetCurrent();
    HandleScope scope(isolate);

    work = new Work();
    work->request.data = work;
    work->stop = false;
    work->rxRunCallback = false;
    work->rxLen = 0;
    work->txRunCallback = false;
    work->txLen = 0;
    work->txOk = false;

    Local<Function> callback = Local<Function>::Cast(args[0]);
    work->rxCallback.Reset(isolate, callback);

    work->txCallback.Reset();

    uv_queue_work(uv_default_loop(), &work->request, WorkAsync, WorkAsyncComplete);


    args.GetReturnValue().Set(Undefined(isolate));
  }


  void StopAsyncWork(const FunctionCallbackInfo<Value>& args){
    Isolate* isolate = Isolate::GetCurrent();
    HandleScope scope(isolate);

    std::cout << "NodeJS-Addon Stop" << std::endl;
    work->stop = true;

    args.GetReturnValue().Set(Undefined(isolate));
  }

  static void atExit(void*){
    delete manager;
    delete driver;
    delete hardwareserial;

    std::cout << "NodeJS-Addon End" << std::endl;
  }

  /**
  * init function declares what we will make visible to node
  */
  void initNode(Local<Object> exports) {
    start_millis = time_in_millis();

    NODE_SET_METHOD(exports, "init", Init);
    NODE_SET_METHOD(exports, "send", Send);
    NODE_SET_METHOD(exports, "available", Available);
    NODE_SET_METHOD(exports, "start", StartAsyncWork);
    NODE_SET_METHOD(exports, "stop", StopAsyncWork);

    AtExit(atExit);


  }

  NODE_MODULE(radiohead, initNode)
}
