/* Copyright (c) 2002, 2003, 2004  Marek Michalkiewicz
   Copyright (c) 2005, 2007 Joerg Wunsch
   All rights reserved.

   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions are met:

   * Redistributions of source code must retain the above copyright
     notice, this list of conditions and the following disclaimer.

   * Redistributions in binary form must reproduce the above copyright
     notice, this list of conditions and the following disclaimer in
     the documentation and/or other materials provided with the
     distribution.

   * Neither the name of the copyright holders nor the names of
     contributors may be used to endorse or promote products derived
     from this software without specific prior written permission.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
  LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
  CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
  SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
  INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
  CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
  ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
  POSSIBILITY OF SUCH DAMAGE. */

//	Port to Energia / MPS430 by Yannick DEVOS XV4Y - (c) 2013
//	http://xv4y.radioclub.asia/
//

// Adapted to RadioHead use by Mike McCauley 2014
// This is to prevent name collisions with other similar library functions
// and to provide a consistent API amonng all processors
//

/*
 * Node.js module radiohead-serial
 *
 * RadioHead Library (http://www.airspayce.com/mikem/arduino/RadioHead/)
 * Copyright (c) 2014 Mike McCauley
 *
 * Port from native C/C++ code to TypeScript
 * Copyright (c) 2017 Peter Müller <peter@crycode.de> (https://crycode.de/)
 */

/**
 * Get the lower 8 bits from a 16-bit number.
 * @param  {number} x The original 16-bit number.
 * @return {number}   The new number from the lower 8 bits.
 */
function lo8(x:number):number{
  return (x)&0xff;
}

/**
 * Get the higher 8 bits from a 16-bit number.
 * @param  {number} x The original 16-bit number.
 * @return {number}   The new number from the higher 8 bits.
 */
function hi8(x:number):number{
  return (x)>>8;
}

/**
 * Get the lower 16 bits from a 16-bit+ number.
 * @param  {number} x The original number.
 * @return {number}   The new number from the lower 16 bits.
 */
function lo16(x:number):number{
  return (x)&0xffff;
}

/**
 * Update a 16-bit CRCITT checksum with one new byte.
 * @param  {number} crc  The old CRCITT checksum.
 * @param  {number} data The new byte.
 * @return {number}      The new CRCITT checksum.
 */
export function RHcrc_ccitt_update (crc:number, data:number):number{
  data ^= lo8 (crc);
  data ^= lo8 (data << 4);

  return ((lo16(data << 8) | hi8 (crc)) ^ (data >> 4) ^ lo16(data << 3));
}
