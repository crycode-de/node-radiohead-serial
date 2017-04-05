# radiohead-serial

[![build status](https://git.cryhost.de/crycode/node-radiohead-serial/badges/master/build.svg)](https://git.cryhost.de/crycode/node-radiohead-serial/commits/master)
[![coverage report](https://git.cryhost.de/crycode/node-radiohead-serial/badges/master/coverage.svg)](https://git.cryhost.de/crycode/node-radiohead-serial/commits/master)
[![npm version](https://badge.fury.io/js/radiohead-serial.svg)](https://badge.fury.io/js/radiohead-serial)

Communication between some **RadioHead** nodes and **Node.js** using the *RH_Serial* driver and the *RHReliableDatagram* manager of the RadioHead library.

With `radiohead-serial` you can build reliable networks based on serial hardware (e.g. RS485 or RS232) between multiple different devices like regular computers, minicomputers (e.g. Raspberry Pi) and microprocessors (e.g. Arduino). It is also possible to include radio hardware using a microprocessor (e.g. an Arduino nano) as a serial-radio gateway.

[RadioHead](http://www.airspayce.com/mikem/arduino/RadioHead/) is a Packet Radio library for embedded microprocessors.
> RH_Serial works with RS232, RS422, RS485, RS488 and other point-to-point and multidropped serial connections, or with TTL serial UARTs such as those on Arduino and many other processors, or with data radios with a serial port interface. RH_Serial provides packetization and error detection over any hardware or virtual serial connection.

> RHReliableDatagram provides Addressed, reliable, retransmitted, acknowledged variable length messages.

Version of the used RadioHead library: *1.74 2017-03-08*

This module can be used on any Linux system, for example a Raspberry Pi with Raspbian or a regular computer.
It requires Node.js version 4 or higher.


## Example scenario for using radiohead-serial

The radiohead-serial module is perfect if you want to build your own bus system based on for example RS485.

As a head station you can use a Raspberry Pi minicomputer with a USB-RS485 adapter.
The other nodes on the bus can be some microprocessors (e.g. ATMega8 or Arduino) with an TTL-RS485 converter (e.g. Max485) connected.
In addition using a serial-radio gateway is possible (see below).


## Using other RadioHead drivers with a serial-radio gateway

If you want to use other RadioHead drivers (for example *RH_ASK*), you can simply use an Arduino nano ($2 to $10) as an serial gateway.
Other microprocessors can be used too.

Connect your radio hardware to the Arduino and upload the `rh_serial_gateway` sketch. An example sketch is included in the *examples* directory.
The Arduino will act as a gateway between the serial and the radio network.

Optionally the gateway can filter messages, so that only a specific address range is transmitted through the radio network.


## Installation

```
npm install radiohead-serial
```

Installed build tools (e.g. build-essential) are required for building the native addon part of this module.


## Examples

The examples blow can be found in the *examples* directory of this package together with TypeScript examples and a gateway Arduino sketch.

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

// Listen to the 'data' event for received messages
rhs.on('data', function(message){
  // Print the received message object
  console.log('-> recv:', message);

  // Convert the decimal from address to hex
  var sender = ('0' + message.from.toString(16)).slice(-2).toUpperCase();

  // Print a readable form of the data
  if(message.length > 0){
    console.log('-> received ' + message.length + ' bytes from 0x' + sender + ': "' + message.data.toString() + '"');
  }

  // Create the answer for the client
  var answer = new Buffer('Hello back to you, client!');

  // Send the answer to the client
  rhs.send(message.from, answer).then(function(){
    // Message has been sent successfully
    console.log('<- sent to 0x' + sender + ': "' + answer.toString() + '" Raw:', answer);
  }).catch(function(error){
    // Error while sending the message
    console.log('<- ERROR', error);
  });
});

// Start the asynchronous worker
rhs.start();

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

// Listen on the 'data' event for received messages
rhs.on('data', function(message){
  // Print the received message object
  console.log('-> recv:', message);

  // Convert the decimal from address to hex
  var sender = ('0' + message.from.toString(16)).slice(-2).toUpperCase();

  // Print a readable form of the data
  if(message.length > 0){
    console.log('-> received ' + message.length + ' bytes from 0x' + sender + ': "' + message.data.toString() + '"');
  }
});

// Listen on the 'started' and 'stopped' events
rhs.on('started', function(){
  console.log('* The worker has been started.');
});
rhs.on('stopped', function(){
  console.log('* The worker has been stopped.');
});

// Start the asynchronous worker
rhs.start();

// Counter for the number of send messages
var sentCount = 0;

// Function to send a message (calls itself with a timeout until five messages are sent)
function sendData(){
  // Create the data to be send to the server
  var data = new Buffer('Hello server!');

  // Send the data to the server
  rhs.send(0x01, data).then(function(){
    // Message has been sent successfully
    console.log('<- sent to 0x01: "' + data.toString() + '" Raw:', data);

  }).catch(function(error){
    // Error while sending the message
    console.log('<- ERROR', error);

  }).finally(function(){
    // After sending the message, even if failed
    sentCount++;

    // 5 times sent?
    if(sentCount < 5){
      // Send a new message after 2 seconds
      setTimeout(sendData, 2000);
    }else{
      // Stop the asynchronous worker after 1 second and exit the client example
      // Use the timeout before stop() to receive the answer from the server
      setTimeout(function(){
        rhs.stop().then(function(){
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
```


## APIv2

*The new APIv2 uses __Events__ and __Promises__ and has some breaking changes against the old APIv1.*

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

### rhs.start()
```ts
start():void;
```
Starts the asynchronous worker for receiving and sending messages through the RadioHead network.
If the worker is already active, this will be ignored.
Before start() is called, no messages can be received or send.

### rhs.stop()
```ts
stop():Promise<{}>;
```
Stops the asynchronous worker.
Returns a Promise which will be resolved when the worker has been fully stopped.
If the worker is not active, the promise is immediately resolved.
After stop() is called, no messages can be received or send.

### rhs.isWorkerActive()
```ts
isWorkerActive():boolean;
```
Returns true if the asynchronous worker is active.

### rhs.send(to, data, length)
```ts
send(to:number, data:Buffer, length?:number):Promise<{}>;
```
Sends a message through the RadioHead network.
Returns a Promise which will be resolved when the message has been sent, or rejected in case of an error.

* `to` - Recipient address. Use 255 for broadcast messages.
* `data` - Buffer containing the message to send.
* `length` - *Optional* number of bytes to send from the buffer. If not given the whole buffer is sent. The maximum length is 60 bytes.

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

### rhs.getRetries()
```ts
getRetries():number
```
Returns the currently configured maximum retries count.

### rhs.setTimeout(timeout)
```ts
setTimeout(timeout:number):void;
```
Sets the minimum retransmit timeout in milliseconds.
If an ack is taking longer than this time, a message will be retransmitted.
Default is 200.

* `timeout` - New timeout in milliseconds.

### rhs.getRetransmissions()
```ts
getRetransmissions():number;
```
Returns the number of retransmissions we have had to send since starting or since the last call to resetRetransmissions().

### rhs.resetRetransmissions()
```ts
resetRetransmissions():void;
```
Resets the count of the number of retransmissions to 0.

### rhs.setPromiscuous(promiscuous)
```ts
setPromiscuous(promiscuous:boolean):void;
```
Tells the receiver to accept messages with any to address, not just messages addressed to this node or the broadcast address.

* `promiscuous` - true if you wish to receive messages with any to address. (default false)

### rhs.setWorkerSleepTime(sleepTime)
```ts
setWorkerSleepTime(sleepTime:number):void;
```
Sets the time in microseconds the asynchronous worker is sleeping between actions.
Default is 50000.

* `time` - The new sleep time in microseconds.

### rhs.destroy()
```ts
destroy():void;
```
Releases the reference to the current instance of this class.
If no other reference exists (e.g. the Node.js variable is also deleted) the garbage collector can destroy this instance.
After destroy is called, no interaction with this class should be made.
This should be used to free up memory if this instance will not be used again.

### rhs.on('data', function(receivedData){ })
```ts
rhs.on('data', (message:RadioHeadSerial.ReceivedData) => { /* do something */ });
```
The `data` event is emitted for every received message and includes an object with the following information.

* `error` - An Error or undefined if no error occurred.
* `length` - The length of the received data.
* `from` - The from address of the received message.
* `to` - The to address of the received message.
* `id` - The id of the received message.
* `flags` - The flags of the received message.
* `data` - The received data as a Buffer or an empty Buffer if nothing was received (in case of an error).

### rhs.on('started', function(){ })
```ts
rhs.on('started', () => { /* do something */ });
```
The `started` event is emitted if the asynchronous worker has been started.

### rhs.on('stopped', function(){ })
```ts
rhs.on('stopped', () => { /* do something */ });
```
The `stopped` event is emitted if the asynchronous worker has been stopped.

### RadioHeadSerial.MAX_MESSAGE_LEN
A constant containing the maximum supported message length (60).
This is the maximum size for a Buffer used for sending or receiving messages.


## License

Licensed under GPL Version 2

Copyright (c) 2017 Peter Müller <peter@crycode.de> (https://crycode.de/)

The RadioHead library is Copyright (C) 2008 Mike McCauley.
