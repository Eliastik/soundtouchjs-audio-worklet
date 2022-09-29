/**
 * @param {AudioContext} audioCtx - an AudioContext instance
 * @param {AudioBuffer} audioBuffer - an AudioBuffer
 */
export function createScheduledSoundTouchNode(audioCtx, audioBuffer) {
  class ScheduledSoundTouchNode extends AudioWorkletNode {
    constructor(context, audioBuffer) {
      super(context, 'scheduled-soundtouch-worklet', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2], //forces output to stereo, even if input is mono
      });
      
      this.port.onmessage = this._messageProcessor.bind(this);

      // Copy the passed AudioBuffer, so it doesn't become detached and can be reused
      this._audioBuffer = audioBuffer;
      this._playing = false;
      this._ready = false;
    }

    get playing() {
      return this._playing;
    }

    get ready() {
      return this._ready;
    }

    get sampleRate() {
      if (!this.audioBuffer) return undefined;
      return this.audioBuffer.sampleRate;
    }

    get duration() {
      if (!this.audioBuffer) return undefined;
      return this.audioBuffer.duration;
    }

    get bufferLength() {
      if (!this.audioBuffer) return undefined;
      return this.audioBuffer.length;
    }

    get numberOfChannels() {
      if (!this.audioBuffer) return undefined;
      return this.audioBuffer.numberOfChannels;
    }

    get pitch() { 
      return this.parameters.get("pitch");
    }
    set pitch(pitch) {
      this.parameters.get("pitch").value = pitch;
    }

    get pitchSemitones() { 
      return this.parameters.get("pitchSemitones");
    }
    set pitchSemitones(semitone) {
      this.parameters.get("pitchSemitones").value = semitone;
    }

    get rate() { 
      return this.parameters.get("rate");
    }
    set rate(rate) {
      this.parameters.get("rate").value = rate;
    }

    get tempo() { 
      return this.parameters.get("tempo");
    }
    set tempo(tempo) {
      this.parameters.get("tempo").value = tempo;
    }

    /**
     * @start Plays the audio source starting at `offset` for `duration` seconds, scheduled to start at `when`.
     * @when (optional) Used to schedule playback of this node. Provide a value in seconds relative to your AudioContext's currentTime. Default is this.context.currentTime.
     * @offset (optional) Where in the audio source to start at, in seconds. Default is 0.
     * @duration (optional) How long to play the audio source for, in seconds. Default is the duration of the audio buffer.
     */
    start(when = null, offset = null, duration = null) {
      when = when || this.context.currentTime;
      offset = offset || 0;
      duration = duration || this.duration;
      if (!this.ready) {
        throw new Error('[ERROR] ScheduledSoundTouchWorklet is not ready yet!');
      }

      this.parameters.get("when").value = when;
      this.parameters.get("offset").value = Math.floor(offset * this.sampleRate);
      this.parameters.get("stopTime").value = Math.floor(offset * this.sampleRate + duration * this.sampleRate);

      this._playing = true;
      
      this.bufferNode = this.context.createBufferSource();
      this.bufferNode.buffer = this.audioBuffer;
      this.bufferNode.connect(this);
    }

    stop() {
      this._playing = false;

      if (this.bufferNode) {
        this.bufferNode.disconnect(); //disconnecting bufferNode stops the worklet
      }
      this.bufferNode = null;

      if (this.onended && typeof(this.onended) === "function") {
        this.onended();
      }
    }

    _messageProcessor(eventFromWorker) {
      const { message } = eventFromWorker.data;

      if (message === 'PROCESSOR_CONSTRUCTOR') {
        //processor ready for audio buffer, send it over!
        this.audioBuffer = audioBuffer;
        return this.port.postMessage({
          message: 'INITIALIZE_PROCESSOR',
          detail: [
            {
              sampleRate: this.sampleRate,
              duration: this.duration,
              bufferLength: this.bufferLength,
              numberOfChannels: this.numberOfChannels,
            },
            audioBuffer.getChannelData(0),
            this.numberOfChannels > 1
              ? audioBuffer.getChannelData(1)
              : audioBuffer.getChannelData(0),
          ],
        });
      }

      if (message === 'PROCESSOR_READY') {
        if (this.oninitialized && typeof(this.oninitialized) === "function") {
          this.oninitialized(this);
        }
        return this._ready = true;
      }

      if (message === 'PROCESSOR_END') {
        return this.stop();
      }
    }
  }

  return new ScheduledSoundTouchNode(audioCtx, audioBuffer);
}