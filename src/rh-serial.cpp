#include <nan.h>
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
    Nan::Persistent<v8::Function> rxCallback;
    Nan::Persistent<v8::Function> txCallback;

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
      Nan::ThrowError("Args[2] (Adress) must be a number");
      return;
    }

    v8::String::Utf8Value port(info[0]->ToString());
    int baud = info[1]->NumberValue();
    int ownAddress = info[2]->NumberValue();

    hardwareserial = new HardwareSerial((char*)*port);
    driver = new RH_Serial(*hardwareserial);
    manager = new RHReliableDatagram(*driver, ownAddress);

    //manager.setThisAddress(ownAddress);

    driver->serial().begin(baud);

    if (!manager->init()){
      Nan::ThrowError("Init failed");
      return;
    }

    info.GetReturnValue().Set(Nan::Undefined());
  }

  void Send(const Nan::FunctionCallbackInfo<v8::Value>& info){

    if (info.Length() < 4) {
      Nan::ThrowError("Wrong number of arguments");
      return;
    }

    if (!info[0]->IsNumber()) {
      Nan::ThrowError("Args[0] (Address) must be a number");
      return;
    }

    if (!info[1]->IsNumber()) {
      Nan::ThrowError("Args[1] (Len) must be a number");
      return;
    }

    if (!info[2]->IsString() && !info[2]->IsObject()) {
      Nan::ThrowError("Args[2] (Data) must be a string or a buffer");
      return;
    }

    if (!info[3]->IsFunction()) {
      Nan::ThrowError("Args[3] (Callback) must be a function");
      return;
    }

    v8::Local<v8::Function> callback = info[3].As<v8::Function>();

    work->txAddr = (uint8_t) info[0]->NumberValue();
    uint8_t txLen = (uint8_t) info[1]->NumberValue();
    if(txLen > RH_SERIAL_MAX_MESSAGE_LEN){
      // Daten zu lang... Callback mit Fehlermeldung aufrufen
      info.GetReturnValue().Set(Nan::Undefined());
      const unsigned argc = 1;
      v8::Local<v8::Value> argv[argc] = {
        Nan::Error("data too long")
      };
      Nan::MakeCallback(Nan::GetCurrentContext()->Global(), callback, argc, argv);
      return;
    }

    // TODO Buffer verwenden
    v8::String::Utf8Value string(info[2]->ToString());
    memcpy(&bufTx[0], (char*) *string, txLen);
    //std::cout << "dataToSend: " << unsigned(txLen) << " bytes -> " << *string << std::endl;

    // Länge übernehmen, damit die Daten gesendet werden
    work->txLen = txLen;

    work->txCallback.Reset(callback);

    info.GetReturnValue().Set(Nan::Undefined());
  }

  void Available(const Nan::FunctionCallbackInfo<v8::Value>& info){
    if(manager->available()){
      info.GetReturnValue().Set(Nan::True());
    }else{
      info.GetReturnValue().Set(Nan::False());
    }
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
    // HandleScope wird hier explizit benötigt, da dies keine eigentlich NaN-Methode ist
    Nan::HandleScope scope;

    // ggf. RX-Callback ausführen
    if(work->rxRunCallback){
      // 4 Argumente für die Callback-Funktion...
      // Error, Sender-Adresse, Länge und Daten
      const unsigned argc = 4;
      v8::Local<v8::Value> argv[argc] = {
        Nan::Undefined(),
        Nan::New(work->rxAddr),
        Nan::New(work->rxLen),
        Nan::Undefined()
      };

      if(work->rxLen > 0){
        // Daten empfangen
        //std::cout << "work->dataRx: " << work->dataRx << std::endl;
        argv[3] = Nan::New((char*) bufRx).ToLocalChecked();
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
        argv[0] = Nan::Error("nothing revcived");
      }

      // Callback-Funktion aufrufen
      v8::Local<v8::Function> callback = Nan::New(work->rxCallback);
      Nan::MakeCallback(Nan::GetCurrentContext()->Global(), callback, argc, argv);

    }

    // ggf. TX-Callback ausführen
    if(work->txRunCallback){
      const unsigned argc = 1;
      v8::Local<v8::Value> argv[argc] = {
        Nan::Undefined()
      };
      if(!work->txOk){
        argv[0] = Nan::Error("sendToWait failed");
      }
      // Callback-Funktion aufrufen
      // TODO check if callback is set
      v8::Local<v8::Function> callback = Nan::New(work->txCallback);
      Nan::MakeCallback(Nan::GetCurrentContext()->Global(), callback, argc, argv);

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


  void StartAsyncWork(const Nan::FunctionCallbackInfo<v8::Value>& info){

    if (!info[0]->IsFunction()) {
      Nan::ThrowError("Args[0] (Callback) must be a function");
      return;
    }

    work = new Work();
    work->request.data = work;
    work->stop = false;
    work->rxRunCallback = false;
    work->rxLen = 0;
    work->txRunCallback = false;
    work->txLen = 0;
    work->txOk = false;

    v8::Local<v8::Function> callback = info[0].As<v8::Function>();
    work->rxCallback.Reset(callback);

    work->txCallback.Reset();

    uv_queue_work(uv_default_loop(), &work->request, WorkAsync, WorkAsyncComplete);


    info.GetReturnValue().Set(Nan::Undefined());
  }


  void StopAsyncWork(const Nan::FunctionCallbackInfo<v8::Value>& info){
    std::cout << "NodeJS-Addon Stop" << std::endl;
    work->stop = true;

    info.GetReturnValue().Set(Nan::Undefined());
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
  void initNode(v8::Local<v8::Object> exports) {
    start_millis = time_in_millis();

    exports->Set(Nan::New("init").ToLocalChecked(), Nan::New<v8::FunctionTemplate>(Init)->GetFunction());
    exports->Set(Nan::New("send").ToLocalChecked(), Nan::New<v8::FunctionTemplate>(Send)->GetFunction());
    exports->Set(Nan::New("available").ToLocalChecked(), Nan::New<v8::FunctionTemplate>(Available)->GetFunction());
    exports->Set(Nan::New("start").ToLocalChecked(), Nan::New<v8::FunctionTemplate>(StartAsyncWork)->GetFunction());
    exports->Set(Nan::New("stop").ToLocalChecked(), Nan::New<v8::FunctionTemplate>(StopAsyncWork)->GetFunction());

    node::AtExit(atExit);


  }

  NODE_MODULE(radiohead, initNode)
}
