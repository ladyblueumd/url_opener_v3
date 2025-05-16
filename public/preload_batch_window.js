const { contextBridge, ipcRenderer } = require('electron');

console.log('preload_batch_window.js loaded successfully.');

// If in the future, batch_window_renderer.js needs to send messages
// to the main process or access specific Node.js features securely,
// you would expose them here using contextBridge.
// Example:
// contextBridge.exposeInMainWorld('electronBatchAPI', {
//   send: (channel, data) => ipcRenderer.send(channel, data),
//   invoke: (channel, data) => ipcRenderer.invoke(channel, data),
//   // Add other specific functions you want to expose
// }); 