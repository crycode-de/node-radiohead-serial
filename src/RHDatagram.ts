/*
 * Node.js module radiohead-serial
 *
 * RadioHead Library (http://www.airspayce.com/mikem/arduino/RadioHead/)
 * Copyright (c) 2014 Mike McCauley
 *
 * Port from native C/C++ code to TypeScript
 * Copyright (c) 2017-2024 Peter Müller <peter@crycode.de> (https://crycode.de/)
 */

import { EventEmitter } from 'events';

import { RH_FLAGS_APPLICATION_SPECIFIC, RH_ReceivedMessage } from './radiohead-serial';
import { RH_Serial } from './RH_Serial';

/**
 * Manager class for addressed, unreliable messages.
 */
export class RHDatagram extends EventEmitter {

  /** The used driver */
  protected _driver: RH_Serial;

  /** The address of this node. */
  protected _thisAddress: number;

  /**
   * Constructor
   * @param  {RH_Serial} driver      The used driver.
   * @param  {number}    thisAddress The address of this node.
   */
  constructor (driver: RH_Serial, thisAddress: number) {
    super();

    this._driver = driver;
    this._thisAddress = thisAddress;

    // emit recv event from driver on this class
    this._driver.on('recv', (msg: RH_ReceivedMessage) => {
      this.emit('recv', msg);
    });

    this._driver.on('error', (err: Error) => {
      this.emit('error', err);
    });
  }

  /**
   * Initialize this instance and the driver connected to it.
   * @return {Promise} Promise which will be resolved if the init of the driver is done.
   */
  public init (): Promise<void> {
    return this._driver.init()
    .then(() => {
      this.setThisAddress(this._thisAddress);
    });
  }

  /**
   * Sets the address of this node. Defaults to 0.
   * This will be used to set the FROM address of all messages sent by this node.
   * In a conventional multinode system, all nodes will have a unique address.
   * @param {number} thisAddress The address of this node.
   */
  public setThisAddress (thisAddress: number): void {
    this._driver.setThisAddress(thisAddress);
    // Use this address in the transmitted FROM header
    this.setHeaderFrom(thisAddress);
    this._thisAddress = thisAddress;
  }

  /**
   * Sends a message to the node(s) with the given address.
   * RH_BROADCAST_ADDRESS is a valid address which will cause the message to be
   * accepted by all RHDatagram nodes within range.
   * @param  {Buffer}  data    The buffer containing the data to send.
   * @param  {number}  len     Number of bytes from the buffer to send.
   * @param  {number}  address The address to send the message to.
   * @return {Promise}         Promise which will be resolved if sending is completed.
   */
  public sendto (data: Buffer, len: number, address: number): Promise<void> {
    this.setHeaderTo(address);
    return this._driver.send(data, len);
  }

  /**
   * Returns the address of this node.
   * @return {number} The address of this node.
   */
  public thisAddress (): number {
    return this._thisAddress;
  }

  /**
   * Sets the TO header to be sent in all subsequent messages.
   * @param {number} to The new TO header value.
   */
  public setHeaderTo (to: number): void {
    this._driver.setHeaderTo(to);
  }

  /**
   * Sets the FROM header to be sent in all subsequent messages.
   * @param {number} from The new FROM header value.
   */
  public setHeaderFrom (from: number): void {
    this._driver.setHeaderFrom(from);
  }

  /**
   * Sets the ID header to be sent in all subsequent messages.
   * @param  {number} id The new ID header value.
   */
  public setHeaderId (id: number): void {
    this._driver.setHeaderId(id);
  }

  /**
   * Sets and clears bits in the FLAGS header to be sent in all subsequent messages.
   * @param  {number} set   Bitmask of bits to be set.
   * @param  {number} clear Bitmask of flags to clear.
   */
  public setHeaderFlags (set: number, clear: number = RH_FLAGS_APPLICATION_SPECIFIC): void {
    this._driver.setHeaderFlags(set, clear);
  }
}
