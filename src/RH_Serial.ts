/*
 * Node.js module radiohead-serial
 *
 * RadioHead Library (http://www.airspayce.com/mikem/arduino/RadioHead/)
 * Copyright (c) 2014 Mike McCauley
 *
 * Port from native C/C++ code to TypeScript
 * Copyright (c) 2017 Peter Müller <peter@crycode.de> (https://crycode.de/)
 */
/// <reference types="node" />

import {EventEmitter} from 'events';

import * as Promise from 'bluebird';
import * as SerialPort from 'serialport';
import * as ParserByteLength from '@serialport/parser-byte-length';

import {RH_BROADCAST_ADDRESS, RH_ReceivedMessage, RH_FLAGS_APPLICATION_SPECIFIC} from './radiohead-serial';
import {RHcrc_ccitt_update} from './RHCRC';

/**
 * Defines different receiver states in teh receiver state machine
 */
enum RxState {
  RxStateInitialising = 0, // Before init() is called
  RxStateIdle,             // Waiting for an STX
  RxStateDLE,              // Waiting for the DLE after STX
  RxStateData,             // Receiving data
  RxStateEscape,           // Got a DLE while receiving data.
  RxStateWaitFCS1,         // Got DLE ETX, waiting for first FCS octet
  RxStateWaitFCS2          // Waiting for second FCS octet
}

// Special characters
const STX = 0x02;
const ETX = 0x03;
const DLE = 0x10;
const SYN = 0x16;

/**
 * Maximum message length (including the headers) we are willing to support
 */
export const RH_SERIAL_MAX_PAYLOAD_LEN = 64;

/**
 * The length of the headers we add.
 * The headers are inside the payload and are therefore protected by the FCS
 */
export const RH_SERIAL_HEADER_LEN = 4;

/**
 * The maximum message length supported by the RH_Serial driver.
 * This is the largest supported size of a rx or tx buffer.
 */
export const RH_SERIAL_MAX_MESSAGE_LEN = (RH_SERIAL_MAX_PAYLOAD_LEN - RH_SERIAL_HEADER_LEN);

/**
 * Driver to send and receive unaddressed, unreliable datagrams via a serial connection
 */
export class RH_Serial extends EventEmitter {

  /**
   * The SerialPort we will use
   */
  private _port:SerialPort;

  /**
   * The parser we will use for the SerialPort.
   */
  private _parser:any;

  /**
   * The current state of the Rx state machine
   */
  private _rxState:RxState = RxState.RxStateInitialising;

  /**
   * Progressive FCS calc (CCITT CRC-16 covering all received data (but not stuffed DLEs), plus trailing DLE, ETX)
   */
  private _rxFcs:number = 0xffff;

  /**
   * The received FCS at the end of the current message
   */
  private _rxRecdFcs:number = 0x0000;

  /**
   * Current length of data in the Rx buffer
   */
  private _rxBufLen:number = 0;

  /**
   * The Rx buffer
   */
  private _rxBuf:Buffer = new Buffer(RH_SERIAL_MAX_PAYLOAD_LEN); // XXX .fill(0) ?

  // The following vars come from RHGenericDriver

  /**
   * This node id
   */
  private _thisAddress:number = RH_BROADCAST_ADDRESS;

  /**
   * Whether the transport is in promiscuous mode
   */
  private _promiscuous:boolean = false;

  /**
   * TO header to send in all messages
   */
  private _txHeaderTo:number = RH_BROADCAST_ADDRESS;

  /**
   * FROM header to send in all messages
   */
  private _txHeaderFrom:number = RH_BROADCAST_ADDRESS;

  /**
   * ID header to send in all messages
   */
  private _txHeaderId:number = 0;

  /**
   * FLAGS header to send in all messages
   */
  private _txHeaderFlags:number = 0;

  /**
   * Constructor
   * @param  {string} port The name of the port we will use. (e.g. /dev/ttyUSB0 or COM1)
   * @param  {number} baud The baud rate we will use.
   */
  constructor(port:string, baud:number){
    super();

    // construct the SerialPort
    this._port = new SerialPort(port, {
      autoOpen: false, // will be opened at init()
      baudRate: baud
    });


    this._parser = this._port.pipe(new ParserByteLength({ length: 1 }));


    // proxy errors
    this._port.on('error', (err:Error)=>{
      this.emit('error', err);
    });

    // handle received bytes
    this._parser.on('data', (buf:Buffer)=>{
      this.handleRx(buf[0]);
    });
  }

