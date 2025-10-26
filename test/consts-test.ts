/*
 * Node.js module radiohead-serial
 *
 * Copyright (c) 2017-2025 Peter Müller <peter@crycode.de> (https://crycode.de/)
 *
 * Node.js module for communication between some RadioHead nodes and Node.js using
 * the RH_Serial driver and the RHReliableDatagram manager of the RadioHead library.
 *
 *
 * RadioHead Library (http://www.airspayce.com/mikem/arduino/RadioHead/)
 * Copyright (c) 2014 Mike McCauley
 *
 * Port from native C/C++ code to TypeScript
 * Copyright (c) 2017-2025 Peter Müller <peter@crycode.de> (https://crycode.de/)
 */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { suite, test } from 'mocha-typescript';
import expect = require('expect.js');

import {
  RH_BROADCAST_ADDRESS, RH_DEFAULT_RETRIES, RH_DEFAULT_TIMEOUT, RH_FLAGS_ACK,
  RH_FLAGS_APPLICATION_SPECIFIC, RH_FLAGS_NONE, RH_FLAGS_RESERVED,
  RH_SERIAL_HEADER_LEN, RH_SERIAL_MAX_MESSAGE_LEN, RH_SERIAL_MAX_PAYLOAD_LEN,
  version,
} from '../src/radiohead-serial';

/****************
 * Check consts *
 ****************/
@suite('check consts') class CheckConsts {
  @test 'version of package.json and exported version' () {
    const pkg = require('../../package.json') as { version: string };
    expect(pkg.version).to.be(version);
  }

  @test 'RH_BROADCAST_ADDRESS 0xff' () {
    expect(RH_BROADCAST_ADDRESS).to.be(0xff);
  }

  @test 'RH_FLAGS_RESERVED 0xf0' () {
    expect(RH_FLAGS_RESERVED).to.be(0xf0);
  }

  @test 'RH_FLAGS_APPLICATION_SPECIFIC 0x0f' () {
    expect(RH_FLAGS_APPLICATION_SPECIFIC).to.be(0x0f);
  }

  @test 'RH_FLAGS_NONE 0' () {
    expect(RH_FLAGS_NONE).to.be(0);
  }

  @test 'RH_SERIAL_MAX_PAYLOAD_LEN 64' () {
    expect(RH_SERIAL_MAX_PAYLOAD_LEN).to.be(64);
  }

  @test 'RH_SERIAL_HEADER_LEN 4' () {
    expect(RH_SERIAL_HEADER_LEN).to.be(4);
  }

  @test 'RH_SERIAL_MAX_MESSAGE_LEN 60' () {
    expect(RH_SERIAL_MAX_MESSAGE_LEN).to.be(60);
  }

  @test 'RH_FLAGS_ACK 0x80' () {
    expect(RH_FLAGS_ACK).to.be(0x80);
  }

  @test 'RH_DEFAULT_TIMEOUT 200' () {
    expect(RH_DEFAULT_TIMEOUT).to.be(200);
  }

  @test 'RH_DEFAULT_RETRIES 3' () {
    expect(RH_DEFAULT_RETRIES).to.be(3);
  }
}
