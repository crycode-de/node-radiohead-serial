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
/* eslint-disable no-console */

import { suite, test } from 'mocha-typescript';
import expect = require('expect.js');

import { ChildProcess, spawn } from 'child_process';

import { RadioHeadSerial, RH_BROADCAST_ADDRESS, RH_ReceivedMessage } from '../src/radiohead-serial';

let socat: ChildProcess;

let tty1: string | null = null;
let tty2: string | null = null;

let rhs1: RadioHeadSerial | null = null;
let rhs2: RadioHeadSerial | null = null;

/************************************
 * Prepare virtual tty's with socat *
*************************************/
@suite('prepare virtual tty\'s with socat') class SocatPrepare {

  @test 'spawn socat' (done: (error?: unknown) => void) {
    socat = spawn('socat', [ '-d', '-d', 'pty,raw,echo=0', 'pty,raw,echo=0' ]);

    socat.on('error', (error) => {
      console.log('Error spawning `socat -d -d pty,raw,echo=0 pty,raw,echo=0`!');
      console.log(error);
      done(error);
    });

    socat.stderr?.on('data', (data: Buffer) => {
      const parts = data.toString().split('\n');
      for (const part of parts) {
        const m = /PTY is (\/dev.*)$/.exec(part);
        if (m) {
          if (tty1 === null) {
            tty1 = m[1];
          } else if (tty2 === null) {
            tty2 = m[1];
            setTimeout(done, 50);
          }
        }
      }
    });
  }

  @test 'check the tty\'s created by socat' () {
    expect(tty1).to.match(/^\/dev\/[/a-zA-Z]+\d+$/);
    expect(tty2).to.match(/^\/dev\/[/a-zA-Z]+\d+$/);
  }
}

/******************************************
 * Check the RadioHeadSerial constructors *
 ******************************************/
// eslint-disable-next-line @typescript-eslint/naming-convention
@suite('check the RadioHeadSerial constructors') class RHS_Constructor {
  @test 'object as argument' (done: (error?: unknown) => void) {
    const rhs = new RadioHeadSerial({
      port: tty1!,
      baud: 9600,
      address: 0x01,
      reliable: true,
      autoInit: true,
    });
    rhs.on('error', (err) => {
      void rhs.close()
        .catch(() => { /* noop */ }).then(() => done(err));
    });
    rhs.on('init-done', () => {
      void rhs.close()
        .then(() => done());
    });
  }

  @test 'object with port only as argument' (done: (error?: unknown) => void) {
    const rhs = new RadioHeadSerial({
      port: tty1!,
    });
    rhs.on('error', (err) => {
      void rhs.close()
        .catch(() => { /* noop */ }).then(() => done(err));
    });
    rhs.on('init-done', () => {
      void rhs.close()
        .then(() => done());
    });
  }

  @test 'single arguments' (done: (error?: unknown) => void) {
    const rhs = new RadioHeadSerial(tty1!, 9600, 0x01, true);
    rhs.on('error', (err) => {
      void rhs.close()
        .catch(() => { /* noop */ }).then(() => done(err));
    });
    rhs.on('init-done', () => {
      void rhs.close()
        .then(() => done());
    });
  }

  @test 'object as argument, non existent port, no autoInit' (done: (error?: unknown) => void) {
    const rhs = new RadioHeadSerial({
      port: '/dev/ttyNonExistent',
      baud: 9600,
      address: 0x01,
      reliable: true,
      autoInit: false,
    });
    rhs.init()
      .then(() => {
        done(new Error('Init successfull, but this should not happen'));
      })
      .catch((err) => {
        // this is expected
        if (rhs.isInitDone()) {
          // should not happen
          done(new Error('isInitDone() reported true but should be false'));
        } else {
          done();
        }
      });
  }

  @test 'undefined options should throw an error' (done: (error?: unknown) => void) {
    try {
      // @ts-expect-error should throw an error
      const rhs = new RadioHeadSerial(undefined);
      done(new Error('Empty port should throw an error'));
    } catch (e) {
      // this is expected
      done();
    }
  }

  @test 'number as argument should throw an error' (done: (error?: unknown) => void) {
    try {
      // @ts-expect-error should throw an error
      const rhs = new RadioHeadSerial(42 as unknown);
      done(new Error('A number as argument should throw an error'));
    } catch (e) {
      // this is expected
      done();
    }
  }

  @test 'undefined port should throw an error' (done: (error?: unknown) => void) {
    try {
      // @ts-expect-error should throw an error
      const rhs = new RadioHeadSerial({ port: undefined });
      done(new Error('Undefined port should throw an error'));
    } catch (e) {
      // this is expected
      done();
    }
  }

