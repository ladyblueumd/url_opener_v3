const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const isDev = require("electron-is-dev");
const Store = require("electron-store");

// Disable GPU Acceleration for Electron
app.disableHardwareAcceleration();

// Fix for context isolation errors
app.allowRendererProcessReuse = false;

// Initialize the data store for persistence
const store = new Store({
  name: "url-opener-data",
  defaults: {
    openedUrls: []
  }
});

let mainWindow;
let childWindows = {};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,
      webSecurity: false, // Allow loading local resources
    }
  });

  mainWindow.loadURL(
    isDev
      ? "http://localhost:3000"
      : `file://${path.join(__dirname, "../build/index.html")}`
  );

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
    // Close all batch windows when main window is closed
    Object.values(childWindows).forEach(window => {
      if (!window.isDestroyed()) {
        window.close();
      }
    });
    childWindows = {};
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC handlers for opening URLs in batches
ipcMain.on("open-batch", (event, { batchId, urls }) => {
  // Close existing batch window if it exists
  if (childWindows[batchId] && !childWindows[batchId].isDestroyed()) {
    childWindows[batchId].close();
  }

  // Create new batch window
  const batchWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: `Batch ${batchId}`,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true
    }
  });

  // Store window reference
  childWindows[batchId] = batchWindow;

  // Load the first URL in the batch
  if (urls.length > 0) {
    batchWindow.loadURL(urls[0]);
  }

  // Listen for window close
  batchWindow.on("closed", () => {
    delete childWindows[batchId];
  });

  // Return window id to renderer
  event.returnValue = batchWindow.id;
});

// Handle URL logging
ipcMain.on("log-url-opened", (event, { url, timestamp, batchId }) => {
  const openedUrls = store.get("openedUrls") || [];
  openedUrls.push({ url, timestamp, batchId });
  store.set("openedUrls", openedUrls);
});

// Get previously opened URLs
ipcMain.handle("get-opened-urls", async () => {
  return store.get("openedUrls") || [];
});

// External browser opening
ipcMain.on("open-external", (event, url) => {
  shell.openExternal(url);
});

// Navigate in batch window
ipcMain.on("navigate-batch", (event, { batchId, url }) => {
  if (childWindows[batchId] && !childWindows[batchId].isDestroyed()) {
    childWindows[batchId].loadURL(url);
  }
});

// Download handler
ipcMain.on("download-pdf", (event, { url, savePath }) => {
  // This would need to be implemented with a proper download manager
  // Basic implementation would use something like:
  // const { download } = require("electron-dl");
  // download(BrowserWindow.getFocusedWindow(), url, { directory: savePath });
  
  // For now, just open the URL in default browser
  shell.openExternal(url);
});
