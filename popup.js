document.addEventListener('DOMContentLoaded', function() {
    // Get login DOM elements
    const loginContainer = document.getElementById('loginContainer');
    const mainContainer = document.getElementById('mainContainer');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const loginStatus = document.getElementById('loginStatus');
    const logoutBtn = document.getElementById('logoutBtn');
    
    // Get main DOM elements
    const applicationIdSelect = document.getElementById('applicationId');
    const refreshFormsBtn = document.getElementById('refreshFormsBtn');
    const loadDataBtn = document.getElementById('loadDataBtn');
    const fillFormBtn = document.getElementById('fillFormBtn');
    const statusMessage = document.getElementById('statusMessage');
    
    // Function to load form IDs into the dropdown
    function loadFormIds() {
      // Show loading in the dropdown
      applicationIdSelect.innerHTML = '<option value="">Loading forms...</option>';
      
      // Fetch forms from the API
      window.borderXClient.getUserForms()
        .then(forms => {
          // Clear the dropdown
          applicationIdSelect.innerHTML = '<option value="">-- Select a form ID --</option>';
          
          if (forms && forms.length > 0) {
            // Add each form to the dropdown
            forms.forEach(form => {
              const option = document.createElement('option');
              option.value = form.application_id;
              option.textContent = form.application_id;
              applicationIdSelect.appendChild(option);
            });
            
            // Load the last used application ID if available
            chrome.storage.local.get('lastApplicationId', function(result) {
              if (result.lastApplicationId) {
                // Try to select the last used ID in the dropdown
                for (let i = 0; i < applicationIdSelect.options.length; i++) {
                  if (applicationIdSelect.options[i].value === result.lastApplicationId) {
                    applicationIdSelect.selectedIndex = i;
                    break;
                  }
                }
              }
            });
          } else {
            // No forms found
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "No forms found";
            applicationIdSelect.appendChild(option);
          }
        })
        .catch(error => {
          console.error('Error loading forms:', error);
          applicationIdSelect.innerHTML = '<option value="">Error loading forms</option>';
          
          // If it's an auth error, redirect to login
          if (error.message && error.message.includes('session has expired')) {
            chrome.storage.local.remove(['authToken', 'userInfo'], function() {
              loginContainer.style.display = 'block';
              mainContainer.style.display = 'none';
            });
          }
        });
    }
    
    // Add event listener for refresh button
    refreshFormsBtn.addEventListener('click', function() {
      loadFormIds();
      showStatus('Form list refreshed', 'success');
    });
    
    // Check if user is already logged in
    chrome.storage.local.get('authToken', function(result) {
      if (result.authToken) {
        // User is logged in, show main container
        loginContainer.style.display = 'none';
        mainContainer.style.display = 'block';
        
        // Load form IDs into the dropdown
        loadFormIds();
      } else {
        // User is not logged in, show login container
        loginContainer.style.display = 'block';
        mainContainer.style.display = 'none';
      }
    });
    
    // Function to show login status messages
    function showLoginStatus(message, type) {
      loginStatus.textContent = message;
      loginStatus.className = 'status ' + type;
      
      // Hide the message after 5 seconds if it's a success message
      if (type === 'success') {
        setTimeout(() => {
          loginStatus.className = 'status';
        }, 5000);
      }
    }
    
    // Function to show main status messages
    function showStatus(message, type) {
      statusMessage.textContent = message;
      statusMessage.className = 'status ' + type;
      
      // Hide the message after 5 seconds if it's a success message
      if (type === 'success') {
        setTimeout(() => {
          statusMessage.className = 'status';
        }, 5000);
      }
    }
    
    // Handle login button click
    loginBtn.addEventListener('click', function() {
      console.log('Login button clicked');
      
      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();
      
      console.log('Email:', email ? 'provided' : 'empty');
      console.log('Password:', password ? 'provided' : 'empty');
      
      if (!email || !password) {
        showLoginStatus('Please enter both email and password', 'error');
        return;
      }
      
      // Show loading status
      showLoginStatus('Logging in...', 'info');
      
      console.log('Attempting login with email:', email);
      
      // Check if borderXClient exists
      if (!window.borderXClient) {
        console.error('borderXClient is not defined!');
        showLoginStatus('Internal error: Client not initialized', 'error');
        return;
      }
      
      // Check if loginWithEmail method exists
      if (!window.borderXClient.loginWithEmail) {
        console.error('loginWithEmail method is not defined!');
        showLoginStatus('Internal error: Login method not found', 'error');
        return;
      }
      
      // Use the BorderX client to login
      try {
        window.borderXClient.loginWithEmail(email, password)
          .then(data => {
            console.log('Login successful:', data);
            showLoginStatus('Login successful!', 'success');
            
            // Switch to main container
            setTimeout(() => {
              loginContainer.style.display = 'none';
              mainContainer.style.display = 'block';
            }, 1000);
          })
          .catch(error => {
            console.error('Login error:', error);
            showLoginStatus(`Error: ${error.message}`, 'error');
          });
      } catch (error) {
        console.error('Exception during login attempt:', error);
        showLoginStatus(`Exception: ${error.message}`, 'error');
      }
    });
    
    // Handle logout button click
    logoutBtn.addEventListener('click', function() {
      // Clear auth data
      chrome.storage.local.remove(['authToken', 'userInfo'], function() {
        // Switch to login container
        loginContainer.style.display = 'block';
        mainContainer.style.display = 'none';
        
        // Clear form fields
        emailInput.value = '';
        passwordInput.value = '';
        applicationIdSelect.innerHTML = '<option value="">-- Select a form ID --</option>';
        
        showLoginStatus('Logged out successfully', 'success');
      });
    });
    
    // Handle load data button click
    loadDataBtn.addEventListener('click', function() {
      const applicationId = applicationIdSelect.value;
      
      if (!applicationId) {
        showStatus('Please select an application ID', 'error');
        return;
      }
      
      // Show loading status
      showStatus('Loading form data...', 'info');
      
      // Save application ID for future use
      chrome.storage.local.set({ lastApplicationId: applicationId });
      
      // Fetch form data from the API
      window.borderXClient.fetchFormData(applicationId)
        .then(formData => {
          console.log('Form data loaded successfully!');
          
          // Store the form data in Chrome storage
          chrome.storage.local.set({ 
            currentFormData: formData,
            currentApplicationId: applicationId
          }, function() {
            showStatus('Form data loaded successfully!', 'success');
          });
        })
        .catch(error => {
          // Log the technical error for debugging
          console.error('Error loading form data:', error);
          
          // Show user-friendly error message
          // The error message is already user-friendly from supabase-client.js
          showStatus(error.message, 'error');
          
          // If it's an auth error, redirect to login
          if (error.message.includes('session has expired')) {
            chrome.storage.local.remove(['authToken', 'userInfo'], function() {
              loginContainer.style.display = 'block';
              mainContainer.style.display = 'none';
            });
          }
        });
    });
    
    // Handle fill form button click
    fillFormBtn.addEventListener('click', function() {
      // Check if we have form data
      chrome.storage.local.get(['currentFormData', 'currentApplicationId'], function(result) {
        if (!result.currentFormData) {
          showStatus('Please load form data first', 'error');
          return;
        }
        
        // Show loading status
        showStatus('Filling form...', 'info');
        
        // Get the active tab
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
          const activeTab = tabs[0];
          
          // Check if we're on the DS-160 website
          if (!activeTab || !activeTab.url || !activeTab.url.includes('ceac.state.gov')) {
            showStatus('Please navigate to the DS-160 form website first', 'error');
            return;
          }
          
          // First try to ping the content script
          chrome.tabs.sendMessage(
            activeTab.id,
            { action: 'ping' },
            function(pingResponse) {
              if (chrome.runtime.lastError) {
                // Content script not loaded, inject it
                chrome.scripting.executeScript({
                  target: { tabId: activeTab.id },
                  files: ['content.js']
                }, function() {
                  // Now send the fill form message
                  chrome.tabs.sendMessage(
                    activeTab.id,
                    { 
                      action: 'fillForm', 
                      clientData: result.currentFormData,
                      applicationId: result.currentApplicationId
                    },
                    function(response) {
                      if (chrome.runtime.lastError) {
                        console.error('Error sending message:', chrome.runtime.lastError);
                        showStatus('Error: Could not communicate with the page. Please refresh the DS-160 form page and try again.', 'error');
                        return;
                      }
                      
                      if (response && response.success) {
                        showStatus(response.message, 'success');
                        
                        // Log the event
                        chrome.runtime.sendMessage({
                          action: 'logEvent',
                          data: {
                            applicationId: result.currentApplicationId,
                            section: response.section,
                            filledCount: response.filledCount
                          }
                        });
                      } else {
                        showStatus(`Error: ${response ? response.error : 'Unknown error'}`, 'error');
                      }
                    }
                  );
                });
              } else {
                // Content script already loaded, send fill form message directly
                chrome.tabs.sendMessage(
                  activeTab.id,
                  { 
                    action: 'fillForm', 
                    clientData: result.currentFormData,
                    applicationId: result.currentApplicationId
                  },
                  function(response) {
                    if (chrome.runtime.lastError) {
                      console.error('Error sending message:', chrome.runtime.lastError);
                      showStatus('Error: Could not communicate with the page. Please refresh the DS-160 form page and try again.', 'error');
                      return;
                    }
                    
                    if (response && response.success) {
                      showStatus(response.message, 'success');
                      
                      // Log the event
                      chrome.runtime.sendMessage({
                        action: 'logEvent',
                        data: {
                          applicationId: result.currentApplicationId,
                          section: response.section,
                          filledCount: response.filledCount
                        }
                      });
                    } else {
                      showStatus(`Error: ${response ? response.error : 'Unknown error'}`, 'error');
                    }
                  }
                );
              }
            }
          );
        });
      });
    });
  });