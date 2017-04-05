/*
 * Node.js RadioHead Serial
 *
 * Copyright (c) 2017 Peter Müller <peter@crycode.de> (https://crycode.de/)
 *
 * Node.js Addon for communication between some RadioHead nodes and Node.js using
 * the RH_Serial driver and the RHReliableDatagram manager of the RadioHead library.
 */

#include <nan.h>
#include "functions.h"
#include "rh-serial.h"

/**
 * Initialisation of the addon.
 */
void InitAll(v8::Local<v8::Object> exports) {

  // set the start time (needed for RadioHead)
  start_millis = time_in_millis();

  // init the RadioHeadSerial class and wrap it as Node.js object
  RadioHeadSerial::Init(exports);
}

NODE_MODULE(addon, InitAll)
