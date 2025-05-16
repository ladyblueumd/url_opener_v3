const { app, BrowserWindow, ipcMain, shell, session } = require("electron");
const path = require("path");
const isDev = require("electron-is-dev");
const Store = require("electron-store");
console.log("--- electron-store import --- ");
console.log(Store); // What is Store?
console.log(typeof Store); // What is its type?
if (Store && Store.default) {
  console.log("Store.default exists:");
  console.log(Store.default);
  console.log(typeof Store.default);
}
// --- End of diagnostic logging ---

// Disable GPU Acceleration for Electron
app.disableHardwareAcceleration();

// Fix for context isolation errors
app.allowRendererProcessReuse = false;

// Initialize the data store for persistence
const store = new Store({
  name: "url-opener-data",
  defaults: {
    openedUrls: [],
    fnSession: {}
  }
});

let mainWindow;
let childWindows = {};

function createWindow() {
  try {
    mainWindow = new BrowserWindow({
      width: 1100,
      height: 800,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, 'preload.js'),
        webviewTag: true,
        webSecurity: false,
        partition: 'persist:fieldnation'
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

    // Block external browser openings for React DevTools
    mainWindow.webContents.on('new-window', (event, url) => {
      if (url.includes('reactjs.org') || url.includes('react-devtools')) {
        console.log('Blocking React DevTools URL:', url);
        event.preventDefault();
        return;
      }
      
      // For other new windows, load them in the embedded webview
      if (url.startsWith('http') || url.startsWith('https')) {
        event.preventDefault();
        mainWindow.webContents.send('navigate-webview', url);
      }
    });

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
  } catch (error) {
    console.error('Error creating window:', error);
  }
}

// Set up Chrome user agent
app.whenReady().then(() => {
  const chromeUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  session.defaultSession.setUserAgent(chromeUserAgent);
  console.log(`Default session user agent set to: ${chromeUserAgent}`);
  
  createWindow();
});

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

// New IPC Handler for Pop-up Batch Windows
ipcMain.handle('open-popup-batch', async (event, { batchId, urls }) => {
  if (!batchId || !urls || urls.length === 0) {
    console.error('Invalid arguments for open-popup-batch:', { batchId, urls });
    return { success: false, message: 'Invalid arguments: batchId and urls are required.' };
  }

  // Close existing window for this batchId if it exists and is not destroyed
  if (childWindows[batchId] && !childWindows[batchId].isDestroyed()) {
    try {
      childWindows[batchId].close();
      delete childWindows[batchId]; // Remove from tracking
    } catch (e) {
      console.warn(`Could not close existing window for ${batchId}:`, e.message);
    }
  }

  try {
    const batchPopupWindow = new BrowserWindow({
      width: 1000,
      height: 700,
      title: `Field Nation - Batch ${batchId} (${urls.length} URLs)`,
      webPreferences: {
        webviewTag: true,
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, 'preload_batch_window.js'),
        webSecurity: false
      }
    });

    // Load batch_window.html and pass data via query parameters
    const batchPageUrl = new URL(`file://${path.join(__dirname, 'batch_window.html')}`);
    batchPageUrl.searchParams.append('urls', JSON.stringify(urls));
    batchPageUrl.searchParams.append('batchId', batchId);

    await batchPopupWindow.loadURL(batchPageUrl.href);

    childWindows[batchId] = batchPopupWindow; // Add to tracking

    batchPopupWindow.on('closed', () => {
      console.log(`Batch window ${batchId} closed.`);
      delete childWindows[batchId];
    });

    return { success: true, windowId: batchPopupWindow.id, batchId };

  } catch (error) {
    console.error(`Failed to create or load pop-up batch window for ${batchId}:`, error);
    return { success: false, message: `Failed to open pop-up window: ${error.message}` };
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
  try {
    const openedUrls = store.get("openedUrls") || [];
    openedUrls.push({ url, timestamp, batchId });
    store.set("openedUrls", openedUrls);
  } catch (error) {
    console.error('Error logging URL:', error);
  }
});

// Get previously opened URLs
ipcMain.handle("get-opened-urls", async () => {
  try {
    return store.get("openedUrls") || [];
  } catch (error) {
    console.error('Error getting opened URLs:', error);
    return [];
  }
});

// External browser opening
ipcMain.on("open-external", (event, url) => {
  // Prevent React DevTools from opening in external browser
  if (!url || url.includes('reactjs.org') || url.includes('react-devtools')) {
    console.log('Blocked external browser open request for:', url);
    return;
  }
  
  try {
    shell.openExternal(url);
  } catch (error) {
    console.error('Error opening external URL:', error);
  }
});

// Navigate in batch window
ipcMain.on("navigate-batch", (event, { batchId, url }) => {
  if (childWindows[batchId] && !childWindows[batchId].isDestroyed()) {
    childWindows[batchId].loadURL(url);
  }
});

// Download handler
ipcMain.on("download-pdf", (event, { url, savePath }) => {
  // For now, just open the URL in default browser
  if (!url.includes('reactjs.org')) {
    shell.openExternal(url);
  }
});

// Add near other IPC handlers (~line 200)
ipcMain.on("store-fn-token", (event, token) => {
  const sessionData = store.get("fnSession") || {};
  sessionData.accessToken = token;
  store.set("fnSession", sessionData);
});
