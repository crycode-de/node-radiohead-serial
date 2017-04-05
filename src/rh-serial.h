/*
 * Node.js RadioHead Serial
 *
 * Copyright (c) 2017 Peter Müller <peter@crycode.de> (https://crycode.de/)
 *
 * Node.js Addon for communication between some RadioHead nodes and Node.js using
 * the RH_Serial driver and the RHReliableDatagram manager of the RadioHead library.
 */

#ifndef NODE_RADIOHEAD_SERIAL_h
#define NODE_RADIOHEAD_SERIAL_h

#include <nan.h>

#include <RHGenericDriver.h>
#include <RHReliableDatagram.h>
#include <RH_Serial.h>
#include <RHutil/HardwareSerial.h>

#define WORKER_DEFAULT_SLEEPTIME 50000 // 50ms

class RadioHeadSerial : public Nan::ObjectWrap {

  // Struct used for the asynchronous worker
  struct Work {
    uv_work_t request;

    // reference to the RadioHeadSerial instance this work belongs to
    RadioHeadSerial * rhs;

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

    // time in usec the worker should sleep between actions
    int sleepTime;
  };

  public:
    static void Init(v8::Local<v8::Object> exports);

  private:
    explicit RadioHeadSerial(void);
    ~RadioHeadSerial();

    static void New(const Nan::FunctionCallbackInfo<v8::Value>& info);
    static void InitRH(const Nan::FunctionCallbackInfo<v8::Value>& info);
    static void Send(const Nan::FunctionCallbackInfo<v8::Value>& info);
    static void WorkAsync(uv_work_t *req);
    static void WorkAsyncComplete(uv_work_t *req, int status);
    static void StartAsyncWork(const Nan::FunctionCallbackInfo<v8::Value>& info);
    static void StopAsyncWork(const Nan::FunctionCallbackInfo<v8::Value>& info);
    static void SetAddress(const Nan::FunctionCallbackInfo<v8::Value>& info);
    static void SetRetries(const Nan::FunctionCallbackInfo<v8::Value>& info);
    static void GetRetries(const Nan::FunctionCallbackInfo<v8::Value>& info);
    static void SetTimeout(const Nan::FunctionCallbackInfo<v8::Value>& info);
    static void GetRetransmissions(const Nan::FunctionCallbackInfo<v8::Value>& info);
    static void ResetRetransmissions(const Nan::FunctionCallbackInfo<v8::Value>& info);
    static void SetPromiscuous(const Nan::FunctionCallbackInfo<v8::Value>& info);
    static void SetWorkerSleepTime(const Nan::FunctionCallbackInfo<v8::Value>& info);
    static void Destroy(const Nan::FunctionCallbackInfo<v8::Value>& info);

    // Constructor for the Node.js construction of a new instance of this class
    static Nan::Persistent<v8::Function> constructor;

    // Pointer to the instances of the RadioHead classes
    HardwareSerial * hardwareserial;
    RH_Serial * driver;
    RHReliableDatagram * manager;

    // Pointer to the asynchronous work in background
    Work * work;

    // If the worker is currently active
    bool workerActive;

    // RX/TX Buffer
    uint8_t bufRx[RH_SERIAL_MAX_MESSAGE_LEN];
    uint8_t bufTx[RH_SERIAL_MAX_MESSAGE_LEN];
};

#endif
