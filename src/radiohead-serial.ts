/*
 * Node.js module radiohead-serial
 *
 * Copyright (c) 2017-2020 Peter Müller <peter@crycode.de> (https://crycode.de/)
 *
 * Node.js module for communication between some RadioHead nodes and Node.js using
 * the RH_Serial driver and the RHReliableDatagram manager of the RadioHead library.
 *
 *
 * RadioHead Library (http://www.airspayce.com/mikem/arduino/RadioHead/)
 * Copyright (c) 2014 Mike McCauley
 *
 * Port from native C/C++ code to TypeScript
 * Copyright (c) 2017-2020 Peter Müller <peter@crycode.de> (https://crycode.de/)
 */
/// <reference types="node" />

import {EventEmitter} from 'events';

import {RH_Serial, RH_SERIAL_MAX_PAYLOAD_LEN, RH_SERIAL_HEADER_LEN,
  RH_SERIAL_MAX_MESSAGE_LEN} from './RH_Serial';
import {RHDatagram} from './RHDatagram';
import {RHReliableDatagram, RH_FLAGS_ACK, RH_DEFAULT_TIMEOUT,
  RH_DEFAULT_RETRIES} from './RHReliableDatagram';

// export the current version of this module
export const version = '4.2.0';

// export some imports to allow an custom usage
export {
  RH_Serial, RHDatagram, RHReliableDatagram,
  RH_SERIAL_MAX_PAYLOAD_LEN, RH_SERIAL_HEADER_LEN, RH_SERIAL_MAX_MESSAGE_LEN,
  RH_FLAGS_ACK,
  RH_DEFAULT_TIMEOUT, RH_DEFAULT_RETRIES
};

/** This is the address that indicates a broadcast */
export const RH_BROADCAST_ADDRESS = 0xff;

export const RH_FLAGS_RESERVED = 0xf0;
export const RH_FLAGS_APPLICATION_SPECIFIC = 0x0f;
export const RH_FLAGS_NONE = 0;

/**
 * Interface for a received message.
 */
export interface RH_ReceivedMessage {

  /**
   * Buffer containing the received data.
   * @type {Buffer}
   */
  data:Buffer;

  /**
   * Length of the received data.
   * @type {number}
   */
  length:number;

  /**
   * TO header.
   * @type {number}
   */
  headerTo:number;

  /**
   * FROM header.
   * @type {number}
   */
  headerFrom:number;

  /**
   * ID header.
   * @type {number}
   */
  headerId:number;

  /**
   * FLAGS header.
   * @type {number}
   */
  headerFlags:number;
}

/**
 * Options for creating a new instance for the RadioHeadSerial class.
 */
export interface RadioHeadSerialOptions {
  /**
   * The serial port/device to be used for the communication. (e.g. /dev/ttyUSB0)
   * @type {string}
   */
  port: string;

  /**
   * (optional) The baud rate to be used for the communication. (default 9600)
   * @type {number}
   */
  baud?: number;

  /**
   * (optional) The address of this node in the RadioHead network. Address range goes from 1 to 254. (default 1)
   * @type {number}
   */
  address?: number;

  /**
   * (optional) false if RHDatagram should be used instead of RHReliableDatagram. (default true)
   * @type {boolean}
   */
  reliable?: boolean;

  /**
   * (optional) false if the manager/serial port should not be initialized automatically. (default true)
   * If false you have to call instance.init() manually.
   * @type {boolean}
   */
  autoInit?: boolean;
}

/**
 * The RadioHeasSerial main class for sending and receiving messages through the RadioHead network.
 */
export class RadioHeadSerial extends EventEmitter {

  /**
   * Private flag if RHReliableDatagram (true) or RHDatagram (false) is used.
   */
  private _reliable:boolean;

  /**
   * The used driver.
   */
  private _driver:RH_Serial;

  /**
   * The used manager.
   * An instance of either RHReliableDatagram or RHDatagram.
   */
  private _manager:RHReliableDatagram|RHDatagram;

  /**
   * If the init is done or not.
   */
  private _initDone:boolean = false;

  /**
   * Constructor for a new instance of this class using an options object.
   * @param {RadioHeadSerialOptions} options An object containing the options.
   */
  constructor(options: RadioHeadSerialOptions);

  /**
   * Constructor for a new instance of this class using the old style arguments
   * @param {string}  port     The serial port/device to be used for the communication. (e.g. /dev/ttyUSB0)
   * @param {number}  baud     (optional) The baud rate to be used for the communication. (default 9600)
   * @param {number}  address  (optional) The address of this node in the RadioHead network. Address range goes from 1 to 254. (default 1)
   * @param {boolean} reliable (optional) false if RHDatagram should be used instead of RHReliableDatagram. (default true)
   */
  constructor(port: string, baud?: number, address?: number, reliable?: boolean);

