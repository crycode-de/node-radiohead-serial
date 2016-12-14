/*
 * NodeJS RadioHead Serial
 *
 * (c) 2016 Peter Müller <peter@crycode.de> (https://crycode.de/)
 *
 * NodeJS module for communiation between some RadioHead nodes and NodeJS using
 * the RH_Serial driver of the RadioHead library.
 */
declare namespace RH_Serial {

  /**
   * Interface to the Addon.
   */
  interface Addon {
    init(port:string, baud:number, address:number):void;

    start(onRecvCallback:(err:Error, from:number, length:number, data:Buffer)=>void):void;

    stop(callback:()=>void):void;

    send(to:number, length:number, data:Buffer, callback:(err:Error)=>void):void;

    setAddress(address:number):void;

    setRetries(count:number):void;

    setTimeout(timeout:number):void;
  }

  /**
   * Options for initialisation of the RadioHeadSerial class.
   */
  interface Options {
    /**
     * Hardware port to be used for serial communiation. (e.g. /dev/ttyUSB0)
     */
    port:string;

    /**
     * Baudrate to be used for serial communiation. (e.g. 9600)
     */
    baud:number;

    /**
     * Address of this node in the RadioHead network. (e.g. 0x01)
     */
    address:number;
  }

  /**
   * The RadioHeadSerial Class.
   */
  class RadioHeadSerial {
    constructor(port:string, baud:number, address:number);

    /**
     * Start the worker for receiving and sending data.
     *
     * @param onRecvCallback Callback which is called when a new message is revcived.
     */
    start(onRecvCallback:(err:Error, from:number, length:number, data:Buffer)=>void):void;

    /**
     * Stop the worker for receiving and sending data.
     *
     * @param callback Callback which is called when the worker as been stopped.
     */
    stop(callback:()=>void);

    /**
     * Send a message through the RadioHead network.
     *
     * @param to Recipient address. Use 255 for broadcast messages.
     * @param length Number ob bytes to send from the buffer.
     * @param data Buffer containing the message to send.
     * @param callback Callback called after the message is send. First Argument is a possible Error object.
     */
    send(to:number, length:number, data:Buffer, callback:(err:Error)=>void):void;

    /**
     * Set the address of this node in the RadioHead network.
     *
     * @param address The new address.
     */
    setAddress(address:number):void;

    /**
     * Sets the maximum number of retries.
     * Defaults to 3 at construction time.
     * If set to 0, each message will only ever be sent once.
     *
     * @param count New number of retries.
     */
    setRetries(count:number):void;

    /**
     * Sets the minimum retransmit timeout in milliseconds.
     * If an ack is taking longer than this time, a message will be retransmittet.
     * Default is 200.
     *
     * @param timeout New timeout in milliseconds.
     */
    setTimeout(timeout:number):void;
  }
}

declare module 'radiohead-serial' {
  export import RadioHeadSerial = RH_Serial.RadioHeadSerial;
}
