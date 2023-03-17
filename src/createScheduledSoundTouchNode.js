/**
 * @param {AudioContext} audioCtx - an AudioContext instance
 * @param {AudioBuffer} audioBuffer - an AudioBuffer
 * @param {Function(ScheduledSoundTouchNode)} onInitialized - (optional) a function to be called when the internal Soundtouch processor is ready. 
 */
export function createScheduledSoundTouchNode(audioCtx, audioBuffer, onInitialized = null) {
  class ScheduledSoundTouchNode extends AudioWorkletNode {
    /**
     * @param {AudioContext} context - an AudioContext instance
     * @param {AudioBuffer} audioBuffer - an AudioBuffer
     * @param {Function(ScheduledSoundTouchNode)} onInitialized - (optional) a function to be called when the internal Soundtouch processor is ready. 
     */
    constructor(context, audioBuffer, onInitialized = null) {
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
      this.onInitialized = onInitialized;
    }

    /** (Readonly) Returns true if the node is currently playing */
    get playing() {
      return this._playing;
    }

    /** (Readonly) Returns true if the internal Soundtouch processor is ready. 
     * Use the `oninitialized` param if you need a callback when it's ready. */
    get ready() {
      return this._ready;
    }

    /** (Readonly) Returns the sample rate of the audio buffer. */
    get sampleRate() {
      if (!this.audioBuffer) return undefined;
      return this.audioBuffer.sampleRate;
    }

    /** (Readonly) Returns the duration of the audio buffer. */
    get duration() {
      if (!this.audioBuffer) return undefined;
      return this.audioBuffer.duration;
    }

    /** (Readonly) Returns the length of the audio buffer. */
    get bufferLength() {
      if (!this.audioBuffer) return undefined;
      return this.audioBuffer.length;
    }

    /** (Readonly) Returns the number of channels of the audio buffer. */
    get numberOfChannels() {
      if (!this.audioBuffer) return undefined;
      return this.audioBuffer.numberOfChannels;
    }

    /**
     * @param {Function(ScheduledSoundTouchNode)} func - The function to be called when the internal Soundtouch processor is ready.
     */
    set oninitialized(func) {
      this.oninitialized = func;
    }

    /** Returns the currently set pitch of the node. */
    get pitch() { 
      return this.parameters.get("pitch");
    }
    /**
     * @param {Number} pitch - the pitch to change to. A value of 1 means no pitch change. Default is 1.
     */
    set pitch(pitch) {
      this.parameters.get("pitch").value = pitch;
    }

    /** Returns the currently set pitch of the node, in semitones. */
    get pitchSemitones() { 
      return this.parameters.get("pitchSemitones");
    }
    /**
     * @param {Number} semitone - the semitone to change to. A value of 0 means no pitch change. Default is 0.
     */
    set pitchSemitones(semitone) {
      this.parameters.get("pitchSemitones").value = semitone;
    }

    /** The currently set rate of the node. */
    get rate() { 
      return this.parameters.get("rate");
    }
    /**
     * @param {Number} rate - the rate to change to. A value of 1 means no rate change; a value of 2 would mean double the speed. Default is 1.
     */
    set rate(rate) {
      this.parameters.get("rate").value = rate;
    }

    /** The currently set tempo of the node. */
    get tempo() { 
      return this.parameters.get("tempo");
    }
    /**
     * @param {Number} tempo - the tempo to change to. A value of 1 means no tempo change; a value of 2 would mean double the speed. Default is 1.
     */
    set tempo(tempo) {
      this.parameters.get("tempo").value = tempo;
    }

    /**
     * Plays the audio source starting at `offset` for `duration` seconds, scheduled to start at `when`.
     * @param {Number} when - (optional) Used to schedule playback of this node. Provide a value in seconds relative to your AudioContext's currentTime. Defaults to this.context.currentTime.
     * @param {Number} offset - (optional) Where in the audio source to start at, in seconds. Defaults to 0.
     * @param {Number} duration - (optional) How long to play the audio source for, in seconds. Defaults to the duration of the audio buffer.
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

    /** Stops playback of the node. */
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
        this._ready = true;
        if (this.oninitialized && typeof(this.oninitialized) === "function") {
          this.oninitialized(this);
        }
        return;
      }

      if (message === 'PROCESSOR_END') {
        return this.stop();
      }
    }
  }

  return new ScheduledSoundTouchNode(audioCtx, audioBuffer, onInitialized);
}