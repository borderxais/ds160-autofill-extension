// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'fillForm') {
    try {
      // Get the client data
      const clientData = request.clientData;
      
      // Detect which page of the DS-160 form we're on
      const currentSection = detectCurrentFormSection();
      
      if (!currentSection) {
        sendResponse({ success: false, error: 'Could not detect form section' });
        return true;
      }
      
      // Fill the fields for the current section
      const result = fillFormSection(currentSection, clientData);
      
      // Send response back to popup
      sendResponse({ 
        success: true, 
        message: `Filled ${result.filledCount} fields in the ${currentSection} section`,
        section: currentSection,
        filledCount: result.filledCount
      });
    } catch (error) {
      console.error('Error filling form:', error);
      sendResponse({ success: false, error: error.message });
    }
    
    return true; // Required to use sendResponse asynchronously
  }
});

/**
 * Detects which section of the DS-160 form is currently displayed
 */
function detectCurrentFormSection() {
  // Check page title and content to determine which section we're on
  const pageTitle = document.title.toLowerCase();
  const pageContent = document.body.textContent.toLowerCase();
  const headers = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => h.textContent.toLowerCase());
  
  // Personal Information section
  if (
    pageTitle.includes('personal') || 
    headers.some(h => h.includes('personal')) ||
    pageContent.includes('name') && pageContent.includes('date of birth')
  ) {
    return 'personalInfo';
  }
  
  // Address/Phone/Email section
  if (
    pageTitle.includes('address') || 
    pageTitle.includes('contact') || 
    headers.some(h => h.includes('address') || h.includes('contact')) ||
    pageContent.includes('street address') && pageContent.includes('phone number')
  ) {
    return 'contactInfo';
  }
  
  // Passport Information section
  if (
    pageTitle.includes('passport') || 
    headers.some(h => h.includes('passport')) ||
    pageContent.includes('passport number') && pageContent.includes('expiration date')
  ) {
    return 'passportInfo';
  }
  
  // Travel Information section
  if (
    pageTitle.includes('travel') || 
    headers.some(h => h.includes('travel')) ||
    pageContent.includes('purpose of trip') && pageContent.includes('arrival date')
  ) {
    return 'travelInfo';
  }
  
  // Education section
  if (
    pageTitle.includes('education') || 
    headers.some(h => h.includes('education') || h.includes('school')) ||
    pageContent.includes('school name') && pageContent.includes('degree')
  ) {
    return 'educationInfo';
  }
  
  // Work/Employment section
  if (
    pageTitle.includes('work') || 
    pageTitle.includes('employment') || 
    headers.some(h => h.includes('work') || h.includes('employment') || h.includes('occupation')) ||
    pageContent.includes('employer name') && pageContent.includes('job title')
  ) {
    return 'workInfo';
  }
  
  // Security and Background section
  if (
    pageTitle.includes('security') || 
    pageTitle.includes('background') || 
    headers.some(h => h.includes('security') || h.includes('background')) ||
    pageContent.includes('criminal') && pageContent.includes('terrorist')
  ) {
    return 'securityInfo';
  }
  
  // Family Information section
  if (
    pageTitle.includes('family') || 
    pageTitle.includes('relatives') || 
    headers.some(h => h.includes('family') || h.includes('relatives')) ||
    pageContent.includes('spouse') && pageContent.includes('children')
  ) {
    return 'familyInfo';
  }
  
  return null;
}

/**
 * Fills form fields for a specific section
 */
function fillFormSection(section, clientData) {
  // Get field mappings for this section
  const fieldMappings = getFieldMappings(section);
  
  let filledCount = 0;
  const errors = [];
  
  // Process each field mapping
  for (const mapping of fieldMappings) {
    try {
      // Get field value from client data
      const value = getValueByPath(clientData, mapping.dbPath);
      
      // Skip if no value
      if (value === undefined || value === null || value === '') {
        continue;
      }
      
      // Find the field in the form
      const field = findField(mapping);
      
      if (!field) {
        console.warn(`Field not found: ${mapping.dbPath}`);
        continue;
      }
      
      // Fill the field
      const success = fillField(field, value, mapping);
      
      if (success) {
        filledCount++;
        console.log(`Successfully filled field: ${mapping.dbPath} with value: ${value}`);
      } else {
        console.warn(`Failed to fill field: ${mapping.dbPath}`);
        errors.push(`Failed to fill field: ${mapping.dbPath}`);
      }
    } catch (error) {
      console.error(`Error filling field: ${mapping.dbPath}`, error);
      errors.push(`Error filling field: ${mapping.dbPath}: ${error.message}`);
    }
  }
  
  return {
    filledCount,
    errors
  };
}

