/*
 * NodeJS RadioHead Serial
 *
 * Copyright (c) 2017 Peter Müller <peter@crycode.de> (https://crycode.de/)
 *
 * NodeJS Addon for communication between some RadioHead nodes and NodeJS using
 * the RH_Serial driver of the RadioHead library.
 */

#ifndef NODE_RADIOHEAD_SERIAL_h
#define NODE_RADIOHEAD_SERIAL_h

#include <nan.h>

namespace radioHeadSerialAddon {

  // Pointer for RadioHead
  HardwareSerial * hardwareserial;
  RH_Serial * driver;
  RHReliableDatagram * manager;

  // Struct for the asynchronous work in background
  struct Work {
    uv_work_t request;

    Nan::Persistent<v8::Function> rxCallback;
    Nan::Persistent<v8::Function> txCallback;
    Nan::Persistent<v8::Function> stopCallback;

    bool rxRunCallback;
    bool txRunCallback;

    uint8_t rxLen;
    uint8_t rxFrom;
    uint8_t rxTo;
    uint8_t rxId;
    uint8_t rxFlags;

    uint8_t txLen;
    uint8_t txTo;

    bool txOk;

    bool stop;
  };

  // Pointer to the asynchronous work in background
  Work * work;

  // RX/TX Buffer
  uint8_t bufRx[RH_SERIAL_MAX_MESSAGE_LEN];
  uint8_t bufTx[RH_SERIAL_MAX_MESSAGE_LEN];

  // Functions
  void Init(const Nan::FunctionCallbackInfo<v8::Value>& info);
  void Send(const Nan::FunctionCallbackInfo<v8::Value>& info);
  static void WorkAsync(uv_work_t *req);
  static void WorkAsyncComplete(uv_work_t *req, int status);
  void StartAsyncWork(const Nan::FunctionCallbackInfo<v8::Value>& info);
  void StopAsyncWork(const Nan::FunctionCallbackInfo<v8::Value>& info);
  void SetAddress(const Nan::FunctionCallbackInfo<v8::Value>& info);
  void SetRetries(const Nan::FunctionCallbackInfo<v8::Value>& info);
  void GetRetries(const Nan::FunctionCallbackInfo<v8::Value>& info);
  void SetTimeout(const Nan::FunctionCallbackInfo<v8::Value>& info);
  void GetRetransmissions(const Nan::FunctionCallbackInfo<v8::Value>& info);
  void ResetRetransmissions(const Nan::FunctionCallbackInfo<v8::Value>& info);
  void SetPromiscuous(const Nan::FunctionCallbackInfo<v8::Value>& info);
  static void atExit(void*);
  void initNode(v8::Local<v8::Object> exports);
}

#endif
