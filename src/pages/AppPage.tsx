import React, { useEffect, useCallback } from 'react';
import { User, LogOut } from 'lucide-react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

export default function AppPage({ onLogout }: { onLogout: () => void }) {
  const userName = 'User'; // Placeholder for user name
  const {
    text,
    isRecording,
    toggleRecording,
    start,
    stop,
  } = useSpeechRecognition();

  const handleStart = useCallback(() => {
    console.log('AppPage: handleStart triggered');
    start();
  }, [start]);

  const handleStop = useCallback(() => {
    console.log('AppPage: handleStop triggered');
    stop();
  }, [stop]);

  useEffect(() => {
    console.log('AppPage: Setting up IPC listeners...');

    // Listen for main process events
    window.electronAPI.onStartRecording(handleStart);
    window.electronAPI.onStopRecording(handleStop);
    
    // This will trigger the main process to send any queued messages
    window.electronAPI.sendAppReady();

    // Cleanup
    return () => {
      console.log('AppPage: Cleaning up IPC listeners.');
      window.electronAPI.removeStartRecordingListener(handleStart);
      window.electronAPI.removeStopRecordingListener(handleStop);
    };
  }, [handleStart, handleStop]);

  useEffect(() => {
    if (text && !isRecording && !text.startsWith('Error:')) {
      // Send text to main process for insertion
      console.log(`Sending text to main process: "${text}"`);
      window.electronAPI.sendTextInsertion(text);
    }
  }, [text, isRecording]);

  return (
    <div className="bg-white flex flex-col h-screen font-sans p-8">
      {/* Header */}
      <header className="flex justify-between items-center w-full">
        {/* Logo */}
        <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
          <span className="text-white font-bold text-sm">Logo</span>
        </div>
        {/* User Menu */}
        <div className="flex items-center gap-2">
          <span className="text-gray-700">{userName}</span>
          <User className="w-5 h-5 text-gray-500" />
          <button onClick={onLogout} className="ml-2">
              <LogOut className="w-5 h-5 text-gray-500 hover:text-red-500" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-col items-center justify-center flex-grow text-center">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-2xl font-semibold text-gray-800">
            <span role="img" aria-label="wave">👋</span> 欢迎使用 Voco (Alpha)
          </h1>
          <p className="text-gray-500">
            按住 <span className="font-semibold text-blue-500">Right Option</span> 键开始听写
          </p>
          <button 
            className="mt-8 px-6 py-3 border border-gray-300 rounded-full hover:bg-gray-100 transition-colors text-lg"
            onClick={() => window.open('https://httpstat.us/404', '_blank')}
            >
            探索使用场景
          </button>
        </div>
      </main>
    </div>
  );
} 