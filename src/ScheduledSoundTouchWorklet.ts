/*
 * SoundTouch JS audio processing library
 * Copyright (c) DanceCuts LLC
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
//@ts-ignore
import { SoundTouch, SimpleFilter } from 'soundtouchjs';
import ProcessAudioBufferSource from './ProcessAudioBufferSource';

class ScheduledSoundTouchWorklet extends AudioWorkletProcessor {
  private initialized = false;
  private bufferSource: ProcessAudioBufferSource | null = null;
  private pipe: SoundTouch;
  private filter: SimpleFilter;
  private filterPositionAtStart = 0;
  private justEnded = false;
  private sampleRate = 44100;

  constructor(nodeOptions: AudioWorkletNodeOptions) {
    super();

    this.initialized = false;
    this.port.onmessage = this.messageProcessor.bind(this);
    this.port.postMessage({
      message: 'PROCESSOR_CONSTRUCTOR',
      detail: nodeOptions,
    });
  }

  /**
   * Called when message received from AudioWorkletNode
   * @param {Map} eventFromWorker - a map containing the keys `message` and `detail`
   * @returns null
   */
  private messageProcessor(eventFromWorker: any) {
    const { message, detail } = eventFromWorker.data;

    if (message === 'INITIALIZE_PROCESSOR') {
      const [bufferProps, leftChannel, rightChannel] = detail;
      this.bufferSource = new ProcessAudioBufferSource(
        bufferProps,
        leftChannel,
        rightChannel
      );
      this.pipe = new SoundTouch();
      this.filter = new SimpleFilter(this.bufferSource, this.pipe);
      this.filterPositionAtStart = 0;
      this.sampleRate = bufferProps.sampleRate;

      // Notify the AudioWorkletNode (ScheduledSoundTouchNode) that the processor is now ready
      this.initialized = true;
      return this.port.postMessage({
        message: 'PROCESSOR_READY',
      });
    } else if (message === 'TERMINATE_PROCESSOR') {
      this.stop();
    }
  }

  /**
   * Sends message to the AudioWorkletNode (ScheduledSoundTouchNode)
   * @param {any} message 
   * @param {any} detail 
   * @returns 
   */
  private sendMessage(message: any, detail = null) {
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
        name: "offsetSamples",
        defaultValue: 0,
      },
      {
        name: "playbackDurationSamples",
        defaultValue: 0,
      }
    ];
  }

  private reset() {
    if (this.filter) {
      this.filter.sourcePosition = 0; //reset the sourcePosition so if playback is started again, it doesn't continue where it left off.
      this.filterPositionAtStart = this.filter.position;
    }
  }

  private stop() {
    if (this.bufferSource) {
      this.bufferSource.reset();
    }

    this.bufferSource = null;
    this.pipe = null;
    this.filter = null;
  }

  private resetAndEnd() {
    this.reset();
    this.justEnded = true;
    this.sendMessage('PROCESSOR_END');
  }
   
  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
    if (!this.initialized || !inputs[0].length || !this.bufferSource) {
      this.reset();
      return true;
    }
    
    const {pitch, pitchSemitones, tempo, rate, when, offsetSamples, playbackDurationSamples} = Object.fromEntries(Object.entries(parameters).map(([key, val]) => [key, val[0]]));
    const sampleRate = this.sampleRate;
    const bufferSize = inputs[0][0].length;
    // eslint-disable-next-line no-undef
    const _currentTime = currentTime;

    //pitch takes precedence over pitchSemitones
    if (pitch !== 1) {
      this.pipe.pitch = pitch;
      this.pipe.pitchSemitones = 1;
    }
    else {  
      this.pipe.pitchSemitones = pitchSemitones;
    }
    //rate takes precedence over tempo
    if (rate !== 1) {
      this.pipe.rate = rate;
      this.pipe.tempo = 1;
    } else {
      this.pipe.tempo = tempo;
    }
    if (!this.filter.sourcePosition || Number.isNaN(this.filter.sourcePosition) || this.filter.sourcePosition < offsetSamples) { 
      //seek to playback start point
      this.filter.sourcePosition = offsetSamples;
    }

    const playbackPosition = this.filter.position - this.filterPositionAtStart;
    if (playbackPosition > playbackDurationSamples) { 
      //playbackDurationSamples reached, stop playing
      console.log(`playbackDurationSamples reached, stop playing`);
      this.resetAndEnd();
      return true;
    }

    if (_currentTime + (bufferSize / sampleRate) < when) { 
      //not playing yet!
      console.log(`not playing yet!`);
      this.reset();
      return true;
    }

    const left = outputs[0][0];
    const right = outputs[0].length > 1 ? outputs[0][1] : outputs[0][0];

    if (!left || (left && !left.length)) {
      console.log(`!left`);
      this.resetAndEnd();
      return false; // no output?! guess it's time to die!
    }

    const startFrame = Math.round(Math.max(0, (when - _currentTime) * sampleRate));
    const totalFrames = Math.min(bufferSize - startFrame, playbackDurationSamples - playbackPosition);
    let samples = new Float32Array(totalFrames * 2);
    const framesExtracted = this.filter.extract(samples, totalFrames);

    if (isNaN(samples[0]) || !framesExtracted) {
      //no more audio left to process, stop playing
      //console.log({when, _currentTime, sampleRate, playbackDurationSamples, playbackPosition, startFrame, totalFrames, samples, framesExtracted});
      this.resetAndEnd();
      return true;
    }

    //sometimes after the PROCESSOR_END message is sent, process gets accidently called an extra time, resulting in garbage output. this justEnded variable fixes that. 
    if (this.justEnded) {
      //console.log(`justEnded`);
      this.justEnded = false;
      return true;
    }

    // The sampleBuffer is an interleavered Float32Array (LRLRLRLRLR...), so we pull the bits from their corresponding location
    for (let i = startFrame; i < startFrame + framesExtracted; i++) {
      left[i] = samples[i * 2];
      right[i] = samples[i * 2 + 1];
      if (isNaN(left[i]) || isNaN(right[i])) {
        left[i] = 0;
        right[i] = 0;
      }
    }

    return true;
  }
}

registerProcessor('scheduled-soundtouch-worklet', ScheduledSoundTouchWorklet);
