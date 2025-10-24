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
      onCountdownUpdate: (callback: (time: number) => void) => void;
      removeCountdownUpdateListener: (callback: (time: number) => void) => void;
      sendFeedbackReady: () => void;
      openExternal: (url: string) => void;
      sendTextInsertion: (text: string) => void;
      sendRefinementState: (state: boolean) => void;
      store: {
        getTokens: () => Promise<{ accessToken?: string; refreshToken?: string }>;
        setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
        clearTokens: () => void;
      };
      permissions: {
        check: () => Promise<{ mic: boolean; accessibility: boolean }>;
        restart: () => Promise<void>;
      };
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
  openExternal: (url: string) => void;
} 