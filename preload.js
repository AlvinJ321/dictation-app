// preload.js

const { contextBridge, ipcRenderer } = require('electron');

// Expose a consolidated API to the renderer process
contextBridge.exposeInMainWorld('electron', {
  // STATUS AND RESULTS (from electronAPI)
  onRecordingStatus: (callback) => ipcRenderer.on('recording-status', (event, status) => callback(status)),
  removeRecordingStatusListener: (callback) => ipcRenderer.removeListener('recording-status', callback),
  onTranscriptionResult: (callback) => ipcRenderer.on('transcription-result', (event, result) => callback(result)),
  removeTranscriptionResultListener: (callback) => ipcRenderer.removeListener('transcription-result', callback),
  
  // TEXT INSERTION
  sendTextInsertion: (text) => ipcRenderer.send('insert-text', text),

  // TOKEN STORE
  store: {
    async getTokens() {
      return await ipcRenderer.invoke('get-tokens');
    },
    setTokens(tokens) {
      ipcRenderer.send('set-tokens', tokens);
    },
    clearTokens() {
      ipcRenderer.send('clear-tokens');
    },
  },
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