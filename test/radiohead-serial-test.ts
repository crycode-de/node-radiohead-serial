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

import {spawn, ChildProcess} from 'child_process';

import {RadioHeadSerial, RH_ReceivedMessage, RH_BROADCAST_ADDRESS} from '../src/radiohead-serial';

let socat:ChildProcess;

let tty1:string = null;
let tty2:string = null;

let rhs1:RadioHeadSerial = null;
let rhs2:RadioHeadSerial = null;

//////////////////////////////////////
// Prepare virtual tty's with socat //
//////////////////////////////////////
@suite('prepare virtual tty\'s with socat') class SocatPrepare {

  @test 'spawn socat' (done){
    socat = spawn('socat', ['-d', '-d', 'pty,raw,echo=0', 'pty,raw,echo=0']);

    socat.on('error', (error)=>{
      console.log('Error spawning `socat -d -d pty,raw,echo=0 pty,raw,echo=0`!');
      console.log(error);
      done(error);
    });

    socat.stderr.on('data', (data)=>{
      let parts = data.toString().split('\n');
      for(let i = 0; i < parts.length; i++){
        let m = parts[i].match(/PTY is (\/dev.*)$/);
        if(m){
          if(tty1 === null){
            tty1 = m[1];
          }else if(tty2 === null){
            tty2 = m[1];
            setTimeout(done, 50);
          }
        }
      }
    });
  }


  @test 'check the tty\'s created by socat' (){
    expect(tty1).to.match(/^\/dev\/[\/a-zA-Z]+\d+$/);
    expect(tty2).to.match(/^\/dev\/[\/a-zA-Z]+\d+$/);
  }
}

/////////////////////////////////////////
// Start two RadioHeadSerial instances //
/////////////////////////////////////////
@suite('create the two RadioHeadSerial instances') class RHS_Start {
  @test 'create rhs1 (address 0x01)' (done){
    rhs1 = new RadioHeadSerial(tty1, 9600, 0x01);
    rhs1.on('init-done', ()=>{
      done();
    });
  }
  @test 'create rhs2 (address 0x02)' (done){
    rhs2 = new RadioHeadSerial(tty2, 9600, 0x02);
    rhs2.on('init-done', ()=>{
      done();
    });
  }
}

///////////////////////////////
// Send and receive messages //
///////////////////////////////
@suite('send and receive messages') class SendRecv {

  @test 'from 0x01 to 0x02' (done){
    const sendData = new Buffer('Hey beauty!'); // data to be sent

    // function for received messages on rhs2
    let recvListener = (msg:RH_ReceivedMessage)=>{
      // remove the listener function from the emitter
      rhs2.removeListener('data', recvListener);

      if(msg.data.compare(sendData) === 0){
        done();
      }else{
        done(new Error('The received data does not match the sent data'));
      }
    }

    // attach the listener function to the emitter
    rhs2.on('data', recvListener);

    // send data
    rhs1.send(0x02, sendData).catch((err)=>{
      done(err);
    });
  }

  @test 'from 0x02 to 0x01' (done){
    const sendData = new Buffer('Here we go!'); // data to be sent

    // function for received messages on rhs2
    let recvListener = (msg:RH_ReceivedMessage)=>{
      // remove the listener function from the emitter
      rhs1.removeListener('data', recvListener);

      if(msg.data.compare(sendData) === 0){
        done();
      }else{
        done(new Error('The received data does not match the sent data'));
      }
    }

    // attach the listener function to the emitter
    rhs1.on('data', recvListener);

    // send data
    rhs2.send(0x01, sendData).catch((err)=>{
      done(err);
    });
  }

  @test 'from 0x01 to 0x02 with limited data length' (done){
    const sendData = new Buffer('Hey beauty!'); // data to be sent

    // function for received messages on rhs2
    let recvListener = (msg:RH_ReceivedMessage)=>{
      // remove the listener function from the emitter
      rhs2.removeListener('data', recvListener);

      let sendDataPart = new Buffer('Hey');
      if(msg.data.compare(sendDataPart) === 0){
        done();
      }else{
        done(new Error('The received data does not match the sent data'));
      }
    }

    // attach the listener function to the emitter
    rhs2.on('data', recvListener);

    // send data
    rhs1.send(0x02, sendData, 3).catch((err)=>{
      done(err);
    });
  }

