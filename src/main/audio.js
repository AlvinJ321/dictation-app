const AudioRecorder = require('node-audiorecorder');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { app } = require('electron'); // safeStorage no longer needed here
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
        this.store = store; // Kept for other potential uses, though not for tokens
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

    async makeSpeechRequest(audioBuffer, cookieString, isRefinementOn) {
        try {
            const url = new URL(`${this.apiBaseUrl}/api/speech`);
            if (isRefinementOn) {
                url.searchParams.append('refine', 'true');
            }
            const response = await axios.post(url.toString(), audioBuffer, {
                headers: {
                    'Content-Type': 'audio/wav',
                    // Manually attach the session cookies.
                    'Cookie': cookieString,
                    'X-Audio-Format': 'wav',
                    'X-Audio-SampleRate': '16000'
                },
                // We need to handle 401 manually since we're not using the default validation
                validateStatus: (status) => status < 500,
            });
    
            if (response.status === 401 || response.status === 403) {
                throw new Error('Authentication failed. Please log in again.');
            }
            
            return response;
        } catch (error) {
            // The error is re-thrown to be handled by the caller.
            throw error;
        }
    }

    startRecording(session) {
        console.log('[DEBUG] MainProcessAudio.startRecording called');
        if (this.isRecording) {
            console.log('[MainAudio] Already recording.');
            return;
        }

        console.log('[MainAudio] Starting recording...');
        this.isRecording = true;
        
        this.createFeedbackWindow('recording');
        
        this.sendIPC('recording-status', 'recording');

        const fileStream = fs.createWriteStream(this.fileName, { encoding: 'binary' });
        this.audioRecorder.start().stream().pipe(fileStream);

        fileStream.on('finish', async () => {
            console.log('[MainAudio] Finished writing to file, starting processing.');
            try {
                this.sendIPC('recording-status', 'processing');

                // Get cookies from the electron session
                const cookies = await session.cookies.get({ url: this.apiBaseUrl });
                if (!cookies || cookies.length === 0) {
                    console.log('[MainAudio] No cookies found. Blocking transcription.');
                    this.sendIPC('transcription-result', {
                        success: false,
                        error: 'You must be logged in to transcribe.'
                    });
                    this.sendIPC('recording-status', 'error');
                    return;
                }

                const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

                const audioBuffer = fs.readFileSync(this.fileName);
                console.log(`[MainAudio] Read file of size: ${audioBuffer.length}`);
                
                const isRefinementOn = this.getRefinementState();
                const response = await this.makeSpeechRequest(audioBuffer, cookieString, isRefinementOn);

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
                this.destroyFeedbackWindow();
                if (fs.existsSync(this.fileName)) {
                    fs.unlinkSync(this.fileName);
                }
                this.maxedOut = false;
            }
        });

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