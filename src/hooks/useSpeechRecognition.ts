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
        // const tokenResponse = await axios.get('http://localhost:3001/api/token');
        // console.log('Got token:', tokenResponse.data); 
        // Token is fetched by the server now, not needed explicitly by client for /api/speech

        // Start recording
        await startRecording();
        setText('Recording started...');
      } else {
        // Stop recording and get the audio blob
        const audioBlob = await stopRecording();
        
        setText(prevText => {
          if (prevText === 'Recording started...' || prevText.startsWith('Error:') || prevText === '') {
            return 'Processing audio...';
          }
          return prevText; 
        });

        console.log('Audio blob type:', audioBlob.type);
        console.log('Audio blob size:', audioBlob.size);

        // Send to backend for speech recognition
        // The server now expects raw audio data and specific headers for Aliyun
        const response = await axios.post('http://localhost:3001/api/speech', 
          audioBlob, // Send the raw blob directly
          {
            headers: {
              'Content-Type': audioBlob.type || 'audio/pcm', // Use blob's type or default to pcm
              'X-Audio-Format': 'pcm', // Based on useAudioRecorder.ts
              'X-Audio-Samplerate': '16000' // Based on useAudioRecorder.ts
            }
          }
        );

        console.log('Speech recognition response:', response.data);

        // Aliyun response structure is different from Baidu
        // Server now returns { transcript: "...", fullResponse: {...} } on success
        if (response.data && response.data.transcript) {
          const newTranscript = response.data.transcript.trim();
          setText(prevText => {
            if (prevText === 'Processing audio...' || prevText === 'Recording started...' || prevText.startsWith('Error:') || prevText === '') {
              return newTranscript;
            } else {
              return prevText.trimEnd() + ' ' + newTranscript;
            }
          });
        } else if (response.data && response.data.error) {
          setText(prevText => {
            const errorMessage = `Error: ${response.data.details || response.data.error}`.trim();
            if (prevText && prevText !== 'Processing audio...' && prevText !== 'Recording started...' && !prevText.startsWith('Error:') && prevText !== '') {
                return prevText.trimEnd() + ' ' + errorMessage;
            }
            return errorMessage;
          });
        } else {
          setText(prevText => {
            const errorMessage = 'Error: Recognition failed. Unexpected response from server.'.trim();
            if (prevText && prevText !== 'Processing audio...' && prevText !== 'Recording started...' && !prevText.startsWith('Error:') && prevText !== '') {
                return prevText.trimEnd() + ' ' + errorMessage;
            }
            return errorMessage;
          });
        }
      }
    } catch (err: any) {
      console.error('Error in toggleRecording:', err);
      setText(prevText => {
        const errorMessage = `Error: ${recordingError || err.response?.data?.error || err.message || 'Failed to process audio'}`.trim();
        if (prevText && prevText !== 'Recording started...' && prevText !== 'Processing audio...' && !prevText.startsWith('Error:') && prevText !== '') {
            return prevText.trimEnd() + ' ' + errorMessage;
        }
        return errorMessage;
      });
    }
  }, [isRecording, startRecording, stopRecording, recordingError]);

  return {
    isRecording,
    text,
    setText,
    toggleRecording
  };
};