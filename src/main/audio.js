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
    constructor(sendIPC, store, player, getRefinementState, createFeedbackWindow, destroyFeedbackWindow) {
        this.sendIPC = sendIPC;
        this.store = store;
        this.player = player;
        this.getRefinementState = getRefinementState || (() => false);
        this.createFeedbackWindow = createFeedbackWindow;
        this.destroyFeedbackWindow = destroyFeedbackWindow;
        this.audioRecorder = null;
        this.isRecording = false;
        this.fileName = path.join(os.tmpdir(), 'voco_recording.wav');
        this.recordingTimer = null;
        this.warningTimer = null;
        this.maxedOut = false;

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

            const response = await axios.post('http://localhost:3001/api/refresh-token', {
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
            const url = new URL('http://localhost:3001/api/speech');
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

    startRecording() {
        console.log('[DEBUG] MainProcessAudio.startRecording called');
        if (this.isRecording) {
            console.log('[MainAudio] Already recording.');
            return;
        }

        console.log('[MainAudio] Starting recording...');
        this.isRecording = true;
        
        // Create feedback window and send initial status
        this.createFeedbackWindow('recording');
        
        // This IPC is for the main window, the feedback window gets it from its creator
        this.sendIPC('recording-status', 'recording');

        const fileStream = fs.createWriteStream(this.fileName, { encoding: 'binary' });
        this.audioRecorder.start().stream().pipe(fileStream);

        fileStream.on('finish', async () => {
            console.log('[MainAudio] Finished writing to file, starting processing.');
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
                    return;
                }
                
                const accessToken = safeStorage.isEncryptionAvailable()
                    ? safeStorage.decryptString(Buffer.from(encryptedAccessToken, 'latin1'))
                    : encryptedAccessToken;

                const audioBuffer = fs.readFileSync(this.fileName);
                console.log(`[MainAudio] Read file of size: ${audioBuffer.length}`);
                
                const isRefinementOn = this.getRefinementState();
                const response = await this.makeSpeechRequest(audioBuffer, accessToken, isRefinementOn);

                if (response.data.transcript) {
                    robot.typeString(response.data.transcript);
                    this.sendIPC('transcription-result', { success: true, maxedOut: this.maxedOut });
                    this.sendIPC('recording-status', 'success');
                } else if (response.data.error) {
                    console.error('[MainAudio] ASR service returned an error:', response.data.error);
                    this.sendIPC('transcription-result', { success: false, error: response.data.error });
                    this.sendIPC('recording-status', 'error');
                }
            } catch (error) {
                console.error('[MainAudio] Error during transcription processing:', error.message);
                this.sendIPC('transcription-result', { success: false, error: error.message });
                this.sendIPC('recording-status', 'error');
            } finally {
                this.sendIPC('recording-status', 'idle');
                this.destroyFeedbackWindow(); // Destroy the window when processing is done
                if (fs.existsSync(this.fileName)) {
                    fs.unlinkSync(this.fileName);
                }
                this.maxedOut = false;
            }
        });

        // Set a timeout to warn the user at 50 seconds
        this.warningTimer = setTimeout(() => {
            console.log('[MainAudio] 50 seconds reached, warning user.');
            this.sendIPC('recording-status', 'warning');
            const warningSoundPath = isProd
              ? path.join(process.resourcesPath, 'sfx', '50seconds.mp3')
              : path.join(__dirname, '../../sfx/50seconds.mp3');
            this.player.play(warningSoundPath, (err) => {
                if (err) console.error('Error playing 50-second warning sound:', err);
            });
        }, 50000);

        // Set a timeout to automatically stop recording at 60 seconds
        this.recordingTimer = setTimeout(() => {
            console.log('[MainAudio] 60 seconds reached, stopping recording.');
            this.stopRecordingAndProcess({ maxedOut: true });
        }, 60000);
    }

    async stopRecordingAndProcess(options = {}) {
        console.log('[DEBUG] MainProcessAudio.stopRecordingAndProcess called');
        if (!this.isRecording) {
            console.log('[MainAudio] Not recording.');
            return;
        }

        clearTimeout(this.warningTimer);
        clearTimeout(this.recordingTimer);
        this.warningTimer = null;
        this.recordingTimer = null;

        console.log('[MainAudio] Stopping recording...');
        this.isRecording = false;
        this.maxedOut = options.maxedOut || false;
        this.audioRecorder.stop();

        if (options.maxedOut) {
            const stopSoundPath = isProd
              ? path.join(process.resourcesPath, 'sfx', 'stop-recording-bubble.mp3')
              : path.join(__dirname, '../../sfx/stop-recording-bubble.mp3');
            this.player.play(stopSoundPath, (err) => {
                if (err) console.error('Error playing stop sound:', err);
            });
        }
    }
}

module.exports = { MainProcessAudio };