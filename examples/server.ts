/*
 * NodeJS RadioHead Serial
 *
 * Copyright (c) 2017 Peter Müller <peter@crycode.de> (https://crycode.de/)
 *
 * Example for the communiation between two nodes.
 * This server example is listening for messages from a client and responding to it.
 */

// The following references are only needed for the examples in the examples directory
///<reference path="../typings/index.d.ts" />
///<reference path="../typings/radiohead-serial.d.ts" />

// Import the radiohead-serial module
import {RadioHeadSerial} from 'radiohead-serial';

// Create an instance of the RadioHeadSerial class
let rhs:RadioHeadSerial = new RadioHeadSerial('/dev/ttyUSB0', 9600, 0x01);

// Listen to the 'data' event for received messages
rhs.on('data', (message:RadioHeadSerial.ReceivedData) => {
  // Print the received message object
  console.log('-> recv:', message);

  // Convert the decimal from address to hex
  let sender:string = ('0' + message.from.toString(16)).slice(-2).toUpperCase();

  // Print a readable form of the data
  if(message.length > 0){
    console.log('-> received ' + message.length + ' bytes from 0x' + sender + ': "' + message.data.toString() + '"');
  }

  // Create the answer for the client
  let answer:Buffer = new Buffer('Hello back to you, client!');

  // Send the answer to the client
  rhs.send(message.from, answer).then(()=>{
    // Message has been sent successfully
    console.log('<- sent to 0x' + sender + ': "' + answer.toString() + '" Raw:', answer);
  }).catch((error:Error)=>{
    // Error while sending the message
    console.log('<- ERROR', error);
  });
});

// Start the asynchronous worker
rhs.start();

// Print some info
console.log('Server example running.');
console.log('Now start the client example...');
