class STNode extends AudioWorkletNode {
  constructor(context, options) {
    super(context, 'st-worklet', options); 
  }
}

export default async function createSTNode (context) {
  return new AudioWorkletNode(context, "st-worklet");
}