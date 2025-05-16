document.addEventListener('DOMContentLoaded', () => {
    const webview = document.getElementById('batchWebview');
    const prevUrlBtn = document.getElementById('prevUrlBtn');
    const nextUrlBtn = document.getElementById('nextUrlBtn');
    const printPageBtn = document.getElementById('printPageBtn');
    const urlInfoDiv = document.getElementById('urlInfo');
    const statusBarDiv = document.getElementById('statusBar');

    let currentBatchUrls = [];
    let currentBatchId = '';
    let currentIndex = 0;

    const params = new URLSearchParams(window.location.search);
    const urlsParam = params.get('urls');
    currentBatchId = params.get('batchId');

    if (urlsParam) {
        try {
            currentBatchUrls = JSON.parse(urlsParam);
        } catch (e) {
            console.error('Failed to parse URLs parameter:', e);
            statusBarDiv.textContent = 'Error: Could not parse URL data.';
            return;
        }
    }

    if (!currentBatchUrls || currentBatchUrls.length === 0) {
        statusBarDiv.textContent = 'Error: No URLs provided for this batch.';
        // Disable buttons if no URLs
        prevUrlBtn.disabled = true;
        nextUrlBtn.disabled = true;
        printPageBtn.disabled = true;
        return;
    }

    // Set webview partition
    // Note: For <webview> tag, partition is an attribute, not a property set via JS directly in all Electron versions easily after init.
    // It's best set in the HTML or via main process if dynamically creating webview. 
    // However, we can try setting it if the webview is already in the DOM.
    // If this doesn't work reliably, the partition should be set in batch_window.html if possible or the main process needs to create the webview element with the partition.
    // For now, we will assume it needs to be unique per batch for FieldNation logins.
    if (webview && currentBatchId) {
        webview.partition = 'persist:fieldnation';
        //statusBarDiv.textContent = `Using partition: ${webview.partition}`;
    } else if (!currentBatchId) {
        statusBarDiv.textContent = 'Warning: No batchId provided, webview session might not be isolated.';
    }


    function loadUrlAtIndex(index) {
        if (index >= 0 && index < currentBatchUrls.length) {
            currentIndex = index;
            const urlToLoad = currentBatchUrls[currentIndex];
            webview.loadURL(urlToLoad).catch(err => {
                console.error(`Failed to load URL: ${urlToLoad}`, err);
                statusBarDiv.textContent = `Error loading: ${urlToLoad.substring(0,50)}...`;
            });
            updateUI();
        } else {
            console.warn('Attempted to load URL at invalid index:', index);
        }
    }

    function updateUI() {
        urlInfoDiv.textContent = `URL ${currentIndex + 1} of ${currentBatchUrls.length}`;
        prevUrlBtn.disabled = currentIndex === 0;
        nextUrlBtn.disabled = currentIndex >= currentBatchUrls.length - 1;
        if (webview.getTitle()) {
            document.title = `${webview.getTitle()} - Batch ${currentBatchId}`;
        } else {
            document.title = `Batch ${currentBatchId} - URL ${currentIndex + 1}`;
        }
    }

    prevUrlBtn.addEventListener('click', () => {
        if (currentIndex > 0) {
            loadUrlAtIndex(currentIndex - 1);
        }
    });

    nextUrlBtn.addEventListener('click', () => {
        if (currentIndex < currentBatchUrls.length - 1) {
            loadUrlAtIndex(currentIndex + 1);
        }
    });

    printPageBtn.addEventListener('click', () => {
        if (webview) {
            webview.print().then(success => {
                statusBarDiv.textContent = success ? 'Print dialog opened.' : 'Print cancelled or failed.';
            }).catch(err => {
                console.error('Print error:', err);
                statusBarDiv.textContent = 'Error initiating print.';
            });
        }
    });

    webview.addEventListener('did-start-loading', () => {
        statusBarDiv.textContent = 'Loading page...';
    });

    webview.addEventListener('did-finish-load', () => {
        statusBarDiv.textContent = `Loaded: ${webview.getURL().substring(0, 100)}...`;
        updateUI(); // Update title and button states
    });

    webview.addEventListener('did-fail-load', (error) => {
        console.error('Webview failed to load:', error);
        statusBarDiv.textContent = `Failed to load: ${error.validatedURL.substring(0,100)}... Error: ${error.errorCode} ${error.errorDescription}`;
        updateUI(); // Still update UI to reflect current state
    });

    // Initial Load
    statusBarDiv.textContent = `Batch ${currentBatchId} loaded with ${currentBatchUrls.length} URLs.`;
    loadUrlAtIndex(0);
}); 