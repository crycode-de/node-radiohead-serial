/*
 * Node.js RadioHead Serial
 *
 * Copyright (c) 2017 Peter Müller <peter@crycode.de> (https://crycode.de/)
 *
 * Node.js module for communication between some RadioHead nodes and Node.js using
 * the RH_Serial driver of the RadioHead library.
 */

/**
 * Namespace for interfaces and types for RadioHeadSerial.
 */
declare namespace RadioHeadSerial {

  /**
   * Interface to the class of the Addon.
   */
  interface Addon {
    /**
     * Constructor for a new instance of the native addon this class.
     * @param  {string} port    The serial port/device to be used for the communication. (e.g. /dev/ttyUSB0)
     * @param  {number} baud    The baud rate to be used for the communication. (e.g. 9600)
     * @param  {number} address The address of this node in the RadioHead network. Address range goes from 1 to 254.
     */
    RadioHeadSerial(port:string, baud:number, address:number):void;
  }

  /**
   * Interface to an instance of the Addon.
   */
  interface AddonInstance {
    start(onRecvCallback:(err:Error, length:number, from:number, to:number, id:number, flags:number, data:Buffer)=>void):void;

    stop(callback:()=>void):void;

    send(to:number, length:number, data:Buffer, callback:(err:Error)=>void):void;

    setAddress(address:number):void;

    setRetries(count:number):void;

    getRetries():number;

    setTimeout(timeout:number):void;

    getRetransmissions():number;

    resetRetransmissions():void;

    setPromiscuous(promiscuous:boolean):void;

    destroy():void;
  }

  /**
   * Data received by the worker.
   * @type {Object}
   */
  type ReceivedData = {
    /**
     * An error or undefined if no error occurred.
     * @type {Error}
     */
    error: Error;

    /**
     * The length of the received data.
     * @type {number}
     */
    length: number;

    /**
     * The from address of the received message.
     * @type {number}
     */
    from: number;

    /**
     * The to address of the received message.
     * @type {number}
     */
    to: number;

    /**
     * The id of the received message.
     * @type {number}
     */
    id: number;

    /**
     * The flags of the received message.
     * @type {number}
     */
    flags: number;

    /**
     * The received data as a Buffer.
     * @type {Buffer}
     */
    data: Buffer;
  }


}

/**
 * The module for RadioHeadSerial.
 */
declare module 'radiohead-serial' {

  // Import the EventEmitter
  import {EventEmitter} from 'events';

  // Import Promise from Bluebird
  import * as Promise from 'bluebird';

  /**
   * The RadioHeadSerial Class.
   */
  export class RadioHeadSerial extends EventEmitter {

    /**
     * The maximum message length supported by the RH_Serial driver.
     * This is the largest supported size of a rx or tx buffer.
     */
    public static readonly MAX_MESSAGE_LEN:number;

    /**
     * Constructor for a new instance of this class.
     * @param  {string} port    The serial port/device to be used for the communication. (e.g. /dev/ttyUSB0)
     * @param  {number} baud    The baud rate to be used for the communication. (e.g. 9600)
     * @param  {number} address The address of this node in the RadioHead network. Address range goes from 1 to 254.
     */
    constructor(port:string, baud:number, address:number);

    /**
     * Function for receiving a new message from the worker.
     * Emits a 'data' event with the type of <RadioHeadSerial.ReceivedData>.
     * @param {Error}  err    An Error or undefined if no error occured.
     * @param {number} length The length of the received data.
     * @param {number} from   The from address of the received message.
     * @param {number} to     The to address of the received message.
     * @param {number} id     The id of the received message.
     * @param {number} flags  The flags of the received message.
     * @param {Buffer} data   The received data as a Buffer or undefined if no data received.
     */
    private messageReceived(err:Error, length:number, from:number, to:number, id:number, flags:number, data:Buffer):void;

    /**
     * Start the worker for receiving and sending data.
     * If the worker already active, nothing is done.
     * Emits a 'started' event if the worker has been started.
     */
    public start():void;

    /**
     * Stop the worker for receiving and sending data.
     * If the worker is not active, the Promise will be resolved immediately.
     * Emits a 'stopped' event if the worker has been stopped.
     * @return {Promise} A Promise which will be resolved when the worker has been stopped.
     */
    public stop():Promise<{}>;

    /**
     * Send a message through the RadioHead network.
     * If the worker is not active, the promise will be immediately rejected with an error.
     * @param  {number} to       Recipient address. Use 255 for broadcast messages.
     * @param  {Buffer} data     Buffer containing the message to send.
     * @param  {number} length   Optional number ob bytes to send from the buffer. If not given the whole buffer is sent.
     * @return {Promise}         A Promise which will be resolved when the message has been sent, or rejected in case of an error.
     */
    public send(to:number, data:Buffer, length?:number):Promise<{}>;

    /**
     * Set the address of this node in the RadioHead network.
     * @param {number} address The new address.
     */
    public setAddress(address:number):void;

    /**
     * Sets the maximum number of retries.
     * Defaults to 3 at construction time.
     * If set to 0, each message will only ever be sent once.
     * @param {number} count New number of retries.
     */
    public setRetries(count:number):void;

    /**
     * Returns the currently configured maximum retries count.
     * Can be changed with setRetries().
     * @return {number} The currently configured maximum retries count.
     */
    public getRetries():number;

    /**
     * Sets the minimum retransmit timeout in milliseconds.
     * If an ack is taking longer than this time, a message will be retransmitted.
     * Default is 200.
     * @param {number} timeout New timeout in milliseconds.
     */
    public setTimeout(timeout:number):void;

    /**
     * Returns the number of retransmissions we have had to send since starting
     * or since the last call to resetRetransmissions().
     * @return {number} The number of retransmissions we have had to send since starting.
     */
    public getRetransmissions():number;

    /**
     * Resets the count of the number of retransmissions to 0.
     */
    public resetRetransmissions():void;

    /**
     * Tells the receiver to accept messages with any to address, not just messages addressed to this node or the broadcast address.
     * @param {boolean} promiscuous true if you wish to receive messages with any to address. (default false)
     */
    public setPromiscuous(promiscuous:boolean):void;

    /**
     * Releases the reference to the current instance of this class.
     * If no other reference exists (e.g. the Node.js variable is also deleted) the
     * garbage collector can destroy this instance.
     * After destroy is called, no interaction with this class should be made.
     * This should be used to free up memory if this instance will not be used again.
     */
    public destroy():void;
  }
}
