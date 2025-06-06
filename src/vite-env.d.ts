/// <reference types="vite/client" />

interface Window {
    electronAPI: {
      onStartRecording: (callback: () => void) => void;
      removeStartRecordingListener: (callback: () => void) => void;
      onStopRecording: (callback: () => void) => void;
      removeStopRecordingListener: (callback: () => void) => void;
      sendTextInsertion: (text: string) => void;
      sendAppReady: () => void;
    };
  }
