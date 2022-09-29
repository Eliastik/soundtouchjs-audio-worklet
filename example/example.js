/**
 * Loosely based on an example from:
 * http://onlinetonegenerator.com/pitch-shifter.html
 */

import {createScheduledSoundTouchNode} from "../src/createScheduledSoundTouchNode.js";

/**
 * https://github.com/chrisguttandin/standardized-audio-context
 * To see this working with the standaridized-audio-context ponyfill,
 * uncomment these two lines
 */
//import sac from 'https://jspm.dev/standardized-audio-context';
//const { AudioContext, AudioWorkletNode } = sac;

const fileInput = document.getElementById('fileinput');
const playBtn = document.getElementById('play');
const stopBtn = document.getElementById('stop');
const whenSlider = document.getElementById('whenSlider');
const whenOutput = document.getElementById('when');
whenOutput.innerHTML = whenSlider.value;
const startSlider = document.getElementById('startSlider');
const startOutput = document.getElementById('start');
startOutput.innerHTML = startSlider.value;
const endSlider = document.getElementById('endSlider');
const endOutput = document.getElementById('end');
endOutput.innerHTML = endSlider.value;
const tempoSlider = document.getElementById('tempoSlider');
const tempoOutput = document.getElementById('tempo');
tempoOutput.innerHTML = tempoSlider.value;
const pitchSlider = document.getElementById('pitchSlider');
const pitchOutput = document.getElementById('pitch');
pitchOutput.innerHTML = pitchSlider.value;
const keySlider = document.getElementById('keySlider');
const keyOutput = document.getElementById('key');
keyOutput.innerHTML = keySlider.value;
const volumeSlider = document.getElementById('volumeSlider');
const volumeOutput = document.getElementById('volume');
volumeOutput.innerHTML = volumeSlider.value;
const duration = document.getElementById('duration');

let audioCtx;
let gainNode;
let soundtouch;
let buffer;

const resetControls = () => {
  playBtn.setAttribute('disabled', 'disabled');
  stopBtn.setAttribute('disabled', 'disabled');
};

const onEnd = () => {
  //if we don't disconnect the gainNode here, we'll keep adding more and more 
  //and the volume will get louder and louder until your speakers blow up!
  gainNode.disconnect(); // disconnect the DestinationNode
  soundtouch.disconnect(); // disconnect the AudioGainNode

  resetControls();
  playBtn.removeAttribute('disabled');
  updateProgress();
};

const onInitialized = (_duration) => {
  resetControls();
  playBtn.removeAttribute('disabled');
  duration.innerHTML = `Song is ${_duration} seconds long`;
  startSlider.max = _duration;
  endSlider.max = _duration;
  endSlider.value = _duration;
  endOutput.innerHTML = endSlider.value;
};

const updateProgress = () => {
  //currTime.innerHTML = soundtouch;
};

const loadSource = async (file) => {
  if (soundtouch && soundtouch.playing) {
    stop();
  }
  try {
    playBtn.setAttribute('disabled', 'disabled');

    audioCtx = new AudioContext();
    audioCtx.resume();
    const data = await audioCtx.decodeAudioData(await file.arrayBuffer());
    buffer = data;
    await audioCtx.audioWorklet.addModule("../dist/scheduled-soundtouch-worklet.js");
    soundtouch = createScheduledSoundTouchNode(audioCtx, buffer);
    onInitialized(data.duration);
  } catch (err) {
    console.error('[loadSource] ', err);
  }
};

const play = function () {
  if (buffer) {
    soundtouch.tempo = tempoSlider.value;
    soundtouch.pitch = pitchSlider.value;
    soundtouch.onended = onEnd;

    gainNode = audioCtx.createGain();
    soundtouch.connect(gainNode); // SoundTouch goes to the GainNode
    gainNode.connect(audioCtx.destination); // GainNode goes to the AudioDestinationNode

    soundtouch.start(audioCtx.currentTime + Number(whenSlider.value), 
      Number(startSlider.value), 
      Number(endSlider.value) - Number(startSlider.value));

    playBtn.setAttribute('disabled', 'disabled');
    stopBtn.removeAttribute('disabled');
  }
};

const stop = () => {
  gainNode.disconnect(); // disconnect the DestinationNode
  soundtouch.disconnect(); // disconnect the AudioGainNode

  soundtouch.stop();

  stopBtn.setAttribute('disabled', 'disabled');
  playBtn.removeAttribute('disabled');
};

fileInput.onchange = (e) => {
  loadSource(e.target.files[0]);
};

playBtn.onclick = play;
stopBtn.onclick = () => stop();

whenSlider.addEventListener('input', function () {
  whenOutput.innerHTML = this.value;
});

startSlider.addEventListener('input', function () {
  startOutput.innerHTML = this.value;
  endSlider.min = this.value;
  endOutput.innerHTML = endSlider.value;
});

endSlider.addEventListener('input', function () {
  endOutput.innerHTML = this.value;
  startSlider.max = this.value;
  startOutput.innerHTML = startSlider.value;
});

tempoSlider.addEventListener('input', function (e) {
  if (!soundtouch) {
    return e.preventDefault();
  }
  tempoOutput.innerHTML = soundtouch.tempo = this.value;
});

pitchSlider.addEventListener('input', function (e) {
  if (!soundtouch) {
    return e.preventDefault();
  }
  pitchOutput.innerHTML = soundtouch.pitch = this.value;
  soundtouch.tempo = tempoSlider.value;
});

keySlider.addEventListener('input', function (e) {
  if (!soundtouch) {
    return e.preventDefault();
  }
  soundtouch.pitchSemitones = this.value;
  keyOutput.innerHTML = this.value / 2;
  soundtouch.tempo = tempoSlider.value;
});

volumeSlider.addEventListener('input', function () {
  volumeOutput.innerHTML = gainNode.gain.value = this.value;
});
