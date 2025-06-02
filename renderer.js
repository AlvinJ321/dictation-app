let audioContext;
// let scriptProcessor; // REMOVE: No longer using ScriptProcessorNode
let mediaStreamSource;
let audioWorkletNode; // ADD: For AudioWorkletNode
let localMediaStream; // ADD: To store the original MediaStream from getUserMedia
let audioData = []; // To store Float32Array chunks
let isRecording = false;
const targetSampleRate = 16000;

function float32To16BitPCM(float32Array) {
    const pcm16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        let val = float32Array[i];
        if (val > 1) val = 1;
        if (val < -1) val = -1;
        pcm16Array[i] = val * 32767;
    }
    return pcm16Array;
}

function combineFloat32Arrays(arrays) {
    let totalLength = 0;
    for (const arr of arrays) {
        totalLength += arr.length;
    }
    const result = new Float32Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}

async function startAudioCapture() {
    if (isRecording) {
        console.log('Already recording.');
        return;
    }

    try {
        console.log('[startAudioCapture] Creating AudioContext...');
        audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: targetSampleRate
        });
        console.log(`[startAudioCapture] AudioContext created. State: ${audioContext.state}, SampleRate: ${audioContext.sampleRate}`);

        console.log('[startAudioCapture] Adding AudioWorklet module...');
        try {
            // Path is relative to the HTML file (index.html)
            await audioContext.audioWorklet.addModule('audio-processor.js');
            console.log('[startAudioCapture] AudioWorklet module added.');
        } catch (e) {
            console.error('[startAudioCapture] Error adding AudioWorklet module:', e);
            // Close AudioContext if module loading fails
            if (audioContext && audioContext.state !== 'closed') {
                await audioContext.close();
                audioContext = null;
            }
            return; // Abort if module cannot be added
        }

        console.log('[startAudioCapture] Getting user media...');
        localMediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                sampleRate: targetSampleRate,
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });
        console.log('[startAudioCapture] User media stream obtained.');

        mediaStreamSource = audioContext.createMediaStreamSource(localMediaStream);
        console.log('[startAudioCapture] MediaStreamSource created.');

        console.log('[startAudioCapture] Creating AudioWorkletNode...');
        audioWorkletNode = new AudioWorkletNode(audioContext, 'audio-recorder-processor', {
            processorOptions: {
                bufferSize: 4096 // Example buffer size, can be adjusted or not used by processor
            }
        });
        console.log('[startAudioCapture] AudioWorkletNode created.');

        audioWorkletNode.port.onmessage = (event) => {
            if (!isRecording) return;
            // event.data will be the Float32Array from the processor
            // We need to ensure we are handling a copy or it might get GC'd if the worklet reuses buffers (though our current one doesn't)
            audioData.push(new Float32Array(event.data)); 
        };
        console.log('[startAudioCapture] AudioWorkletNode onmessage handler set up.');

        mediaStreamSource.connect(audioWorkletNode);
        audioWorkletNode.connect(audioContext.destination); // Connect to destination to keep it processing
        console.log('[startAudioCapture] Nodes connected.');

        isRecording = true;
        audioData = []; // Reset audio data
        console.log('Recording started (using AudioWorkletNode)...');

    } catch (err) {
        console.error('Error starting audio capture (AudioWorkletNode):', err);
        if (localMediaStream) { // ADD: Stop tracks if stream was obtained before error
            localMediaStream.getTracks().forEach(track => track.stop());
            localMediaStream = null;
        }
        if (audioContext && audioContext.state !== 'closed') {
            audioContext.close().catch(console.error);
            audioContext = null;
        }
        isRecording = false; 
    }
}

