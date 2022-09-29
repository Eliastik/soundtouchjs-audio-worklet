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

import { SoundTouch, SimpleFilter } from 'soundtouchjs';
import ProcessAudioBufferSource from './ProcessAudioBufferSource';

class ScheduledSoundTouchWorklet extends AudioWorkletProcessor {
  constructor(nodeOptions) {
    super();

    this._initialized = false;
    this.bufferSize = 128;
    this.port.onmessage = this._messageProcessor.bind(this);
    this.port.postMessage({
      message: 'PROCESSOR_CONSTRUCTOR',
      detail: nodeOptions,
    });
  }

  //Called when message recieved from AudioWorkletNode
  _messageProcessor(eventFromWorker) {
    const { message, detail } = eventFromWorker.data;

    if (message === 'INITIALIZE_PROCESSOR') {
      const [bufferProps, leftChannel, rightChannel] = detail;
      this.bufferSource = new ProcessAudioBufferSource(
        bufferProps,
        leftChannel,
        rightChannel
      );
      this._pipe = new SoundTouch();
      this._filter = new SimpleFilter(this.bufferSource, this._pipe);
      this._filter.sourcePosition = this.offset;

      // Notify the AudioWorkletNode (SoundTouchNode) that the processor is now ready
      this._initialized = true;
      return this.port.postMessage({
        message: 'PROCESSOR_READY',
      });
    }
  }

  //Sends message to the AudioWorkletNode (ScheduledSoundTouchNode)
  _sendMessage(message, detail = null) {
    if (!message) {
      return;
    }
    this.port.postMessage({ message, detail });
  }

  static get parameterDescriptors() {
    return [
      {
        name: "pitch",
        defaultValue: 1,
      },
      {
        name: "pitchSemitones",
        defaultValue: 0,
      },
      {
        name: "tempo",
        defaultValue: 1,
      },
      {
        name: "rate",
        defaultValue: 1,
      },
      {
        name: "when",
        defaultValue: 0,
      },
      {
        name: "offset",
        defaultValue: 0,
      },
      {
        name: "stopTime",
        defaultValue: 0,
      },
    ];
  }

  reset() {
    this._filter.sourcePosition = 0; //reset the sourcePosition so if playback is started again, it doesn't continue where it left off.
  }

  resetAndEnd() {
    this.reset();
    this._sendMessage('PROCESSOR_END');
  }
   
  process(inputs, outputs, parameters) {
    const convertKRateParams = (params) => { 
      return Object.fromEntries(Object.entries(params).map(([key, val]) => [key, val[0]])); 
    };

    const {pitch, pitchSemitones, tempo, rate, when, offset, stopTime} = convertKRateParams(parameters);
    // eslint-disable-next-line no-undef
    if (!this._initialized || !inputs[0].length || currentTime < when) {
      this.reset();
      return true;
    }

    const left = outputs[0][0];
    const right = outputs[0][1];

    if (!left || (left && !left.length)) {
      this.resetAndEnd();
      return false;
    }

    //cannot assign both pitch and pitchSemitones, so assign pitch only if it's changed from its default of 1.
    if (pitch !== 1) {
      this._pipe.pitch = pitch;
    }
    else {  
      this._pipe.pitchSemitones = pitchSemitones;
    }
    this._pipe.tempo = tempo;
    this._pipe.rate = rate;
    if (!this._filter.sourcePosition || Number.isNaN(this._filter.sourcePosition) || this._filter.sourcePosition < offset) { //seek to playback start point
      this._filter.sourcePosition = offset;
    }
    if (this._filter.sourcePosition > stopTime) { //duration reached, stop playing
      this.resetAndEnd();
      return true;
    }

    let samples = new Float32Array(this.bufferSize * 2);
    const framesExtracted = this._filter.extract(samples, inputs[0][0].length);

    if (!framesExtracted) { //no more audio left to process, stop playing
      this.resetAndEnd();
      return true;
    }

    // The sampleBuffer is an interleavered Float32Array (LRLRLRLRLR...), so we pull the bits from their corresponding location
    for (let i = 0; i < framesExtracted; i++) {
      left[i] = samples[i * 2];
      if (right) { //check might be necessary if output is mono? idk
        right[i] = samples[i * 2 + 1];
      }
    }

    return true;
  }
}

registerProcessor('scheduled-soundtouch-worklet', ScheduledSoundTouchWorklet);