  /**
   * Initialise the Driver transport hardware and software.
   * @return {Promise} Promise which will be resolved if the SerialPort is opened.
   */
  public init():Promise<{}>{
    return new Promise((resolve, reject)=>{
      this._port.open((err:Error)=>{
        if(err){
          reject(err);
        }else{
          this._rxState = RxState.RxStateIdle;
          resolve();
        }
      });
    });
  }

  /**
   * Close the Driver transport hardware and software.
   * @return {Promise} Promise which will be resolved if the SerialPort is closed.
   */
  public close():Promise<{}>{
    return new Promise((resolve, reject)=>{
      this._port.close((err:Error)=>{
        if(err){
          reject(err);
        }else{
          resolve();
        }
      });
    });
  }
  /**
   * Handle a character received from the serial port. Implements
   * the receiver state machine.
   * @param {number} ch One received byte.
   */
  private handleRx(ch:number):void{

    switch(this._rxState){
      case RxState.RxStateIdle:
        if(ch == DLE){
          this._rxState = RxState.RxStateDLE;
        }
        break;

      case RxState.RxStateDLE:
        if(ch == STX){
          this.clearRxBuf();
          this._rxState = RxState.RxStateData;
        }else{
          this._rxState = RxState.RxStateIdle;
        }
        break;

      case RxState.RxStateData:
        if(ch == DLE){
          this._rxState = RxState.RxStateEscape;
        }else{
          this.appendRxBuf(ch);
        }
        break;

      case RxState.RxStateEscape:
        if(ch == ETX){
          // add fcs for DLE, ETX
          this._rxFcs = RHcrc_ccitt_update(this._rxFcs, DLE);
          this._rxFcs = RHcrc_ccitt_update(this._rxFcs, ETX);
          this._rxState = RxState.RxStateWaitFCS1; // End frame
        }else if(ch == DLE){
          this.appendRxBuf(ch);
          this._rxState = RxState.RxStateData;
        }else{
          this._rxState = RxState.RxStateIdle; // Unexpected
        }
        break;

      case RxState.RxStateWaitFCS1:
        this._rxRecdFcs = ch << 8;
        this._rxState = RxState.RxStateWaitFCS2;
        break;

      case RxState.RxStateWaitFCS2:
        this._rxRecdFcs |= ch;
        this._rxState = RxState.RxStateIdle;
        this.validateRxBuf();

      default:
        break;
    }
  }

  /**
   * Empties the Rx buffer.
   */
  protected clearRxBuf():void{
    this._rxFcs = 0xffff;
    this._rxBufLen = 0;
  }

  /**
   * Adds a charater to the Rx buffer
   * @param  {number} ch The charater.
   */
  protected appendRxBuf(ch:number):void{
    if(this._rxBufLen < RH_SERIAL_MAX_PAYLOAD_LEN){
      // Normal data, save and add to FCS
      this._rxBuf[this._rxBufLen++] = ch;
      this._rxFcs = RHcrc_ccitt_update(this._rxFcs, ch);
    }
  }

  /**
   * Check whether the latest received message is complete and uncorrupted.
   */
  protected validateRxBuf():void{
    if(this._rxRecdFcs != this._rxFcs){
      return;
    }

    // check if the message is addressed to this node
    if(this._promiscuous || this._rxBuf[0] == this._thisAddress || this._rxBuf[0] == RH_BROADCAST_ADDRESS){

      // emit event with the received data
      let buf:Buffer = new Buffer(this._rxBufLen-RH_SERIAL_HEADER_LEN);
      this._rxBuf.copy(buf, 0, RH_SERIAL_HEADER_LEN, this._rxBufLen);
      this.emit('recv', <RH_ReceivedMessage>{
        data:        buf,
        length:      this._rxBufLen-RH_SERIAL_HEADER_LEN,
        headerTo:    this._rxBuf[0],
        headerFrom:  this._rxBuf[1],
        headerId:    this._rxBuf[2],
        headerFlags: this._rxBuf[3],
      });
    }

    // clear the rx buffer for ne next message
    this.clearRxBuf();

  }

