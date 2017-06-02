/*
 * Node.js module radiohead-serial
 *
 * RadioHead Library (http://www.airspayce.com/mikem/arduino/RadioHead/)
 * Copyright (c) 2014 Mike McCauley
 *
 * Port from native C/C++ code to TypeScript
 * Copyright (c) 2017 Peter Müller <peter@crycode.de> (https://crycode.de/)
 */

/** This is the address that indicates a broadcast */
export const RH_BROADCAST_ADDRESS = 0xff;

export const RH_FLAGS_RESERVED = 0xf0;
export const RH_FLAGS_APPLICATION_SPECIFIC = 0x0f;
export const RH_FLAGS_NONE = 0;

/**
 * Interface for a received message.
 */
export interface RH_ReceivedMessage {
  data:Buffer;
  len:number;
  headerTo:number;
  headerFrom:number;
  headerId:number;
  headerFlags:number;
}
