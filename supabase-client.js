// This file handles all interactions with the BorderX backend API

// Base URL for the BorderX API
const API_BASE_URL = 'http://localhost:5000/api';

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
   * @param {string} application_id - The DS-160 application ID
   * @returns {Promise} - Promise with translation data
   */
  async fetchFormData(application_id) {
    try {
      if (!this.authToken) {
        throw new Error('Not authenticated');
      }
      
      console.log(`Fetching translation data for application ID: ${application_id}`);
      
      // Validate that application_id is not empty
      if (!application_id) {
        throw new Error('Application ID cannot be empty');
      }
      
      // Use the client endpoint that returns translation data
      console.log(`API URL: ${API_BASE_URL}/ds160/client/${application_id}`);
      console.log(`Auth token: ${this.authToken.substring(0, 10)}...`);
      
      const response = await fetch(`${API_BASE_URL}/ds160/client/${application_id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Response status:', response.status);
      
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
      
      const responseText = await response.text();
      console.log('Response text (first 100 chars):', responseText.substring(0, 100));
      
      try {
        const data = JSON.parse(responseText);
        console.log('Parsed translation data:', data);
        return this.formatFormData(data);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        throw new Error('Invalid JSON response from server');
      }
    } catch (error) {
      console.error('Error fetching translation data:', error);
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
    // The data might be nested in different ways depending on the API response
    const formData = data.form_data || data;
    
    console.log('Raw form data structure:', Object.keys(formData));

    // // Get section data from the structure used in the Non-immigration Website
    // const personalInfo = formData.personal_info || {};
    // const contactInfo = formData.contact_info || {};
    // const passportInfo = formData.passport_info || {};
    // const travelInfo = formData.travel_info || {};
    // const usContactInfo = formData.us_contact_info || {};
    // const familyInfo = formData.family_info || {};
    // const workEducationInfo = formData.work_education_info || {};
    // const securityInfo = formData.security_background_info || {};
    
    // // Store the application ID if available
    // const application_id = data.application_id || formData.application_id;
    
    // Format the data according to the DS-160 form fields
    return {
        application_id: data.application_id || formData.application_id,
        
        // Personal Information section
        personalInfo: {
          surname: formData.surname,
          givenName: formData.givenName,
          fullNameNative_na: formData.fullNameNative_na,
          hasOtherNames: formData.hasOtherNames,
          hasTelecode: formData.hasTelecode,
          gender: formData.gender,
          maritalStatus: formData.maritalStatus,
          dateOfBirth: formData.dateOfBirth,
          dobDay: formData.dobDay,
          dobMonth: formData.dobMonth,
          dobYear: formData.dobYear,
          birthPlace: formData.birthPlace,
          birthState_na: formData.birthState_na,
          birthCountry: formData.birthCountry,
          nationality: formData.nationality
        },
        
        // Contact Information section
        contactInfo: {
          streetAddress1: formData.homeAddressLine1 || formData.streetAddress1,
          city: formData.homeCity || formData.city,
          state: formData.homeState || formData.state,
          postalCode: formData.homePostalCode || formData.zipCode,
          country: formData.homeCountry,
          phone: formData.primaryPhone,
          email: formData.emailAddress
        },
        
        // Passport Information section
        passportInfo: {
          passportNumber: formData.passportNumber,
          issuingCountry: formData.passportIssuedCountry,
          issueDate: this.formatDate(`${formData.passportIssuedYear}-${this.monthToNumber(formData.passportIssuedMonth)}-${formData.passportIssuedDay}`),
          expirationDate: this.formatDate(`${formData.passportExpirationYear}-${this.monthToNumber(formData.passportExpirationMonth)}-${formData.passportExpirationDay}`)
        },
        
        // Travel Information section
        travelInfo: {
          purposeOfTrip: formData.specificPurpose,
          intendedArrivalDate: this.formatDate(`${formData.arrivalYear}-${this.monthToNumber(formData.arrivalMonth)}-${formData.arrivalDay}`),
          intendedDepartureDate: null, // Not present in the data
          previouslyVisitedUS: formData.everBeenInUS === "Y",
          usContactName: `${formData.usPocGivenName} ${formData.usPocSurname}`,
          usContactAddress: formData.usPocAddressLine1,
          usContactPhone: null // Not present in the data
        },
        
        // Family Information section
        familyInfo: {
          fatherDateOfBirth: this.formatDate(`${formData.fatherDobYear}-${this.monthToNumber(formData.fatherDobMonth)}-${formData.fatherDobDay}`),
          motherDateOfBirth: this.formatDate(`${formData.motherDobYear}-${this.monthToNumber(formData.motherDobMonth)}-${formData.motherDobDay}`),
          hasOtherRelativesInUs: formData.hasOtherRelativesInUs === "Y"
        },
        
        // Security Information section
        securityInfo: {
          criminalRecord: formData.previouslyDenied || false,
          drugOffenses: false, // Not present in the data
          terroristActivities: false // Not present in the data
        }
      };
    }
    monthToNumber(monthAbbr) {
        const months = {
          'JAN': '01',
          'FEB': '02',
          'MAR': '03',
          'APR': '04',
          'MAY': '05',
          'JUN': '06',
          'JUL': '07',
          'AUG': '08',
          'SEP': '09',
          'OCT': '10',
          'NOV': '11',
          'DEC': '12'
        };
        
        return months[monthAbbr] || '01';
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
  async logFormFillEvent(application_id, sectionName, success, details) {
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
          application_id,
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
   * Update the application ID for a DS-160 form
   * @param {string} old_application_id - The current application ID
   * @param {string} new_application_id - The new DS-160 application ID
   * @returns {Promise} - Promise with updated form data
   */
  async updateApplicationId(old_application_id, new_application_id) {
    try {
      if (!this.authToken) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch(`${API_BASE_URL}/ds160/form/${old_application_id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ application_id: new_application_id })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update application ID');
      }
      
      // Log the event
      this.logFormEvent(old_application_id, 'application_id_updated', { application_id: new_application_id });
      
      return response.json();
    } catch (error) {
      console.error('Error updating application ID:', error);
      throw error;
    }
  }
  
  /**
   * Log a form event
   * @param {string} application_id - The application ID
   * @param {string} eventType - The type of event
   * @param {Object} eventData - Additional event data
   */
  async logFormEvent(application_id, eventType, eventData = {}) {
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
          application_id,
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