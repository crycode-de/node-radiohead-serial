/*
 * Node.js module radiohead-serial
 *
 * Copyright (c) 2017 Peter Müller <peter@crycode.de> (https://crycode.de/)
 *
 * Node.js module for communication between some RadioHead nodes and Node.js using
 * the RH_Serial driver and the RHReliableDatagram manager of the RadioHead library.
 *
 *
 * RadioHead Library (http://www.airspayce.com/mikem/arduino/RadioHead/)
 * Copyright (c) 2014 Mike McCauley
 *
 * Port from native C/C++ code to TypeScript
 * Copyright (c) 2017 Peter Müller <peter@crycode.de> (https://crycode.de/)
 */

import { suite, test, slow, timeout, skip, only } from "mocha-typescript";
import expect = require('expect.js');

import {RHcrc_ccitt_update} from '../src/RHCRC';

@suite('RHCRC') class RHCRC {

  @test 'RHcrc_ccitt_update 42 127 should be 21811' (){
    let crc = 0;
    crc = RHcrc_ccitt_update(crc,42);
    crc = RHcrc_ccitt_update(crc,127);
    expect(crc).to.be(21811);
  }

  @test 'RHcrc_ccitt_update 255 255 should be 61624' (){
    let crc = 0;
    crc = RHcrc_ccitt_update(crc,255);
    crc = RHcrc_ccitt_update(crc,255);
    expect(crc).to.be(61624);
  }
}
