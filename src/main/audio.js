const AudioRecorder = require('node-audiorecorder');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');
const robot = require('@hurdlegroup/robotjs');

class MainProcessAudio {
    constructor(sendIPC, store, player) {
        this.sendIPC = sendIPC;
        this.store = store;
        this.player = player;
        this.audioRecorder = null;
        this.isRecording = false;
        this.fileName = path.join(app.getPath('temp'), 'recording.wav');
        this.recordingTimer = null;
        this.warningTimer = null;

        const options = {
            program: 'sox',
            device: null,
            bits: 16,
            channels: 1,
            rate: 16000,
            type: 'wav',
            silence: 0,
            keepSilence: true
        };
        this.audioRecorder = new AudioRecorder(options, console);
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

    async makeSpeechRequest(audioBuffer, accessToken) {
        try {
            const response = await axios.post('http://localhost:3001/api/speech', audioBuffer, {
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
                    return await this.makeSpeechRequest(audioBuffer, newAccessToken);
                } else {
                    throw new Error('Authentication failed. Please log in again.');
                }
            }
            throw error;
        }
    }

    startRecording() {
        if (this.isRecording) {
            console.log('[MainAudio] Already recording.');
            return;
        }

        console.log('[MainAudio] Starting recording...');
        this.isRecording = true;
        this.sendIPC('recording-status', 'recording');

        const fileStream = fs.createWriteStream(this.fileName, { encoding: 'binary' });
        this.audioRecorder.start().stream().pipe(fileStream);

        fileStream.on('finish', () => {
            console.log('[MainAudio] Finished writing to file.');
        });

        // Set a timeout to warn the user at 50 seconds
        this.warningTimer = setTimeout(() => {
            console.log('[MainAudio] 50 seconds reached, warning user.');
            this.sendIPC('recording-status', 'warning');
            this.player.play(path.join(__dirname, '../../sfx/50seconds.mp3'), (err) => {
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
        if (!this.isRecording) {
            console.log('[MainAudio] Not recording.');
            return;
        }

        // Clear timers when stopping manually or automatically
        clearTimeout(this.warningTimer);
        clearTimeout(this.recordingTimer);
        this.warningTimer = null;
        this.recordingTimer = null;

        console.log('[MainAudio] Stopping recording...');
        this.isRecording = false;
        this.sendIPC('recording-status', 'processing');
        this.audioRecorder.stop();

        // Play stop sound effect if recording was stopped due to reaching the 60-second limit
        if (options.maxedOut) {
            this.player.play(path.join(__dirname, '../../sfx/stop-recording-bubble.mp3'), (err) => {
                if (err) console.error('Error playing stop sound:', err);
            });
        }

        try {
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
            
            const response = await this.makeSpeechRequest(audioBuffer, accessToken);

            if (response.data && response.data.transcript) {
                console.log('[MainAudio] Transcription success:', response.data.transcript);
                this.sendIPC('transcription-result', {
                    success: true,
                    text: response.data.transcript,
                    maxedOut: options.maxedOut || false,
                });
                robot.typeString(response.data.transcript);
            } else {
                throw new Error(response.data.error || 'No transcript in response');
            }
        } catch (error) {
            console.error('[MainAudio] Error processing transcription:', error.message);
            
            let errorMessage = error.message;
            
            // Handle specific HTTP status codes
            if (error.response) {
                const status = error.response.status;
                if (status === 403) {
                    errorMessage = 'Your session has expired. Please log in again to continue using voice transcription.';
                } else if (status === 401) {
                    errorMessage = 'Authentication required. Please log in again.';
                } else if (status === 429) {
                    errorMessage = 'Too many requests. Please wait a moment before trying again.';
                } else if (status >= 500) {
                    errorMessage = 'Server error. Please try again later.';
                }
            } else if (error.message === 'Authentication failed. Please log in again.') {
                errorMessage = 'Your session has expired. Please log in again to continue using voice transcription.';
                // Notify the renderer that authentication has failed
                this.sendIPC('auth-failed', { reason: 'token_expired' });
            }
            
            this.sendIPC('transcription-result', {
                success: false,
                error: errorMessage
            });
        } finally {
            this.sendIPC('recording-status', 'idle');
            if (fs.existsSync(this.fileName)) {
                fs.unlinkSync(this.fileName);
            }
        }
    }
}

module.exports = { MainProcessAudio }; 