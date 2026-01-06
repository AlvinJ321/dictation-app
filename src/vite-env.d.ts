/// <reference types="vite/client" />

type Status = 'idle' | 'recording' | 'processing' | 'success';
type TranscriptionResult = { success: boolean; text?: string; error?: string; };

interface Window {
    electronAPI: {
      onRecordingStatus: (callback: (status: Status) => void) => void;
      removeRecordingStatusListener: (callback: (status: Status) => void) => void;
      onTranscriptionResult: (callback: (result: TranscriptionResult) => void) => void;
      removeTranscriptionResultListener: (callback: (result: TranscriptionResult) => void) => void;
      getAppStoreReceipt: () => Promise<string | null>;
    };
  }
