export {};

declare global {
  interface Window {
    electron: {
      onRecordingStatus: (callback: (status: 'recording' | 'processing' | 'success' | 'idle') => void) => void;
      removeRecordingStatusListener: (callback: (status: 'recording' | 'processing' | 'success' | 'idle') => void) => void;
      onTranscriptionResult: (callback: (result: { success: boolean; text?: string; error?: string }) => void) => void;
      removeTranscriptionResultListener: (callback: (result: { success: boolean; text?: string; error?: string }) => void) => void;
      sendTextInsertion: (text: string) => void;
      store: {
        getTokens: () => Promise<{ accessToken: string; refreshToken: string } | null>;
        setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
        clearTokens: () => void;
      };
    };
  }
} 