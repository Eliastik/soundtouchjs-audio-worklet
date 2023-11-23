/*
 * SoundTouch JS audio processing library
 * Copyright (c) Olli Parviainen
 * Copyright (c) Ryan Berdeen
 * Copyright (c) Jakub Fiala
 * Copyright (c) Steve 'Cutter' Blades
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
 */

import { BufferProps } from "./BufferProps";

export default class ProcessAudioBufferSource {
  private leftChannel: Float32Array;
  private rightChannel: Float32Array;
  position = 0;

  constructor(bufferProps: BufferProps, leftChannel: Float32Array, rightChannel: Float32Array) {
    Object.assign(this, bufferProps);
    this.leftChannel = leftChannel;
    this.rightChannel = rightChannel;
  }

  extract(target: Float32Array, numFrames = 0, position = 0) {
    this.position = position;
    let i = 0;
    for (; i < numFrames; i++) {
      target[i * 2] = this.leftChannel[i + position];
      target[i * 2 + 1] = this.rightChannel[i + position];
    }
    return numFrames;
  }

  reset() {
    this.leftChannel = new Float32Array(1);
    this.rightChannel = new Float32Array(1);
  }
}