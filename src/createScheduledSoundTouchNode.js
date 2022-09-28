/**
 *
 * @param {AudioContext} audioCtx - an AudioContext instance
 * @param {AudioBuffer} audioBuffer - an audio buffer
 * @param {callback} - called when the worklet is finished initializing, with the actual ScheduledSoundTouchNode as a parameter.
 */
export function createScheduledSoundTouchNode(audioCtx, audioBuffer, playbackSettings, callback) {
  class ScheduledSoundTouchNode extends AudioWorkletNode {
    /**
     * @constructor
     * @param {BaseAudioContext} context The associated BaseAudioContext.
     * @param {AudioBuffer} audioBuffer fixed length raw binary data buffer (undecoded audio)
     */
    constructor(context, audioBuffer, playbackSettings, callback) {
      const offset = playbackSettings.offset ? playbackSettings.offset * audioBuffer.sampleRate : 0;
      super(context, 'scheduled-soundtouch-worklet', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2], //forces output to stereo, even if input is mono
        processorOptions: {
          when: playbackSettings.when || context.currentTime,
          offset,
          stopTime: offset * audioBuffer.sampleRate + (playbackSettings.duration ? playbackSettings.duration : audioBuffer.duration) * audioBuffer.sampleRate,
        },
      });
      
      this._callback = callback;
      // Copy the passed AudioBuffer, so it doesn't become detached and can be reused
      this._audioBuffer = audioBuffer;
      // an array of all of the listeners
      this.listeners = [];
      // setup our Worklet to Node messaging listener
      this.port.onmessage = this._messageProcessor.bind(this);

      this._playing = false;
      this._ready = false;
    }

    /**
     * @playing (getter)
     * @return {Boolean} is the SoundTouchNode 'playing'
     */
    get playing() {
      return this._playing;
    }

    /**
     * @ready (getter)
     * @return {Boolean} is the SoundTouchNode 'ready'
     */
    get ready() {
      return this._ready;
    }

    /**
     * @sampleRate (getter)
     * @return {Int|undefined} if the audioBuffer has been set it returns the buffer's 'sampleRate',
     *   otherwise returns undefined
     */
    get sampleRate() {
      if (!this.audioBuffer) return undefined;
      return this.audioBuffer.sampleRate;
    }

    /**
     * @duration (getter)
     * @return {Float|undefined} if the audioBuffer has been set it returns the buffer's 'duration'
     *   (in seconds), otherwise returns undefined
     */
    get duration() {
      if (!this.audioBuffer) return undefined;
      return this.audioBuffer.duration;
    }

    /**
     * @bufferLength (getter)
     * @return {Int|undefined} if the audioBuffer has been set it returns the buffer's 'length',
     *   otherwise returns undefined
     */
    get bufferLength() {
      if (!this.audioBuffer) return undefined;
      return this.audioBuffer.length;
    }

    /**
     * @numberOfChannels (getter)
     * @return {Int|undefined} if the audioBuffer has been set it returns the buffer's 'numberOfChannels'
     *   otherwise returns undefined
     */
    get numberOfChannels() {
      if (!this.audioBuffer) return undefined;
      return this.audioBuffer.numberOfChannels;
    }

    /* AudioWorkletProcessor SimpleFilter params*/
    // TODO: convert these to true AudioParams, at some point
    /**
     * @pitch (setter) [NO GETTER]
     * @param {Float} pitch - the 'pitch' value to send to the SoundTouch instance in the Worklet
     */
    set pitch(pitch) {
      this._updatePipeProp('pitch', pitch);
    }

    /**
     * @pitchSemitones (setter) [NO GETTER]
     * @param {Float} semitone - the 'pitchSemitones' value (key change) to send to the SoundTouch instance in the Worklet
     */
    set pitchSemitones(semitone) {
      this._updatePipeProp('pitchSemitones', semitone);
    }

    /**
     * @rate (setter) [NO GETTER]
     * @param {Float} rate - the 'rate' value to send to the SoundTouch instance in the Worklet
     */
    set rate(rate) {
      this._updatePipeProp('rate', rate);
    }

    /**
     * @tempo (setter) [NO GETTER]
     * @param {Float} tempo - the 'tempo' value to send to the SoundTouch instance in the Worklet
     */
    set tempo(tempo) {
      this._updatePipeProp('tempo', tempo);
    }
    /* AudioWorkletProcessor SimpleFilter params*/ 

    /**
     * @play Plays the audio source starting at `offset` for `duration` seconds, scheduled to start at `when`.
     * @when (optional) Used to schedule playback of this node. Provide a value in seconds relative to your AudioContext's currentTime. Default is this.context.currentTime.
     * @offset (optional) Where in the audio source to start at, in seconds. Default is 0.
     * @duration (optional) How long to play the audio source for, in seconds. Default is the duration of the audio buffer.
     */
    play() {
      if (!this.ready) {
        throw new Error('Your processor is not ready yet');
      }
      //console.log(`Scheduling playback for ${when} (currentTime = ${this.context.currentTime}) starting at ${offset} for ${duration}`);

      //this._updatePlaybackProp("when", when);
      //this._updateFilterProp("sourcePosition", offset * this.sampleRate);
      //this._updatePlaybackProp("stopTime", offset * this.sampleRate + duration * this.sampleRate);

      // set the SoundTouchNode to 'playing'
      this._playing = true;
      
      this.bufferNode = this.context.createBufferSource();
      this.bufferNode.buffer = this.audioBuffer;
      this.bufferNode.connect(this);
    }

    stop() {
      this.port.postMessage({
        message: 'STOP_PROCESSOR',
      });

      this._playing = false;

      if (this.onended && typeof(this.onended) === "function") {
        this.onended();
      }
    }

    onprocessorerror(err) {
      throw err;
    }

    /**
     * @_updatePipeProp
     * @param {String} name - the name of the SoundTouch property to set
     * @param {*} value - the value of the SoundTouch property to set
     */
    _updatePipeProp(name, value) {
      // send message to the Worklet to set the SoundTouch instance's property
      this.port.postMessage({
        message: 'SET_PIPE_PROP',
        detail: { name, value },
      });
    }

    /**
     * @_updateFilterProp
     * @param {String} name - the name of the SimpleFilter property to set
     * @param {*} value - the value of the SimpleFilter property to set
     */
    _updateFilterProp(name, value) {
      // send message to the Worklet to set the SimpleFilter instance's property
      this.port.postMessage({
        message: 'SET_FILTER_PROP',
        detail: { name, value },
      });
    }

    _updatePlaybackProp(name, value) {
      this.port.postMessage({
        message: 'SET_PLAYBACK_PROP',
        detail: { name, value },
      });
    }

    /**
     * @_messageProcessor
     * @param {*} eventFromWorker - the message 'event' sent from the AudioWorkletProcessor
     *   eventFromWorker.data {*} - the actual 'message'
     *     message {String} - the message string
     *     detail {Transferable} - any serializable data sent with the message
     */
    _messageProcessor(eventFromWorker) {
      const { message } = eventFromWorker.data;

      if (message === 'PROCESSOR_CONSTRUCTOR') {
        // The AudioWorkletProcessor object is instantiated, so we can now decode the raw audio.
        this.audioBuffer = audioBuffer;
        // creates a simple data structure to transfer to the Worklet, based on the audioBuffer
        this.port.postMessage({
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
        return;
      }

      if (message === 'PROCESSOR_READY') {
        /**
         * The AudioWorkletProcessor (SoundTouchWorklet) has received the bits it needs
         * to begin processing, so the AudioWorkletNode (SoundTouchNode) is now
         * 'ready' for use
         */
        this._ready = true;
        if (this._callback) {
          this._callback(this);
        }
        return;
      }

      /**
       * called by the AudioWorkletProcessor (SoundTouchWorklet) to tell us
       * that it's done with all of the available data in the audioBuffer
       */
      if (message === 'PROCESSOR_END') {
        this.stop();
        return;
      }
    }
  }

  new ScheduledSoundTouchNode(audioCtx, audioBuffer, playbackSettings, callback);
}