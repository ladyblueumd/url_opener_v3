const { contextBridge, ipcRenderer } = require('electron');

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
    receive: (channel, func) => {
      const validChannels = ['url-opened', 'batch-completed'];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender` 
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
    invoke: async (channel, data) => {
      const validChannels = ['get-opened-urls'];
      if (validChannels.includes(channel)) {
        return await ipcRenderer.invoke(channel, data);
      }
    }
  }
); 