/*
 * Node.js module radiohead-serial
 *
 * Copyright (c) 2017 Peter Müller <peter@crycode.de> (https://crycode.de/)
 *
 * Node.js module for communication between some RadioHead nodes and Node.js using
 * the RH_Serial driver and the RHReliableDatagram manager of the RadioHead library.
 *
 *
 * RadioHead Library (http://www.airspayce.com/mikem/arduino/RadioHead/)
 * Copyright (c) 2014 Mike McCauley
 *
 * Port from native C/C++ code to TypeScript
 * Copyright (c) 2017 Peter Müller <peter@crycode.de> (https://crycode.de/)
 */

import {EventEmitter} from 'events';
import * as Promise from 'bluebird';

import {RH_ReceivedMessage, RH_BROADCAST_ADDRESS, RH_FLAGS_RESERVED,
  RH_FLAGS_APPLICATION_SPECIFIC, RH_FLAGS_NONE} from './RadioHead/RadioHead';
import {RH_Serial, RH_SERIAL_MAX_PAYLOAD_LEN, RH_SERIAL_HEADER_LEN,
  RH_SERIAL_MAX_MESSAGE_LEN} from './RadioHead/RH_Serial';
import {RHDatagram} from './RadioHead/RHDatagram';
import {RHReliableDatagram, RH_FLAGS_ACK, RH_DEFAULT_TIMEOUT,
  RH_DEFAULT_RETRIES} from './RadioHead/RHReliableDatagram';

// export the current version of this module
export const version = '3.0.0';

// export some imports to allow an custom usage
export {
  RH_Serial, RHDatagram, RHReliableDatagram, RH_ReceivedMessage,
  RH_SERIAL_MAX_PAYLOAD_LEN, RH_SERIAL_HEADER_LEN, RH_SERIAL_MAX_MESSAGE_LEN,
  RH_BROADCAST_ADDRESS,
  RH_FLAGS_RESERVED, RH_FLAGS_APPLICATION_SPECIFIC, RH_FLAGS_NONE, RH_FLAGS_ACK,
  RH_DEFAULT_TIMEOUT, RH_DEFAULT_RETRIES
};

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
   * Constructor for a new instance of this class.
   * @param {string}  port     The serial port/device to be used for the communication. (e.g. /dev/ttyUSB0)
   * @param {number}  baud     The baud rate to be used for the communication. (e.g. 9600)
   * @param {number}  address  The address of this node in the RadioHead network. Address range goes from 1 to 254.
   * @param {boolean} reliable (optional) false if RHDatagram should be used instead of RHReliableDatagram. (default true)
   */
  constructor(port:string, baud:number, address:number, reliable:boolean=true){
    super();

    this._reliable = reliable;

    this._driver = new RH_Serial(port, baud);

    if(this._reliable){
      this._manager = new RHReliableDatagram(this._driver, address);
    }else{
      this._manager = new RHDatagram(this._driver, address);
    }

    this._manager.init()
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
      this.emit('init-done');
    })
    .catch((err:Error)=>{
      throw err;
    });
  }

  /**
   * Send a message through the RadioHead network.
   * @param  {number} to       Recipient address. Use 255 for broadcast messages.
   * @param  {Buffer} data     Buffer containing the message to send.
   * @param  {number} length   Optional number ob bytes to send from the buffer. If not given the whole buffer is sent.
   * @return {Promise}         A Promise which will be resolved when the message has been sent, or rejected in case of an error.
   */
  public send(to:number, data:Buffer, length?:number):Promise<{}>{

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
