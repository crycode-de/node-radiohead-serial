/*
 * NodeJS RadioHead Serial
 *
 * Copyright (C) 2016 Peter Müller <peter@crycode.de> (https://crycode.de/)
 *
 * Example for the communiation between two nodes.
 * This client example sends ten messages to the server and prints all received messages.
 */

// Require the radiohead-serial module
//var RadioHeadSerial = require('radiohead-serial').RadioHeadSerial;
var RadioHeadSerial = require('../').RadioHeadSerial;

// Create an instance of the RadioHeadSerial class
var rhs = new RadioHeadSerial('/dev/ttyUSB1', 9600, 0x02);

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
}

// Start the asynchronous worker
rhs.start(onRecv);

// Counter for the number of send messages
var i = 0;

// Start an interval for sending one message every 2 seconds
var interval = setInterval(function(){

  // Create the data to be send to the server
  var data = new Buffer('Hello server!');

  // Send the data to the server
  rhs.send(0x01, data.length, data, function(err){
    // Check if an error occurred
    if(err){
      console.log('<- Error:', err);
      return;
    }

    // Print info to the console
    console.log('<- Ok! Send: "' + data.toString() + '" Raw:', data);
  });

  // Count up the counter an check if we tried to send ten messages
  if(++i >= 10){
    // We send ten messages
    // Clear the interval
    clearInterval(interval);

    // Stop the asynchronous worker
    rhs.stop(function(){
      // Print some info when the worker has been stopped
      console.log('Client example done.');
    });
  }
}, 2000);

// Print some info
console.log('Client example running.');
console.log('I\'ll try to send hello to the Server ten times...');
