const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron', {
    send: (channel, data) => {
      // whitelist channels
      const validChannels = ['open-batch', 'log-url-opened', 'navigate-batch', 'open-external', 'download-pdf'];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    on: (channel, func) => {
      const validChannels = ['url-opened', 'batch-completed', 'navigate-webview'];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender` 
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
    removeListener: (channel, func) => {
      const validChannels = ['url-opened', 'batch-completed', 'navigate-webview'];
      if (validChannels.includes(channel)) {
        ipcRenderer.removeListener(channel, func);
      }
    },
    invoke: async (channel, data) => {
      const validChannels = ['get-opened-urls', 'open-popup-batch'];
      if (validChannels.includes(channel)) {
        return await ipcRenderer.invoke(channel, data);
      }
    },
    // Expose directory paths for loading preload scripts in webviews
    dirname: __dirname
  }
); 