// App.js
import React, { useState, useRef } from 'react';
import './App.css';

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
  const fileInputRef = useRef(null);
  
  const parseURLs = (text) => {
    if (!text) return [];
    return text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && (line.startsWith('http://') || line.startsWith('https://')));
  };

  const openURLs = async () => {
    const urls = parseURLs(inputText);
    if (urls.length === 0) {
      setStatus('No valid URLs found. URLs must start with http:// or https://');
      return;
    }

    setTotalURLs(urls.length);
    setOpenCount(0);
    setIsOpening(true);
    
    // Calculate total batches
    const calculatedTotalBatches = Math.ceil(urls.length / batchSize);
    setTotalBatches(calculatedTotalBatches);
    setCurrentBatch(1);
    
    setStatus(`Opening batch 1/${calculatedTotalBatches} (${Math.min(batchSize, urls.length)} URLs)...`);

    // Open first URL in a new window
    window.open(urls[0], '_blank');
    setOpenCount(1);
    
    // Wait a bit longer for the first window to open
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Open remaining URLs in batches
    let batchNumber = 1;
    for (let i = 1; i < urls.length; i++) {
      // Open URL in new tab
      window.open(urls[i], '_blank');
      setOpenCount(i + 1);
      
      // Short delay between tabs
      await new Promise(resolve => setTimeout(resolve, tabDelay * 1000));
      
      // If we've reached the end of a batch, pause
      if (i % batchSize === batchSize - 1 && i < urls.length - 1) {
        batchNumber++;
        setCurrentBatch(batchNumber);
        setStatus(`Completed batch ${batchNumber-1}/${calculatedTotalBatches}. Pausing for ${batchDelay} seconds...`);
        await new Promise(resolve => setTimeout(resolve, batchDelay * 1000));
        setStatus(`Opening batch ${batchNumber}/${calculatedTotalBatches}...`);
      }
    }

    setStatus(`Finished opening all ${urls.length} URLs`);
    setIsOpening(false);
  };

  const handleOpenClick = () => {
    if (isOpening) return;
    openURLs();
  };

  const handleClearClick = () => {
    setInputText('');
    setStatus('');
    setOpenCount(0);
    setTotalURLs(0);
    setCurrentBatch(1);
    setTotalBatches(1);
  };
  
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

  return (
    <div className="app-container">
      <div className="app-content">
        <h1 className="app-title">Field Nation Work Order Opener</h1>
        
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
            onChange={(e) => setInputText(e.target.value)}
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
              onChange={(e) => {
                const newSize = Math.max(1, parseInt(e.target.value) || 1);
                setBatchSize(newSize);
                if (totalURLs > 0) {
                  setTotalBatches(Math.ceil(totalURLs / newSize));
                }
              }}
              min="1"
              disabled={isOpening}
            />
            <div className="setting-desc">Number of tabs to open before pausing</div>
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
          {totalURLs > 0 && !isOpening && (
            <p>Will open {totalURLs} URLs in {totalBatches} batch{totalBatches !== 1 ? 'es' : ''}</p>
          )}
        </div>
        
        <div className="button-group">
          <button
            className="btn btn-primary"
            onClick={handleOpenClick}
            disabled={isOpening || !inputText.trim()}
          >
            Open URLs
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
            {isOpening && totalURLs > 0 && (
              <div className="progress-container">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${(openCount / totalURLs) * 100}%` }}
                  ></div>
                </div>
                <div className="progress-details">
                  <p className="progress-text">{openCount} of {totalURLs} URLs</p>
                  <p className="batch-text">Batch {currentBatch} of {totalBatches}</p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="instructions">
          <h2>Instructions:</h2>
          <ol>
            <li>Upload the <code>fieldnation_work_order_urls.csv</code> file or paste URLs</li>
            <li>
              Adjust batch settings based on your browser's capabilities:
              <ul>
                <li><strong>Batch Size:</strong> Number of URLs to open before pausing (recommended: 10-20)</li>
                <li><strong>Batch Delay:</strong> Seconds to wait between batches (recommended: 5-15)</li>
                <li><strong>Tab Delay:</strong> Seconds to wait between opening tabs (recommended: 0.3-1.0)</li>
              </ul>
            </li>
            <li>Click "Open URLs" to begin</li>
            <li>After each batch opens, you can manually print/download the content you need</li>
            <li>When ready for the next batch, wait for the delay or click "Open URLs" again</li>
            <li>Your browser may block popups - allow them when prompted</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

export default App;