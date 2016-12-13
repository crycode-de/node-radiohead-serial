/*
 * NodeJS RadioHead RH_Serial
 *
 * (c) 2016 Peter Müller <peter@crycode.de> (https://crycode.de/)
 *
 * NodeJS Addon for communiation between some RadioHead nodes and NodeJS using
 * the RH_Serial driver of the RadioHead library.
 */

#ifndef NODE_RADIOHEAD_SERIAL_h
#define NODE_RADIOHEAD_SERIAL_h

#include <nan.h>

namespace radioHeadSerialAddon {

  // Pointer für RadioHead
  HardwareSerial * hardwareserial;
  RH_Serial * driver;
  RHReliableDatagram * manager;

  // Struct für die Arbeiten im Hintergrund
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

  // Pointer auf die Arbeit im Hintergrund
  Work * work;

  // RX/TX Buffer
  uint8_t bufRx[RH_SERIAL_MAX_MESSAGE_LEN];
  uint8_t bufTx[RH_SERIAL_MAX_MESSAGE_LEN];

  // Funktionen
  void Init(const Nan::FunctionCallbackInfo<v8::Value>& info);
  void Send(const Nan::FunctionCallbackInfo<v8::Value>& info);
  static void WorkAsync(uv_work_t *req);
  static void WorkAsyncComplete(uv_work_t *req, int status);
  void StartAsyncWork(const Nan::FunctionCallbackInfo<v8::Value>& info);
  void StopAsyncWork(const Nan::FunctionCallbackInfo<v8::Value>& info);
  static void atExit(void*);
  void initNode(v8::Local<v8::Object> exports);
}

#endif
