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
            
            const response = await axios.post('http://localhost:3001/api/speech', audioBuffer, {
                headers: {
                    'Content-Type': 'audio/wav',
                    'Authorization': `Bearer ${accessToken}`,
                    'X-Audio-Format': 'wav',
                    'X-Audio-SampleRate': '16000'
                }
            });

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
            this.sendIPC('transcription-result', {
                success: false,
                error: error.message
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