  @test 'from 0x01 to 0x02 with control characters' (done){

    const STX = 0x02;
    const ETX = 0x03;
    const DLE = 0x10;
    const SYN = 0x16;

    const sendData = new Buffer('abcdef'); // data to be sent
    sendData[1] = 0x02; // STX
    sendData[2] = 0x03; // ETX
    sendData[3] = 0x10; // DLE
    sendData[4] = 0x16; // SYN

    // function for received messages on rhs2
    let recvListener = (msg:RH_ReceivedMessage)=>{
      // remove the listener function from the emitter
      rhs2.removeListener('data', recvListener);

      if(msg.data.compare(sendData) === 0){
        done();
      }else{
        done(new Error('The received data does not match the sent data'));
      }
    }

    // attach the listener function to the emitter
    rhs2.on('data', recvListener);

    // send data
    rhs1.send(0x02, sendData).catch((err)=>{
      done(err);
    });
  }

  @test 'from 0x01 to broadcast' (done){
    const sendData = new Buffer('Hey beauty!'); // data to be sent

    // function for received messages on rhs2
    let recvListener = (msg:RH_ReceivedMessage)=>{
      // remove the listener function from the emitter
      rhs2.removeListener('data', recvListener);

      if(msg.headerTo !== RH_BROADCAST_ADDRESS){
        done(new Error('The headerTo does not RH_BROADCAST_ADDRESS'));
        return;
      }

      if(msg.data.compare(sendData) === 0){
        done();
      }else{
        done(new Error('The received data does not match the sent data'));
      }
    }

    // attach the listener function to the emitter
    rhs2.on('data', recvListener);

    // send data
    rhs1.send(RH_BROADCAST_ADDRESS, sendData).catch((err)=>{
      done(err);
    });
  }

  @test 'from 0x01 to 0x42 should fail' (done){
    const sendData = new Buffer('Hey beauty!'); // data to be sent

    // send data
    rhs1.send(0x42, sendData).catch((err)=>{
      done();
    });
  }
}

@suite('test functions') class TestFunctions {
  @test 'setAddress(0x05)' (){
    rhs2.setAddress(0x05);
  }

  @test 'thisAddress()' (done){
    if(rhs2.thisAddress() === 0x05){
      done();
    }else{
      done(new Error('thisAddress() did not report the set address'));
    }
  }

  @test 'setRetries(7)' (){
    rhs1.setRetries(7);
  }

  @test 'getRetries()' (done){
    if(rhs1.getRetries() === 7){
      done();
    }else{
      done(new Error('getRetries() did not report the set number of retries'));
    }
  }

  @test 'setTimeout(100)' (){
    rhs1.setTimeout(100);
  }

  @test 'getRetransmissions()' (){
    let retransmissions = rhs1.getRetransmissions();
    expect(retransmissions).to.be.a('number');
  }

  @test 'resetRetransmissions()' (){
    rhs1.resetRetransmissions();
  }

  @test 'setPromiscuous(true)' (){
    rhs1.setPromiscuous(true);
  }
}

///////////////////////////////
// Send and receive messages //
///////////////////////////////
@suite('send and receive messages') class SendRecv2 {
  @test 'from 0x01 to 0x05' (done){
    const sendData = new Buffer('Hey beauty!'); // data to be sent

    // function for received messages on rhs2
    let recvListener = (msg:RH_ReceivedMessage)=>{
      // remove the listener function from the emitter
      rhs2.removeListener('data', recvListener);

      if(msg.data.compare(sendData) === 0){
        done();
      }else{
        done(new Error('The received data does not match the sent data'));
      }
    }

    // attach the listener function to the emitter
    rhs2.on('data', recvListener);

    // send data
    rhs1.send(0x05, sendData).catch((err)=>{
      done(err);
    });
  }

  @test 'from 0x05 to 0x42 (0x01 with promiscuous mode)' (done){
    const sendData = new Buffer('Hey beauty!'); // data to be sent

    // function for received messages on rhs2
    let recvListener = (msg:RH_ReceivedMessage)=>{
      // remove the listener function from the emitter
      rhs1.removeListener('data', recvListener);

      if(msg.data.compare(sendData) === 0){
        done();
      }else{
        done(new Error('The received data does not match the sent data'));
      }
    }

    // attach the listener function to the emitter
    rhs1.on('data', recvListener);

    // send data
    rhs2.send(0x42, sendData).catch((err)=>{
      done(err);
    });
  }
}

/////////////
// Cleanup //
/////////////
@suite('cleanup') class Cleanup {
  @test 'kill socat' (done){
    socat.on('close', (code)=>{
      done();
    });
    socat.kill();
  }
}
