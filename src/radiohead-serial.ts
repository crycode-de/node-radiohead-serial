/*
 * NodeJS RadioHead Serial
 *
 * Copyright (c) 2017 Peter Müller <peter@crycode.de> (https://crycode.de/)
 *
 * NodeJS module for communication between some RadioHead nodes and Node.js using
 * the RH_Serial driver of the RadioHead library.
 */

import {EventEmitter} from 'events';
import * as Promise from 'bluebird';

export class RadioHeadSerial extends EventEmitter {

  /**
   * The maximum message length supported by the RH_Serial driver.
   * This is the largest supported size of a rx or tx buffer.
   */
  public static readonly MAX_MESSAGE_LEN:number = 60;

  /**
   * The loaded Node.js addon.
   */
  private _addon:RadioHeadSerial.Addon;

  /**
   * Indicator if the worker is active.
   */
  private workerActive:boolean = false;

  /**
   * Constructor for a new instance of this class.
   * @param  {string} port    The serial port/device to be used for the communication. (e.g. /dev/ttyUSB0)
   * @param  {number} baud    The baud rate to be used for the communication. (e.g. 9600)
   * @param  {number} address The address of this node in the RadioHead network. Address range goes from 1 to 254.
   */
  constructor(port:string, baud:number, address:number){
    super();

    // load the addon
    this._addon = require('../build/Release/radiohead-serial.node');

    this._addon.init(port, baud, address);
  }

  /**
   * Function for receiving a new message from the worker.
   * Emits a 'data' event with the type of <RadioHeadSerial.ReceivedData>.
   * @param {Error}  err    An Error or undefined if no error occured.
   * @param {number} length The length of the received data.
   * @param {number} from   The from address of the received message.
   * @param {number} to     The to address of the received message.
   * @param {number} id     The id of the received message.
   * @param {number} flags  The flags of the received message.
   * @param {Buffer} data   The received data as a Buffer.
   */
  private messageReceived(err:Error, length:number, from:number, to:number, id:number, flags:number, data:Buffer):void{
    this.emit('data', <RadioHeadSerial.ReceivedData>{
      error: err,
      length: length,
      from: from,
      to: to,
      id: id,
      flags: flags,
      data: data || new Buffer(0)
    });
  }

  /**
   * Start the worker for receiving and sending data.
   * If the worker already active, nothing is done.
   * Emits a 'started' event if the worker has been started.
   */
  public start():void{
    if(this.workerActive){
      return;
    }

    this._addon.start(this.messageReceived.bind(this));
    this.workerActive = true;

    this.emit('started');
  }

  /**
   * Stop the worker for receiving and sending data.
   * If the worker is not active, the Promise will be resolved immediately.
   * Emits a 'stopped' event if the worker has been stopped.
   * @return {Promise} A Promise which will be resolved when the worker has been stopped.
   */
  public stop():Promise<{}>{
    if(!this.workerActive){
      return Promise.resolve(undefined);
    }

    return new Promise((resolve:()=>void)=>{
      this.workerActive = false;
      this._addon.stop(()=>{
        this.emit('stopped');
        resolve();
      });
    });
  }

  /**
   * Returns true if the worker is active.
   * @return {boolean} Current state of the worker.
   */
  public isWorkerActive():boolean{
    return this.workerActive;
  }

  /**
   * Send a message through the RadioHead network.
   * If the worker is not active, the promise will be immediately rejected with an error.
   * @param  {number} to       Recipient address. Use 255 for broadcast messages.
   * @param  {Buffer} data     Buffer containing the message to send.
   * @param  {number} length   Optional number ob bytes to send from the buffer. If not given the whole buffer is sent.
   * @return {Promise}         A Promise which will be resolved when the message has been sent, or rejected in case of an error.
   */
  public send(to:number, data:Buffer, length?:number):Promise<{}>{
    if(!this.workerActive){
      return Promise.reject(new Error('Worker not active'))
    }

    if(!length){
      length = data.length;
    }

    if(length <= 0){
      return Promise.reject(new Error('Nothing to send'))
    }

    return new Promise((resolve:()=>void, reject:(err:Error)=>void)=>{
      this._addon.send(to, length, data, (err:Error)=>{
        if(err){
          reject(err);
        }else{
          resolve();
        }
      });
    });

  }

  /**
   * Set the address of this node in the RadioHead network.
   * @param {number} address The new address.
   */
  public setAddress(address:number):void{
    this._addon.setAddress(address);
  }

  /**
   * Sets the maximum number of retries.
   * Defaults to 3 at construction time.
   * If set to 0, each message will only ever be sent once.
   * @param {number} count New number of retries.
   */
  public setRetries(count:number):void{
    this._addon.setRetries(count);
  }

  /**
   * Returns the currently configured maximum retries count.
   * Can be changed with setRetries().
   * @return {number} The currently configured maximum retries count.
   */
  public getRetries():number{
    return this._addon.getRetries();
  }

  /**
   * Sets the minimum retransmit timeout in milliseconds.
   * If an ack is taking longer than this time, a message will be retransmitted.
   * Default is 200.
   * @param {number} timeout New timeout in milliseconds.
   */
  public setTimeout(timeout:number):void{
    this._addon.setTimeout(timeout);
  }

  /**
   * Returns the number of retransmissions we have had to send since starting
   * or since the last call to resetRetransmissions().
   * @return {number} The number of retransmissions we have had to send since starting.
   */
  public getRetransmissions():number{
    return this._addon.getRetransmissions();
  }

  /**
   * Resets the count of the number of retransmissions to 0.
   */
  public resetRetransmissions():void{
    this._addon.resetRetransmissions();
  }

  /**
   * Tells the receiver to accept messages with any to address, not just messages addressed to this node or the broadcast address.
   * @param {boolean} promiscuous true if you wish to receive messages with any to address. (default false)
   */
  public setPromiscuous(promiscuous:boolean):void{
    this._addon.setPromiscuous(promiscuous);
  }
}
