const AudioRecorder = require('node-audiorecorder');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');
const robot = require('@hurdlegroup/robotjs');
const os = require('os');

const isProd = process.env.NODE_ENV === 'production' || (app && app.isPackaged);
let soxPath;
if (isProd) {
  // Use the resources path for binaries
  soxPath = path.join(process.resourcesPath, 'resource', 'sox');
} else {
  soxPath = 'sox';
}
console.log('[MainAudio] Using sox binary at:', soxPath);

class MainProcessAudio {
    constructor(sendIPC, store, player, getRefinementState, createFeedbackWindow, destroyFeedbackWindow, apiBaseUrl) {
        this.sendIPC = sendIPC;
        this.store = store;
        this.player = player;
        this.getRefinementState = getRefinementState || (() => false);
        this.createFeedbackWindow = createFeedbackWindow;
        this.destroyFeedbackWindow = destroyFeedbackWindow;
        this.apiBaseUrl = apiBaseUrl;
        this.audioRecorder = null;
        this.isRecording = false;
        this.fileName = path.join(os.tmpdir(), 'voco_recording.wav');
        this.recordingTimer = null;
        this.warningTimer = null;
        this.countdownTimer = null;
        this.maxedOut = false;
        this.realtimeSessionId = null;
        this.audioStream = null;
        this.wavHeaderParsed = false;
        this.pcmDataStartOffset = 44; // Typical WAV header size

        this.audioRecorder = new AudioRecorder({
            program: isProd ? path.join(process.resourcesPath, 'sox') : 'sox',
            device: null,
            bits: 16,
            channels: 1,
            rate: 16000,
            type: 'wav',
            silence: 0,
            keepSilence: true
        }, console);
    }

    async refreshToken() {
        try {
            const encryptedRefreshToken = this.store.get('refreshToken');
            if (!encryptedRefreshToken) {
                console.log('[MainAudio] No refresh token available.');
                return null;
            }

            const refreshToken = safeStorage.isEncryptionAvailable()
                ? safeStorage.decryptString(Buffer.from(encryptedRefreshToken, 'latin1'))
                : encryptedRefreshToken;

            const response = await axios.post(`${this.apiBaseUrl}/api/refresh-token`, {
                refreshToken: refreshToken
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.data && response.data.accessToken) {
                // Store the new tokens
                const newAccessToken = response.data.accessToken;
                const newRefreshToken = response.data.refreshToken || refreshToken;

                if (safeStorage.isEncryptionAvailable()) {
                    this.store.set('accessToken', safeStorage.encryptString(newAccessToken).toString('latin1'));
                    this.store.set('refreshToken', safeStorage.encryptString(newRefreshToken).toString('latin1'));
                } else {
                    this.store.set('accessToken', newAccessToken);
                    this.store.set('refreshToken', newRefreshToken);
                }

                console.log('[MainAudio] Token refreshed successfully.');
                return newAccessToken;
            }
        } catch (error) {
            console.error('[MainAudio] Failed to refresh token:', error.message);
            // Clear tokens on refresh failure
            this.store.delete('accessToken');
            this.store.delete('refreshToken');
        }
        return null;
    }

    async makeSpeechRequest(audioBuffer, accessToken, isRefinementOn) {
        try {
            const url = new URL(`${this.apiBaseUrl}/api/speech`);
            if (isRefinementOn) {
                url.searchParams.append('refine', 'true');
            }
            const response = await axios.post(url.toString(), audioBuffer, {
                headers: {
                    'Content-Type': 'audio/wav',
                    'Authorization': `Bearer ${accessToken}`,
                    'X-Audio-Format': 'wav',
                    'X-Audio-SampleRate': '16000'
                }
            });
            return response;
        } catch (error) {
            // If we get a 401 or 403, try to refresh the token and retry
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                console.log('[MainAudio] Token expired, attempting to refresh...');
                const newAccessToken = await this.refreshToken();
                
                if (newAccessToken) {
                    console.log('[MainAudio] Token refreshed, retrying request...');
                    return await this.makeSpeechRequest(audioBuffer, newAccessToken, isRefinementOn);
                } else {
                    throw new Error('Authentication failed. Please log in again.');
                }
            }
            throw error;
        }
    }