  /**
   * Sends data fron a buffer using the currently set headers.
   * Note that a message length of 0 is NOT permitted.
   * @param  {Buffer}  data The buffer containing the data to send.
   * @param  {number}  len  Number of bytes from the buffer to send.
   * @return {Promise}      Promise which will be resolved if sending is completed.
   */
  public send(data:Buffer, len:number):Promise<{}>{

    if(len > RH_SERIAL_MAX_MESSAGE_LEN){
      len = RH_SERIAL_MAX_MESSAGE_LEN;
    }

    let txBuf = new Buffer(RH_SERIAL_MAX_PAYLOAD_LEN + RH_SERIAL_MAX_MESSAGE_LEN + 6); // double message len because any byte in the message can be DLE, 2 prepended and 4 appended bytes

    let txFcs = 0xffff; // Initial value

    txBuf[0] = DLE; // Not in FCS
    txBuf[1] = STX; // Not in FCS

    // First the 4 headers
    txBuf[2] = this._txHeaderTo;
    txFcs = RHcrc_ccitt_update(txFcs, this._txHeaderTo);
    txBuf[3] = this._txHeaderFrom;
    txFcs = RHcrc_ccitt_update(txFcs, this._txHeaderFrom);
    txBuf[4] = this._txHeaderId;
    txFcs = RHcrc_ccitt_update(txFcs, this._txHeaderId);
    txBuf[5] = this._txHeaderFlags;
    txFcs = RHcrc_ccitt_update(txFcs, this._txHeaderFlags);

    // next index in the tx buffer
    let idx = 6;

    // Now the message
    for(let i = 0; i < len; i++){
      txBuf[idx++] = data[i];
      txFcs = RHcrc_ccitt_update(txFcs, data[i]);

      // duplicate DLE
      if(data[i] == DLE){
        txBuf[idx++] = DLE; // Not in FCS
      }
    }

    // End of message
    txBuf[idx++] = DLE;
    txFcs = RHcrc_ccitt_update(txFcs, DLE);
    txBuf[idx++] = ETX;
    txFcs = RHcrc_ccitt_update(txFcs, ETX);

    // Add the calculated FCS for this message
    txBuf[idx++] = (txFcs >> 8) & 0xff;
    txBuf[idx++] = txFcs & 0xff;

    // Send the used part of the tx buffer
    return new Promise((resolve:()=>void, reject:(err:Error)=>void)=>{
      this._port.write(txBuf.slice(0,idx), (err:Error)=>{
        if(err){
          reject(err);
        }else{
          resolve();
        }
      });
    });
  }

  /**
   * Sets the address of this node. Defaults to 0xFF. The user may want to change this.
   * his will be used to test the adddress in incoming messages. In non-promiscuous mode,
   * only messages with a TO header the same as thisAddress or the broadcast addess (0xFF) will be accepted.
   * In promiscuous mode, all messages will be accepted regardless of the TO header.
   * In a conventional multinode system, all nodes will have a unique address.
   * You would normally set the header FROM address to be the same as thisAddress (though you dont have to,
   * allowing the possibilty of address spoofing).
   * @param  {number} address The address of this node.
   */
  public setThisAddress(address:number):void{
    if(address < 0 || address > 255) return;
    this._thisAddress = address;
  }

  /**
   * Sets the TO header to be sent in all subsequent messages.
   * @param {number} to The new TO header value.
   */
  public setHeaderTo(to:number):void{
    if(to < 0 || to > 255) return;
    this._txHeaderTo = to;
  }

  /**
   * Sets the FROM header to be sent in all subsequent messages.
   * @param {number} from The new FROM header value.
   */
  public setHeaderFrom(from:number):void{
    if(from < 0 || from > 255) return;
    this._txHeaderFrom = from;
  }

  /**
   * Sets the ID header to be sent in all subsequent messages.
   * @param {number} id The new ID header value.
   */
  public setHeaderId(id:number):void{
    if(id < 0 || id > 255) return;
    this._txHeaderId = id;
  }

  /**
   * Sets and clears bits in the FLAGS header to be sent in all subsequent messages.
   * First it clears the FLAGS according to the clear argument, then sets the flags according to the
   * set argument. The default for clear always clears the application specific flags.
   * @param {number} set   Bitmask of bits to be set. Flags are cleared with the clear mask before being set.
   * @param {number} clear Bitmask of flags to clear. Defaults to RH_FLAGS_APPLICATION_SPECIFIC which clears the application specific flags, resulting in new application specific flags identical to the set.
   */
  public setHeaderFlags(set:number, clear:number=RH_FLAGS_APPLICATION_SPECIFIC):void{
    if(set >=0 && set <=255){
      this._txHeaderFlags &= ~clear;
    }
    if(clear >= 0 && clear <= 255){
      this._txHeaderFlags |= set;
    }
  }

  /**
   * Tells the receiver to accept messages with any TO address, not just messages
   * addressed to thisAddress or the broadcast address.
   * @param {boolean} promiscuous true if you wish to receive messages with any TO address.
   */
  public setPromiscuous(promiscuous:boolean):void{
    this._promiscuous = promiscuous;
  }
}
