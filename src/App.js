// App.js
import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import EmbeddedBrowser from './components/EmbeddedBrowser';
import BatchBrowser from './components/BatchBrowser';
import UrlHistory from './components/UrlHistory';

// const electron = window.electron; // Commented out unused electron

// Simplified initial URL for testing - REMOVED as it's unused
// const INITIAL_URL = 'https://www.google.com'; 

function App() {
  const [inputText, setInputText] = useState('');
  const [urlsPerBatch, setUrlsPerBatch] = useState(10);
  const [concurrentPopupBatches, setConcurrentPopupBatches] = useState(2);
  const [batchDelay, setBatchDelay] = useState(5);
  const [tabDelay, setTabDelay] = useState(0.3);
  const [status, setStatus] = useState('');
  const [isOpening, setIsOpening] = useState(false);
  const [totalURLs, setTotalURLs] = useState(0);
  const [currentBatch, setCurrentBatch] = useState(1);
  const [totalBatches, setTotalBatches] = useState(1);
  const [parsedUrls, setParsedUrls] = useState([]);
  const [activeTab, setActiveTab] = useState('input'); // 'input', 'embedded', 'history'
  const [currentUrl, setCurrentUrl] = useState('');
  const fileInputRef = useRef(null);
  
  // New state variables for batching logic - Task 3.1
  const [currentInAppBatchUrls, setCurrentInAppBatchUrls] = useState([]);
  const [currentInAppBatchPageIndex, setCurrentInAppBatchPageIndex] = useState(0);
  const [processedBatchIndexes, setProcessedBatchIndexes] = useState(new Set()); // Tracks overall batch numbers (0-indexed) processed by pop-ups
  const [nextPopupBatchStartIndex, setNextPopupBatchStartIndex] = useState(0); // Index in parsedUrls for the start of the next set of pop-up batches
  
  // Effect to listen for 'navigate-webview' IPC from main process
  useEffect(() => {
    const electron = window.electron;
    if (electron && electron.on) {
      const handleNavigateWebview = (navigationUrl) => { // Removed unused event argument
        console.log(`App.js: Received 'navigate-webview' IPC for URL: ${navigationUrl}`);
        if (navigationUrl) {
          setActiveTab('embedded');
          setCurrentUrl(navigationUrl);
          console.log(`App.js: Set activeTab to 'embedded' and currentUrl to: ${navigationUrl}`);
        }
      };

      electron.on('navigate-webview', handleNavigateWebview);
      console.log("App.js: 'navigate-webview' IPC listener registered.");

      return () => {
        if (electron && electron.removeListener) { // Check if removeListener exists
          electron.removeListener('navigate-webview', handleNavigateWebview);
          console.log("App.js: 'navigate-webview' IPC listener removed.");
        }
      };
    } else {
      console.warn("App.js: Electron IPC (electron.on or electron.removeListener) not available for 'navigate-webview' listener.");
    }
  }, []); // Empty dependency array means this runs once on mount and cleans up on unmount

  // Parse URLs from text input
  const parseURLs = (text) => {
    if (!text) return [];
    return text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && (line.startsWith('http://') || line.startsWith('https://')));
  };

  // Handle text input change
  const handleInputTextChange = (e) => {
    const newText = e.target.value;
    setInputText(newText);
    
    const urls = parseURLs(newText);
    setParsedUrls(urls);
    setTotalURLs(urls.length);
    
    // Use urlsPerBatch for calculation
    const calculatedTotalBatches = Math.ceil(urls.length / urlsPerBatch);
    setTotalBatches(calculatedTotalBatches > 0 ? calculatedTotalBatches : 1);
  };

  // Renamed handleBatchSizeChange to handleUrlsPerBatchChange
  const handleUrlsPerBatchChange = (e) => {
    const newSize = Math.max(1, parseInt(e.target.value) || 1);
    setUrlsPerBatch(newSize); // Use setUrlsPerBatch
    
    if (parsedUrls.length > 0) {
      // Use newSize for recalculation
      setTotalBatches(Math.ceil(parsedUrls.length / newSize) || 1);
    }
  };

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
    }

    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setStatus('Error: Please upload a CSV file.');
      setParsedUrls([]);
      setTotalURLs(0);
      setTotalBatches(1);
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const contents = e.target.result;
        const lines = contents.split('\n').map(line => line.trim()).filter(line => line);

        if (lines.length === 0) {
          setStatus('Info: CSV file is empty. No URLs to load.');
          setParsedUrls([]);
          setTotalURLs(0);
          setTotalBatches(1);
          return;
        }

        const urls = [];
        const urlRegex = /(https?:\/\/[^\s/$.?#].[^\s]*)/gi;

        let startLineIndex = 0;
        const firstLineContent = lines[0];
        let firstLineUrls = [];
        let match;
        while ((match = urlRegex.exec(firstLineContent)) !== null) {
          firstLineUrls.push(match[0]);
        }
        urlRegex.lastIndex = 0;

        if (firstLineUrls.length === 0 && lines.length > 1) {
          startLineIndex = 1;
        }
        
        for (let i = startLineIndex; i < lines.length; i++) {
          const line = lines[i];
          const parts = line.split(',');
          
          parts.forEach(part => {
            let partUrls = [];
            let partMatch;
            const cleanedPart = part.trim().replace(/^"(.*)"$/, '$1');
            while ((partMatch = urlRegex.exec(cleanedPart)) !== null) {
              partUrls.push(partMatch[0]);
            }
            urlRegex.lastIndex = 0;
            urls.push(...partUrls);
          });
        }

        const uniqueUrls = [...new Set(urls)];

        if (uniqueUrls.length > 0) {
          setInputText(uniqueUrls.join('\n'));
          setStatus(`Success: Loaded ${uniqueUrls.length} unique URLs from the CSV file.`);
          setParsedUrls(uniqueUrls);
          setTotalURLs(uniqueUrls.length);
          // Use urlsPerBatch for calculation
          const calculatedTotalBatches = Math.ceil(uniqueUrls.length / urlsPerBatch);
          setTotalBatches(calculatedTotalBatches > 0 ? calculatedTotalBatches : 1);
        } else {
          setStatus('Info: No valid URLs found in the CSV file.');
          setInputText('');
          setParsedUrls([]);
          setTotalURLs(0);
          setTotalBatches(1);
        }
      } catch (error) {
        setStatus(`Error: Failed to process CSV content. ${error.message}`);
        setInputText('');
        setParsedUrls([]);
        setTotalURLs(0);
        setTotalBatches(1);
      }
    };

    reader.onerror = () => {
      setStatus('Error: Could not read the file. It might be corrupted or inaccessible.');
      setInputText('');
      setParsedUrls([]);
      setTotalURLs(0);
      setTotalBatches(1);
    };

    reader.readAsText(file);
  };

  // Handle batch processing start
  const handleBatchStart = (batchNum, batchUrls) => {
    setCurrentBatch(batchNum);
    setStatus(`Processing batch ${batchNum}/${totalBatches} (${batchUrls.length} URLs)`);
    
    if (batchUrls.length > 0) {
      setCurrentUrl(batchUrls[0]);
    }
  };

  // Handle batch processing complete
  const handleBatchComplete = (batchNum) => {
    setStatus(`Completed batch ${batchNum}/${totalBatches}`);
  };

  const handleLoadFirstBatch = () => {
    if (parsedUrls.length === 0 || urlsPerBatch <= 0) {
      setStatus('Info: No URLs loaded or URLs per batch is not set correctly.');
      return;
    }

    const firstBatch = parsedUrls.slice(0, urlsPerBatch);
    setCurrentInAppBatchUrls(firstBatch);
    setCurrentInAppBatchPageIndex(0);

    // TEST: Load a simple URL first to see if webview itself is working - REVERTING
    // setCurrentUrl('https://www.electronjs.org'); 
    // setActiveTab('embedded'); // Switch to embedded browser tab
    
    if (firstBatch.length > 0) {
      setCurrentUrl(firstBatch[0]); // REVERTED to load the actual first URL from the batch
      setActiveTab('embedded'); // Switch to embedded browser tab
      setStatus(`Loaded first batch of ${firstBatch.length} URLs for in-app viewing. Displaying URL 1 of ${firstBatch.length}.`);
    } else {
      // setCurrentUrl(''); // Clear current URL if batch is somehow empty - now handled by the above if
      setStatus('Info: Attempted to load first batch, but no URLs were available in the selection.');
      setCurrentUrl(''); 
    }
    
    setProcessedBatchIndexes(new Set()); 
    setNextPopupBatchStartIndex(urlsPerBatch);

  };

  const handleProcessNextBatches = async () => {
    if (parsedUrls.length === 0 || urlsPerBatch <= 0 || concurrentPopupBatches <= 0) {
      setStatus('Info: No URLs loaded or batch settings are invalid for pop-up processing.');
      return;
    }

    if (nextPopupBatchStartIndex >= parsedUrls.length) {
      setStatus('Info: All available URLs have been processed or batched for pop-ups.');
      return;
    }

    // Ensure electron API is available (it should be if preload worked)
    if (!window.electron || !window.electron.invoke) {
      setStatus('Error: Electron IPC not available. Cannot open pop-up batches.');
      console.error('window.electron.invoke is not available.');
      return;
    }

    setIsOpening(true); // Disable UI elements during this operation
    let batchesOpenedThisClick = 0;
    let tempNextPopupStartIndex = nextPopupBatchStartIndex;
    const newProcessedBatchIndexes = new Set(processedBatchIndexes);

    for (let i = 0; i < concurrentPopupBatches; i++) {
      if (tempNextPopupStartIndex >= parsedUrls.length) {
        setStatus(batchesOpenedThisClick > 0 ? `Successfully opened ${batchesOpenedThisClick} batch(es). No more URLs available for new pop-up batches.` : 'Info: No more URLs available for new pop-up batches.');
        break; // No more URLs to form new batches
      }

      const batchUrls = parsedUrls.slice(tempNextPopupStartIndex, tempNextPopupStartIndex + urlsPerBatch);
      if (batchUrls.length === 0) {
        // Should not happen if previous checks are correct, but as a safeguard
        break; 
      }

      const overallBatchNumber = Math.floor(tempNextPopupStartIndex / urlsPerBatch);
      // Skip if this overall batch number was somehow already processed (e.g. if logic was more complex)
      // For simple sequential, this check is redundant with nextPopupBatchStartIndex but good for robustness
      if (newProcessedBatchIndexes.has(overallBatchNumber)) {
        // This case means we might have an issue with how nextPopupBatchStartIndex is updated or reset
        // For now, we advance the start index and continue to the next iteration of the loop
        console.warn(`Skipping already processed batch number: ${overallBatchNumber}`);
        tempNextPopupStartIndex += urlsPerBatch; 
        continue; 
      }

      const batchId = `popup_batch_${overallBatchNumber}`;
      
      try {
        setStatus(`Opening pop-up batch ${i + 1} of ${concurrentPopupBatches} (Overall batch #${overallBatchNumber +1})...`);
        const result = await window.electron.invoke('open-popup-batch', { batchId, urls: batchUrls });
        
        if (result && result.success) {
          newProcessedBatchIndexes.add(overallBatchNumber);
          tempNextPopupStartIndex += batchUrls.length; // Advance by the actual number of URLs in the opened batch
          batchesOpenedThisClick++;
          setStatus(`Successfully opened pop-up for batch ${overallBatchNumber + 1} with ${batchUrls.length} URLs.`);
        } else {
          setStatus(`Warning: Main process indicated pop-up for batch ${overallBatchNumber + 1} might not have opened correctly. ${result ? result.message : ''}`);
          // Decide if we should stop or continue trying other popups
          // For now, we'll log and continue, but not advance tempNextPopupStartIndex for this failed one, to allow retry
          console.warn('IPC call to open-popup-batch did not report success:', result);
          // break; // Optionally break if one fails
        }
      } catch (error) {
        setStatus(`Error opening pop-up batch ${overallBatchNumber + 1}: ${error.message}`);
        console.error('Error invoking open-popup-batch:', error);
        // Decide if we should break or continue
        // break; // Optionally break on error
      }
    }
    
    setNextPopupBatchStartIndex(tempNextPopupStartIndex); // Persist the advanced index
    setProcessedBatchIndexes(newProcessedBatchIndexes); // Persist processed indexes
    setIsOpening(false); // Re-enable UI

    if (batchesOpenedThisClick === 0 && tempNextPopupStartIndex >= parsedUrls.length) {
        setStatus('Info: All URLs have been processed or batched for pop-ups.');
    } else if (batchesOpenedThisClick < concurrentPopupBatches && tempNextPopupStartIndex < parsedUrls.length) {
        setStatus(`Opened ${batchesOpenedThisClick} batch(es). More URLs available. Click again or adjust settings.`);
    } else if (batchesOpenedThisClick > 0) {
        setStatus(`Successfully initiated ${batchesOpenedThisClick} pop-up batch(es).`);
    }
    // If batchesOpenedThisClick is 0 and there was an error, the error status will already be set.

  };

  // Task 4.2: In-App Batch Navigation Handlers
  const handleNextInAppUrl = () => {
    if (currentInAppBatchUrls.length > 0 && currentInAppBatchPageIndex < currentInAppBatchUrls.length - 1) {
      const newIndex = currentInAppBatchPageIndex + 1;
      setCurrentInAppBatchPageIndex(newIndex);
      setCurrentUrl(currentInAppBatchUrls[newIndex]);
      setStatus(`Displaying URL ${newIndex + 1} of ${currentInAppBatchUrls.length} in current in-app batch.`);
    }
  };

  const handlePreviousInAppUrl = () => {
    if (currentInAppBatchUrls.length > 0 && currentInAppBatchPageIndex > 0) {
      const newIndex = currentInAppBatchPageIndex - 1;
      setCurrentInAppBatchPageIndex(newIndex);
      setCurrentUrl(currentInAppBatchUrls[newIndex]);
      setStatus(`Displaying URL ${newIndex + 1} of ${currentInAppBatchUrls.length} in current in-app batch.`);
    }
  };

  // Handle clear button click
  const handleClearClick = () => {
    setInputText('');
    setStatus('');
    setTotalURLs(0);
    setCurrentBatch(1);
    setTotalBatches(1);
    setParsedUrls([]);
    setCurrentUrl('');
    // Also reset in-app batch state on clear
    setCurrentInAppBatchUrls([]);
    setCurrentInAppBatchPageIndex(0);
    // Optionally reset popup tracking too, or decide if it should persist across clears if a CSV isn't immediately loaded.
    // For now, let's reset them for a cleaner state.
    setProcessedBatchIndexes(new Set());
    setNextPopupBatchStartIndex(0);
  };

  // Handle embedded browser navigation
  const handleBrowserNavigate = (url) => {
    setCurrentUrl(url);
  };

  return (
    <div className="app-container">
      <div className="app-header">
        <h1 className="app-title">Field Nation Work Order Browser</h1>
        
        <div className="app-tabs">
          <button 
            className={`tab-button ${activeTab === 'input' ? 'active' : ''}`}
            onClick={() => setActiveTab('input')}
          >
            Input URLs
          </button>
          <button 
            className={`tab-button ${activeTab === 'embedded' ? 'active' : ''}`}
            onClick={() => setActiveTab('embedded')}
          >
            Embedded Browser
          </button>
          <button 
            className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            URL History
          </button>
        </div>
      </div>
      
      <div className="app-content">
        {activeTab === 'input' && (
          <div className="input-tab">
            <div className="upload-section">
              <h2>Load Work Orders</h2>
              <div className="file-upload">
                <label htmlFor="csvFile" className="file-label">
                  Choose CSV File
                  <input
                    type="file"
                    id="csvFile"
                    ref={fileInputRef}
                    accept=".csv"
                    onChange={handleFileUpload}
                    disabled={isOpening}
                    style={{ display: 'none' }}
                  />
                </label>
                <span className="file-info">or paste URLs below / see loaded URLs</span>
              </div>
            </div>
            
            <div className="input-group">
              <label htmlFor="urlInput">Paste Work Order URLs (one per line) or see CSV Loaded URLs</label>
              <textarea
                id="urlInput"
                className="url-input"
                value={inputText}
                onChange={handleInputTextChange}
                placeholder="https://app.fieldnation.com/workorders/123456\nhttps://app.fieldnation.com/workorders/789012"
                disabled={isOpening}
                rows={parsedUrls.length > 0 ? 3 : 10} // Adjust rows based on parsedUrls
              />
            </div>

            {/* Scrollable URL List - Task 2.1 */}
            {parsedUrls.length > 0 && (
              <div className="loaded-urls-section">
                <h4>Loaded URLs:</h4>
                <div 
                  className="scrollable-url-list"
                  style={{ 
                    overflowY: 'auto', 
                    maxHeight: '200px', // Can be adjusted
                    border: '1px solid #ccc', 
                    padding: '10px', 
                    marginTop: '10px',
                    marginBottom: '15px' 
                  }}
                >
                  {parsedUrls.map((url, index) => (
                    <div key={index} className="url-list-item">
                      {index + 1}. {url}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Batch Configuration UI Elements - Task 2.2 */}
            <div className="batch-summary-info">
              <p>Total URLs found: {totalURLs}</p>
              <p>Total batches: {totalBatches} (based on {urlsPerBatch} URLs per batch)</p>
            </div>

            <div className="settings-grid">
              <div className="setting">
                {/* Renamed from Batch Size */}
                <label htmlFor="urlsPerBatchInput">Number of URLs per batch</label>
                <input
                  id="urlsPerBatchInput"
                  type="number"
                  value={urlsPerBatch} // Use urlsPerBatch
                  onChange={handleUrlsPerBatchChange} // Use handleUrlsPerBatchChange
                  min="1"
                  disabled={isOpening}
                />
                <div className="setting-desc">URLs processed together in one batch.</div>
              </div>
              {/* New Input for Concurrent Pop-up Batches */}
              <div className="setting">
                <label htmlFor="concurrentPopupBatchesInput">Simultaneous Pop-up Batches</label>
                <input
                  id="concurrentPopupBatchesInput"
                  type="number"
                  value={concurrentPopupBatches}
                  onChange={(e) => setConcurrentPopupBatches(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  disabled={isOpening}
                />
                <div className="setting-desc">Number of pop-up windows per click.</div>
              </div>
              <div className="setting">
                <label htmlFor="batchDelay">Batch Delay (seconds)</label>
                <input
                  id="batchDelay"
                  type="number"
                  value={batchDelay}
                  onChange={(e) => setBatchDelay(Math.max(1, parseFloat(e.target.value) || 1))}
                  min="1"
                  step="0.5"
                  disabled={isOpening}
                />
                <div className="setting-desc">Time to pause between batches</div>
              </div>
              <div className="setting">
                <label htmlFor="tabDelay">Tab Delay (seconds)</label>
                <input
                  id="tabDelay"
                  type="number"
                  value={tabDelay}
                  onChange={(e) => setTabDelay(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                  min="0.1"
                  step="0.1"
                  disabled={isOpening}
                />
                <div className="setting-desc">Time to wait between opening tabs</div>
              </div>
            </div>
            
            <div className="batch-info">
              {parsedUrls.length > 0 && (
                <BatchBrowser 
                  urls={parsedUrls}
                  urlsPerBatch={urlsPerBatch} // Changed prop name
                  onBatchStart={handleBatchStart}
                  onBatchComplete={handleBatchComplete}
                />
              )}
            </div>
            
            <div className="button-group">
              {/* New Buttons - Task 2.2 */}
              <button
                className="btn btn-primary"
                onClick={handleLoadFirstBatch}
                disabled={isOpening || parsedUrls.length === 0}
                style={{ marginRight: '10px' }}
              >
                Load First Batch (In-App)
              </button>
              <button
                className="btn btn-success" // Changed class for different color
                onClick={handleProcessNextBatches}
                disabled={isOpening || parsedUrls.length === 0}
                style={{ marginRight: '10px' }}
              >
                Process Next {concurrentPopupBatches > 1 ? `${concurrentPopupBatches} ` : ''}Batch(es) (Pop-ups)
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleClearClick}
                disabled={isOpening || !inputText.trim()}
              >
                Clear
              </button>
            </div>
            
            {status && (
              <div className="status-container">
                <p>{status}</p>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'embedded' && (
          <div className="embedded-tab">
            <div className="embedded-browser-container">
              {currentUrl ? (
                <>
                  {/* Task 4.2: In-App Batch Navigation UI */}
                  {currentInAppBatchUrls.length > 0 && (
                    <div className="in-app-batch-navigation" style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #eee' }}>
                      <button 
                        onClick={handlePreviousInAppUrl} 
                        disabled={currentInAppBatchPageIndex === 0}
                        className="btn btn-info"
                        style={{ marginRight: '10px' }}
                      >
                        Previous URL in Batch
                      </button>
                      <span style={{ margin: '0 10px' }}>
                        URL {currentInAppBatchPageIndex + 1} of {currentInAppBatchUrls.length}
                      </span>
                      <button 
                        onClick={handleNextInAppUrl} 
                        disabled={currentInAppBatchPageIndex >= currentInAppBatchUrls.length - 1}
                        className="btn btn-info"
                      >
                        Next URL in Batch
                      </button>
                    </div>
                  )}
                  <EmbeddedBrowser 
                    url={currentUrl}
                    batchId={currentBatch} // This `currentBatch` might need to refer to an in-app batch ID or be re-evaluated
                    onNavigate={handleBrowserNavigate}
                  />
                </>
              ) : (
                <div className="no-url-message">
                  <p>No URL currently loaded</p>
                  <p>Select a batch in the "Input URLs" tab to start browsing</p>
                </div>
              )}
            </div>
          </div>
        )}
        
        {activeTab === 'history' && (
          <div className="history-tab">
            <UrlHistory />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;