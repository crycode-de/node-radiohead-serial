/*
 * Node.js module radiohead-serial
 *
 * Copyright (c) 2017-2022 Peter Müller <peter@crycode.de> (https://crycode.de/)
 *
 * Node.js module for communication between some RadioHead nodes and Node.js using
 * the RH_Serial driver and the RHReliableDatagram manager of the RadioHead library.
 *
 *
 * RadioHead Library (http://www.airspayce.com/mikem/arduino/RadioHead/)
 * Copyright (c) 2014 Mike McCauley
 *
 * Port from native C/C++ code to TypeScript
 * Copyright (c) 2017-2022 Peter Müller <peter@crycode.de> (https://crycode.de/)
 *
 * Example for the communication between two nodes.
 * This server example is listening for messages from a client and responding to it.
 */

// Require the radiohead-serial module
//var RadioHeadSerial = require('radiohead-serial').RadioHeadSerial;
var RadioHeadSerial = require('../').RadioHeadSerial;

// Create an instance of the RadioHeadSerial class
var rhs = new RadioHeadSerial({
  port: '/dev/ttyUSB0', // COM1 on Windows
  baud: 9600,
  address: 0x01,
  // reliable: true,
  // autoInit: true
});

// Listen to the 'data' event for received messages
rhs.on('data', function(message){
  // Print the received message object
  console.log('-> recv:', message);

  // Convert the decimal from address to hex
  var sender = ('0' + message.headerFrom.toString(16)).slice(-2).toUpperCase();

  // Print a readable form of the data
  if(message.length > 0){
    console.log('-> received ' + message.length + ' bytes from 0x' + sender + ': "' + message.data.toString() + '"');
  }

  // Create the answer for the client
  var answer = Buffer.from('Hello back to you, client!');

  // Send the answer to the client
  rhs.send(message.headerFrom, answer).then(function(){
    // Message has been sent successfully
    console.log('<- sent to 0x' + sender + ': "' + answer.toString() + '" Raw:', answer);
  }).catch(function(error){
    // Error while sending the message
    console.log('<- ERROR', error);
  });
});

// Print some info
console.log('Server example running.');
console.log('Now start the client example...');