  @test 'empty port should throw an error' (done: (error?: unknown) => void) {
    try {
      const rhs = new RadioHeadSerial({ port: '' });
      done(new Error('Empty port should throw an error'));
    } catch (e) {
      // this is expected
      done();
    }
  }
}

/***************************************
 * Start two RadioHeadSerial instances *
 ***************************************/
// eslint-disable-next-line @typescript-eslint/naming-convention
@suite('create the two RadioHeadSerial instances') class RHS_Start {
  @test 'create rhs1 (address 0x01)' (done: (error?: unknown) => void) {
    rhs1 = new RadioHeadSerial({
      port: tty1!,
      baud: 9600,
      address: 0x01,
    });
    rhs1.on('error', (err) => {
      void rhs1!.close()
        .catch(() => { /* noop */ }).then(() => done(err));
    });
    rhs1.on('init-done', () => {
      done();
    });
  }

  @test 'create rhs2 (address 0x02)' (done: (error?: unknown) => void) {
    rhs2 = new RadioHeadSerial({
      port: tty2!,
      baud: 9600,
      address: 0x02,
    });
    rhs2.on('error', (err) => {
      void rhs2!.close()
        .catch(() => { /* noop */ }).then(() => done(err));
    });
    rhs2.on('init-done', () => {
      done();
    });
  }
}

/*****************************
 * Send and receive messages *
 *****************************/
@suite('send and receive messages') class SendRecv {

  @test 'from 0x01 to 0x02' (done: (error?: unknown) => void) {
    const sendData = Buffer.from('Hey beauty!'); // data to be sent

    // function for received messages on rhs2
    const recvListener = (msg: RH_ReceivedMessage) => {
      // remove the listener function from the emitter
      rhs2!.removeListener('data', recvListener);

      if (msg.data.compare(sendData) === 0) {
        done();
      } else {
        done(new Error('The received data does not match the sent data'));
      }
    };

    // attach the listener function to the emitter
    rhs2!.on('data', recvListener);

    // send data
    rhs1!.send(0x02, sendData).catch((err) => {
      done(err);
    });
  }

  @test 'from 0x02 to 0x01' (done: (error?: unknown) => void) {
    const sendData = Buffer.from('Here we go!'); // data to be sent

    // function for received messages on rhs2
    const recvListener = (msg: RH_ReceivedMessage) => {
      // remove the listener function from the emitter
      rhs1!.removeListener('data', recvListener);

      if (msg.data.compare(sendData) === 0) {
        done();
      } else {
        done(new Error('The received data does not match the sent data'));
      }
    };

    // attach the listener function to the emitter
    rhs1!.on('data', recvListener);

    // send data
    rhs2!.send(0x01, sendData).catch((err) => {
      done(err);
    });
  }

  @test 'from 0x01 to 0x02 with limited data length' (done: (error?: unknown) => void) {
    const sendData = Buffer.from('Hey beauty!'); // data to be sent

    // function for received messages on rhs2
    const recvListener = (msg: RH_ReceivedMessage) => {
      // remove the listener function from the emitter
      rhs2!.removeListener('data', recvListener);

      const sendDataPart = Buffer.from('Hey');
      if (msg.data.compare(sendDataPart) === 0) {
        done();
      } else {
        done(new Error('The received data does not match the sent data'));
      }
    };

    // attach the listener function to the emitter
    rhs2!.on('data', recvListener);

    // send data
    rhs1!.send(0x02, sendData, 3).catch((err) => {
      done(err);
    });
  }

  @test 'from 0x01 to 0x02 with control characters' (done: (error?: unknown) => void) {
    const sendData = Buffer.from('abcdef'); // data to be sent
    sendData[1] = 0x02; // STX
    sendData[2] = 0x03; // ETX
    sendData[3] = 0x10; // DLE
    sendData[4] = 0x16; // SYN

    // function for received messages on rhs2
    const recvListener = (msg: RH_ReceivedMessage) => {
      // remove the listener function from the emitter
      rhs2!.removeListener('data', recvListener);

      if (msg.data.compare(sendData) === 0) {
        done();
      } else {
        done(new Error('The received data does not match the sent data'));
      }
    };

    // attach the listener function to the emitter
    rhs2!.on('data', recvListener);

    // send data
    rhs1!.send(0x02, sendData).catch((err) => {
      done(err);
    });
  }