function stopAudioCaptureAndProcess() {
    // ABSOLUTELY FIRST LINE LOG
    console.log('renderer.js: ### stopAudioCaptureAndProcess CALLED. isRecording:', isRecording);

    if (!isRecording) {
        console.warn('[stopAudioCaptureAndProcess] Not recording (bail out).');
        return null;
    }

    try {
        console.log('[stopAudioCaptureAndProcess] Setting isRecording to false.');
        isRecording = false; // This should signal the worklet's onmessage to stop pushing data

        // Disconnect and clean up AudioWorkletNode and related resources
        if (audioWorkletNode) {
            console.log('[stopAudioCaptureAndProcess] Disconnecting audioWorkletNode.');
            audioWorkletNode.port.onmessage = null; // Remove message handler
            audioWorkletNode.disconnect(); 
            audioWorkletNode = null;
        } else {
            console.warn('[stopAudioCaptureAndProcess] audioWorkletNode was already null.');
        }
        
        // REMOVE: scriptProcessor related cleanup, as it's no longer used
        // if (scriptProcessor) { ... }

        if (mediaStreamSource) {
            console.log('[stopAudioCaptureAndProcess] Disconnecting mediaStreamSource.');
            mediaStreamSource.disconnect(); // Disconnect the node first
            mediaStreamSource = null;
        } else {
            console.warn('[stopAudioCaptureAndProcess] mediaStreamSource was already null.');
        }

        if (localMediaStream) { // MODIFY: Use localMediaStream to stop tracks
            console.log('[stopAudioCaptureAndProcess] Stopping localMediaStream tracks.');
            localMediaStream.getTracks().forEach(track => {
                console.log(`[stopAudioCaptureAndProcess] Stopping track: ${track.kind}, ${track.label}`);
                track.stop();
            });
            localMediaStream = null; // Nullify after stopping tracks
        } else {
            console.warn('[stopAudioCaptureAndProcess] localMediaStream was already null.');
        }

        if (audioContext && audioContext.state !== 'closed') {
            console.log(`[stopAudioCaptureAndProcess] Closing audioContext. Current state: ${audioContext.state}`);
            audioContext.close().then(() => {
                console.log('[stopAudioCaptureAndProcess] audioContext closed successfully.');
            }).catch(err => {
                console.error('[stopAudioCaptureAndProcess] Error closing audioContext:', err);
            });
            audioContext = null; 
        } else {
            console.warn(`[stopAudioCaptureAndProcess] audioContext was already null or closed. State: ${audioContext ? audioContext.state : 'null'}`);
        }

        console.log(`[stopAudioCaptureAndProcess] Recording stopped. Audio data length: ${audioData.length}`);

        if (audioData.length === 0) {
            console.warn('[stopAudioCaptureAndProcess] No audio data captured.');
            return null;
        }

        console.log('[stopAudioCaptureAndProcess] Combining Float32Arrays.');
        const combinedAudio = combineFloat32Arrays(audioData);
        console.log(`[stopAudioCaptureAndProcess] Combined audio length: ${combinedAudio.length}`);

        console.log('[stopAudioCaptureAndProcess] Converting to 16-bit PCM.');
        const pcm16Audio = float32To16BitPCM(combinedAudio);
        console.log(`[stopAudioCaptureAndProcess] PCM audio length: ${pcm16Audio.length}`);

        console.log('[stopAudioCaptureAndProcess] Creating Blob.');
        const audioBlob = new Blob([pcm16Audio.buffer], { type: 'audio/pcm' });

        console.log('[stopAudioCaptureAndProcess] Audio processed into PCM Blob:', audioBlob);
        audioData = []; // Clear stored data
        console.log('[stopAudioCaptureAndProcess] Cleared audioData.');

        return audioBlob;

    } catch (error) {
        console.error('[stopAudioCaptureAndProcess] CRITICAL ERROR:', error);
        alert(`Critical error during audio processing: ${error.message}. Check console.`);
        // Make sure to nullify critical objects if an error occurs mid-process if they weren't already
        isRecording = false; // Ensure recording is marked as stopped
        
        // REMOVE: scriptProcessor cleanup from catch block
        // if (scriptProcessor) { ... }

        if (audioWorkletNode) { // ADD: Cleanup for audioWorkletNode in catch
            audioWorkletNode.port.onmessage = null;
            audioWorkletNode.disconnect();
            audioWorkletNode = null;
        }

        if (mediaStreamSource) {
            mediaStreamSource.disconnect();
            mediaStreamSource = null;
        }

        if (localMediaStream) { // ADD: localMediaStream cleanup in catch
            localMediaStream.getTracks().forEach(track => track.stop());
            localMediaStream = null;
        }

        if (audioContext && audioContext.state !== 'closed') {
            audioContext.close().catch(console.error); 
            audioContext = null;
        }

        audioData = []; // Clear data to prevent issues on subsequent attempts
        return null; // Indicate failure
    }
}

