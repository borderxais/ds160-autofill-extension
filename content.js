// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'ping') {
    // Just respond to confirm content script is loaded
    sendResponse({ loaded: true });
    return true;
  }
  
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

      let result = fillFormSection(currentSection, clientData);
      // Fill the fields for the current section
      setTimeout(() => {
        result = fillFormSection(currentSection, clientData);
        // Send response back to popup
        
      }, 1000);

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
 * Maps official DS-160 page titles to our section names
 */
const DS160_PAGE_TO_SECTION_MAP = {
  'Personal Information 1': 'personalInfo1',
  'Personal Information 2': 'personalInfo2'
  // 'Address and Phone Information': 'contactInfo',
  // 'Passport Information': 'passportInfo',
  // 'Travel Information': 'travelInfo',
  // 'Travel Companions': 'travelCompanions',
  // 'Previous U.S. Travel Information': 'previousTravel',
  // 'U.S. Contact Information': 'usContact',
  // 'Family Information': 'familyInfo',
  // 'Work/Education/Training Information': 'education',
  // 'Security and Background Information': 'securityInfo'
};

/**
 * Detects which section of the DS-160 form is currently displayed
 */
function detectCurrentFormSection() {
  // Get the page title from the DS-160 form
  const pageTitle = document.title.trim();
  console.log('Current DS-160 page title:', pageTitle);
  
  // Find our section name that corresponds to this DS-160 page
  for (const [ds160Title, sectionName] of Object.entries(DS160_PAGE_TO_SECTION_MAP)) {
    if (pageTitle.toLowerCase().includes(ds160Title.toLowerCase())) {
      console.log(`Matched section: ${sectionName} for page: ${ds160Title}`);
      return sectionName;
    }
  }
  
  // If no exact match found, try matching by URL
  const url = window.location.href.toLowerCase();
  if (url.includes('complete_personal.aspx')) {
    console.log('Matched section by URL: personalInfo1');
    return 'personalInfo1';
  } else if (url.includes('complete_personalcont.aspx')) {
    console.log('Matched section by URL: personalInfo2');
    return 'personalInfo2';
  }
  
  console.warn('Could not determine section from page title:', pageTitle);
  return null;
}

/**
 * Gets a value from client data
 */
function getValueFromClientData(clientData, dbPath) {
  try {
    // Get the current section from the DS-160 page title
    const section = detectCurrentFormSection();
    if (!section) {
      console.warn('Could not determine current section');
      return null;
    }
    
    // Check if we have data for this section
    if (!clientData[section]) {
      console.warn(`No data found for section: ${section}`);
      return null;
    }
    
    // Get the field value from the section using dot notation path
    const value = getValueByPath(clientData[section], dbPath);
    console.log(`Looking for ${dbPath} in section ${section}:`, value);
    return value;
  } catch (error) {
    console.error('Error getting value from client data:', error);
    return null;
  }
}

/**
 * Gets a value from an object using dot notation path
 */
