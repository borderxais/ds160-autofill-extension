// This file handles all interactions with the BorderX backend API

// Base URL for the BorderX API
// const API_BASE_URL = 'http://localhost:5000/api';

// For production
const API_BASE_URL = 'https://visasupport-dot-overseabiz-453023.wl.r.appspot.com/api';
// const API_BASE_URL = 'http://localhost:5000/api';
/**
 * BorderXClient class for handling authentication and data operations
 */
class BorderXClient {
  constructor() {
    this.authToken = null;
    this.userInfo = null;
    
    // Load auth data from storage
    chrome.storage.local.get(['authToken', 'userInfo'], (result) => {
      if (result.authToken) {
        this.authToken = result.authToken;
        this.userInfo = result.userInfo;
        console.log('Auth token loaded from storage');
      } else {
        console.log('No auth token found in storage');
      }
    });
  }
  
  /**
   * Login with email and password
   * @param {string} email - User's email
   * @param {string} password - User's password
   * @returns {Promise} - Promise with user data
   */
  async loginWithEmail(email, password) {
    try {
      console.log(`Sending login request to ${API_BASE_URL}/auth/login`);
      
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });
      
      console.log('Login response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Login failed');
      }
      
      const data = await response.json();
      console.log('Login successful, received data:', data);
      
      // Store auth token and user info
      this.authToken = data.token;
      this.userInfo = data.user;
      
      // Save to Chrome storage
      chrome.storage.local.set({
        authToken: this.authToken,
        userInfo: this.userInfo
      });
      
      return data;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Fetch DS-160 form translation data by application ID
   * @param {string} original_form_application_id - The original DS-160 application ID
   * @returns {Promise} - Promise with translation data
   */
  async fetchFormData(original_form_application_id) {
    try {
      if (!this.authToken) {
        throw new Error('Not authenticated');
      }
      
      console.log(`Fetching translation data for application ID: ${original_form_application_id}`);
      
      // Validate that original_form_application_id is not empty
      if (!original_form_application_id) {
        throw new Error('Application ID cannot be empty');
      }
      
      // Use the client endpoint that returns translation data
      console.log(`API URL: ${API_BASE_URL}/ds160/client/${original_form_application_id}`);
      
      const response = await fetch(`${API_BASE_URL}/ds160/client/${original_form_application_id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const responseText = await response.text();
        
        try {
          // Try to parse as JSON if possible
          const errorData = JSON.parse(responseText);
          throw new Error(errorData.error || 'Failed to fetch translation data');
        } catch (parseError) {
          // Format technical errors into user-friendly messages
          if (response.status === 500) {
            throw new Error('Server error: The application ID may be invalid or the translation might not exist.');
          } else if (response.status === 404) {
            throw new Error('Translation not found: Please check the application ID and ensure the form has been translated.');
          } else if (response.status === 401) {
            throw new Error('Your session has expired. Please log in again.');
          } else if (response.status === 403) {
            throw new Error('You do not have permission to access this form.');
          } else {
            throw new Error('Unable to load form data. Please try again later.');
          }
        }
      }
      
      const data = await response.json();
      
      // Remove metadata fields that we don't need for form filling
      const { application_id, translation_created_at, translation_updated_at, ...formData } = data;
      
      // Ensure we have form data
      if (!formData || Object.keys(formData).length === 0) {
        throw new Error('Invalid response: No form data found in the translation');
      }
      
      console.log('Translation data fetched successfully');
      return formData;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Get all DS-160 forms for the current user
   */
  async getUserForms() {
    try {
      if (!this.authToken) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch(`${API_BASE_URL}/ds160/client/all`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('User forms response:', response);
      if (!response.ok) {
        console.error('API Error Status:', response.status);
        try {
          const errorData = await response.json();
          console.error('API Error Response:', errorData);
          throw new Error(errorData.error || 'Failed to fetch user forms');
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
          throw new Error(`API Error (${response.status}): ${response.statusText}`);
        }
      }
      
      const data = await response.json();
      console.log('Received form data:', data);
      return data;
    } catch (error) {
      throw error;
    }
  }

}

// Create and export a singleton instance
window.borderXClient = new BorderXClient();