// We will add IPC listeners and API sending logic here later.

async function sendAudioToBackend(audioBlob) {
    if (!audioBlob) {
        console.error('No audio blob to send.');
        return;
    }

    try {
        console.log('Sending audio to backend as raw blob...');
        const response = await fetch('http://localhost:3001/api/speech', {
            method: 'POST',
            body: audioBlob,
            headers: {
                'Content-Type': 'audio/pcm',
                'X-Audio-Format': 'pcm',
                'X-Audio-SampleRate': String(targetSampleRate)
            }
        });

        console.log('Received response from backend:', response.status, response.statusText);

        if (response.ok) {
            const data = await response.json();
            console.log('Transcription data:', data);
            if (data.transcript) {
                console.log('Transcription successful:', data.transcript);
                if (window.electronAPI && typeof window.electronAPI.sendTextInsertion === 'function') {
                    window.electronAPI.sendTextInsertion(data.transcript);
                } else {
                    console.error('window.electronAPI.sendTextInsertion is not available. Make sure it is exposed in preload.js');
                }
            } else if (data.error) {
                console.error('Backend ASR error:', data.error, data.details || '');
                // Optionally display this error to the user
                alert(`ASR Error: ${data.error} - ${data.details || 'No details'}`);
            } else {
                console.warn('Received OK response, but no transcript or error in data:', data);
            }
        } else {
            const errorText = await response.text();
            console.error('Backend request failed:', response.status, response.statusText, errorText);
            alert(`Error from backend: ${response.status} ${response.statusText}. ${errorText}`);
        }
    } catch (error) {
        console.error('Error sending audio to backend:', error);
        alert(`Failed to send audio for transcription: ${error.message}`);
    }
}

// Example Usage (will be triggered by IPC later):
// async function handleToggleRecording() {
//     if (!isRecording) {
//         await startAudioCapture();
//     } else {
//         const blob = stopAudioCaptureAndProcess();
//         if (blob) {
//             await sendAudioToBackend(blob);
//         }
//     }
// }

// Listen for IPC messages from main process
if (window.electronAPI) {
  window.electronAPI.onStartRecording(async () => {
    console.log('IPC: Received start-recording');
    await startAudioCapture();
  });

  window.electronAPI.onStopRecording(async () => {
    console.log('renderer.js: ### onStopRecording HANDLER INVOKED'); 
    console.log('renderer.js: Calling stopAudioCaptureAndProcess...');
    const audioBlob = stopAudioCaptureAndProcess();
    console.log('renderer.js: stopAudioCaptureAndProcess returned. Blob:', audioBlob ? `Blob type: ${audioBlob.type}, size: ${audioBlob.size}` : String(audioBlob) );
    if (audioBlob) {
      console.log('renderer.js: audioBlob is valid, calling sendAudioToBackend...');
      await sendAudioToBackend(audioBlob);
    } else {
      console.warn('[onStopRecording HANDLER] No audioBlob received from stopAudioCaptureAndProcess. Not sending to backend.');
    }
  });
} else {
  console.error('electronAPI not found. Preload script might not have run correctly.');
} 