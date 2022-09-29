# SoundTouchJS Scheduled Audio Worklet 

This package was created as a fork from [@cutterbl](https://github.com/cutterbl)'s [soundtouchjs-audio-worklet](https://github.com/cutterbl/soundtouchjs-audio-worklet), with various improvements and most importantly adds the ability to schedule playback of the worklet, similar to the way [`AudioBufferSourceNode`](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode) works.

## Installation

To install the package:
- `yarn add @dancecuts/soundtouchjs-scheduled-audio-worklet`
- OR
- `npm install @dancecuts/soundtouchjs-scheduled-audio-worklet`.

Next you'll need to register the actual worklet. The worklet file is located at `/dist/scheduled-soundtouch-worklet.js`. Here's a sample of how to add an `AudioWorklet`:

```js
const context = new AudioContext();
await context.audioWorklet.addModule("scheduled-soundtouch-worklet.js");
// now the ScheduledSoundTouchWorklet is registered!
```

I recommend copying the `/dist/scheduled-soundtouch-worklet.js` file to your project's `/public` directory, then adding the module from that path.

## Creating a ScheduledSoundTouchNode

After you've read in an audio file and decoded it to an `AudioBuffer`, you can easily create a `ScheduledSoundTouchNode` for playback using the `createScheduledSoundTouchNode` function:

```js
import {createScheduledSoundTouchNode} from "@dancecuts/soundtouchjs-audio-worklet";

const context = new AudioContext();
AudioBuffer buffer;
const node = createScheduledSoundTouchNode(audioContext, buffer);
```

## ScheduledSoundTouchNode properties

The `ScheduledSoundTouchNode` has the following properties you can change: 

- `pitch` (float): Changes the pitch of playback. Defaults to `1`.
  - Note: `pitch` takes precendence over `pitchSemitones`, meaning if both are set only `pitch` will apply.
- `pitchSemitones` (float): Changes the pitch of playback in half-step increments. Defaults to `0`.
- `rate` (float): Controls the "rate" of playback (tempo is changed and affects pitch). Defaults to `1`.
- `tempo` (float): Controls the tempo of playback (tempo is changed and does not affect pitch). Defaults to `1`.

*Note*: these properties can be changed at any time, even if `ready` is `false`.

**Example**: to change the pitch of `node` to 2: 

```js
node.pitch = 2;
```

There are also the following **read-only** properties:

- `ready` (boolean): True if the worklet is ready for playback.
- `playing` (boolean): True if playback is active.
- `duration` (float): The duration of the provided buffer.
- `bufferLength` (float): The length of the provided buffer.
- `sampleRate` (float): The sample rate of the provided buffer.
- `numberOfChannels` (int): The number of channels of the provided buffer.

## ScheduledSoundTouchNode events

You can listen to the following events:

- `onended`: called when playback has ended, either from: the `duration` parameter of `start()` being reached, the end of the audio buffer, or `stop()` being called.
- `oninitialized`: called when the worklet is ready for playback. The instance is provided as a parameter.

**Example**: to listen to the `onended` event of `node`:

```js
node.onended = () => {
  //...do disconnect()s or other work here...
};
```

## ScheduledSoundTouchNode playback

### start()

The `start()` function has three **optional** parameters to control playback, which are based off of [`AudioBufferSourceNode`](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start)'s `start()` function:

- `when` (float, optional): Used to schedule playback of this node. Provide a value in seconds relative to the provided `AudioContext`'s `currentTime`. Default is the provided `AudioContext`'s `currentTime` (meaning playback begins immediately).
- `offset` (float, optional): Where in the audio source to start at, in seconds. Default is `0`.
- `duration` (float, optional): How long to play the audio source for, in seconds. Default is the duration of the audio buffer.

**Note: You cannot call `start()` until the worklet is ready!** You can check if it's ready by checking the `.ready` property, or listening to the `oninitialized` event.

**Example**: to play the node 2 seconds from now, 10 seconds into the track for 5 seconds:

```js
node.start(context.currentTime + 2, 10, 5);
```

### stop()

Stops playback immediately. Unlike [`AudioBufferSourceNode`](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start#exceptions), this node can be reused and `start()` can be called as many times as you need.

## Complete example

*For a live demonstration, check out `/example`. If loading the worklet is throwing CORS errors, you'll need to host it on a server - I recommend using the [`serve` package](https://www.npmjs.com/package/serve) for this.*

```js
import {createScheduledSoundTouchNode} from "@dancecuts/soundtouchjs-audio-worklet";

const context = new AudioContext();
await context.audioWorklet.addModule("scheduled-soundtouch-worklet.js");
// now the ScheduledSoundTouchWorklet is registered!

// read in "my-audio-file.mp3" and decode it as an AudioBuffer
const fileArrayBuffer = await (await fetch("./my-audio-file.mp3")).arrayBuffer();
const buffer = await context.decodeAudioData(fileArrayBuffer);
// create node
const node = createScheduledSoundTouchNode(audioContext, buffer);
// ...assign properties as needed... 
node.pitch = 1.2; 
node.tempo = 1.4;

node.oninitialized = () => {
  // node is now ready for playback
  node.connect(context);
  node.start(context.currentTime + 2, 10, 5);
};
node.onended = () => {
  // node finished playing, clean up
  node.disconnect();
};
```