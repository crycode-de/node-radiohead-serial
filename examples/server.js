/*
 * NodeJS RadioHead Serial
 *
 * Copyright (C) 2016 Peter Müller <peter@crycode.de> (https://crycode.de/)
 *
 * Example for the communiation between two nodes.
 * This server example is listening for messages from a client and responding to it.
 */

// Require the radiohead-serial module
//var RadioHeadSerial = require('radiohead-serial').RadioHeadSerial;
var RadioHeadSerial = require('../').RadioHeadSerial;

// Create an instance of the RadioHeadSerial class
var rhs = new RadioHeadSerial('/dev/ttyUSB0', 9600, 0x01);

// Define a callback function for received messages
function onRecv(err, from, length, data){
  // Check if an error occurred
  if(err){
    console.log('-> Error:', err);
    return;
  }

  // Convert the decimal from address to hex
  var sender = ('0' + from.toString(16)).slice(-2).toUpperCase();

  // Print info to the console
  console.log('-> Got ' + length + ' Bytes from 0x' + sender + ': "' + data.toString() + '" Raw:', data);

  // Create the answer for the client
  var answer = new Buffer('Hello back to you, client!');

  // Send the answer to the client
  rhs.send(from, answer.length, answer, function(err){
    // Check if an error occured
    if(err){
      console.log('<- Error:', err);
      return;
    }

    // Print info to the console
    console.log('<- Ok! Answered to 0x' + sender + ': "' + answer.toString() + '" Raw:', answer);
  });
}

// Start the asynchronous worker
rhs.start(onRecv);

// Print some info
console.log('Server example running.');
console.log('Now start the client example...');
