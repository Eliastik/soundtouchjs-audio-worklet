import 'regenerator-runtime/runtime';
import { SoundTouch, SimpleFilter } from 'soundtouchjs';
import ProcessAudioBufferSource from './ProcessAudioBufferSource';

class STWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this._pipe = new SoundTouch();
    this.bufferSize = 128;
  }

  _messageProcessor(eventFromWorker) {
    const { message, detail } = eventFromWorker.data;

    if (message === 'INITIALIZE_PROCESSOR') {
      const [bufferProps, leftChannel, rightChannel] = detail;
      this.bufferSource = new ProcessAudioBufferSource(
        bufferProps,
        leftChannel,
        rightChannel
      );
      this._samples = new Float32Array(this.bufferSize * 2);
      this._pipe = new SoundTouch();
      this._filter = new SimpleFilter(this.bufferSource, this._pipe);
      this.port.postMessage({
        message: 'PROCESSOR_READY',
      });
      this._initialized = true;
      return true;
    }

    if (message === 'SET_PIPE_PROP' && detail) {
      const { name, value } = detail;
      this._pipe[name] = value;
      this.port.postMessage({
        message: 'PIPE_PROP_CHANGED',
        detail: `Updated ${name} to ${
          this._pipe[name]
        }\ntypeof ${typeof value}`,
      });
      return;
    }

    if (message === 'SET_FILTER_PROP' && detail) {
      const { name, value } = detail;
      this._filter[name] = value;
      this.port.postMessage({
        message: 'FILTER_PROP_CHANGED',
        detail: `Updated ${name} to ${
          this._filter[name]
        }\ntypeof ${typeof value}`,
      });
      return;
    }

    console.log(
      '[PitchShifterWorkletProcessor] Unknown message: ',
      eventFromWorker
    );
  }

  _sendMessage(message, detail = null) {
    if (!message) {
      return;
    }
    this.port.postMessage({ message, detail });
  }

  process(inputs, outputs) {
    if (!inputs[0].length) {
      return true;
    }

    const bufferSource = new ProcessAudioBufferSource(
      {},
      inputs[0][0],
      inputs[0][1]
    );
    let samples = new Float32Array(this.bufferSize * 2);
    const filter = new SimpleFilter(bufferSource, this._pipe);

    const left = outputs[0][0];
    const right = outputs[0][1];

    if (!left || (left && !left.length)) {
      return false;
    }

    const framesExtracted = filter.extract(samples, inputs[0][0].length);

    if (!framesExtracted) {
      this._sendMessage('PROCESSOR_END');
      //return false;
    }

    for (let i = 0; i < framesExtracted; i++) {
      left[i] = samples[i * 2];
      right[i] = samples[i * 2 + 1];
    }

    return true;
  }
}

registerProcessor('st-worklet', STWorklet);