function getValueByPath(obj, path) {
  try {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  } catch (error) {
    console.error(`Error getting value by path ${path}:`, error);
    return undefined;
  }
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
    console.log('Error filling field:', error);
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
  // Ensure value is exactly 'Y' or 'N'
  const selectValue = value === 'Y' ? 'Y' : 'N';
  
  // APPROACH 1: Find by name and value - most reliable for DS-160
  const name = mapping.selector.value;
  if (typeof name === 'string') {
    // For ASP.NET forms, we need to escape $ in the selector
    const nameForQuery = name.replace(/\$/g, '\\$');
    const radioButtons = document.querySelectorAll(`input[type="radio"][name="${nameForQuery}"]`);
    
    if (radioButtons.length > 0) {
      // Try to find by value first
      for (const radio of radioButtons) {
        
        if (radio.value === selectValue) {
          
          // setTimeout(() => {
          //   const clickEvent = new MouseEvent('click', {
          //     'view': window,
          //     'bubbles': true,
          //     'cancelable': true,
          //     'clientX': radio.getBoundingClientRect().left + (Math.random() * radio.offsetWidth),
          //     'clientY': radio.getBoundingClientRect().top + (Math.random() * radio.offsetHeight)
          //   });
          //   radio.dispatchEvent(clickEvent);
          // }, 200);
          setTimeout(() => {
            radio.click();
          }, 500);
          // radio.checked = true;
          // radio.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('Radio button:', radio.value);
          console.log('selectValue:', selectValue);
 
          return true;
        }
      }
      
      // If not found by value, use position (0=Yes, 1=No)
      const index = selectValue === 'Y' ? 0 : 1;
      if (index < radioButtons.length) {
        radioButtons[index].checked = true;
        radioButtons[index].dispatchEvent(new Event('change', { bubbles: true }));
        
        if (radioButtons[index].onclick) {
          try {
            radioButtons[index].onclick();
          } catch (e) {}
        }
        return true;
      }
    }
  }
  
  // APPROACH 2: Try direct ID selection for DS-160 form pattern
  if (typeof mapping.selector.value === 'string' && mapping.selector.value.includes('$')) {
    const baseId = mapping.selector.value.replace(/\$/g, '_');
    const radioId = selectValue === 'Y' ? `${baseId}_0` : `${baseId}_1`;
    
    const radioToSelect = document.getElementById(radioId);
    if (radioToSelect) {
      radioToSelect.checked = true;
      radioToSelect.dispatchEvent(new Event('change', { bubbles: true }));
      
      if (radioToSelect.onclick) {
        try {
          radioToSelect.onclick();
        } catch (e) {}
      }
      return true;
    }
  }
  
  // APPROACH 3: Use fallback selectors if available
  if (mapping.fallbackSelectors && mapping.fallbackSelectors.length > 0) {
    const index = selectValue === 'Y' ? 0 : 1;
    if (index < mapping.fallbackSelectors.length) {
      const fallbackSelector = mapping.fallbackSelectors[index];
      let radioElement = null;
      
      if (fallbackSelector.type === 'id') {
        radioElement = document.getElementById(fallbackSelector.value);
      } else if (fallbackSelector.type === 'name') {
        radioElement = document.querySelector(`[name="${fallbackSelector.value}"]`);
      } else if (fallbackSelector.type === 'xpath') {
        const result = document.evaluate(
          fallbackSelector.value,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        radioElement = result.singleNodeValue;
      }
      
      if (radioElement) {
        radioElement.checked = true;
        radioElement.dispatchEvent(new Event('change', { bubbles: true }));
        
        if (radioElement.onclick) {
          try {
            radioElement.onclick();
          } catch (e) {}
        }
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Fills form fields for a specific section
 */
async function fillFormSection(section, clientData) {
  console.log(`Filling section: ${section}`);
  console.log('Client data:', clientData);
  
  let filledCount = 0;
  
  // Get field mappings for this section
  const mappings = getFieldMappings(section);
  if (!mappings) {
    console.warn(`No mappings found for section: ${section}`);
    return { filledCount: 0 };
  }
  
  // Process each field mapping
  for (const mapping of mappings) {
    try {
      let value = getValueFromClientData(clientData, mapping.dbPath);
      if (mapping.valueExtractor) {
        value = mapping.valueExtractor(clientData);
      }
      if (value === null || value === undefined) {
        continue;
      }
      
      const field = findField(mapping);
      if (!field) {
        continue;
      }
      
      fillField(field, value, mapping);
      console.log(`Filled field ${mapping.dbPath} with value:`, value);
      filledCount++;
    } catch (error) {
      console.error(`Error filling field ${mapping.dbPath}:`, error);
    }
  }
  
  return { filledCount };
}

/**
 * Gets field mappings for a specific form section
 */
function getFieldMappings(section) {
  const mappings = {
    personalInfo1: [
      {
        dbPath: 'surname',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_SURNAME' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxAPP_SURNAME' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'givenName',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_GIVEN_NAME' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxAPP_GIVEN_NAME' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'fullNameNative_na',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbexAPP_FULL_NAME_NATIVE_NA' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbexAPP_FULL_NAME_NATIVE_NA' }
        ],
        fieldType: 'checkbox'
      },
      {
        dbPath: 'fullNameNative',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_FULL_NAME_NATIVE' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxAPP_FULL_NAME_NATIVE' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'hasOtherNames',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblOtherNames' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblOtherNames_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblOtherNames_1' }
        ],
        fieldType: 'radio',
        valueMap: {
          'Y': '0',
          'N': '1'
        }
      },
      {
        dbPath: 'otherNames',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_DListAlias_ctl00_tbxSURNAME' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$DListAlias$ctl00$tbxSURNAME' }
        ],
        fieldType: 'text',
        valueExtractor: (data) => {
          if (data.otherNames && data.otherNames.length > 0 && data.otherNames[0].surname) {
            return data.otherNames[0].surname;
          }
          return null;
        }
      },
      {
        dbPath: 'otherNames',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_DListAlias_ctl00_tbxGIVEN_NAME' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$DListAlias$ctl00$tbxGIVEN_NAME' }
        ],
        fieldType: 'text',
        valueExtractor: (data) => {
          if (data.otherNames && data.otherNames.length > 0 && data.otherNames[0].givenName) {
            return data.otherNames[0].givenName;
          }
          return null;
        }
      },
      {
        dbPath: 'hasTelecode',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblTelecodeQuestion' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblTelecodeQuestion_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblTelecodeQuestion_1' }
        ],
        fieldType: 'radio',
        valueMap: {
          'Y': '0',
          'N': '1'
        }
      },
      {
        dbPath: 'telecode.surname',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_TelecodeSURNAME' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxAPP_TelecodeSURNAME' }
        ],
        fieldType: 'text',
        maxLength: 20
      },
      {
        dbPath: 'telecode.givenName',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_TelecodeGIVEN_NAME' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxAPP_TelecodeGIVEN_NAME' }
        ],
        fieldType: 'text',
        maxLength: 20
      },
      {
        dbPath: 'gender',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlAPP_GENDER' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlAPP_GENDER' }
        ],
        fieldType: 'select',
        valueMap: {
          'M': 'M',
          'F': 'F'
        }
      },
      {
        dbPath: 'maritalStatus',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlAPP_MARITAL_STATUS' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlAPP_MARITAL_STATUS' }
        ],
        fieldType: 'select'
      },
      {
        dbPath: 'dob.day',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlDOBDay' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlDOBDay' }
        ],
        fieldType: 'select'
      },
      {
        dbPath: 'dob.month',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlDOBMonth' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlDOBMonth' }
        ],
        fieldType: 'select'
      },
      {
        dbPath: 'dob.year',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxDOBYear' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxDOBYear' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'birthCity',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_POB_CITY' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxAPP_POB_CITY' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'birthState_na',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbexAPP_POB_ST_PROVINCE_NA' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbexAPP_POB_ST_PROVINCE_NA' }
        ],
        fieldType: 'checkbox'
      },
      {
        dbPath: 'birthState',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_POB_ST_PROVINCE' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxAPP_POB_ST_PROVINCE' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'birthCountry',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlAPP_POB_CNTRY' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlAPP_POB_CNTRY' }
        ],
        fieldType: 'select'
      }
    ],
    
    personalInfo2: [
      {
        dbPath: 'nationality',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlAPP_NATL' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlAPP_NATL' }
        ],
        fieldType: 'select'
      },
      {
        dbPath: 'hasOtherNationality',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblAPP_OTH_NATL_IND' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblAPP_OTH_NATL_IND_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblAPP_OTH_NATL_IND_1' }
        ],
        fieldType: 'radio',
        valueMap: {
          'Y': '0',
          'N': '1'
        }
      },
      {
        dbPath: 'isPermResOtherCountry',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblPermResOtherCntryInd' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblPermResOtherCntryInd_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblPermResOtherCntryInd_1' }
        ],
        fieldType: 'radio',
        valueMap: {
          'Y': '0',
          'N': '1'
        }
      },
      {
        dbPath: 'nationalIdNumber',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_NATIONAL_ID' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxAPP_NATIONAL_ID' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'nationalIdNumber_na',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbexAPP_NATIONAL_ID_NA' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbexAPP_NATIONAL_ID_NA' }
        ],
        fieldType: 'checkbox'
      },
      {
        dbPath: 'usSSN.part1',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_SSN1' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxAPP_SSN1' }
        ],
        fieldType: 'text',
        maxLength: 3
      },
      {
        dbPath: 'usSSN.part2',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_SSN2' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxAPP_SSN2' }
        ],
        fieldType: 'text',
        maxLength: 2
      },
      {
        dbPath: 'usSSN.part3',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_SSN3' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxAPP_SSN3' }
        ],
        fieldType: 'text',
        maxLength: 4
      },
      {
        dbPath: 'usSSN_na',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbexAPP_SSN_NA' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbexAPP_SSN_NA' }
        ],
        fieldType: 'checkbox'
      },
      {
        dbPath: 'usTaxId',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_TAX_ID' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxAPP_TAX_ID' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'usTaxId_na',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbexAPP_TAX_ID_NA' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbexAPP_TAX_ID_NA' }
        ],
        fieldType: 'checkbox'
      }
    ],
    
    // Additional mappings for other sections
    travelCompanions: [
      {
        dbPath: 'hasCompanions',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblTravelWithOthers' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblTravelWithOthers_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblTravelWithOthers_1' }
        ],
        fieldType: 'radio',
        valueMap: {
          'Y': '0',
          'N': '1'
        }
      },
      {
        dbPath: 'groupTravel',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblTravelGroup' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblTravelGroup_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblTravelGroup_1' }
        ],
        fieldType: 'radio',
        valueMap: {
          'Y': '0',
          'N': '1'
        }
      },
      {
        dbPath: 'groupName',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxGROUP_NAME' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxGROUP_NAME' }
        ],
        fieldType: 'text'
      }
    ],

    addressAndPhone: [
      // Home Address fields
      {
        dbPath: 'homeAddressStreet1',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_ADDR_LN1' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxAPP_ADDR_LN1' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'homeAddressStreet2',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_ADDR_LN2' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxAPP_ADDR_LN2' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'homeAddressCity',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_ADDR_CITY' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxAPP_ADDR_CITY' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'homeAddressState',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_ADDR_STATE' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxAPP_ADDR_STATE' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'homeAddressState_na',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbexAPP_ADDR_STATE_NA' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbexAPP_ADDR_STATE_NA' }
        ],
        fieldType: 'checkbox'
      },
      {
        dbPath: 'homeAddressZipCode',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_ADDR_POSTAL_CD' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxAPP_ADDR_POSTAL_CD' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'homeAddressZipCode_na',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbexAPP_ADDR_POSTAL_CD_NA' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbexAPP_ADDR_POSTAL_CD_NA' }
        ],
        fieldType: 'checkbox'
      },
      {
        dbPath: 'homeAddressCountry',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlCountry' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlCountry' }
        ],
        fieldType: 'select'
      },
      
      // Mailing Address Same as Home Address
      {
        dbPath: 'isMailingAddressSame',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblMailingAddrSame' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblMailingAddrSame_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblMailingAddrSame_1' }
        ],
        fieldType: 'radio',
        valueMap: {
          'Y': '0',
          'N': '1'
        }
      },
      
      // Mailing Address fields (only used when isMailingAddressSame = "N")
      {
        dbPath: 'mailingAddressStreet1',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxMAILING_ADDR_LN1' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxMAILING_ADDR_LN1' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'mailingAddressStreet2',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxMAILING_ADDR_LN2' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxMAILING_ADDR_LN2' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'mailingAddressCity',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxMAILING_ADDR_CITY' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxMAILING_ADDR_CITY' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'mailingAddressState',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxMAILING_ADDR_STATE' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxMAILING_ADDR_STATE' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'mailingAddressState_na',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbexMAILING_ADDR_STATE_NA' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbexMAILING_ADDR_STATE_NA' }
        ],
        fieldType: 'checkbox'
      },
      {
        dbPath: 'mailingAddressZipCode',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxMAILING_ADDR_POSTAL_CD' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxMAILING_ADDR_POSTAL_CD' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'mailingAddressZipCode_na',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbexMAILING_ADDR_POSTAL_CD_NA' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbexMAILING_ADDR_POSTAL_CD_NA' }
        ],
        fieldType: 'checkbox'
      },
      {
        dbPath: 'mailingAddressCountry',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlMAILING_ADDR_CNTRY' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlMAILING_ADDR_CNTRY' }
        ],
        fieldType: 'select'
      },
      
      // Phone Information
      {
        dbPath: 'primaryPhone',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_HOME_TEL' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxAPP_HOME_TEL' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'secondaryPhone',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_MOBILE_TEL' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxAPP_MOBILE_TEL' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'secondaryPhone_na',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbexAPP_MOBILE_TEL_NA' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbexAPP_MOBILE_TEL_NA' }
        ],
        fieldType: 'checkbox'
      },
      {
        dbPath: 'workPhone',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_BUS_TEL' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxAPP_BUS_TEL' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'workPhone_na',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbexAPP_BUS_TEL_NA' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbexAPP_BUS_TEL_NA' }
        ],
        fieldType: 'checkbox'
      },
      {
        dbPath: 'hasOtherPhones',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblAddPhone' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblAddPhone_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblAddPhone_1' }
        ],
        fieldType: 'radio',
        valueMap: {
          'Y': '0',
          'N': '1'
        }
      },
      
      // Email Address
      {
        dbPath: 'emailAddress',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_EMAIL_ADDR' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxAPP_EMAIL_ADDR' }
        ],
        fieldType: 'text'
      },
      {
        dbPath: 'hasOtherEmails',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblAddEmail' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblAddEmail_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblAddEmail_1' }
        ],
        fieldType: 'radio',
        valueMap: {
          'Y': '0',
          'N': '1'
        }
      },
      
      // Social Media Platform
      {
        dbPath: 'socialMediaPlatform',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_dtlSocial_ctl00_ddlSocialMedia' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$dtlSocial$ctl00$ddlSocialMedia' }
        ],
        fieldType: 'select',
        valueExtractor: (data) => {
          if (data.socialMediaPlatform && data.socialMediaPlatform.length > 0 && data.socialMediaPlatform[0].platform) {
            return data.socialMediaPlatform[0].platform;
          }
          return 'NONE'; // Default to "NONE" if no social media platform is specified
        }
      },
      {
        dbPath: 'socialMediaPlatform',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_dtlSocial_ctl00_tbxSocialMediaIdent' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$dtlSocial$ctl00$tbxSocialMediaIdent' }
        ],
        fieldType: 'text',
        valueExtractor: (data) => {
          if (data.socialMediaPlatform && data.socialMediaPlatform.length > 0 && data.socialMediaPlatform[0].identifier) {
            return data.socialMediaPlatform[0].identifier;
          }
          return '';
        }
      },
      {
        dbPath: 'hasOtherSocialMedia',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblAddSocial' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblAddSocial_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblAddSocial_1' }
        ],
        fieldType: 'radio',
        valueMap: {
          'Y': '0',
          'N': '1'
        }
      }
    ]
};
  
  return mappings[section] || [];
}