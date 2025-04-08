// Background script
// This runs in the background and can maintain state even when the popup is closed

// Listen for installation
chrome.runtime.onInstalled.addListener(function(details) {
    console.log('DS-160 Autofill Helper installed', details);
  });
  
  // Listen for messages from popup or content scripts
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    // You can add more advanced functionality here
    if (request.action === 'logEvent') {
      console.log('Event logged:', request.data);
      sendResponse({ success: true });
    }
    
    return true; // Required for async response
  });