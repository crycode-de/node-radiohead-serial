/*
 * Node.js RadioHead Serial
 *
 * Copyright (c) 2017 Peter Müller <peter@crycode.de> (https://crycode.de/)
 *
 * Node.js module for communication between some RadioHead nodes and Node.js using
 * the RH_Serial driver and the RHReliableDatagram manager of the RadioHead library.
 */
"use strict";

const spawn = require('child_process').spawn;
const RadioHeadSerial = require('../').RadioHeadSerial;

const expect = require('expect.js');

let socat;

let tty1 = null;
let tty2 = null;

let rhs1 = null;
let rhs2 = null;

//////////////////////////////////////
// Prepare virtual tty's with socat //
//////////////////////////////////////
describe('prepare virtual tty\'s with socat', function(){
  it('spawn socat', function(done){
    socat = spawn('socat', ['-d', '-d', 'pty,raw,echo=0', 'pty,raw,echo=0']);

    socat.on('error', (error)=>{
      console.log('Error spawning `socat -d -d pty,raw,echo=0 pty,raw,echo=0`!');
      console.log(error);
      done(error);
    });

    socat.stderr.on('data', (data) => {
      let parts = data.toString().split('\n');
      for(let i = 0; i < parts.length; i++){
        let m = parts[i].match(/PTY is (\/dev.*)$/);
        if(m){
          if(tty1 === null){
            tty1 = m[1];
          }else if(tty2 === null){
            tty2 = m[1];
            done();
          }
        }
      }
    });
  });

  it('check the tty\'s created by socat', function(){
    expect(tty1).to.match(/^\/dev\/[\/a-zA-Z]+\d+$/);
    expect(tty2).to.match(/^\/dev\/[\/a-zA-Z]+\d+$/);
  });

});

/////////////////////////////////////////
// Start two RadioHeadSerial instances //
/////////////////////////////////////////
describe('create and start the two RadioHeadSerial instances', function(){
  it('start rhs1 (address 0x01)', function(){
    rhs1 = new RadioHeadSerial(tty1, 9600, 0x01);
    rhs1.start();
  });
  it('start rhs2 (address 0x02) using event', function(done){
    rhs2 = new RadioHeadSerial(tty2, 9600, 0x02);
    rhs2.on('started', ()=>{
      done();
    });
    rhs2.start();
  });
});

///////////////////////////////
// Send and receive messages //
///////////////////////////////
describe('send and receive messages', function(){

  // the data to be sent
  let sendData = new Buffer('Hey beauty!');

  it('from 0x01 to 0x02', function(done){

    // function for received messages on rhs2
    function recvListener(msg){
      // remove the listener function from the emitter
      rhs2.removeListener('data', recvListener);

      if(msg.error){
        done(msg.error);
      }else if(msg.data.compare(sendData) === 0){
        done();
      }else{
        done(new Error('The received data does not match the sent data'));
      }
    }

    // attach the listener function to the emitter
    rhs2.on('data', recvListener);

    // send data
    rhs1.send(0x02, sendData).catch(function(err){
      done(err);
    });

  });

  it('from 0x02 to 0x01', function(done){

    // function for received messages on rhs1
    function recvListener(msg){
      // remove the listener function from the emitter
      rhs1.removeListener('data', recvListener);

      if(msg.error){
        done(msg.error);
      }else if(msg.data.compare(sendData) === 0){
        done();
      }else{
        done(new Error('The received data does not match the sent data'));
      }
    }

    // attach the listener function to the emitter
    rhs1.on('data', recvListener);

    // send data
    rhs2.send(0x01, sendData).catch(function(err){
      done(err);
    });;
  });

  it('from 0x01 to 0xFF (broadcast)', function(done){

    // function for received messages on rhs1
    function recvListener(msg){
      // remove the listener function from the emitter
      rhs2.removeListener('data', recvListener);

      if(msg.error){
        done(msg.error);
      }else if(msg.data.compare(sendData) === 0){
        done();
      }else{
        done(new Error('The received data does not match the sent data'));
      }
    }

    // attach the listener function to the emitter
    rhs2.on('data', recvListener);

    // send data
    rhs1.send(0xFF, sendData);
  });
});

///////////////
// Functions //
///////////////
describe('test functions', function(){
  it('isWorkerActive', function(done){
    if(rhs1.isWorkerActive()){
      done();
    }else{
      done(new Error('isWorkerActive() reported false but it has to be true'));
    }
  });

  it('setAddress', function(){
    rhs1.setAddress(0x05);
  });

  it('setRetries', function(){
    rhs1.setRetries(7);
  });

  it('getRetries', function(done){
    if(rhs1.getRetries() === 7){
      done();
    }else{
      done(new Error('getRetries() did not report the set number of retries'));
    }
  });

  it('setTimeout', function(){
    rhs1.setTimeout(100);
  });

  it('getRetransmissions', function(){
    let retransmissions = rhs1.getRetransmissions();
  });

  it('resetRetransmissions', function(){
    rhs1.resetRetransmissions();
  });

  it('setPromiscuous', function(){
    rhs1.setPromiscuous(true);
  });

});

////////////////////////////////////////////
// Stop the two RadioHeadSerial instances //
////////////////////////////////////////////
describe('stop the two RadioHeadSerial instances', function(){
  it('stop rhs1 using promise', function(done){
    rhs1.stop().then(function(){
      done();
    });
  });
  it('stop rhs2 using event', function(done){
    rhs2.on('stopped', function(){
      done();
    });
    rhs2.stop();
  });
});

///////////////////////////////////////////////
// Destroy the two RadioHeadSerial instances //
///////////////////////////////////////////////
describe('destroy the two RadioHeadSerial instances', function(){
  it('destroy rhs1', function(){
    rhs1.destroy();
    rhs1 = null;
  });
  it('destroy rhs2', function(){
    rhs2.destroy();
    rhs2 = null;
  });
});

/////////////
// Cleanup //
/////////////
describe('cleanup', function(){
  it('kill socat', function(done){
    socat.on('close', (code)=>{
      done();
    });
    socat.kill();
  });
});

/////////////////////
// Check variables //
/////////////////////
describe('check variables', function(){
  it('MAX_MESSAGE_LEN', function(){
    expect(RadioHeadSerial.MAX_MESSAGE_LEN).to.be(60);
  });
});
