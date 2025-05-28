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

  const toggleRecording = useCallback(async () => {
    try {
      if (!isRecording) {
        // Get token first
        const tokenResponse = await axios.get('http://localhost:3001/api/token');
        console.log('Got token:', tokenResponse.data);

        // Start recording
        await startRecording();
        setText('Recording started...');
      } else {
        // Stop recording and get the audio blob
        const audioBlob = await stopRecording();
        setText('Processing audio...');
        console.log('Audio blob size:', audioBlob.size);

        // Convert audio to base64
        const audioBase64 = await convertBlobToBase64(audioBlob);
        console.log('Base64 length:', audioBase64.length);

        // Send to backend for speech recognition
        const response = await axios.post('http://localhost:3001/api/speech', {
          format: 'pcm',
          rate: 16000,
          channel: 1,
          cuid: 'unique_user_id',
          speech: audioBase64,
          len: audioBlob.size
        });

        console.log('Speech recognition response:', response.data);

        if (response.data.err_no === 0 && response.data.result) {
          // Update the text with the recognition result
          setText(response.data.result.join(''));
        } else {
          setText(`Error: ${response.data.err_msg || 'Recognition failed'}`);
        }
      }
    } catch (err: any) {
      console.error('Error:', err);
      setText(`Error: ${recordingError || err.response?.data?.error || err.message || 'Failed to process audio'}`);
    }
  }, [isRecording, startRecording, stopRecording, recordingError]);

  return {
    isRecording,
    text,
    toggleRecording
  };
};