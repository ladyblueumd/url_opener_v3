import React, { useState, useEffect, useRef } from 'react';
import './EmbeddedBrowser.css';

// Replace direct ipcRenderer with the safe version from preload.js
const electron = window.electron;

const EmbeddedBrowser = ({ url, onNavigate }) => {
  const [currentUrl, setCurrentUrl] = useState(url || '');
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const webviewRef = useRef(null);
  const [status, setStatus] = useState('');
  const [loadRetries, setLoadRetries] = useState(0);
  const MAX_RETRIES = 3;

  console.log(`EmbeddedBrowser: Received url prop: ${url}`);

  // Handle url prop changes
  useEffect(() => {
    console.log(`EmbeddedBrowser useEffect for [url]: New url is ${url}`);
    if (url && url !== currentUrl) {
      setCurrentUrl(url);
      setLoadRetries(0); // Reset retries when URL changes
      if (webviewRef.current) {
        try {
          console.log(`EmbeddedBrowser: Attempting to load URL in webview: ${url}`);
          webviewRef.current.loadURL(url);
          setCurrentUrl(url);
        } catch (error) {
          console.error('Error loading URL in webview:', error);
          setStatus(`Error: ${error.message}`);
        }
      }
    }
  }, [url, currentUrl]);

  // Set up webview event listeners
  useEffect(() => {
    const webview = webviewRef.current;
    
    if (!webview) return;

    console.log("EmbeddedBrowser: Adding event listeners to webview");

    const handleDidStartLoading = () => {
      setIsLoading(true);
      setStatus('Loading...');
    };

    const handleDidStopLoading = () => {
      setIsLoading(false);
      setStatus('');
      
      try {
        // Log the URL opening with timestamp
        const timestamp = new Date().toISOString();
        electron.send('log-url-opened', { 
          url: webview.getURL(), 
          timestamp, 
        });
      } catch (error) {
        console.error('Error in didStopLoading handler:', error);
      }
    };

    const handleDidFinishLoad = () => {
      try {
        setTitle(webview.getTitle());
        setCanGoBack(webview.canGoBack());
        setCanGoForward(webview.canGoForward());
        setCurrentUrl(webview.getURL());
        setStatus('');
        
        // Notify parent component about navigation
        if (onNavigate) {
          onNavigate(webview.getURL());
        }
      } catch (error) {
        console.error('Error in didFinishLoad handler:', error);
      }
    };

    const handleWillNavigate = (e) => {
      console.log(`EmbeddedBrowser: will-navigate to ${e.url}`);
      setCurrentUrl(e.url);
      setStatus(`Navigating to ${e.url}...`);
    };

    const handleDidNavigate = (e) => {
      console.log(`EmbeddedBrowser: did-navigate to ${e.url}`);
      setCurrentUrl(e.url);
    };

    const handleDidFailLoad = (e) => {
      console.error('EmbeddedBrowser Webview did-fail-load:', {
        errorCode: e.errorCode,
        errorDescription: e.errorDescription,
        validatedURL: e.validatedURL,
        isMainFrame: e.isMainFrame,
      });
      
      // Don't set error for -3 (User cancelled) as this is normal during redirects
      if (e.errorCode !== -3) {
        setStatus(`Error loading: ${e.errorDescription} (Code: ${e.errorCode})`);
        
        // Auto-retry logic for certain errors - only if it's the main frame
        if (e.isMainFrame && loadRetries < MAX_RETRIES) {
          const retryableErrors = [-100, -101, -102, -105, -106, -109, -324];
          
          if (retryableErrors.includes(e.errorCode)) {
            setLoadRetries(prev => prev + 1);
            setStatus(`Retrying... (${loadRetries + 1}/${MAX_RETRIES})`);
            
            // Wait a moment before retrying
            setTimeout(() => {
              if (webviewRef.current) {
                console.log(`Retrying load of ${e.validatedURL}`);
                webviewRef.current.loadURL(e.validatedURL);
              }
            }, 1000);
          }
        }
      } else {
        console.log('Ignoring ERR_ABORTED (-3) as it may be part of a redirect');
      }
    };

    const handleDomReady = () => {
      console.log('EmbeddedBrowser: Webview DOM is ready');
      // Inject custom JS to help with redirects if needed
      try {
        webview.executeJavaScript(`
          console.log('Custom redirect handler injected');
          // Track navigation actions
          if (window.location.href.includes('id.fieldnation.com')) {
            console.log('On FieldNation login page, monitoring for redirects');
          }
        `);
      } catch (error) {
        console.error('Error executing JavaScript in webview:', error);
      }
    };

    // Add handlers for redirect-related events
    const handleRedirect = (e) => {
      console.log(`EmbeddedBrowser: Redirect detected to: ${e.newURL}`);
      // No need to handle manually - will be caught by will-navigate
    };

    const handleNewWindow = (e) => {
      e.preventDefault();
      console.log(`EmbeddedBrowser: new-window event to ${e.url}`);
      
      if (e.url.startsWith('http:') || e.url.startsWith('https:')) {
        if (webviewRef.current) {
          try {
            webviewRef.current.loadURL(e.url);
            console.log(`EmbeddedBrowser: Loading new-window URL in current webview: ${e.url}`);
          } catch (error) {
            console.error('Error loading new-window URL in webview:', error);
          }
        }
      }
    };

    // Attach event listeners
    const events = [
      { name: 'did-start-loading', handler: handleDidStartLoading },
      { name: 'did-stop-loading', handler: handleDidStopLoading },
      { name: 'did-finish-load', handler: handleDidFinishLoad },
      { name: 'will-navigate', handler: handleWillNavigate },
      { name: 'did-navigate', handler: handleDidNavigate },
      { name: 'did-fail-load', handler: handleDidFailLoad },
      { name: 'dom-ready', handler: handleDomReady },
      { name: 'did-redirect-navigation', handler: handleRedirect },
      { name: 'new-window', handler: handleNewWindow }
    ];
    
    // Safely add each event listener
    events.forEach(({ name, handler }) => {
      try {
        webview.addEventListener(name, handler);
      } catch (error) {
        console.error(`Error adding ${name} listener:`, error);
      }
    });

    // Return cleanup function
    return () => {
      // Safely remove each event listener
      events.forEach(({ name, handler }) => {
        try {
          if (webview) {
            webview.removeEventListener(name, handler);
          }
        } catch (error) {
          console.error(`Error removing ${name} listener:`, error);
        }
      });
    };
  }, [onNavigate, loadRetries]);

  const handleGoBack = () => {
    if (webviewRef.current && canGoBack) {
      try {
        webviewRef.current.goBack();
      } catch (error) {
        console.error('Error going back:', error);
      }
    }
  };

  const handleGoForward = () => {
    if (webviewRef.current && canGoForward) {
      try {
        webviewRef.current.goForward();
      } catch (error) {
        console.error('Error going forward:', error);
      }
    }
  };

  const handleRefresh = () => {
    if (webviewRef.current) {
      try {
        webviewRef.current.reload();
      } catch (error) {
        console.error('Error refreshing:', error);
      }
    }
  };

  const handleOpenExternal = () => {
    if (currentUrl) {
      try {
        electron.send('open-external', currentUrl);
      } catch (error) {
        console.error('Error opening external URL:', error);
      }
    }
  };

  const handleDownload = () => {
    if (currentUrl) {
      try {
        electron.send('download-pdf', { url: currentUrl });
      } catch (error) {
        console.error('Error downloading PDF:', error);
      }
    }
  };

  const handleUrlChange = (e) => {
    setCurrentUrl(e.target.value);
  };

  const handleUrlSubmit = (e) => {
    e.preventDefault();
    if (webviewRef.current && currentUrl) {
      try {
        webviewRef.current.loadURL(currentUrl);
      } catch (error) {
        console.error('Error loading URL from input:', error);
        setStatus(`Error: ${error.message}`);
      }
    }
  };

  // Task 4.3: Handler for Print button
  const handlePrintPage = () => {
    if (webviewRef.current) {
      try {
        webviewRef.current.print()
          .then(success => {
            if (success) {
              console.log('Print command sent successfully');
            } else {
              console.log('Print command failed or was cancelled');
            }
          })
          .catch(error => {
            console.error('Error initiating print:', error);
          });
      } catch (error) {
        console.error('Error printing page:', error);
      }
    }
  };

  // New: Handler to open webview DevTools
  const handleOpenWebviewDevTools = () => {
    if (webviewRef.current) {
      try {
        webviewRef.current.openDevTools();
      } catch (error) {
        console.error('Error opening DevTools:', error);
      }
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
        {/* Task 4.3: Print button */}
        <button
          className="toolbar-button"
          onClick={handlePrintPage}
          title="Print current page"
        >
          🖨️
        </button>
        {/* New: Webview DevTools Button */}
        <button
          className="toolbar-button"
          onClick={handleOpenWebviewDevTools}
          title="Open Webview DevTools"
        >
          🐞
        </button>
      </div>
      
      <div className="browser-title-bar">
        {isLoading ? 'Loading...' : title}
      </div>
      
      {/* Display status/error messages */}
      {status && (
        <div className="browser-status-bar">
          {status}
        </div>
      )}
      
      <div className="browser-content">
        <webview
          ref={webviewRef}
          src={url}
          className="webview"
          partition="persist:fieldnation-session"
          allowpopups="true"
          preload={`file://${window.electron?.dirname ? window.electron.dirname + '/preload_webview.js' : ''}`}
        />
      </div>
    </div>
  );
};

export default EmbeddedBrowser; 