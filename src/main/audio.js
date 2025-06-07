const AudioRecorder = require('node-audiorecorder');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const robot = require('@hurdlegroup/robotjs');

class MainProcessAudio {
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.audioRecorder = null;
        this.isRecording = false;
        this.fileName = path.join(app.getPath('temp'), 'recording.wav');

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
        this.mainWindow.webContents.send('recording-status', 'recording');

        const fileStream = fs.createWriteStream(this.fileName, { encoding: 'binary' });
        this.audioRecorder.start().stream().pipe(fileStream);

        fileStream.on('finish', () => {
            console.log('[MainAudio] Finished writing to file.');
        });
    }

    async stopRecordingAndProcess() {
        if (!this.isRecording) {
            console.log('[MainAudio] Not recording.');
            return;
        }

        console.log('[MainAudio] Stopping recording...');
        this.isRecording = false;
        this.mainWindow.webContents.send('recording-status', 'processing');
        this.audioRecorder.stop();

        try {
            const audioBuffer = fs.readFileSync(this.fileName);
            console.log(`[MainAudio] Read file of size: ${audioBuffer.length}`);
            
            const response = await axios.post('http://localhost:3001/api/speech', audioBuffer, {
                headers: {
                    'Content-Type': 'audio/wav',
                    'X-Audio-Format': 'wav',
                    'X-Audio-SampleRate': '16000'
                }
            });

            if (response.data && response.data.transcript) {
                console.log('[MainAudio] Transcription success:', response.data.transcript);
                this.mainWindow.webContents.send('transcription-result', {
                    success: true,
                    text: response.data.transcript
                });
                robot.typeString(response.data.transcript);
            } else {
                throw new Error(response.data.error || 'No transcript in response');
            }
        } catch (error) {
            console.error('[MainAudio] Error processing transcription:', error.message);
            this.mainWindow.webContents.send('transcription-result', {
                success: false,
                error: error.message
            });
        } finally {
            this.mainWindow.webContents.send('recording-status', 'idle');
            // Clean up the temp file
            if (fs.existsSync(this.fileName)) {
                fs.unlinkSync(this.fileName);
            }
        }
    }
}

module.exports = { MainProcessAudio }; 