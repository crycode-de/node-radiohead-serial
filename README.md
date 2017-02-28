# radiohead-serial

[![build status](https://git.cryhost.de/crycode/node-radiohead-serial/badges/master/build.svg)](https://git.cryhost.de/crycode/node-radiohead-serial/commits/master)

Communication between some **RadioHead** nodes and **Node.js** using the *RH_Serial* driver and the *RHReliableDatagram* manager of the RadioHead library.

[RadioHead](http://www.airspayce.com/mikem/arduino/RadioHead/) is a Packet Radio library for embedded microprocessors.
> RH_Serial works with RS232, RS422, RS485, RS488 and other point-to-point and multidropped serial connections, or with TTL serial UARTs such as those on Arduino and many other processors, or with data radios with a serial port interface. RH_Serial provides packetization and error detection over any hardware or virtual serial connection.

> RHReliableDatagram provides Addressed, reliable, retransmitted, acknowledged variable length messages.

Version of the used RadioHead library: *1.64 2016-12-10*

This module can be used on any Linux system, for example a Raspberry Pi with Raspbian or a regular computer.


## Example scenario for using radiohead-serial

The radiohead-serial module is perfect if you want to build your own bus system based on for example RS485.

As a head station you can use a Raspberry Pi mini computer with a USB-RS485 adapter.
The other nodes on the bus can be some microcontrollers (e.g. ATMega8 or Arduino) with an TTL-RS485 converter (e.g. Max485) connected.
In addition using a serial to radio gateway is possible (see below).


## Using other RadioHead drivers with a gateway

If you want to use other RadioHead drivers (for example *RH_ASK*), you can simply use an Arduino nano ($2 to $10) as an serial gateway.
Other microcontrollers can be used too.

Connect your radio hardware to the Arduino and upload the `rh_serial_gateway` sketch. An example sketch is included in the *examples* directory.
The Arduino will act as a gateway between the serial and the radio network.

Optionally the gateway can filter messages, so that only a specific address range is transmitted through the radio network.


## Installation

```
npm install radiohead-serial
```


## Examples

The examples blow can be found in the *examples* directory of this package.

The examples assume a Linux system with two USB-RS485 adapters connected.
The A and B lines of the RS485 are connected between both adapters.
You can also use two machines with respectively one adapter.

Depending on your system you may have to change the used ports (/dev/ttyUSB0) in the examples.

If you want to use ES6 style imports you can use
```ts
import {RadioHeadSerial} from 'radiohead-serial';
```

### A server replying to messages sent by clients
```js
// Require the radiohead-serial module
var RadioHeadSerial = require('radiohead-serial').RadioHeadSerial;

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
```

### A client sending messages to a server
```js
// Require the radiohead-serial module
var RadioHeadSerial = require('radiohead-serial').RadioHeadSerial;

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
```


## API

Receiving and sending of messages is always done asynchronous.

Most methods are able to throw an error, if their arguments mismatched or any other error occurs.

TypeScript typings are available in the `typings` directory.

### RadioHeadSerial(port, baud, address)
```ts
constructor(port:string, baud:number, address:number);
```
Constructor of the RadioHeadSerial class.
Loads and initializes the RadioHead driver and manager.

* `port` - The serial port/device to be used for the communication. For example /dev/ttyUSB0.
* `baud` - The baud rate to be used for the communication. Supported are 50, 75, 110, 134, 150, 200, 300, 600, 1200, 1800, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400.
* `address` - The address of this node in the RadioHead network. Address range goes from 1 to 254.

### rhs.start(onRecvCallback)
```ts
start(onRecvCallback:(err:Error, from:number, length:number, data:Buffer)=>void):void;
```
Starts the asynchronous worker for receiving and sending messages through the RadioHead network.
If the worker is already active, an error is thrown.
Before start is called, no messages can be received or send.

* `onRecvCallback` - Callback function, which is called on every received message. The callback takes the following arguments:
    * `err` - A possible occurred error if something went wrong.
    * `from` - The address of the sender of the received message.
    * `length` - The length of the received message in bytes.
    * `data` - A buffer containing the received message.

### rhs.stop(callback)
```ts
stop(callback:()=>void);
```
Stops the asynchronous worker.
If the worker is not active, the callback is immediately called.
After stop is called, no messages can be received or send.

* `callback` - Callback function, which is called if the worker has been stopped.

### rhs.send(to, length, data, callback)
```ts
send(to:number, length:number, data:Buffer, callback:(err:Error)=>void):void;
```
Sends a message through the RadioHead network.

* `to` - Recipient address. Use 255 for broadcast messages.
* `length` - Number of bytes to send from the buffer.
* `data` - Buffer containing the message to send.
* `callback` - Callback called after the message is send. First argument is a possible occurred error.

### rhs.setAddress(address)
```ts
setAddress(address:number):void;
```
Sets the address of this node in the RadioHead network.

* `address` - The new address. Address range goes from 1 to 254.

### rhs.setRetries(count)
```ts
setRetries(count:number):void;
```
Sets the maximum number of retries.
Defaults to 3 at construction time.
If set to 0, each message will only ever be sent once.

* `count` - New number of retries.

### rhs.setTimeout(timeout)
```ts
setTimeout(timeout:number):void;
```
Sets the minimum retransmit timeout in milliseconds.
If an ack is taking longer than this time, a message will be retransmitted.
Default is 200.

* `timeout` - New timeout in milliseconds.


## License

Licensed under GPL Version 2

Copyright (C) 2016 Peter Müller <peter@crycode.de> (https://crycode.de/)

The RadioHead library is Copyright (C) 2008 Mike McCauley.
