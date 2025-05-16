// preload_webview.js - This script is injected into all webviews

// Function to be executed when the webview DOM is ready
function handleDOMReady() {
  // Log that the preload script is running
  console.log('Preload script running in webview');
  
  // Handle FieldNation login pages
  if (window.location.href.includes('id.fieldnation.com')) {
    console.log('On FieldNation login page, enhancing with redirect support');
    
    // Observe the document for form submissions
    observeLoginForm();
    
    // Inject helper functions for debugging
    window.fnDebug = {
      getRedirectInfo: () => {
        try {
          const url = new URL(window.location.href);
          const state = url.searchParams.get('state');
          return {
            url: window.location.href,
            state: state,
            hasWorkOrder: state && state.includes('workorders'),
            redirect: url.searchParams.get('redirect_uri')
          };
        } catch (err) {
          return { error: err.message };
        }
      },
      getCookies: () => document.cookie
    };
  }
  
  // Handle FieldNation OAuth redirection endpoint
  if (window.location.href.includes('redirection-endpoint')) {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    
    if (accessToken) {
      document.cookie = `fn_access_token=${accessToken}; 
        Path=/; 
        Secure; 
        SameSite=Strict;
        ${window.location.protocol === 'https:' ? 'Secure' : ''}`;
      
      // Store token in electron-store
      window.electron.send('store-fn-token', accessToken);
      
      // Redirect to workorders
      window.location.href = 'https://app.fieldnation.com/workorders';
    }
  }
  
  // Handle FieldNation work order pages
  if (window.location.href.includes('app.fieldnation.com/workorders/')) {
    console.log('On FieldNation work order page');
    
    // Add any work order page specific enhancements here
  }
}

// Helper function to observe login form submissions
function observeLoginForm() {
  // Wait for form elements to load
  setTimeout(() => {
    // Find login form
    const form = document.querySelector('form');
    if (form) {
      console.log('Found login form, attaching event listener');
      form.addEventListener('submit', (event) => {
        console.log('Login form submitted');
      });
    }
    
    // Find login buttons and attach event listeners
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
      if (button.textContent.includes('Sign In') || 
          button.textContent.includes('Login') ||
          button.textContent.includes('Continue')) {
        console.log('Found login/continue button, attaching event listener');
        button.addEventListener('click', () => {
          console.log('Login/continue button clicked');
        });
      }
    });
  }, 1000);
}

// Set up the event listener for when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', handleDOMReady);

// Also trigger handleDOMReady if the document is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  handleDOMReady();
}

// Intercept all navigation events
window.addEventListener('beforeunload', (event) => {
  // Log navigation to help debug
  console.log('Navigating away from:', window.location.href);
  
  // Don't prevent navigation
  event.returnValue = undefined;
}); 