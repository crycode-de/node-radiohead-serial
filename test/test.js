"use strict";

const spawn = require('child_process').spawn;
const RadioHeadSerial = require('../').RadioHeadSerial;

const expect = require('expect.js');

let socat;

let tty1 = null;
let tty2 = null;

let rhs1 = null;
let rhs2 = null;

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

  it('check the tty\'s', function(){
    expect(tty1).to.match(/^\/dev\/[\/a-zA-Z]+\d+$/);
    expect(tty2).to.match(/^\/dev\/[\/a-zA-Z]+\d+$/);
  });

});

describe('start the two RadioHeadSerial instances', function(){
  it('start 1', function(){
    rhs1 = new RadioHeadSerial(tty1, 9600, 0x01);
    rhs1.start();
  });
  // TODO 2nd instance if the native addon allows multiple instances
  /*it('start 2', function(){
    rhs2 = new RadioHeadSerial(tty2, 9600, 0x02);
    rhs2.start();
  });*/
});

describe('test functions', function(){
  it('setAddress', function(){
    rhs1.setAddress(5);
  });
});

describe('stop the two RadioHeadSerial instances', function(){
  it('stop 1', function(done){
    rhs1.stop().then(function(){
      done();
    });
  });
  // TODO 2nd instance if the native addon allows multiple instances
  /*it('stop 2', function(done){
    rhs2.stop().then(()=>{
      done();
    });
  });*/
});

describe('cleanup', function(){
  it('kill socat', function(done){
    socat.on('close', (code)=>{
      done();
    });
    socat.kill();
  });
});
