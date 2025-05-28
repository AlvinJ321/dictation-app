import { useState, useRef, useCallback } from 'react';

interface AudioRecorderHook {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob>;
  isRecording: boolean;
  error: string | null;
}

export function useAudioRecorder(): AudioRecorderHook {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const audioStream = useRef<MediaStream | null>(null);
  const audioData = useRef<Float32Array[]>([]);
  const processorNode = useRef<ScriptProcessorNode | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,          // Mono channel
          sampleRate: 16000,        // 16kHz sample rate
          echoCancellation: true,   // Enable echo cancellation
          noiseSuppression: true,   // Enable noise suppression
        } 
      });

      audioStream.current = stream;
      audioContext.current = new AudioContext({ sampleRate: 16000 });
      
      // Create audio source from stream
      const source = audioContext.current.createMediaStreamSource(stream);
      
      // Create script processor for raw PCM data
      processorNode.current = audioContext.current.createScriptProcessor(4096, 1, 1);
      
      // Process audio data
      processorNode.current.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        audioData.current.push(new Float32Array(inputData));
      };

      // Connect the nodes
      source.connect(processorNode.current);
      processorNode.current.connect(audioContext.current.destination);

      setIsRecording(true);
      setError(null);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to start recording: ' + err);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    return new Promise<Blob>((resolve, reject) => {
      try {
        if (!audioContext.current || !processorNode.current || !audioStream.current) {
          reject(new Error('No active recording'));
          return;
        }

        // Stop recording
        processorNode.current.disconnect();
        audioStream.current.getTracks().forEach(track => track.stop());

        // Combine all audio chunks
        const combinedData = new Float32Array(audioData.current.reduce((acc, curr) => acc + curr.length, 0));
        let offset = 0;
        audioData.current.forEach(buffer => {
          combinedData.set(buffer, offset);
          offset += buffer.length;
        });

        // Convert to 16-bit PCM
        const pcmData = new Int16Array(combinedData.length);
        for (let i = 0; i < combinedData.length; i++) {
          const s = Math.max(-1, Math.min(1, combinedData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Create blob with PCM data
        const audioBlob = new Blob([pcmData], { type: 'audio/pcm' });
        
        // Clean up
        audioContext.current.close();
        audioContext.current = null;
        processorNode.current = null;
        audioStream.current = null;
        audioData.current = [];
        setIsRecording(false);

        console.log('PCM audio blob size:', audioBlob.size);
        resolve(audioBlob);
      } catch (err) {
        console.error('Error processing audio:', err);
        reject(err);
      }
    });
  }, []);

  return {
    startRecording,
    stopRecording,
    isRecording,
    error
  };
} 