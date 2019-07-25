/*
 * Node.js module radiohead-serial
 *
 * RadioHead Library (http://www.airspayce.com/mikem/arduino/RadioHead/)
 * Copyright (c) 2014 Mike McCauley
 *
 * Port from native C/C++ code to TypeScript
 * Copyright (c) 2017-2019 Peter Müller <peter@crycode.de> (https://crycode.de/)
 */
/// <reference types="node" />

import * as Promise from 'bluebird';

import {RH_BROADCAST_ADDRESS, RH_FLAGS_NONE, RH_ReceivedMessage} from './radiohead-serial';

import {RH_Serial} from './RH_Serial';

import {RHDatagram} from './RHDatagram';

/**
 * The acknowledgement bit in the FLAGS.
 */
export const RH_FLAGS_ACK = 0x80;

/**
 * The default retry timeout in milliseconds.
 */
export const RH_DEFAULT_TIMEOUT = 200;

/**
 * The default number of retries.
 */
export const RH_DEFAULT_RETRIES = 3;

/**
 * RHDatagram subclass for sending addressed, acknowledged, retransmitted datagrams.
 */
export class RHReliableDatagram extends RHDatagram {

  /**
   * Count of retransmissions we have had to send
   * @type {number}
   */
  private _retransmissions:number; // uint32_t

  /**
   * The last sequence number to be used
   * Defaults to 0
   * @type {number}
   */
  private _lastSequenceNumber:number; // uint8_t

  /**
   * Retransmit timeout (milliseconds)
   * Defaults to 200
   * @type {number}
   */
  private _timeout:number; // uint16_t

  /**
   * Retries (0 means one try only)
   * Defaults to 3
   * @type {number}
   */
  private _retries:number;

  /**
   * Array of the last seen sequence number indexed by node address that sent it
   * It is used for duplicate detection. Duplicated messages are re-acknowledged when received
   * (this is generally due to lost ACKs, causing the sender to retransmit, even though we have already
   * received that message)
   * @type {number[]}
   */
  private _seenIds:number[];

  /**
   * Constructor.
   * @param  {RH_Serial} driver      The RadioHead driver to use to transport messages.
   * @param  {number}    thisAddress The address to assign to this node.
   */
  constructor(driver:RH_Serial, thisAddress:number){
    super(driver, thisAddress);

    this._retransmissions = 0;
    this._lastSequenceNumber = 0;
    this._timeout = RH_DEFAULT_TIMEOUT;
    this._retries = RH_DEFAULT_RETRIES;

    this._seenIds = [];
    for(let i=0; i<256; i++){
      this._seenIds[i] = 0;
    }
  }

  /**
   * Initialise this manager class.
   * @return {Promise}
   */
  public init():Promise<void>{
    return super.init()
    .then<any>(()=>{
      // ack messages
      this.on('recv', this._recvfromAckHandler.bind(this));
    });
  }

  /**
   * Handler for received messages.
   * This sends ack messages and emits the recvfromAck event.
   * @param {RecvMessage} msg The received message to handle.
   */
  private _recvfromAckHandler(msg:RH_ReceivedMessage):void{
    // Never ACK an ACK
    if(!(msg.headerFlags & RH_FLAGS_ACK)){
      // Its a normal message not an ACK
      if(msg.headerTo === this._thisAddress){
        // Its for this node and
        // Its not a broadcast, so ACK it
        // Acknowledge message with ACK set in flags and ID set to received ID
        this.acknowledge(msg.headerId, msg.headerFrom);
      }
      // If we have not seen this message before, then we are interested in it
      if(msg.headerId !== this._seenIds[msg.headerFrom]){
        // emit event for new message
        this.emit('recvfromAck', msg);
        this._seenIds[msg.headerFrom] = msg.headerId;
      }
      // Else just re-ack it
    }
  }

  /**
   * Sets the minimum retransmit timeout. If sendtoWait is waiting for an ack
   * longer than this time (in milliseconds),
   * it will retransmit the message. Defaults to 200ms. The timeout is measured from the end of
   * transmission of the message. It must be at least longer than the the transmit
   * time of the acknowledgement (preamble+6 octets) plus the latency/poll time of the receiver.
   * For fast modulation schemes you can considerably shorten this time.
   * Caution: if you are using slow packet rates and long packets
   * you may need to change the timeout for reliable operations.
   * The actual timeout is randomly varied between timeout and timeout*2.
   * @param {number} timeout The new timeout period in milliseconds
   */
  public setTimeout(timeout:number):void{
    this._timeout = timeout;
  }

  /**
   * Sets the maximum number of retries. Defaults to 3 at construction time.
   * If set to 0, each message will only ever be sent once.
   * sendtoWait will give up and reject if there is no ack received after all transmissions time out
   * and the retries count is exhausted.
   * @param  {number} retries The maximum number a retries.
   */
  public setRetries(retries:number):void{
    this._retries = retries;
  }

