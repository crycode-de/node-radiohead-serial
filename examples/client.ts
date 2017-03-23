/*
 * NodeJS RadioHead Serial
 *
 * Copyright (c) 2017 Peter Müller <peter@crycode.de> (https://crycode.de/)
 *
 * Example for the communiation between two nodes.
 * This client example sends ten messages to the server and prints all received messages.
 */

// The following references are only needed for the examples in the examples directory
///<reference path="../typings/index.d.ts" />
///<reference path="../typings/radiohead-serial.d.ts" />

// Import the radiohead-serial module
import {RadioHeadSerial} from 'radiohead-serial';

// Create an instance of the RadioHeadSerial class
let rhs:RadioHeadSerial = new RadioHeadSerial('/dev/ttyUSB1', 9600, 0x01);

// Listen on the 'data' event for received messages
rhs.on('data', (message:RadioHeadSerial.ReceivedData) => {
  // Print the received message object
  console.log('-> recv:', message);

  // Convert the decimal from address to hex
  let sender:string = ('0' + message.from.toString(16)).slice(-2).toUpperCase();

  // Print a readable form of the data
  if(message.length > 0){
    console.log('-> received ' + message.length + ' bytes from 0x' + sender + ': "' + message.data.toString() + '"');
  }
});

// Listen on the 'started' and 'stopped' events
rhs.on('started', () => {
  console.log('* The worker has been started.');
});
rhs.on('stopped', () => {
  console.log('* The worker has been stopped.');
});

// Start the asynchronous worker
rhs.start();

// Counter for the number of send messages
let sentCount:number = 0;

// Function to send a message (calls itself with a timeout until five messages are sent)
function sendData(){
  // Create the data to be send to the server
  let data:Buffer = new Buffer('Hello server!');

  // Send the data to the server
  rhs.send(0x01, data).then(() => {
    // Message has been sent successfully
    console.log('<- sent to 0x01: "' + data.toString() + '" Raw:', data);

  }).catch((error:Error) => {
    // Error while sending the message
    console.log('<- ERROR', error);

  }).finally(() => {
    // After sending the message, even if failed
    sentCount++;

    // 5 times sent?
    if(sentCount < 5){
      // Send a new message after 2 seconds
      setTimeout(sendData, 2000);
    }else{
      // Stop the asynchronous worker after 1 second and exit the client example
      // Use the timeout before stop() to receive the answer from the server
      setTimeout(() => {
        rhs.stop().then(() => {
          // The worker has been stopped
          console.log('Client example done. :-)');
        });
      }, 1000);
    }
  });
}

// Trigger sending the first message
sendData();

// Print some info
console.log('Client example running.');
console.log('I\'ll try to send hello to the Server five times...');
