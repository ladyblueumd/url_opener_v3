import React, { useState, useEffect, useRef } from 'react';
import './EmbeddedBrowser.css';

const { ipcRenderer } = window.require('electron');

const EmbeddedBrowser = ({ url, batchId, onNavigate }) => {
  const [currentUrl, setCurrentUrl] = useState(url || '');
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const webviewRef = useRef(null);

  useEffect(() => {
    if (url && url !== currentUrl) {
      setCurrentUrl(url);
      if (webviewRef.current) {
        webviewRef.current.loadURL(url);
      }
    }
  }, [url, currentUrl]);

  useEffect(() => {
    const webview = webviewRef.current;
    
    if (!webview) return;

    const handleDidStartLoading = () => {
      setIsLoading(true);
    };

    const handleDidStopLoading = () => {
      setIsLoading(false);
      
      // Log the URL opening with timestamp
      const timestamp = new Date().toISOString();
      ipcRenderer.send('log-url-opened', { 
        url: webview.getURL(), 
        timestamp, 
        batchId 
      });
    };

    const handleDidFinishLoad = () => {
      setTitle(webview.getTitle());
      setCanGoBack(webview.canGoBack());
      setCanGoForward(webview.canGoForward());
      setCurrentUrl(webview.getURL());
      
      // Notify parent component about navigation
      if (onNavigate) {
        onNavigate(webview.getURL());
      }
    };

    const handleWillNavigate = (e) => {
      setCurrentUrl(e.url);
    };

    webview.addEventListener('did-start-loading', handleDidStartLoading);
    webview.addEventListener('did-stop-loading', handleDidStopLoading);
    webview.addEventListener('did-finish-load', handleDidFinishLoad);
    webview.addEventListener('will-navigate', handleWillNavigate);

    return () => {
      webview.removeEventListener('did-start-loading', handleDidStartLoading);
      webview.removeEventListener('did-stop-loading', handleDidStopLoading);
      webview.removeEventListener('did-finish-load', handleDidFinishLoad);
      webview.removeEventListener('will-navigate', handleWillNavigate);
    };
  }, [batchId, onNavigate]);

  const handleGoBack = () => {
    if (webviewRef.current && canGoBack) {
      webviewRef.current.goBack();
    }
  };

  const handleGoForward = () => {
    if (webviewRef.current && canGoForward) {
      webviewRef.current.goForward();
    }
  };

  const handleRefresh = () => {
    if (webviewRef.current) {
      webviewRef.current.reload();
    }
  };

  const handleOpenExternal = () => {
    if (currentUrl) {
      ipcRenderer.send('open-external', currentUrl);
    }
  };

  const handleDownload = () => {
    if (currentUrl) {
      ipcRenderer.send('download-pdf', { url: currentUrl });
    }
  };

  const handleUrlChange = (e) => {
    setCurrentUrl(e.target.value);
  };

  const handleUrlSubmit = (e) => {
    e.preventDefault();
    if (webviewRef.current && currentUrl) {
      webviewRef.current.loadURL(currentUrl);
    }
  };

  return (
    <div className="embedded-browser">
      <div className="browser-toolbar">
        <button 
          className="toolbar-button" 
          onClick={handleGoBack} 
          disabled={!canGoBack}
        >
          &larr;
        </button>
        <button 
          className="toolbar-button" 
          onClick={handleGoForward} 
          disabled={!canGoForward}
        >
          &rarr;
        </button>
        <button 
          className="toolbar-button" 
          onClick={handleRefresh}
        >
          ↻
        </button>
        
        <form className="url-form" onSubmit={handleUrlSubmit}>
          <input 
            type="text" 
            className="url-input"
            value={currentUrl} 
            onChange={handleUrlChange}
            placeholder="Enter URL"
          />
        </form>
        
        <button 
          className="toolbar-button" 
          onClick={handleOpenExternal} 
          title="Open in external browser"
        >
          ↗️
        </button>
        
        <button 
          className="toolbar-button" 
          onClick={handleDownload} 
          title="Download content"
        >
          ⬇️
        </button>
      </div>
      
      <div className="browser-title-bar">
        {isLoading ? 'Loading...' : title}
      </div>
      
      <div className="webview-container">
        <webview
          ref={webviewRef}
          src={url}
          className="webview"
          partition={`persist:batch-${batchId}`}
        />
      </div>
    </div>
  );
};

export default EmbeddedBrowser; 