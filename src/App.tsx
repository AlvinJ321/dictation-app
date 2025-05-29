import React, { useEffect } from 'react';
import Header from './components/Header';
import TextArea from './components/TextArea';
import RecordButton from './components/RecordButton';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import axios from 'axios';

function App() {
  const { isRecording, text, setText, toggleRecording } = useSpeechRecognition();

  // Update page title based on recording state
  useEffect(() => {
    document.title = isRecording ? '正在录音... | 语音转文字' : '语音转文字';
  }, [isRecording]);

  const testAccessToken = async () => {
    const options = {
      method: 'POST',
      url: '/api/oauth/2.0/token',
      params: {
        client_id: 'bkWef0uhNDfDFE70Ni86KUkC',
        client_secret: 'HCiCBWhTrGyvy9T50qo5y018AladxHAC',
        grant_type: 'client_credentials'
      },
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    
    try {
      const response = await axios(options);
      console.log('Access Token Response:', response.data);
      alert('Token received! Check console for details.');
    } catch (error) {
      console.error('Error getting access token:', error);
      alert('Error getting token. Check console for details.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-gray-100">
      <div className="container mx-auto px-4 py-8 flex flex-col items-center min-h-screen">
        <Header />
        
        <main className="flex-1 w-full max-w-3xl mx-auto flex flex-col items-center justify-center py-8 gap-8">
          <TextArea 
            text={text} 
            setText={setText}
            isRecording={isRecording} 
          />
          <RecordButton 
            isRecording={isRecording} 
            onToggleRecording={toggleRecording} 
          />
        </main>

        <footer className="py-4 text-center text-sm text-gray-500">
          © 2025 语音转文字 | 所有权利保留
        </footer>
      </div>
    </div>
  );
}

export default App;