// preload.js

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onStartRecording: (callback) => ipcRenderer.on('start-recording', callback),
  onStopRecording: (callback) => ipcRenderer.on('stop-recording', callback),
  sendTextInsertion: (text) => ipcRenderer.send('insert-text', text)
  // We can add a send function here if renderer needs to send to main, e.g.:
  // send: (channel, data) => ipcRenderer.send(channel, data)
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