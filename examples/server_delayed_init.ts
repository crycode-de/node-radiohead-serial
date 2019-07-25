/*
 * Node.js module radiohead-serial
 *
 * Copyright (c) 2017-2019 Peter Müller <peter@crycode.de> (https://crycode.de/)
 *
 * Node.js module for communication between some RadioHead nodes and Node.js using
 * the RH_Serial driver and the RHReliableDatagram manager of the RadioHead library.
 *
 *
 * RadioHead Library (http://www.airspayce.com/mikem/arduino/RadioHead/)
 * Copyright (c) 2014 Mike McCauley
 *
 * Port from native C/C++ code to TypeScript
 * Copyright (c) 2017-2019 Peter Müller <peter@crycode.de> (https://crycode.de/)
 *
 * Example for the communiation between two nodes.
 * This server example is listening for messages from a client and responding to it.
 * The constructor is called with the `autoInit: false` option and the init is
 * done later with error handling.
 */

///<reference types="node" />

// Import the radiohead-serial module
//import {RadioHeadSerial, RH_ReceivedMessage} from 'radiohead-serial';
// @ts-ignore
import {RadioHeadSerial, RH_ReceivedMessage} from '../';

// Create an instance of the RadioHeadSerial class
const rhs:RadioHeadSerial = new RadioHeadSerial({
  port: '/dev/ttyUSB0', // COM1 on Windows
  baud: 9600,
  address: 0x01,
  reliable: true,
  autoInit: false // delayed init called by `rhs.init()`
});

// Listen to the 'data' event for received messages
rhs.on('data', (message:RH_ReceivedMessage) => {
  // Print the received message object
  console.log('-> recv:', message);

  // Convert the decimal from address to hex
  let sender:string = ('0' + message.headerFrom.toString(16)).slice(-2).toUpperCase();

  // Print a readable form of the data
  if(message.length > 0){
    console.log('-> received ' + message.length + ' bytes from 0x' + sender + ': "' + message.data.toString() + '"');
  }

  // Create the answer for the client
  let answer:Buffer = Buffer.from('Hello back to you, client!');

  // Send the answer to the client
  rhs.send(message.headerFrom, answer).then(()=>{
    // Message has been sent successfully
    console.log('<- sent to 0x' + sender + ': "' + answer.toString() + '" Raw:', answer);
  }).catch((error:Error)=>{
    // Error while sending the message
    console.log('<- ERROR', error);
  });
});

// Print info
console.log('isInitDone =', rhs.isInitDone());

// Run the init and catch possible error
rhs.init()
.then(() => {
  // Print some info
  console.log('isInitDone =', rhs.isInitDone());
  console.log('Server example running.');
  console.log('Now start the client example...');
})
.catch((err) => {
  console.log('init error: ', err);
});
