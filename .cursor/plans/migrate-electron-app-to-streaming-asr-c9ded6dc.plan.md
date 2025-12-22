---
name: Migrate Electron App to Paraformer Realtime Streaming ASR
overview: ""
todos:
  - id: e61dd7ce-ffb7-4c35-956e-69dfe36a5ab0
    content: Create paraformerStreamingClient service with startRealtimeSession, sendRealtimeChunk, finishRealtimeSession functions
    status: pending
  - id: c79d1a93-a003-4b8e-aab0-f28b1b746be8
    content: "Modify renderer.js to stream audio chunks in real-time: add downsampling, PCM conversion, and chunk sending logic"
    status: pending
  - id: 6b0cec95-b420-4d3e-add1-1bc85e755678
    content: Add IPC channels in preload.js and handlers in main.js/renderer.js for streaming coordination
    status: pending
  - id: e4f362c7-cd3d-4be7-8a15-ebfe9278f5b5
    content: Update MainProcessAudio.startRecording() and stopRecordingAndProcess() to use streaming API instead of file-based recording
    status: pending
  - id: 7f2dc0d1-5a08-44aa-8b12-8d6a5f63bff3
    content: Remove old file-based recording code (node-audiorecorder, file writing) from audio.js
    status: pending
  - id: 1622cb78-2245-4908-ae1a-5636c229c098
    content: Implement error handling for network errors, session failures, and resource cleanup in both main and renderer processes
    status: pending
---

# Migrate Electron App to Paraformer Realtime Streaming ASR

## Overview

Replace the current file-based ASR implementation in the Electron app with real-time streaming using Paraformer Realtime v2. The app will stream audio chunks during recording to the backend, which will maintain WebSocket connections to DashScope API.

**Scope**: Only Electron app changes. Backend API changes are out of scope but the backend will provide streaming endpoints (as implemented in the POC).

**User Experience**: No changes - still use Right Option key to start/stop recording, transcribed text is typed into the focused input field.

## Backend API Assumptions

The backend will provide these endpoints (based on POC implementation):

- `POST /api/paraformer/realtime-session/start` - Returns `{ sessionId: string }`
- `POST /api/paraformer/realtime-session/:id/chunk` - Accepts PCM audio chunks (Content-Type: application/octet-stream)
- `POST /api/paraformer/realtime-session/:id/finish` - Returns `{ transcript: string }`
- All endpoints require `Authorization: Bearer <accessToken>` header

## Electron App Changes

### 1. Create Streaming Audio Service

- **New File**: `src/services/paraformerStreamingClient.ts` (or add to existing service file)
- Functions:
- `startRealtimeSession(apiBaseUrl: string, accessToken: string): Promise<string>` - Returns sessionId
- `sendRealtimeChunk(apiBaseUrl: string, sessionId: string, buffer: ArrayBuffer, accessToken: string): Promise<void>`
- `finishRealtimeSession(apiBaseUrl: string, sessionId: string, accessToken: string): Promise<{ transcript: string }>`
- Use `fetch` API with proper headers:
- `Content-Type: application/octet-stream` for chunk endpoint
- `Authorization: Bearer <accessToken>` for all endpoints
- Handle token refresh using existing token refresh logic (similar to current `makeSpeechRequest` in `audio.js`)
- Handle 401/403 errors by refreshing token and retrying

### 2. Implement Real-time Audio Streaming in Renderer

