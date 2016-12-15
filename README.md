# radiohead-serial

Communiation between some **RadioHead** nodes and **Node.js** using the *RH_Serial* driver and the *RHReliableDatagram* manager of the RadioHead library.

[RadioHead](http://www.airspayce.com/mikem/arduino/RadioHead/) is a Packet Radio library for embedded microprocessors.
> RH_Serial Works with RS232, RS422, RS485, RS488 and other point-to-point and multidropped serial connections, or with TTL serial UARTs such as those on Arduino and many other processors, or with data radios with a serial port interface. RH_Serial provides packetization and error detection over any hardware or virtual serial connection.

> RHReliableDatagram provides Addressed, reliable, retransmitted, acknowledged variable length messages.

Version of the used RadioHead library: *1.64 2016-12-10*


## Example scenario for using radiohead-serial

The radiohead-serial module is perfect if you want to build your own bus system based on for example RS485.

As a head station you can use a Raspberry Pi mini computer with a USB-RS485 adapter.
The other nodes on the bus can be some microcontrollers (e.g. ATMega8 or Arduino) with an TTL-RS485 converter (e.g. Max485) connected.


## Installation

```
npm install git+https://git@git.cryhost.de/crycode/node-radiohead-serial.git
```


## Examples

Comming soon...


## API

Receiving and sending of messages is always done asynchronous.

Most methods are able to throw an error, if there arguments mismatched or any other error occurs.

TypeScript typings are available in the `typings` directory.

### RadioHeadSerial(port, baud, address)
```ts
constructor(port:string, baud:number, address:number);
```
Constructor of the RadioHeadSerial class.
Loads an initializes the RadioHead driver and manager.

* `port` - The serial port/device to be used for the communication. For example /dev/ttyUSB0.
* `baud` - The baud rate to be used for the communication. Supported are 50, 75, 110, 134, 150, 200, 300, 600, 1200, 1800, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400.
* `address` - The address of this node in the RadioHead network. Address range goes from 1 to 254.

### rhs.start(onRecvCallback)
```ts
start(onRecvCallback:(err:Error, from:number, length:number, data:Buffer)=>void):void;
```
Starts the asynchronous worker for receiving and sending messages through the RadioHead network.
If the worker already active, an error is thrown.
Before start is called, no messages an be received or send.

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
After stop is called, no messages an be received or send.

* `callback` - Callback function, which is called if the worker has been stopped.

### rhs.send(to, length, data, callback)
```ts
send(to:number, length:number, data:Buffer, callback:(err:Error)=>void):void;
```
Sends a message through the RadioHead network.

* `to` - Recipient address. Use 255 for broadcast messages.
* `length` - Number ob bytes to send from the buffer.
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
If an ack is taking longer than this time, a message will be retransmittet.
Default is 200.

* `timeout` - New timeout in milliseconds.


## License

Licensed under GPL V2

Copyright (C) 2016 Peter Müller <peter@crycode.de> (https://crycode.de/)

The RadioHead library is Copyright (C) 2008 Mike McCauley.