    async startRealtimeSession(accessToken, isRefinementOn = false) {
        try {
            const url = new URL(`${this.apiBaseUrl}/api/paraformer/realtime-session/start`);
            if (isRefinementOn) {
                url.searchParams.append('refine', 'true');
            }
            const response = await axios.post(url.toString(), {}, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            return response.data.sessionId;
        } catch (error) {
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                console.log('[MainAudio] Token expired, attempting to refresh...');
                const newAccessToken = await this.refreshToken();
                if (newAccessToken) {
                    console.log('[MainAudio] Token refreshed, retrying startRealtimeSession...');
                    return await this.startRealtimeSession(newAccessToken, isRefinementOn);
                } else {
                    throw new Error('Authentication failed. Please log in again.');
                }
            }
            throw error;
        }
    }

    async sendRealtimeChunk(sessionId, pcmBuffer, accessToken) {
        try {
            await axios.post(`${this.apiBaseUrl}/api/paraformer/realtime-session/${sessionId}/chunk`, pcmBuffer, {
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'Authorization': `Bearer ${accessToken}`
                },
                maxRedirects: 0,
                validateStatus: (status) => status === 200 || status === 204
            });
        } catch (error) {
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                console.log('[MainAudio] Token expired during chunk send, attempting to refresh...');
                const newAccessToken = await this.refreshToken();
                if (newAccessToken) {
                    console.log('[MainAudio] Token refreshed, retrying sendRealtimeChunk...');
                    return await this.sendRealtimeChunk(sessionId, pcmBuffer, newAccessToken);
                } else {
                    console.error('[MainAudio] Failed to refresh token, chunk send failed');
                    // Don't throw, just log - we don't want to stop recording on a single chunk failure
                }
            } else {
                console.error('[MainAudio] Failed to send realtime chunk:', error.message);
                // Don't throw, just log - we don't want to stop recording on a single chunk failure
            }
        }
    }

    async finishRealtimeSession(sessionId, accessToken) {
        try {
            const response = await axios.post(`${this.apiBaseUrl}/api/paraformer/realtime-session/${sessionId}/finish`, {}, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            return response.data;
        } catch (error) {
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                console.log('[MainAudio] Token expired, attempting to refresh...');
                const newAccessToken = await this.refreshToken();
                if (newAccessToken) {
                    console.log('[MainAudio] Token refreshed, retrying finishRealtimeSession...');
                    return await this.finishRealtimeSession(sessionId, newAccessToken);
                } else {
                    throw new Error('Authentication failed. Please log in again.');
                }
            }
            throw error;
        }
    }

    // Parse WAV header to find where PCM data starts
    parseWavHeader(buffer) {
        if (buffer.length < 44) {
            return null; // Not enough data for header
        }

        // Check RIFF header
        const riff = buffer.toString('ascii', 0, 4);
        if (riff !== 'RIFF') {
            return null;
        }

        // Check WAVE header
        const wave = buffer.toString('ascii', 8, 12);
        if (wave !== 'WAVE') {
            return null;
        }

        // Find 'data' chunk
        let dataOffset = 12;
        while (dataOffset < buffer.length - 8) {
            const chunkId = buffer.toString('ascii', dataOffset, dataOffset + 4);
            const chunkSize = buffer.readUInt32LE(dataOffset + 4);
            
            if (chunkId === 'data') {
                return dataOffset + 8; // Return offset to actual PCM data
            }
            
            dataOffset += 8 + chunkSize;
        }

        return 44; // Fallback to typical header size
    }

    async startRecording() {
        console.log('[DEBUG] MainProcessAudio.startRecording called');
        if (this.isRecording) {
            console.log('[MainAudio] Already recording.');
            return;
        }

        // Check for access token before starting
        const encryptedAccessToken = this.store.get('accessToken');
        if (!encryptedAccessToken) {
            console.log('[MainAudio] No access token found. Blocking transcription.');
            this.sendIPC('transcription-result', {
                success: false,
                error: 'You must be logged in to transcribe.'
            });
            this.sendIPC('recording-status', 'error');
            return;
        }

        const accessToken = safeStorage.isEncryptionAvailable()
            ? safeStorage.decryptString(Buffer.from(encryptedAccessToken, 'latin1'))
            : encryptedAccessToken;

        try {
            console.log('[MainAudio] Starting realtime session...');
            // Get refinement state
            const isRefinementOn = this.getRefinementState();
            // Start realtime session first
            const sessionId = await this.startRealtimeSession(accessToken, isRefinementOn);
            this.realtimeSessionId = sessionId;
            console.log('[MainAudio] Realtime session started:', sessionId);

            console.log('[MainAudio] Starting recording...');
            this.isRecording = true;
            this.wavHeaderParsed = false;
            this.pcmDataStartOffset = 44;
            
            // Create feedback window and send initial status
            this.createFeedbackWindow('recording');
            
            // This IPC is for the main window, the feedback window gets it from its creator
            this.sendIPC('recording-status', 'recording');

            // Get the audio stream
            this.audioStream = this.audioRecorder.start().stream();
            let wavHeaderBuffer = Buffer.alloc(0);

            // Handle audio chunks
            this.audioStream.on('data', async (chunk) => {
                if (!this.isRecording || !this.realtimeSessionId) {
                    return;
                }

                // Accumulate header bytes until we have enough to parse
                if (!this.wavHeaderParsed) {
                    wavHeaderBuffer = Buffer.concat([wavHeaderBuffer, chunk]);
                    
                    if (wavHeaderBuffer.length >= 44) {
                        // Try to parse the header
                        const pcmOffset = this.parseWavHeader(wavHeaderBuffer);
                        if (pcmOffset !== null) {
                            this.pcmDataStartOffset = pcmOffset;
                            this.wavHeaderParsed = true;
                            
                            // Send any PCM data that comes after the header in this chunk
                            if (wavHeaderBuffer.length > pcmOffset) {
                                const pcmData = wavHeaderBuffer.slice(pcmOffset);
                                // Fire and forget - don't block audio processing
                                this.sendRealtimeChunk(this.realtimeSessionId, pcmData, accessToken)
                                    .catch(err => console.error('[MainAudio] Failed to send initial chunk:', err));
                            }
                        } else {
                            // If we can't parse, assume standard 44-byte header
                            this.pcmDataStartOffset = 44;
                            this.wavHeaderParsed = true;
                            
                            if (wavHeaderBuffer.length > 44) {
                                const pcmData = wavHeaderBuffer.slice(44);
                                this.sendRealtimeChunk(this.realtimeSessionId, pcmData, accessToken)
                                    .catch(err => console.error('[MainAudio] Failed to send initial chunk:', err));
                            }
                        }
                    }
                } else {
                    // Header already parsed, send chunk as-is (it's already PCM data)
                    // Fire and forget - don't block audio processing
                    this.sendRealtimeChunk(this.realtimeSessionId, chunk, accessToken)
                        .catch(err => console.error('[MainAudio] Failed to send chunk:', err));
                }
            });

            this.audioStream.on('end', () => {
                console.log('[MainAudio] Audio stream ended.');
            });

            this.audioStream.on('error', (err) => {
                console.error('[MainAudio] Audio stream error:', err);
                this.sendIPC('recording-status', 'error');
                this.sendIPC('transcription-result', { success: false, error: err.message });
            });

            // Set a timeout to warn the user at 80 seconds
            this.warningTimer = setTimeout(() => {
                console.log('[MainAudio] 80 seconds reached, warning user.');
                this.sendIPC('recording-status', 'warning');
                const warningSoundPath = isProd
                  ? path.join(process.resourcesPath, 'sfx', '50seconds.mp3')
                  : path.join(__dirname, '../../sfx/50seconds.mp3');
                this.player.play(warningSoundPath, (err) => {
                    if (err) console.error('Error playing final warning sound:', err);
                });
                
                // Start countdown from 10 seconds
                let remainingTime = 10;
                this.sendIPC('countdown-update', remainingTime);
                
                this.countdownTimer = setInterval(() => {
                    remainingTime--;
                    this.sendIPC('countdown-update', remainingTime);
                    
                    if (remainingTime <= 0) {
                        clearInterval(this.countdownTimer);
                        this.countdownTimer = null;
                    }
                }, 1000);
            }, 80000);

            // Set a timeout to automatically stop recording at 90 seconds
            this.recordingTimer = setTimeout(() => {
                console.log('[MainAudio] 90 seconds reached, stopping recording.');
                this.stopRecordingAndProcess({ maxedOut: true });
            }, 90000);
        } catch (error) {
            console.error('[MainAudio] Error starting recording:', error.message);
            this.isRecording = false;
            this.realtimeSessionId = null;
            this.sendIPC('recording-status', 'error');
            this.sendIPC('transcription-result', { success: false, error: error.message });
        }
    }

    async stopRecordingAndProcess(options = {}) {
        console.log('[DEBUG] MainProcessAudio.stopRecordingAndProcess called');
        if (!this.isRecording) {
            console.log('[MainAudio] Not recording.');
            return;
        }

        clearTimeout(this.warningTimer);
        clearTimeout(this.recordingTimer);
        clearInterval(this.countdownTimer);
        this.warningTimer = null;
        this.recordingTimer = null;
        this.countdownTimer = null;

        console.log('[MainAudio] Stopping recording...');
        this.isRecording = false;
        this.maxedOut = options.maxedOut || false;
        
        // Stop the audio recorder
        this.audioRecorder.stop();
        
        // Clean up stream reference
        if (this.audioStream) {
            this.audioStream.removeAllListeners();
            this.audioStream = null;
        }

        if (options.maxedOut) {
            const stopSoundPath = isProd
              ? path.join(process.resourcesPath, 'sfx', 'stop-recording-bubble.mp3')
              : path.join(__dirname, '../../sfx/stop-recording-bubble.mp3');
            this.player.play(stopSoundPath, (err) => {
                if (err) console.error('Error playing stop sound:', err);
            });
        }

        // Finish the realtime session and get transcript
        const sessionId = this.realtimeSessionId;
        if (!sessionId) {
            console.error('[MainAudio] No session ID found. Cannot finish session.');
            this.sendIPC('recording-status', 'error');
            this.sendIPC('transcription-result', { success: false, error: 'No active session found.' });
            this.sendIPC('recording-status', 'idle');
            this.destroyFeedbackWindow();
            return;
        }

        try {
            this.sendIPC('recording-status', 'processing');

            const encryptedAccessToken = this.store.get('accessToken');
            if (!encryptedAccessToken) {
                console.log('[MainAudio] No access token found. Blocking transcription.');
                this.sendIPC('transcription-result', {
                    success: false,
                    error: 'You must be logged in to transcribe.'
                });
                this.sendIPC('recording-status', 'error');
                this.sendIPC('recording-status', 'idle');
                this.destroyFeedbackWindow();
                this.realtimeSessionId = null;
                return;
            }

            const accessToken = safeStorage.isEncryptionAvailable()
                ? safeStorage.decryptString(Buffer.from(encryptedAccessToken, 'latin1'))
                : encryptedAccessToken;

            console.log('[MainAudio] Finishing realtime session:', sessionId);
            const result = await this.finishRealtimeSession(sessionId, accessToken);

            if (result && result.transcript) {
                console.log('[MainAudio] Transcript received:', result.transcript);
                // 设置极短的键盘延迟，让文字几乎瞬间全部出现，而不是逐字显示
                robot.setKeyboardDelay(1);
                robot.typeString(result.transcript);
                this.sendIPC('transcription-result', { success: true, maxedOut: this.maxedOut });
                this.sendIPC('recording-status', 'success');
            } else if (result && result.error) {
                console.error('[MainAudio] ASR service returned an error:', result.error);
                this.sendIPC('transcription-result', { success: false, error: result.error });
                this.sendIPC('recording-status', 'error');
            } else {
                console.error('[MainAudio] No transcript or error in result:', result);
                this.sendIPC('transcription-result', { success: false, error: 'No transcript received from server.' });
                this.sendIPC('recording-status', 'error');
            }
        } catch (error) {
            console.error('[MainAudio] Error during transcription processing:', error.message);
            this.sendIPC('transcription-result', { success: false, error: error.message });
            this.sendIPC('recording-status', 'error');
        } finally {
            this.sendIPC('recording-status', 'idle');
            this.destroyFeedbackWindow();
            this.realtimeSessionId = null;
            this.maxedOut = false;
        }
    }
}

module.exports = { MainProcessAudio };