- **File**: `renderer.js` (existing file, already has AudioWorklet code)
- Modify to support streaming:
- Keep existing AudioWorklet setup but change behavior:
- Instead of collecting all audio data in `audioData` array, send chunks immediately via `sendRealtimeChunk`
- Store `sessionId` and `accessToken` in module-level variables
- Add functions:
- `downsampleBuffer(buffer: Float32Array, inputRate: number, outputRate: number): Float32Array` - Downsample to 16kHz using averaging method
- `convertToPCM16(float32Array: Float32Array): Int16Array` - Convert Float32 (-1.0 to 1.0) to Int16 PCM
- Modify `startAudioCapture()` to accept `{ apiBaseUrl, sessionId, accessToken }` and start streaming chunks
- Modify `stopAudioCaptureAndProcess()` to call finish endpoint and return transcript
- Handle native sample rate (don't force 16kHz in AudioContext, downsample in processing)

### 3. Update IPC Communication

- **File**: `preload.js`
- Add new IPC channels:
- `start-streaming-recording` - Main → Renderer (with `{ apiBaseUrl, sessionId, accessToken }`)
- `stop-streaming-recording` - Main → Renderer (with `{ apiBaseUrl, sessionId, accessToken }`)
- `streaming-transcript-result` - Renderer → Main (with `{ transcript?: string, error?: string }`)
- Expose these in `window.electronAPI` (or `window.electron` based on existing pattern)

- **File**: `main.js`
- Add IPC handler for `streaming-transcript-result` to receive transcript from renderer
- Update existing recording start/stop IPC handlers to use new streaming flow

- **File**: `renderer.js`
- Add IPC listeners for `start-streaming-recording` and `stop-streaming-recording`
- Send transcript or error back via `streaming-transcript-result` channel

### 4. Update Main Process Audio Handler

- **File**: `src/main/audio.js`
- Modify `startRecording()`:
- Get accessToken from store (same as current implementation)
- Call `startRealtimeSession` API first to get sessionId (using `apiBaseUrl` from constructor)
- Store sessionId in instance variable (`this.sessionId`)
- Send IPC message `start-streaming-recording` to renderer with `{ apiBaseUrl, sessionId, accessToken }`
- Remove file-based recording logic (sox, file writing, file stream)
- Keep existing UI feedback (createFeedbackWindow, sendIPC for recording-status)
- Modify `stopRecordingAndProcess()`:
- Send IPC message `stop-streaming-recording` to renderer (with sessionId and accessToken)
- Wait for renderer to return transcript via IPC `streaming-transcript-result` channel
- Handle transcript result:
- Type it with `robot.typeString(transcript)` (same as current behavior)
- Send IPC updates (`transcription-result`, `recording-status`)
- Clean up sessionId reference
- Keep existing error handling and cleanup logic
- Remove dependencies on `node-audiorecorder` and file system operations for audio

### 5. Code Cleanup

- Remove old file-based recording code:
- Remove `node-audiorecorder` usage from `audio.js`
- Remove file writing logic (`fs.createWriteStream`, file cleanup)
- Remove `this.fileName` and related file path references
- Keep `sox` binary in resources for now (in case needed for other features)

## Key Implementation Details

### Audio Processing Pipeline

1. User presses Right Option key → `startRecording()` called in main process
2. Main process gets accessToken from store
3. Main process calls `/api/paraformer/realtime-session/start` to get sessionId
4. Main process sends IPC `start-streaming-recording` to renderer with `{ apiBaseUrl, sessionId, accessToken }`
5. Renderer gets `MediaStream` from `getUserMedia({ audio: true })`
6. Renderer creates `AudioContext` (use native sample rate, typically 44.1kHz or 48kHz)
7. Renderer creates `MediaStreamAudioSourceNode` from stream
8. Renderer uses `AudioWorkletNode` to process audio in chunks (4096 buffer size)
9. For each chunk:

- Downsample to 16kHz if needed (using averaging method)
- Convert Float32 (-1.0 to 1.0) to Int16 PCM
- Send via HTTP POST to `/api/paraformer/realtime-session/:id/chunk` endpoint (async, don't block)

10. User releases Right Option key → `stopRecordingAndProcess()` called in main process
11. Main process sends IPC `stop-streaming-recording` to renderer
12. Renderer stops audio capture, calls `/api/paraformer/realtime-session/:id/finish` and waits for final transcript
13. Renderer sends transcript back to main process via IPC `streaming-transcript-result`
14. Main process types the transcript with `robot.typeString()` and updates UI (same as current behavior)

### Error Handling

- Handle network errors during chunk sending (log but don't stop recording, backend should handle retries)
- Handle session timeout/expiry (backend should handle, frontend should propagate errors)
- Handle errors from `/finish` endpoint (send error via IPC to main process)
- Provide user feedback for errors via IPC (main process shows error via existing error handling)
- Clean up resources on errors:
- Renderer: Close AudioContext, stop MediaStream tracks, disconnect audio nodes
- Main process: Clear sessionId, send error IPC, update UI status
- Handle token refresh failures gracefully

## Testing Considerations

- Test with various audio input devices
- Test with different native sample rates (44.1kHz, 48kHz)
- Test network interruption scenarios (chunk sending failures)
- Test session cleanup on errors
- Verify final transcript accuracy matches or exceeds current implementation
- Test token refresh during long recordings (if token expires mid-recording)
- Test the Right Option key press/release behavior (should work exactly as before)
- Test typing into different applications (should work as before)

## Dependencies

- No new dependencies needed for Electron app (using native Web APIs and existing packages)
- Backend changes are out of scope but will need to enable the streaming endpoints