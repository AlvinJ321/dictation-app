import { useState, useCallback } from 'react';
import axios from 'axios';
import { useAudioRecorder } from './useAudioRecorder';

// Mock data for simulating speech recognition results
const mockSentences = [
  "这是一个语音转文字的示例。",
  "人工智能技术正在快速发展。",
  "语音识别可以提高工作效率。",
  "未来的交互方式将更加自然。",
  "欢迎使用我们的语音转文字应用。"
];

export const useSpeechRecognition = () => {
  const [text, setText] = useState('');
  const { startRecording, stopRecording, isRecording, error: recordingError } = useAudioRecorder();

  const convertBlobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          // Remove the data URL prefix
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to convert to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const start = useCallback(async () => {
    if (isRecording) return;
    await startRecording();
    setText('Recording started...');
  }, [isRecording, startRecording]);

  const stop = useCallback(async () => {
    if (!isRecording) return;
    const audioBlob = await stopRecording();
    
    setText('Processing audio...');
    console.log('Audio blob type:', audioBlob.type);
    console.log('Audio blob size:', audioBlob.size);

    try {
      const response = await axios.post('http://localhost:3001/api/speech', 
        audioBlob,
        {
          headers: {
            'Content-Type': audioBlob.type || 'audio/pcm',
            'X-Audio-Format': 'pcm',
            'X-Audio-Samplerate': '16000'
          }
        }
      );

      console.log('Speech recognition response:', response.data);

      if (response.data && response.data.transcript) {
        setText(response.data.transcript.trim());
      } else if (response.data && response.data.error) {
        setText(`Error: ${response.data.details || response.data.error}`);
      } else {
        setText('Error: Recognition failed. Unexpected response from server.');
      }
    } catch (err: any) {
      console.error('Error in speech recognition request:', err);
      setText(`Error: ${recordingError || err.response?.data?.error || err.message || 'Failed to process audio'}`);
    }
  }, [isRecording, stopRecording, recordingError]);

  const toggleRecording = useCallback(async () => {
    if (!isRecording) {
      await start();
    } else {
      await stop();
    }
  }, [isRecording, start, stop]);

  return {
    isRecording,
    text,
    setText,
    toggleRecording,
    start,
    stop
  };
};