export {};

declare global {
  interface Window {
    electron: {
      onRecordingStatus: (callback: (status: 'recording' | 'processing' | 'success' | 'idle' | 'warning' | 'error') => void) => void;
      removeRecordingStatusListener: (callback: (status: 'recording' | 'processing' | 'success' | 'idle' | 'warning' | 'error') => void) => void;
      onTranscriptionResult: (callback: (result: { success: boolean; text?: string; error?: string; maxedOut?: boolean }) => void) => void;
      removeTranscriptionResultListener: (callback: (result: { success: boolean; text?: string; error?: string; maxedOut?: boolean }) => void) => void;
      onAuthFailed: (callback: (data: { reason: string }) => void) => void;
      removeAuthFailedListener: (callback: (data: { reason: string }) => void) => void;
      sendTextInsertion: (text: string) => void;
      sendRefinementState: (state: boolean) => void;
      store: {
        getTokens: () => Promise<{ accessToken: string; refreshToken: string } | null>;
        setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
        clearTokens: () => void;
      };
      permissions: {
        check: () => Promise<{ mic: boolean; accessibility: boolean }>;
        restart: () => Promise<void>;
      };
      onMaxedOut: (callback: () => void) => void;
      removeMaxedOutListener: (callback: () => void) => void;
      sendFeedbackReady: () => void;
      ipcRenderer: any;
    };
  }
}

export interface IElectronAPI {
  store: {
    getTokens: () => Promise<{ accessToken?: string; refreshToken?: string }>;
    setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
    clearTokens: () => void;
  };
  sendFeedbackReady: () => void;
} 