  /**
   * Generic constructor for a new instance of this class.
   */
  constructor(options: string|RadioHeadSerialOptions, baud?: number, address?: number, reliable?: boolean){
    super();

    // create options object if a port is provided
    if (typeof options === 'string') {
      options = {
        port: options,
        baud: baud,
        address: address,
        reliable: reliable,
        autoInit: true
      };
    } else if (typeof options !== 'object') {
      throw new Error('Wrong arguments! The first argument must be a string or an object.');
    }

    if (typeof options.port !== 'string' || options.port.length === 0) {
      throw new Error('Port must be a string.');
    }

    // set defaults
    if (typeof options.baud !== 'number') options.baud = 9600;
    if (typeof options.address !== 'number') options.address = 0x01;
    if (typeof options.reliable !== 'boolean') options.reliable = true;
    if (typeof options.autoInit !== 'boolean') options.autoInit = true;

    this._reliable = options.reliable;

    this._driver = new RH_Serial(options.port, options.baud);

    // proxy driver errors
    this._driver.on('error', (err:Error)=>{
      this.emit('error', err);
    });

    if(this._reliable){
      this._manager = new RHReliableDatagram(this._driver, options.address);
    }else{
      this._manager = new RHDatagram(this._driver, options.address);
    }

    if (options.autoInit) {
      this.init();
    }
  }

  /**
   * Init the manager (and the serial port).
   * @return {Promise} Promise which will be resolved when the manager is initialized and the serial port is opened or rejected in case of an error.
   */
  public init (): Promise<void> {
    if (this._initDone) return Promise.resolve();

    return this._manager.init()
    .then(()=>{
      if(this._reliable){
        this._manager.on('recvfromAck',(message:RH_ReceivedMessage)=>{
          this.emit('data', message);
        });
      }else{
        this._manager.on('recv',(message:RH_ReceivedMessage)=>{
          this.emit('data', message);
        });
      }
      this._initDone = true;
      this.emit('init-done');
    });
  }

  /**
   * Returns if the init is done.
   * @return If the init is done (true) or not (false).
   */
  public isInitDone (): boolean {
    return this._initDone;
  }

  /**
   * Closes the Serialport.
   * After close() is called, no messages can be received.
   * @return {Promise} Promise which will be resolved if the SerialPort is closed.
   */
  public close():Promise<void>{
    return this._driver.close();
  }

  /**
   * Send a message through the RadioHead network.
   * @param  {number} to       Recipient address. Use 255 for broadcast messages.
   * @param  {Buffer} data     Buffer containing the message to send.
   * @param  {number} length   Optional number ob bytes to send from the buffer. If not given the whole buffer is sent.
   * @return {Promise}         A Promise which will be resolved when the message has been sent, or rejected in case of an error.
   */
  public send(to:number, data:Buffer, length?:number):Promise<void>{

    if(!length){
      length = data.length;
    }

    if(length <= 0){
      return Promise.reject(new Error('Nothing to send'))
    }

    if(this._reliable){
      return (<RHReliableDatagram>this._manager).sendtoWait(data, length, to);
    }else{
      return this._manager.sendto(data, length, to);
    }

  }

  /**
   * Set the address of this node in the RadioHead network.
   * @param {number} address The new address.
   */
  public setAddress(address:number):void{
    this._manager.setThisAddress(address);
  }

  /**
   * Returns the address of this node.
   * @return {number} The address of this node.
   */
  public thisAddress():number{
    return this._manager.thisAddress();
  }

  /**
   * Sets the maximum number of retries.
   * Defaults to 3 at construction time.
   * If set to 0, each message will only ever be sent once.
   * @param {number} count New number of retries.
   */
  public setRetries(count:number):void{
    if(!this._reliable) return;
    (<RHReliableDatagram>this._manager).setRetries(count);
  }

  /**
   * Returns the currently configured maximum retries count.
   * Can be changed with setRetries().
   * @return {number} The currently configured maximum retries count.
   */
  public getRetries():number{
    if(!this._reliable) return 0;
    return (<RHReliableDatagram>this._manager).retries();
  }

  /**
   * Sets the minimum retransmit timeout in milliseconds.
   * If an ack is taking longer than this time, a message will be retransmitted.
   * Default is 200.
   * @param {number} timeout New timeout in milliseconds.
   */
  public setTimeout(timeout:number):void{
    if(!this._reliable) return;
    (<RHReliableDatagram>this._manager).setTimeout(timeout);
  }

  /**
   * Returns the number of retransmissions we have had to send since starting
   * or since the last call to resetRetransmissions().
   * @return {number} The number of retransmissions we have had to send since starting.
   */
  public getRetransmissions():number{
    if(!this._reliable) return 0;
    return (<RHReliableDatagram>this._manager).retransmissions();
  }

  /**
   * Resets the count of the number of retransmissions to 0.
   */
  public resetRetransmissions():void{
    if(!this._reliable) return;
    (<RHReliableDatagram>this._manager).resetRetransmissions();
  }

  /**
   * Tells the receiver to accept messages with any to address, not just messages addressed to this node or the broadcast address.
   * @param {boolean} promiscuous true if you wish to receive messages with any to address. (default false)
   */
  public setPromiscuous(promiscuous:boolean):void{
    this._driver.setPromiscuous(promiscuous);
  }
}