  @test 'from 0x01 to broadcast' (done: (error?: unknown) => void) {
    const sendData = Buffer.from('Hey beauty!'); // data to be sent

    // function for received messages on rhs2
    const recvListener = (msg: RH_ReceivedMessage) => {
      // remove the listener function from the emitter
      rhs2!.removeListener('data', recvListener);

      if (msg.headerTo !== RH_BROADCAST_ADDRESS) {
        done(new Error('The headerTo does not RH_BROADCAST_ADDRESS'));
        return;
      }

      if (msg.data.compare(sendData) === 0) {
        done();
      } else {
        done(new Error('The received data does not match the sent data'));
      }
    };

    // attach the listener function to the emitter
    rhs2!.on('data', recvListener);

    // send data
    rhs1!.send(RH_BROADCAST_ADDRESS, sendData).catch((err) => {
      done(err);
    });
  }

  @test 'from 0x01 to 0x42 should fail' (done: (error?: unknown) => void) {
    const sendData = Buffer.from('Hey beauty!'); // data to be sent

    // send data
    rhs1!.send(0x42, sendData).catch((err) => {
      done();
    });
  }

  @test 'from 0x01 to 0x02 with zero data should fail' (done: (error?: unknown) => void) {
    const sendData = Buffer.alloc(0); // data to be sent

    // send data
    rhs1!.send(0x02, sendData).catch((err) => {
      done();
    });
  }
}

@suite('test functions') class TestFunctions {
  @test 'isInitDone()' (done: (error?: unknown) => void) {
    if (rhs2!.isInitDone()) {
      done();
    } else {
      done(new Error('isInitDone() is false but should be true'));
    }
  }

  @test 'setAddress(0x05)' () {
    rhs2!.setAddress(0x05);
  }

  @test 'thisAddress()' (done: (error?: unknown) => void) {
    if (rhs2!.thisAddress() === 0x05) {
      done();
    } else {
      done(new Error('thisAddress() did not report the set address'));
    }
  }

  @test 'setRetries(7)' () {
    rhs1!.setRetries(7);
  }

  @test 'getRetries()' (done: (error?: unknown) => void) {
    if (rhs1!.getRetries() === 7) {
      done();
    } else {
      done(new Error('getRetries() did not report the set number of retries'));
    }
  }

  @test 'setTimeout(100)' () {
    rhs1!.setTimeout(100);
  }

  @test 'getRetransmissions()' () {
    const retransmissions = rhs1!.getRetransmissions();
    expect(retransmissions).to.be.a('number');
  }

  @test 'resetRetransmissions()' () {
    rhs1!.resetRetransmissions();
  }

  @test 'setPromiscuous(true)' () {
    rhs1!.setPromiscuous(true);
  }
}

/*****************************
 * Send and receive messages *
 *****************************/
@suite('send and receive messages') class SendRecv2 {
  @test 'from 0x01 to 0x05' (done: (error?: unknown) => void) {
    const sendData = Buffer.from('Hey beauty!'); // data to be sent

    // function for received messages on rhs2
    const recvListener = (msg: RH_ReceivedMessage) => {
      // remove the listener function from the emitter
      rhs2!.removeListener('data', recvListener);

      if (msg.data.compare(sendData) === 0) {
        done();
      } else {
        done(new Error('The received data does not match the sent data'));
      }
    };

    // attach the listener function to the emitter
    rhs2!.on('data', recvListener);

    // send data
    rhs1!.send(0x05, sendData).catch((err) => {
      done(err);
    });
  }

  @test 'from 0x05 to 0x42 (0x01 with promiscuous mode)' (done: (error?: unknown) => void) {
    const sendData = Buffer.from('Hey beauty!'); // data to be sent

    // function for received messages on rhs2
    const recvListener = (msg: RH_ReceivedMessage) => {
      // remove the listener function from the emitter
      rhs1!.removeListener('data', recvListener);

      if (msg.data.compare(sendData) === 0) {
        done();
      } else {
        done(new Error('The received data does not match the sent data'));
      }
    };

    // attach the listener function to the emitter
    rhs1!.on('data', recvListener);

    // send data
    rhs2!.send(0x42, sendData).catch((err) => {
      done(err);
    });
  }
}

/***********
 * Cleanup *
 ***********/
@suite('cleanup') class Cleanup {
  @test 'close rhs1' (done: (error?: unknown) => void) {
    void rhs1!.close()
      .then(() => done());
  }

  @test 'close rhs2' (done: (error?: unknown) => void) {
    void rhs2!.close()
      .then(() => done());
  }

  @test 'kill socat' (done: (error?: unknown) => void) {
    socat.on('close', (code) => {
      done();
    });
    socat.kill();
  }
}
