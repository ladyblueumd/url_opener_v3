// App.js
import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import EmbeddedBrowser from './components/EmbeddedBrowser';
import BatchBrowser from './components/BatchBrowser';
import UrlHistory from './components/UrlHistory';

// Replace direct ipcRenderer with the safe version from preload.js
const electron = window.electron;

function App() {
  const [inputText, setInputText] = useState('');
  const [batchSize, setBatchSize] = useState(10);
  const [batchDelay, setBatchDelay] = useState(5);
  const [tabDelay, setTabDelay] = useState(0.3);
  const [status, setStatus] = useState('');
  const [isOpening, setIsOpening] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  const [totalURLs, setTotalURLs] = useState(0);
  const [currentBatch, setCurrentBatch] = useState(1);
  const [totalBatches, setTotalBatches] = useState(1);
  const [parsedUrls, setParsedUrls] = useState([]);
  const [activeTab, setActiveTab] = useState('input'); // 'input', 'embedded', 'history'
  const [currentUrl, setCurrentUrl] = useState('');
  const fileInputRef = useRef(null);
  
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
    
    // Parse URLs and update state
    const urls = parseURLs(newText);
    setParsedUrls(urls);
    setTotalURLs(urls.length);
    
    // Calculate total batches
    const calculatedTotalBatches = Math.ceil(urls.length / batchSize);
    setTotalBatches(calculatedTotalBatches);
  };

  // Handle batch size change
  const handleBatchSizeChange = (e) => {
    const newSize = Math.max(1, parseInt(e.target.value) || 1);
    setBatchSize(newSize);
    
    // Recalculate total batches
    if (parsedUrls.length > 0) {
      setTotalBatches(Math.ceil(parsedUrls.length / newSize));
    }
  };

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check if it's a CSV file
    if (!file.name.endsWith('.csv')) {
      setStatus('Please upload a CSV file');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const contents = e.target.result;
        const lines = contents.split('\n');
        
        // Skip header row and extract URLs
        const urls = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          // Parse CSV line (handle commas within quotes)
          let parts = line.split(',');
          // If there's a URL column, extract it
          if (parts.length >= 2) {
            const url = parts[1].trim().replace(/^"(.*)"$/, '$1');
            if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
              urls.push(url);
            }
          }
        }
        
        if (urls.length > 0) {
          setInputText(urls.join('\n'));
          setStatus(`Loaded ${urls.length} URLs from the CSV file`);
          setParsedUrls(urls);
          
          // Calculate batch stats
          const calculatedTotalBatches = Math.ceil(urls.length / batchSize);
          setTotalBatches(calculatedTotalBatches);
          setTotalURLs(urls.length);
        } else {
          setStatus('No valid URLs found in the CSV file');
        }
      } catch (error) {
        setStatus(`Error parsing CSV: ${error.message}`);
      }
    };
    reader.readAsText(file);
  };

  // Handle batch processing start
  const handleBatchStart = (batchNum, batchUrls) => {
    setCurrentBatch(batchNum);
    setStatus(`Processing batch ${batchNum}/${totalBatches} (${batchUrls.length} URLs)`);
    
    // Set the first URL of the batch for embedded browser
    if (batchUrls.length > 0) {
      setCurrentUrl(batchUrls[0]);
    }
  };

  // Handle batch processing complete
  const handleBatchComplete = (batchNum) => {
    setStatus(`Completed batch ${batchNum}/${totalBatches}`);
  };

  // Handle clear button click
  const handleClearClick = () => {
    setInputText('');
    setStatus('');
    setOpenCount(0);
    setTotalURLs(0);
    setCurrentBatch(1);
    setTotalBatches(1);
    setParsedUrls([]);
    setCurrentUrl('');
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
                <span className="file-info">or paste URLs below</span>
              </div>
            </div>
            
            <div className="input-group">
              <label htmlFor="urlInput">Work Order URLs (one per line)</label>
              <textarea
                id="urlInput"
                className="url-input"
                value={inputText}
                onChange={handleInputTextChange}
                placeholder="https://app.fieldnation.com/workorders/123456&#10;https://app.fieldnation.com/workorders/789012"
                disabled={isOpening}
              />
            </div>
            
            <div className="settings-grid">
              <div className="setting">
                <label htmlFor="batchSize">Batch Size</label>
                <input
                  id="batchSize"
                  type="number"
                  value={batchSize}
                  onChange={handleBatchSizeChange}
                  min="1"
                  disabled={isOpening}
                />
                <div className="setting-desc">Number of URLs per batch</div>
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
                  batchSize={batchSize}
                  onBatchStart={handleBatchStart}
                  onBatchComplete={handleBatchComplete}
                />
              )}
            </div>
            
            <div className="button-group">
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
                <EmbeddedBrowser 
                  url={currentUrl}
                  batchId={currentBatch}
                  onNavigate={handleBrowserNavigate}
                />
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