  /**
   * Returns the currently configured maximum retries count.
   * Can be changed with setRetries().
   * @return {number} The currently configured maximum number of retries.
   */
  public retries():number{
    return this._retries;
  }

  /**
   * Send the message (with retries) and waits for an ack. Resolves true if an acknowledgement is received.
   * Rejects if all retries are exhausted (ie up to retries*timeout milliseconds).
   * If the destination address is the broadcast address RH_BROADCAST_ADDRESS (255), the message will
   * be sent as a broadcast, but receiving nodes do not acknowledge, and sendtoWait() resolves immediately
   * without waiting for any acknowledgements.
   * @param  {Buffer}  buf     The buffer to send.
   * @param  {number}  len     Length of the buffer to send.
   * @param  {number}  address The address to send the message to.
   * @return {Promise}
   */
  public sendtoWait(buf:Buffer, len:number, address:number):Promise<void>{
    return new Promise((resolve:()=>void, reject:(err:Error)=>void)=>{
      // Assemble the message
      let thisSequenceNumber = ++this._lastSequenceNumber;
      let retries = 0;

      // promise chain loop with the retries
      let prom:Promise<any>;

      let succeeded = ()=>{
        // _sendtoWaitOne succeeded
        resolve();
      };

      let failed = (_err:Error)=>{
        // _sendtoWaitOne failed
        if(retries++ <= this._retries){
          // retry
          this._retransmissions++;
          prom.then(()=>{
            return this._sendtoWaitOne(buf, len, address, thisSequenceNumber).then(succeeded).catch(failed);
          });
        }else{
          // max retries reached
          reject(new Error('sendtoWait failed'));
        }
      };

      prom = this._sendtoWaitOne(buf, len, address, thisSequenceNumber).then(succeeded).catch(failed);
    });
  }

  /**
   * Internal helper function for sendtoWait().
   * @param  {Buffer}  buf     The buffer to send.
   * @param  {number}  len     Length of the buffer to send.
   * @param  {number}  address The address to send the message to.
   * @param  {number}  thisSequenceNumber The headerId for the message.
   * @return {Promise}
   */
  private _sendtoWaitOne(buf:Buffer, len:number, address:number, thisSequenceNumber:number):Promise<void>{
    return new Promise((resolve:()=>void, reject:(err:Error)=>void)=>{

      this.setHeaderId(thisSequenceNumber);
      this.setHeaderFlags(RH_FLAGS_NONE, RH_FLAGS_ACK); // Clear the ACK flag

      this.sendto(buf, len, address)
      // sendto succeeded
      .then(()=>{
        // Never wait for ACKS to broadcasts:
        if(address === RH_BROADCAST_ADDRESS){
          resolve();
          return;
        }

        // variable for the ack timeout
        let ackTimeout:NodeJS.Timer = null;

        // on ack listener
        let ackListener = (msg:RH_ReceivedMessage)=>{
          if(msg.headerFrom === address
           && msg.headerTo === this._thisAddress
           && (msg.headerFlags & RH_FLAGS_ACK)
           && msg.headerId === thisSequenceNumber){
            // ack received
            // clear timeout, remove listener and resolve
            clearTimeout(ackTimeout);
            this.removeListener('recv', ackListener);
            resolve();
          }
        };
        this.on('recv', ackListener);

        // Compute a new timeout, random between _timeout and _timeout*2
        // This is to prevent collisions on every retransmit
        // if 2 nodes try to transmit at the same time
        let timeout = this._timeout + Math.floor(Math.random() * this._timeout);

        // set ack timeout
        ackTimeout = setTimeout(()=>{
          // ack timed out
          // remove listener and reject
          this.removeListener('recv', ackListener);
          reject(new Error('ACK timeout'));
        }, timeout);

      })
      // sendto failed
      .catch((err:Error)=>{
        reject(err);
      });
    });
  }

  /**
   * Returns the number of retransmissions
   *  we have had to send since starting or since the last call to resetRetransmissions().
   * @return {number} The number of retransmissions since initialisation.
   */
  public retransmissions():number{
    return this._retransmissions;
  }

  /**
   * Resets the count of the number of retransmissions to 0.
   */
  public resetRetransmissions():void{
    this._retransmissions = 0;
  }

  /**
   * Send an ACK for the message id to the given from address
   * @param  {number} id   The id of the message
   * @param  {number} from From address of the message
   */
  private acknowledge(id:number, from:number):Promise<void>{
    this.setHeaderId(id);
    this.setHeaderFlags(RH_FLAGS_ACK);
    return this.sendto(Buffer.from('!'), 1, from);
  }

}