/**
 * Gets a value from an object using dot notation path
 */
function getValueByPath(obj, path) {
  return path.split('.').reduce((prev, curr) => {
    return prev ? prev[curr] : null;
  }, obj);
}

/**
 * Finds a form field element
 */
function findField(mapping) {
  const { selector, fallbackSelectors } = mapping;
  
  // Try primary selector
  let field = findFieldBySelector(selector);
  
  // If not found, try fallback selectors
  if (!field && fallbackSelectors) {
    for (const fallbackSelector of fallbackSelectors) {
      field = findFieldBySelector(fallbackSelector);
      if (field) break;
    }
  }
  
  return field;
}

/**
 * Finds a field by selector type
 */
function findFieldBySelector(selector) {
  switch (selector.type) {
    case 'id':
      return document.getElementById(selector.value);
      
    case 'name':
      return document.querySelector(`[name="${selector.value}"]`);
      
    case 'xpath':
      const result = document.evaluate(
        selector.value,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      return result.singleNodeValue;
      
    default:
      return null;
  }
}

/**
 * Fills a form field with a value
 */
function fillField(field, value, mapping) {
  try {
    const fieldType = mapping.fieldType || detectFieldType(field);
    
    switch (fieldType) {
      case 'text':
        field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        break;
        
      case 'select':
        fillSelectField(field, value);
        break;
        
      case 'radio':
        fillRadioField(field, value, mapping);
        break;
        
      case 'checkbox':
        field.checked = Boolean(value);
        field.dispatchEvent(new Event('change', { bubbles: true }));
        break;
        
      case 'date':
        // Format date as needed
        if (typeof value === 'string' && value.includes('-')) {
          // Convert YYYY-MM-DD to MM/DD/YYYY
          const parts = value.split('-');
          if (parts.length === 3) {
            value = `${parts[1]}/${parts[2]}/${parts[0]}`;
          }
        }
        field.value = value;
        field.dispatchEvent(new Event('change', { bubbles: true }));
        break;
        
      default:
        field.value = value;
        field.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    return true;
  } catch (error) {
    console.error('Error filling field:', error);
    return false;
  }
}

/**
 * Detects the type of form field
 */
function detectFieldType(field) {
  if (!field) return null;
  
  const tagName = field.tagName.toLowerCase();
  
  if (tagName === 'input') {
    return field.type || 'text';
  }
  
  if (tagName === 'select') {
    return 'select';
  }
  
  if (tagName === 'textarea') {
    return 'text';
  }
  
  return 'text';
}

/**
 * Fills a select dropdown field
 */
function fillSelectField(field, value) {
  // First try exact match by value
  for (let i = 0; i < field.options.length; i++) {
    if (field.options[i].value === value) {
      field.selectedIndex = i;
      field.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
  }
  
  // Then try text content match
  for (let i = 0; i < field.options.length; i++) {
    if (field.options[i].text === value) {
      field.selectedIndex = i;
      field.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
  }
  
  // Then try case-insensitive match
  const lowerValue = String(value).toLowerCase();
  for (let i = 0; i < field.options.length; i++) {
    if (field.options[i].text.toLowerCase().includes(lowerValue)) {
      field.selectedIndex = i;
      field.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
  }
}

/**
 * Fills a radio button field
 */
function fillRadioField(field, value, mapping) {
  // If field is already a radio input, just check it
  if (field.tagName === 'INPUT' && field.type === 'radio') {
    field.checked = true;
    field.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  
  // Otherwise, find all radio buttons in the group
  const name = field.name || mapping.selector.value;
  const radioButtons = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
  
  // Determine which value to select
  let selectValue = value;
  if (mapping.selectValue) {
    selectValue = typeof mapping.selectValue === 'function' 
      ? mapping.selectValue(value) 
      : mapping.selectValue;
  }
  
  // Find the button to check
  for (const radio of radioButtons) {
    if (radio.value === String(selectValue) || 
        radio.value.toLowerCase() === String(selectValue).toLowerCase()) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
  }
}

/**
 * Gets field mappings for a specific form section
 */
function getFieldMappings(section) {
  const mappings = {
    personalInfo: [
      {
        dbPath: 'personalInfo.lastName',
        selector: { type: 'id', value: 'surname' },
        fallbackSelectors: [
          { type: 'name', value: 'surname' },
          { type: 'xpath', value: '//label[contains(text(), "Surname")]/following-sibling::input' },
          { type: 'xpath', value: '//label[contains(text(), "Last Name")]/following-sibling::input' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'personalInfo.firstName',
        selector: { type: 'id', value: 'given-name' },
        fallbackSelectors: [
          { type: 'name', value: 'givenName' },
          { type: 'xpath', value: '//label[contains(text(), "Given Name")]/following-sibling::input' },
          { type: 'xpath', value: '//label[contains(text(), "First Name")]/following-sibling::input' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'personalInfo.fullNameNative',
        selector: { type: 'id', value: 'full-name-native-alphabet' },
        fallbackSelectors: [
          { type: 'xpath', value: '//label[contains(text(), "Native Alphabet")]/following-sibling::input' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'personalInfo.dateOfBirth',
        selector: { type: 'id', value: 'date-of-birth' },
        fallbackSelectors: [
          { type: 'name', value: 'dateOfBirth' },
          { type: 'xpath', value: '//label[contains(text(), "Date of Birth")]/following-sibling::input' }
        ],
        fieldType: 'date'
      },
      {
        dbPath: 'personalInfo.gender',
        selector: { type: 'name', value: 'gender' },
        fallbackSelectors: [
          { type: 'xpath', value: '//label[contains(text(), "Gender")]/following-sibling::input[@type="radio"]' }
        ],
        fieldType: 'radio',
        selectValue: (value) => value.toUpperCase() // 'male' -> 'MALE'
      },
      {
        dbPath: 'personalInfo.maritalStatus',
        selector: { type: 'id', value: 'marital-status' },
        fallbackSelectors: [
          { type: 'name', value: 'maritalStatus' },
          { type: 'xpath', value: '//label[contains(text(), "Marital Status")]/following-sibling::select' }
        ],
        fieldType: 'select'
      },
      {
        dbPath: 'personalInfo.birthCity',
        selector: { type: 'id', value: 'birth-city' },
        fallbackSelectors: [
          { type: 'name', value: 'birthCity' },
          { type: 'xpath', value: '//label[contains(text(), "City of Birth")]/following-sibling::input' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'personalInfo.birthCountry',
        selector: { type: 'id', value: 'birth-country' },
        fallbackSelectors: [
          { type: 'name', value: 'birthCountry' },
          { type: 'xpath', value: '//label[contains(text(), "Country/Region of Birth")]/following-sibling::select' }
        ],
        fieldType: 'select'
      },
      {
        dbPath: 'personalInfo.nationality',
        selector: { type: 'id', value: 'nationality' },
        fallbackSelectors: [
          { type: 'name', value: 'nationality' },
          { type: 'xpath', value: '//label[contains(text(), "Nationality")]/following-sibling::select' }
        ],
        fieldType: 'select'
      }
    ],
    
    contactInfo: [
      {
        dbPath: 'contactInfo.streetAddress1',
        selector: { type: 'id', value: 'home-address-1' },
        fallbackSelectors: [
          { type: 'name', value: 'address1' },
          { type: 'xpath', value: '//label[contains(text(), "Street Address")]/following-sibling::input' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'contactInfo.streetAddress2',
        selector: { type: 'id', value: 'home-address-2' },
        fallbackSelectors: [
          { type: 'name', value: 'address2' },
          { type: 'xpath', value: '//label[contains(text(), "Apartment")]/following-sibling::input' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'contactInfo.city',
        selector: { type: 'id', value: 'home-city' },
        fallbackSelectors: [
          { type: 'name', value: 'city' },
          { type: 'xpath', value: '//label[contains(text(), "City")]/following-sibling::input' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'contactInfo.state',
        selector: { type: 'id', value: 'home-state' },
        fallbackSelectors: [
          { type: 'name', value: 'state' },
          { type: 'xpath', value: '//label[contains(text(), "State/Province")]/following-sibling::input' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'contactInfo.postalCode',
        selector: { type: 'id', value: 'home-postal-code' },
        fallbackSelectors: [
          { type: 'name', value: 'postalCode' },
          { type: 'xpath', value: '//label[contains(text(), "Postal Code")]/following-sibling::input' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'contactInfo.country',
        selector: { type: 'id', value: 'home-country' },
        fallbackSelectors: [
          { type: 'name', value: 'country' },
          { type: 'xpath', value: '//label[contains(text(), "Country/Region")]/following-sibling::select' }
        ],
        fieldType: 'select'
      },
      {
        dbPath: 'contactInfo.phone',
        selector: { type: 'id', value: 'phone-number' },
        fallbackSelectors: [
          { type: 'name', value: 'phoneNumber' },
          { type: 'xpath', value: '//label[contains(text(), "Phone Number")]/following-sibling::input' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'contactInfo.email',
        selector: { type: 'id', value: 'email' },
        fallbackSelectors: [
          { type: 'name', value: 'email' },
          { type: 'xpath', value: '//label[contains(text(), "Email Address")]/following-sibling::input' }
        ],
        fieldType: 'text'
      }
    ],
    
    passportInfo: [
      {
        dbPath: 'passportInfo.passportNumber',
        selector: { type: 'id', value: 'passport-number' },
        fallbackSelectors: [
          { type: 'name', value: 'passportNumber' },
          { type: 'xpath', value: '//label[contains(text(), "Passport Number")]/following-sibling::input' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'passportInfo.issuingCountry',
        selector: { type: 'id', value: 'passport-issuing-country' },
        fallbackSelectors: [
          { type: 'name', value: 'issuingCountry' },
          { type: 'xpath', value: '//label[contains(text(), "Country/Authority")]/following-sibling::select' }
        ],
        fieldType: 'select'
      },
      {
        dbPath: 'passportInfo.issueDate',
        selector: { type: 'id', value: 'passport-issue-date' },
        fallbackSelectors: [
          { type: 'name', value: 'issueDate' },
          { type: 'xpath', value: '//label[contains(text(), "Issuance Date")]/following-sibling::input' }
        ],
        fieldType: 'date'
      },
      {
        dbPath: 'passportInfo.expirationDate',
        selector: { type: 'id', value: 'passport-expiration-date' },
        fallbackSelectors: [
          { type: 'name', value: 'expirationDate' },
          { type: 'xpath', value: '//label[contains(text(), "Expiration Date")]/following-sibling::input' }
        ],
        fieldType: 'date'
      }
    ],
    
    travelInfo: [
      {
        dbPath: 'travelInfo.purposeOfTrip',
        selector: { type: 'id', value: 'purpose-of-trip' },
        fallbackSelectors: [
          { type: 'name', value: 'purposeOfTrip' },
          { type: 'xpath', value: '//label[contains(text(), "Purpose of Trip")]/following-sibling::select' }
        ],
        fieldType: 'select'
      },
      {
        dbPath: 'travelInfo.intendedArrivalDate',
        selector: { type: 'id', value: 'intended-arrival-date' },
        fallbackSelectors: [
          { type: 'name', value: 'arrivalDate' },
          { type: 'xpath', value: '//label[contains(text(), "Arrival Date")]/following-sibling::input' }
        ],
        fieldType: 'date'
      },
      {
        dbPath: 'travelInfo.intendedDepartureDate',
        selector: { type: 'id', value: 'intended-departure-date' },
        fallbackSelectors: [
          { type: 'name', value: 'departureDate' },
          { type: 'xpath', value: '//label[contains(text(), "Departure Date")]/following-sibling::input' }
        ],
        fieldType: 'date'
      },
      {
        dbPath: 'travelInfo.previouslyVisitedUS',
        selector: { type: 'name', value: 'previouslyVisitedUS' },
        fallbackSelectors: [
          { type: 'xpath', value: '//label[contains(text(), "Previously visited the United States")]/following-sibling::input[@type="radio"]' }
        ],
        fieldType: 'radio',
        selectValue: (value) => value ? 'YES' : 'NO'
      },
      {
        dbPath: 'travelInfo.usContactName',
        selector: { type: 'id', value: 'us-contact-name' },
        fallbackSelectors: [
          { type: 'name', value: 'usContactName' },
          { type: 'xpath', value: '//label[contains(text(), "Contact Person Name")]/following-sibling::input' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'travelInfo.usContactAddress',
        selector: { type: 'id', value: 'us-contact-address' },
        fallbackSelectors: [
          { type: 'name', value: 'usContactAddress' },
          { type: 'xpath', value: '//label[contains(text(), "Contact Address")]/following-sibling::input' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'travelInfo.usContactPhone',
        selector: { type: 'id', value: 'us-contact-phone' },
        fallbackSelectors: [
          { type: 'name', value: 'usContactPhone' },
          { type: 'xpath', value: '//label[contains(text(), "Contact Phone")]/following-sibling::input' }
        ],
        fieldType: 'text'
      }
    ],
    
    educationInfo: [
      {
        dbPath: 'educationInfo.schoolName',
        selector: { type: 'id', value: 'school-name' },
        fallbackSelectors: [
          { type: 'name', value: 'schoolName' },
          { type: 'xpath', value: '//label[contains(text(), "School Name")]/following-sibling::input' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'educationInfo.schoolAddress',
        selector: { type: 'id', value: 'school-address' },
        fallbackSelectors: [
          { type: 'name', value: 'schoolAddress' },
          { type: 'xpath', value: '//label[contains(text(), "School Address")]/following-sibling::input' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'educationInfo.schoolCity',
        selector: { type: 'id', value: 'school-city' },
        fallbackSelectors: [
          { type: 'name', value: 'schoolCity' },
          { type: 'xpath', value: '//label[contains(text(), "School City")]/following-sibling::input' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'educationInfo.schoolState',
        selector: { type: 'id', value: 'school-state' },
        fallbackSelectors: [
          { type: 'name', value: 'schoolState' },
          { type: 'xpath', value: '//label[contains(text(), "School State/Province")]/following-sibling::input' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'educationInfo.schoolCountry',
        selector: { type: 'id', value: 'school-country' },
        fallbackSelectors: [
          { type: 'name', value: 'schoolCountry' },
          { type: 'xpath', value: '//label[contains(text(), "School Country")]/following-sibling::select' }
        ],
        fieldType: 'select'
      },
      {
        dbPath: 'educationInfo.degree',
        selector: { type: 'id', value: 'degree' },
        fallbackSelectors: [
          { type: 'name', value: 'degree' },
          { type: 'xpath', value: '//label[contains(text(), "Degree")]/following-sibling::input' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'educationInfo.fieldOfStudy',
        selector: { type: 'id', value: 'field-of-study' },
        fallbackSelectors: [
          { type: 'name', value: 'fieldOfStudy' },
          { type: 'xpath', value: '//label[contains(text(), "Field of Study")]/following-sibling::input' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'educationInfo.attendedFrom',
        selector: { type: 'id', value: 'attended-from' },
        fallbackSelectors: [
          { type: 'name', value: 'attendedFrom' },
          { type: 'xpath', value: '//label[contains(text(), "From")]/following-sibling::input' }
        ],
        fieldType: 'date'
      },
      {
        dbPath: 'educationInfo.attendedTo',
        selector: { type: 'id', value: 'attended-to' },
        fallbackSelectors: [
          { type: 'name', value: 'attendedTo' },
          { type: 'xpath', value: '//label[contains(text(), "To")]/following-sibling::input' }
        ],
        fieldType: 'date'
      }
    ],
    
    workInfo: [
      {
        dbPath: 'workInfo.employerName',
        selector: { type: 'id', value: 'employer-name' },
        fallbackSelectors: [
          { type: 'name', value: 'employerName' },
          { type: 'xpath', value: '//label[contains(text(), "Employer Name")]/following-sibling::input' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'workInfo.employerAddress',
        selector: { type: 'id', value: 'employer-address' },
        fallbackSelectors: [
          { type: 'name', value: 'employerAddress' },
          { type: 'xpath', value: '//label[contains(text(), "Employer Address")]/following-sibling::input' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'workInfo.employerCity',
        selector: { type: 'id', value: 'employer-city' },
        fallbackSelectors: [
          { type: 'name', value: 'employerCity' },
          { type: 'xpath', value: '//label[contains(text(), "Employer City")]/following-sibling::input' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'workInfo.employerState',
        selector: { type: 'id', value: 'employer-state' },
        fallbackSelectors: [
          { type: 'name', value: 'employerState' },
          { type: 'xpath', value: '//label[contains(text(), "Employer State/Province")]/following-sibling::input' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'workInfo.employerCountry',
        selector: { type: 'id', value: 'employer-country' },
        fallbackSelectors: [
          { type: 'name', value: 'employerCountry' },
          { type: 'xpath', value: '//label[contains(text(), "Employer Country")]/following-sibling::select' }
        ],
        fieldType: 'select'
      },
      {
        dbPath: 'workInfo.jobTitle',
        selector: { type: 'id', value: 'job-title' },
        fallbackSelectors: [
          { type: 'name', value: 'jobTitle' },
          { type: 'xpath', value: '//label[contains(text(), "Job Title")]/following-sibling::input' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'workInfo.description',
        selector: { type: 'id', value: 'job-description' },
        fallbackSelectors: [
          { type: 'name', value: 'jobDescription' },
          { type: 'xpath', value: '//label[contains(text(), "Job Description")]/following-sibling::textarea' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'workInfo.employedFrom',
        selector: { type: 'id', value: 'employed-from' },
        fallbackSelectors: [
          { type: 'name', value: 'employedFrom' },
          { type: 'xpath', value: '//label[contains(text(), "From")]/following-sibling::input' }
        ],
        fieldType: 'date'
      },
      {
        dbPath: 'workInfo.employedTo',
        selector: { type: 'id', value: 'employed-to' },
        fallbackSelectors: [
          { type: 'name', value: 'employedTo' },
          { type: 'xpath', value: '//label[contains(text(), "To")]/following-sibling::input' }
        ],
        fieldType: 'date'
      }
    ],
    
    familyInfo: [
      {
        dbPath: 'familyInfo.spouseFirstName',
        selector: { type: 'id', value: 'spouse-first-name' },
        fallbackSelectors: [
          { type: 'name', value: 'spouseFirstName' },
          { type: 'xpath', value: '//label[contains(text(), "Spouse First Name")]/following-sibling::input' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'familyInfo.spouseLastName',
        selector: { type: 'id', value: 'spouse-last-name' },
        fallbackSelectors: [
          { type: 'name', value: 'spouseLastName' },
          { type: 'xpath', value: '//label[contains(text(), "Spouse Last Name")]/following-sibling::input' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'familyInfo.spouseDateOfBirth',
        selector: { type: 'id', value: 'spouse-dob' },
        fallbackSelectors: [
          { type: 'name', value: 'spouseDOB' },
          { type: 'xpath', value: '//label[contains(text(), "Spouse Date of Birth")]/following-sibling::input' }
        ],
        fieldType: 'date'
      },
      {
        dbPath: 'familyInfo.spouseCountryOfBirth',
        selector: { type: 'id', value: 'spouse-country-of-birth' },
        fallbackSelectors: [
          { type: 'name', value: 'spouseCountryOfBirth' },
          { type: 'xpath', value: '//label[contains(text(), "Spouse Country of Birth")]/following-sibling::select' }
        ],
        fieldType: 'select'
      }
    ],
    
    securityInfo: [
      {
        dbPath: 'securityInfo.criminalRecord',
        selector: { type: 'name', value: 'criminalRecord' },
        fallbackSelectors: [
          { type: 'xpath', value: '//label[contains(text(), "Criminal Record")]/following-sibling::input[@type="radio"]' }
        ],
        fieldType: 'radio',
        selectValue: (value) => value ? 'YES' : 'NO'
      },
      {
        dbPath: 'securityInfo.drugOffenses',
        selector: { type: 'name', value: 'drugOffenses' },
        fallbackSelectors: [
          { type: 'xpath', value: '//label[contains(text(), "Drug Offenses")]/following-sibling::input[@type="radio"]' }
        ],
        fieldType: 'radio',
        selectValue: (value) => value ? 'YES' : 'NO'
      },
      {
        dbPath: 'securityInfo.terroristActivities',
        selector: { type: 'name', value: 'terroristActivities' },
        fallbackSelectors: [
          { type: 'xpath', value: '//label[contains(text(), "Terrorist Activities")]/following-sibling::input[@type="radio"]' }
        ],
        fieldType: 'radio',
        selectValue: (value) => value ? 'YES' : 'NO'
      }
    ]
  };
  
  return mappings[section] || [];
}