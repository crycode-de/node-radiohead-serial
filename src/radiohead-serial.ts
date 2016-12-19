/*
 * NodeJS RadioHead Serial
 *
 * Copyright (C) 2016 Peter Müller <peter@crycode.de> (https://crycode.de/)
 *
 * NodeJS module for communication between some RadioHead nodes and NodeJS using
 * the RH_Serial driver of the RadioHead library.
 */
export class RadioHeadSerial {

  /**
   * The loaded NodeJS addon.
   */
  private _addon:RH_Serial.Addon;

  /**
   * Indicator if the worker is active.
   */
  private workerActive:boolean = false;

  constructor(port:string, baud:number, address:number){
    // load the addon
    this._addon = require('../build/Release/radiohead-serial.node');

    this._addon.init(port, baud, address);
  }

  /**
   * Start the worker for receiving and sending data.
   * If the worker already active, an error is thrown.
   *
   * @param onRecvCallback Callback which is called when a new message is revcived.
   */
  public start(onRecvCallback:(err:Error, from:number, length:number, data:Buffer)=>void):void{
    if(this.workerActive){
      throw new Error('already started');
    }

    this._addon.start(onRecvCallback);
    this.workerActive = true;
  }

  /**
   * Stop the worker for receiving and sending data.
   * If the worker is not active, the callback is immediately called.
   *
   * @param callback Callback which is called when the worker has been stopped.
   */
  public stop(callback:()=>void):void{
    if(!this.workerActive){
      callback();
      return;
    }

    this.workerActive = false;
    this._addon.stop(callback);
  }

  /**
   * Send a message through the RadioHead network.
   *
   * @param to Recipient address. Use 255 for broadcast messages.
   * @param length Number ob bytes to send from the buffer.
   * @param data Buffer containing the message to send.
   * @param callback Callback called after the message is send. First Argument is a possible Error object.
   */
  public send(to:number, length:number, data:Buffer, callback:(err:Error)=>void):void{
    if(!this.workerActive){
      throw new Error('Worker not active');
    }

    this._addon.send(to, length, data, callback);
  }

  /**
   * Set the address of this node in the RadioHead network.
   *
   * @param address The new address.
   */
  public setAddress(address:number):void{
    this._addon.setAddress(address);
  }

  /**
   * Sets the maximum number of retries.
   * Defaults to 3 at construction time.
   * If set to 0, each message will only ever be sent once.
   *
   * @param count New number of retries.
   */
  public setRetries(count:number):void{
    this._addon.setRetries(count);
  }

  /**
   * Returns the currently configured maximum retries count.
   * Can be changed with setRetries().
   */
  public getRetries():number{
    return this._addon.getRetries();
  }

  /**
   * Sets the minimum retransmit timeout in milliseconds.
   * If an ack is taking longer than this time, a message will be retransmitted.
   * Default is 200.
   *
   * @param timeout New timeout in milliseconds.
   */
  public setTimeout(timeout:number):void{
    this._addon.setTimeout(timeout);
  }

  /**
   * Returns the number of retransmissions we have had to send since starting
   * or since the last call to resetRetransmissions().
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
}
