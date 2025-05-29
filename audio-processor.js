class AudioRecorderProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super(options);
    this._bufferSize = options.processorOptions.bufferSize;
    this._buffer = new Float32Array(this._bufferSize);
    this._currentBufferPosition = 0;
    this.port.onmessage = (event) => {
      // console.log('[AudioWorkletProcessor] Received message:', event.data);
    };
    console.log('[AudioWorkletProcessor] Initialized with buffer size:', this._bufferSize);
  }

  process(inputs, outputs, parameters) {
    // We expect a single input, and that input to have a single channel (mono).
    const input = inputs[0];
    if (!input || input.length === 0) {
      // No input available, or input is empty.
      // Return true to keep the processor alive.
      return true;
    }
    const inputChannelData = input[0];

    // If the input channel data is undefined or empty, do nothing.
    if (!inputChannelData || inputChannelData.length === 0) {
        // console.warn('[AudioWorkletProcessor] Empty inputChannelData');
        return true;
    }

    // For simplicity, we'll send data in chunks matching the render quantum size (128 frames typically).
    // More sophisticated buffering could be done here if needed.
    this.port.postMessage(inputChannelData);

    // Return true to keep the processor alive.
    return true;
  }
}

registerProcessor('audio-recorder-processor', AudioRecorderProcessor); 