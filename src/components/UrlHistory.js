import React, { useState, useEffect } from 'react';
import './UrlHistory.css';

// Replace direct ipcRenderer with the safe version from preload.js
const electron = window.electron;

const UrlHistory = () => {
  const [urlHistory, setUrlHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load URL history from electron store
    const loadHistory = async () => {
      try {
        setIsLoading(true);
        const history = await electron.invoke('get-opened-urls');
        setUrlHistory(history || []);
      } catch (error) {
        console.error('Failed to load URL history:', error);
        setUrlHistory([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadHistory();
  }, []);

  // Filter and sort the URL history
  const filteredAndSortedHistory = urlHistory
    .filter(item => 
      item.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.batchId && item.batchId.toString().includes(searchTerm))
    )
    .sort((a, b) => {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      
      return sortOrder === 'newest' 
        ? dateB - dateA 
        : dateA - dateB;
    });

  // Format the date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Handle sort order change
  const handleSortChange = (e) => {
    setSortOrder(e.target.value);
  };

  // Handle open URL in external browser
  const handleOpenUrl = (url) => {
    electron.send('open-external', url);
  };

  return (
    <div className="url-history">
      <div className="history-header">
        <h2>URL Access History</h2>
        
        <div className="history-controls">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search URLs..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="search-input"
            />
          </div>
          
          <div className="sort-container">
            <select 
              value={sortOrder} 
              onChange={handleSortChange}
              className="sort-select"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>
      </div>
      
      {isLoading ? (
        <div className="loading-message">Loading history...</div>
      ) : filteredAndSortedHistory.length === 0 ? (
        <div className="empty-message">
          {searchTerm ? 'No matching URLs found.' : 'No URL history available.'}
        </div>
      ) : (
        <div className="history-list">
          <table className="history-table">
            <thead>
              <tr>
                <th>URL</th>
                <th>Batch</th>
                <th>Date & Time</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedHistory.map((item, index) => (
                <tr key={index} className="history-item">
                  <td className="url-cell">
                    <div className="url-text">{item.url}</div>
                  </td>
                  <td className="batch-cell">{item.batchId || 'N/A'}</td>
                  <td className="timestamp-cell">{formatDate(item.timestamp)}</td>
                  <td className="actions-cell">
                    <button 
                      className="action-button"
                      onClick={() => handleOpenUrl(item.url)}
                      title="Open in browser"
                    >
                      ↗️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default UrlHistory; 