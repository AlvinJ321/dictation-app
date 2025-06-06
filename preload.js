// preload.js

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // STATUS AND RESULTS
  onRecordingStatus: (callback) => ipcRenderer.on('recording-status', (event, status) => callback(status)),
  removeRecordingStatusListener: (callback) => ipcRenderer.removeListener('recording-status', callback),
  onTranscriptionResult: (callback) => ipcRenderer.on('transcription-result', (event, result) => callback(result)),
  removeTranscriptionResultListener: (callback) => ipcRenderer.removeListener('transcription-result', callback),
});

// Expose a function for sending text to the main process for insertion
contextBridge.exposeInMainWorld('electron', {
  sendTextInsertion: (text) => ipcRenderer.send('insert-text', text)
});

// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type]);
  }
}); 