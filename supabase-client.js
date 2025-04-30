// This file handles all interactions with the BorderX backend API

// Base URL for the BorderX API
const API_BASE_URL = 'http://localhost:5000/api';

// For production
// const API_BASE_URL = 'https://visasupport-dot-overseabiz-453023.wl.r.appspot.com/api';

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
        console.error('Login error data:', errorData);
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
      console.error('Login error:', error);
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
        console.error('Error response:', responseText);
        
        try {
          // Try to parse as JSON if possible
          const errorData = JSON.parse(responseText);
          throw new Error(errorData.error || 'Failed to fetch translation data');
        } catch (parseError) {
          // If not JSON, throw with the text
          if (response.status === 500) {
            throw new Error('Server error: The application ID may be invalid or the translation might not exist.');
          } else if (response.status === 404) {
            throw new Error('Translation not found: Please check the application ID and ensure the form has been translated.');
          } else {
            throw new Error(`Server returned ${response.status}: ${responseText.substring(0, 100)}...`);
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
      
      const response = await fetch(`${API_BASE_URL}/ds160/form`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch user forms');
      }
      
      return response.json();
    } catch (error) {
      console.error('Error fetching user forms:', error);
      throw error;
    }
  }
  
  /**
   * Format form data for the DS-160 form
   * @param {Object} data - Raw form data from the API
   * @returns {Object} - Formatted form data
   */
  formatFormData(data) {
    // Extract the form_data from the response
    const formData = data.form_data || data;
    
    console.log('Raw form data structure:', Object.keys(formData));

    // Get section data from the structure
    const personalInfo1 = formData.personalInfo1 || {};
    const personalInfo2 = formData.personalInfo2 || {};
    const contactInfo = formData.contactInfo || {};
    const passportInfo = formData.passportInfo || {};
    const travelInfo = formData.travelInfo || {};
    const familyInfo = formData.familyInfo || {};
    const workEducationInfo = formData.workEducationInfo || {};
    const securityInfo = formData.securityInfo || {};
    
    // Format the data according to the DS-160 form fields
    return {
        application_id: data.application_id || formData.application_id,
        personalInfo1,
        personalInfo2,
        contactInfo,
        passportInfo,
        travelInfo,
        familyInfo,
        workEducationInfo,
        securityInfo
    };
    }

  /**
   * Format date from various formats to MM/DD/YYYY
   * @param {string} date - Date string in various formats
   * @returns {string} - Formatted date string
   */
  formatDate(date) {
    if (!date) return '';
    
    // Handle ISO format (YYYY-MM-DD)
    if (typeof date === 'string' && date.includes('-')) {
      const parts = date.split('-');
      if (parts.length === 3) {
        return `${parts[1]}/${parts[2]}/${parts[0]}`; // MM/DD/YYYY
      }
    }
    
    // Handle object format with day, month, year properties
    if (typeof date === 'object' && date !== null) {
      const { day, month, year } = date;
      if (day && month && year) {
        return `${month}/${day}/${year}`;
      }
    }
    
    return date;
  }
  
  /**
   * Format education history data
   */
  formatEducationInfo(educationHistory) {
    if (!educationHistory || !Array.isArray(educationHistory) || educationHistory.length === 0) {
      return {};
    }
    
    // Use the most recent education entry
    const mostRecent = educationHistory[0];
    
    return {
      schoolName: mostRecent.school_name || mostRecent.institution_name,
      schoolAddress: mostRecent.school_address || mostRecent.address,
      schoolCity: mostRecent.school_city || mostRecent.city,
      schoolState: mostRecent.school_state || mostRecent.state || mostRecent.province,
      schoolCountry: mostRecent.school_country || mostRecent.country,
      degree: mostRecent.degree,
      fieldOfStudy: mostRecent.field_of_study || mostRecent.course_of_study,
      attendedFrom: this.formatEducationDate(mostRecent.attended_from_month, mostRecent.attended_from_year),
      attendedTo: this.formatEducationDate(mostRecent.attended_to_month, mostRecent.attended_to_year)
    };
  }
  
  /**
   * Format work history data
   */
  formatWorkInfo(workHistory) {
    if (!workHistory || !Array.isArray(workHistory) || workHistory.length === 0) {
      return {};
    }
    
    // Use the most recent work entry
    const mostRecent = workHistory[0];
    
    return {
      employerName: mostRecent.employer_name || mostRecent.company_name,
      employerAddress: mostRecent.employer_address || mostRecent.address,
      employerCity: mostRecent.employer_city || mostRecent.city,
      employerState: mostRecent.employer_state || mostRecent.state || mostRecent.province,
      employerCountry: mostRecent.employer_country || mostRecent.country,
      jobTitle: mostRecent.job_title || mostRecent.position,
      description: mostRecent.description || mostRecent.job_description,
      employedFrom: this.formatWorkDate(mostRecent.employed_from_month, mostRecent.employed_from_year),
      employedTo: this.formatWorkDate(mostRecent.employed_to_month, mostRecent.employed_to_year)
    };
  }
  
  /**
   * Format education date
   */
  formatEducationDate(month, year) {
    if (!month || !year) return '';
    return `${month}/${year}`;
  }
  
  /**
   * Format work date
   */
  formatWorkDate(month, year) {
    if (!month || !year) return '';
    return `${month}/${year}`;
  }
  
  /**
   * Log form fill event
   */
  async logFormFillEvent(original_form_application_id, sectionName, success, details) {
    try {
      if (!this.authToken) {
        console.warn('Not authenticated, skipping event logging');
        return;
      }
      
      await fetch(`${API_BASE_URL}/ds160/event`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          original_form_application_id,
          event_type: 'form_fill',
          section: sectionName,
          success,
          details
        })
      });
    } catch (error) {
      console.error('Error logging form fill event:', error);
      // Non-critical error, don't throw
    }
  }
  
  /**
   * Log a form event
   * @param {string} original_form_application_id - The original application ID
   * @param {string} eventType - The type of event
   * @param {Object} eventData - Additional event data
   */
  async logFormEvent(original_form_application_id, eventType, eventData = {}) {
    try {
      if (!this.authToken) {
        throw new Error('Not authenticated');
      }
      
      await fetch(`${API_BASE_URL}/ds160/events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          original_form_application_id,
          event_type: eventType,
          event_data: eventData
        })
      });
    } catch (error) {
      console.error('Error logging form event:', error);
      // Don't throw the error to avoid disrupting the main flow
    }
  }
}

// Create and export a singleton instance
window.borderXClient = new BorderXClient();