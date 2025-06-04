// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
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
      // // Fill the fields for the current section
      // setTimeout(() => {
      //   result = fillFormSection(currentSection, clientData);
      //   // Send response back to popup

      // }, 1000);
      // setTimeout(() => {
      //   result = fillFormSection(currentSection, clientData);
      //   // Send response back to popup

      // }, 2000);

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
  'Personal Information 2': 'personalInfo2',
  'Address and Phone Information': 'addressAndPhone',
  'Passport Information': 'passport',
  'Travel Information': 'travelInfo',
  'Travel Companions': 'travelCompanions',
  'Previous U.S. Travel Information': 'previousTravel',
  'U.S. Contact Information': 'usContact',
  'Family Information: Relatives': 'familyRelatives',
  'Family Information: Spouse': 'familySpouse',
  'Present Work/Education/Training Information': 'workEducation',
  'Previous Work/Education/Training Information': 'workEducationPrevious',
  'Additional Work/Education/Training Information': 'workEducationAdditional',
  'Security and Background: Part 1': 'securityBackground',
  'Security and Background: Part 2': 'securityBackground2',
  'Security and Background: Part 3': 'securityBackground3',
  'Security and Background: Part 4': 'securityBackground4',
  'Security and Background: Part 5': 'securityBackground5',
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
    if (pageTitle.toLowerCase() === ds160Title.toLowerCase()) {

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
  } else if (url.includes('complete_travel.aspx')) {
    console.log('Matched section by URL: travelInfo');
    return 'travelInfo';
  } else if (url.includes('complete_travelcompanions.aspx')) {
    console.log('Matched section by URL: travelCompanions');
    return 'travelCompanions';
  } else if (url.includes('complete_previousustravel.aspx')) {
    console.log('Matched section by URL: previousTravel');
    return 'previousTravel';
  } else if (url.includes('complete_contact.aspx?')) {
    console.log('Matched section by URL: addressAndPhone');
    return 'addressAndPhone';
  } else if (url.includes('passport_visa_info.aspx')) {
    console.log('Matched section by URL: passport');
    return 'passport';
  } else if (url.includes('complete_uscontact.aspx')) {
    console.log('Matched section by URL: usContact');
    return 'usContact';
  } else if (url.includes('complete_family1.aspx')) {
    console.log('Matched section by URL: familyRelatives');
    return 'familyRelatives';
  } else if (url.includes('complete_family2.aspx')) {
    console.log('Matched section by URL: familySpouse');
    return 'familySpouse';
  } else if (url.includes('complete_workeducation1.aspx')) {
    console.log('Matched section by URL: workEducation');
    return 'workEducation';
  } else if (url.includes('complete_workeducation2.aspx')) {
    console.log('Matched section by URL: workEducationPrevious');
    return 'workEducationPrevious';
  } else if (url.includes('complete_workeducation3.aspx')) {
    console.log('Matched section by URL: workEducationAdditional');
    return 'workEducationAdditional';
  } else if (url.includes('complete_securityandbackground1.aspx')) {
    console.log('Matched section by URL: securityBackground');
    return 'securityBackground';
  } else if (url.includes('complete_securityandbackground2.aspx')) {
    console.log('Matched section by URL: securityBackground');
    return 'securityBackground2';
  } else if (url.includes('complete_securityandbackground3.aspx')) {
    console.log('Matched section by URL: securityBackground');
    return 'securityBackground3';
  } else if (url.includes('complete_securityandbackground4.aspx')) {
    console.log('Matched section by URL: securityBackground');
    return 'securityBackground4';
  } else if (url.includes('complete_securityandbackground5.aspx')) {
    console.log('Matched section by URL: securityBackground');
    return 'securityBackground5';
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
  console.log("findField: ", mapping);
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
async function fillField(field, value, mapping) {
  if (mapping.action === 'addAnotherRow') {
    // add another ROW, input addone parentNode.

    console.log("add another row", field);
    await addAnotherField(field.parentNode.parentNode.parentNode, mapping.id, mapping);
    await delay(200);
  }
  if (field.value === value && mapping.fieldType != 'radio') {
    console.log("field.value === value", field.value, value);
    return true;
  }
  if (mapping.action === 'wait') {
    await delay(500);
    field = findField(mapping);
  }
  try {
    const fieldType = mapping.fieldType || detectFieldType(field);
    switch (fieldType) {
      case 'text':
        field.focus();
        field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        break;

      case 'select':
        if (mapping.action === 'preventRefresh' && field.value === value) {
          break;
        }
        else {
          fillSelectField(field, value);
          await delay(100);
        }
        break;

      case 'radio':
        fillRadioField(field, value, mapping);
        break;

      case 'checkbox':
        if (Boolean(value) == field.checked) {
          break;
        }
        console.log("filling checkbox: ", value);
        console.log("field.checked: ", field.checked);
        do {
          field.focus();
          field.click();
          await delay(1000); // Ensures onclick is fired
        } while (Boolean(value) != Boolean(field.checked));
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

      case 'array':
        console.log("filling array: ", value);
        // from input to its parent table that contains all small tables of each array object
        const tableField = field.parentNode.parentNode.parentNode.parentNode.parentNode;
        const tableRows = tableField.querySelectorAll('tr');
        for (let i = tableRows.length - 1; i < value.length - 1; i++) {
          //add another field, only when value.length > 1
          await addAnotherField(field.parentNode.parentNode.parentNode.parentNode.parentNode, i, mapping);
          // wait for the new field to be added

        }

        await fillArrayField(field, value, mapping);

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

async function fillArrayField(field, value, mapping) {
  await delay(500);
  field = findField(mapping);
  let tableField = field.parentNode.parentNode.parentNode.parentNode.parentNode;
  console.log("tableField: ", tableField);
  let tableRows = tableField.querySelectorAll('tr');
  console.log("tableRows: ", tableRows);
  console.log("value: ", value);
  for (let i = 0; i < tableRows.length; i++) {
    // the number of objects, e.g. how many other names
    const tableRow = tableRows[i];
    let inputFields = tableRow.querySelectorAll('input');
    for (let j = 0; j < inputFields.length; j++) {
      // the number of attributes in a object, e.g. surname & given name
      const inputField = inputFields[j];
      inputField.value = value[i][j];
      inputField.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }


}

// assistant function of add another field
// Manually run the same logic as the <a> tag
function fireAliasInsertButton(element) {
  try {
    if (typeof ValidNavigation === 'function') {
      ValidNavigation();  // Safe to call even if it's a no-op
    }
    if (typeof setDirty === 'function') {
      setDirty();
      setDirty();
      setDirty();
      setDirty();
    }

    __doPostBack(element.id.replace(/_/g, '$'), '');
  } catch (e) {
    console.error("Failed to trigger Add Another logic", e);
  }
}
function manualPostBack(eventTarget, eventArgument) {
  const form = document.forms[0];
  if (!form) {
    console.error("No form found");
    return;
  }

  const createOrUpdateHidden = (name, value) => {
    let input = form.querySelector(`[name="${name}"]`);
    if (!input) {
      input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      form.appendChild(input);
    }
    input.value = value;
  };

  createOrUpdateHidden("__EVENTTARGET", eventTarget);
  createOrUpdateHidden("__EVENTARGUMENT", eventArgument);

  // Also include __VIEWSTATE and __EVENTVALIDATION if present
  const viewState = form.querySelector('[name="__VIEWSTATE"]');
  const eventValidation = form.querySelector('[name="__EVENTVALIDATION"]');
  if (!viewState || !eventValidation) {
    console.warn("Missing __VIEWSTATE or __EVENTVALIDATION. Postback might fail.");
  }

  form.submit();  // Native form submission
}
// click add one button
/**
 * 
 * @param {*} field: whole table <tbody>
 * @param {*} idx : index of add one button, start with 0
 * @param {*} mapping : mapping of the first input field of first tr row
 */
async function addAnotherField(field, idx, mapping) {

  let addone_button = field.querySelectorAll(".addone")[idx];
  let addone_link = addone_button.querySelector("a")
  const currentRows = field.querySelectorAll(".addone").length;

  await delay(600);
  // Inject __doPostBack only if missing (safe for CSP)
  if (typeof __doPostBack === 'undefined') {
    console.log("injecting __doPostBack", typeof __doPostBack);
    window.__doPostBack = function (eventTarget, eventArgument) {
      const form = document.forms[0];
      if (!form) return;

      const eventTargetInput = form.querySelector('[name="__EVENTTARGET"]');
      const eventArgumentInput = form.querySelector('[name="__EVENTARGUMENT"]');

      if (eventTargetInput && eventArgumentInput) {
        eventTargetInput.value = eventTarget;
        eventArgumentInput.value = eventArgument;

        // Try firing the submit event, some pages override it for async/AJAX postback
        const evt = new Event("submit", { bubbles: true, cancelable: true });
        form.dispatchEvent(evt);
      }
    };
  }
  fireAliasInsertButton(addone_link);
  await delay(800);

  field = findField(mapping).parentNode.parentNode.parentNode;
  whole_table = field.parentNode.parentNode;
  await delay(300);

  console.log("whole_table: ", whole_table);
  console.log("currentRows before check: ", currentRows);

  if (whole_table.querySelectorAll(".addone").length <= currentRows) {
    console.log("add another field. second attempt ...", whole_table.querySelectorAll(".addone"), currentRows);

    addone_button = whole_table.querySelectorAll(".addone")[idx];

    addone_link = addone_button.querySelector("a")
    const href = addone_link.getAttribute("href");
    const match = href.match(/__doPostBack\(['"]([^'"]+)['"],\s*['"]([^'"]*)['"]\)/);
    if (!match) {
      console.error("Could not parse __doPostBack href:", href);
      return;
    }

    const eventTarget = match[1];
    const eventArgument = match[2];
    console.log("Triggering __doPostBack with:", eventTarget, eventArgument);

    manualPostBack(eventTarget, eventArgument);

    // Wait for the new row to appear
    await delay(1200);
  } else {
    console.log("add another field success");
    return;
  }

  if (field.querySelectorAll(".addone").length <= currentRows) {
    console.log("add another field failed");
    return;
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
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Fills a radio button field
 */
async function fillRadioField(field, value, mapping) {
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
          radio.click();

          // radio.checked = true;
          // radio.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('Radio button:', radio);
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
          } catch (e) { }
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
        } catch (e) { }
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
          } catch (e) { }
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
  const mappings = getFieldMappings(section, clientData);
  if (!mappings) {
    console.warn(`No mappings found for section: ${section}`);
    return { filledCount: 0 };
  }

  // Process each field mapping
  for (const mapping of mappings) {
    try {

      console.log("filling field: ", mapping.action);
      let value = getValueFromClientData(clientData, mapping.dbPath);
      if (mapping.valueExtractor) {
        value = mapping.valueExtractor(value);
        console.log("value extractor: ", value);
      }
      if (value === null || value === undefined) {
        console.log("value is null or undefined, skipping...")
        continue;
      }

      let field = findField(mapping);

      if (!field) {
        await delay(400);
        console.log("field not found, retrying...")
        field = findField(mapping);
      }

      if (!field) {
        console.log("field not found, skipping...")
        continue;
      }

      // DO NOT CHANGE; MAKE FORM FILLED FIELD BY FIELD.
      await delay(200);
      await fillField(field, value, mapping);
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
function getFieldMappings(section, clientData) {
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
        fieldType: 'checkbox',
        valueExtractor: value => value === undefined ? false : value
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
        fieldType: 'array',
        valueExtractor: (data) => {
          if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
            return data.map(entry => [entry.givenName, entry.surname]);
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
        fieldType: 'checkbox',
        valueExtractor: value => value === undefined ? false : value
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
    personalInfo2: (() => {
      if (!clientData['personalInfo2'] || clientData['personalInfo2'].length === 0) {
        return [];
      }
      const arr = clientData['personalInfo2']['otherNationalities'] || [];
      const perm_arr = clientData['personalInfo2']['permanentResidences'] || [];
      let dynamic = [];
      dynamic.push({
        dbPath: 'nationality',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlAPP_NATL' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlAPP_NATL' }
        ],
        fieldType: 'select'
      });
      dynamic.push({
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
      });
      dynamic.push({
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
      });
      dynamic.push({
        dbPath: 'nationalIdNumber',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_NATIONAL_ID' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxAPP_NATIONAL_ID' }
        ],
        fieldType: 'text'
      });
      dynamic.push({
        dbPath: 'nationalIdNumber_na',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbexAPP_NATIONAL_ID_NA' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbexAPP_NATIONAL_ID_NA' }
        ],
        fieldType: 'checkbox',
        valueExtractor: value => value === undefined ? false : value
      });
      dynamic.push({
        dbPath: 'usSSN.part1',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_SSN1' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxAPP_SSN1' }
        ],
        fieldType: 'text',
        maxLength: 3
      });
      dynamic.push({
        dbPath: 'usSSN.part2',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_SSN2' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxAPP_SSN2' }
        ],
        fieldType: 'text',
        maxLength: 2
      });
      dynamic.push({
        dbPath: 'usSSN.part3',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_SSN3' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxAPP_SSN3' }
        ],
        fieldType: 'text',
        maxLength: 4
      });
      dynamic.push({
        dbPath: 'usSSN_na',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbexAPP_SSN_NA' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbexAPP_SSN_NA' }
        ],
        fieldType: 'checkbox',
        valueExtractor: value => value === undefined ? false : value
      });
      dynamic.push({
        dbPath: 'usTaxId',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_TAX_ID' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxAPP_TAX_ID' }
        ],
        fieldType: 'text'
      });
      dynamic.push({
        dbPath: 'usTaxId_na',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbexAPP_TAX_ID_NA' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbexAPP_TAX_ID_NA' }
        ],
        fieldType: 'checkbox',
        valueExtractor: value => value === undefined ? false : value
      });
      dynamic.push(...arr.flatMap((entry, idx) => {
        let baseName = `ctl00$SiteContentPlaceHolder$FormView1$dtlOTHER_NATL$ctl0${idx}$`;
        let baseId = baseName.replace(/\$/g, '_');
        const block = [];
        if (idx > 0) {
          let baseName = `ctl00$SiteContentPlaceHolder$FormView1$dtlOTHER_NATL$ctl0${idx - 1}$`;
          let baseId = baseName.replace(/\$/g, '_');
          block.push({
            dbPath: `otherNationalities.${idx - 1}.country`,
            selector: { type: 'name', value: `${baseName}ddlOTHER_NATL` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}ddlOTHER_NATL` }],
            fieldType: 'select',
            action: 'addAnotherRow',
            id: idx - 1,
          });
        }
        block.push({
          dbPath: `otherNationalities.${idx}.country`,
          selector: { type: 'name', value: `${baseName}ddlOTHER_NATL` },
          fallbackSelectors: [{ type: 'id', value: `${baseId}ddlOTHER_NATL` }],
          fieldType: 'select',
        });

        block.push({
          dbPath: `otherNationalities.${idx}.hasPassport`,
          selector: { type: 'name', value: `${baseName}rblOTHER_PPT_IND` },
          fallbackSelectors: [{ type: 'id', value: `${baseId}rblOTHER_PPT_IND_0` }, { type: 'id', value: `${baseId}rblOTHER_PPT_IND_1` }],
          fieldType: 'radio',
          valueMap: {
            'Y': '0',
            'N': '1'
          }
        });
        block.push({
          dbPath: `otherNationalities.${idx}.passportNumber`,
          selector: { type: 'name', value: `${baseName}tbxOTHER_PPT_NUM` },
          fallbackSelectors: [{ type: 'id', value: `${baseId}tbxOTHER_PPT_NUM` }],
          fieldType: 'text',

        });
        return block;
      }));

      dynamic.push(...perm_arr.flatMap((entry, idx) => {
        let baseName = `ctl00$SiteContentPlaceHolder$FormView1$dtlOthPermResCntry$ctl0${idx}$`;
        let baseId = baseName.replace(/\$/g, '_');
        const block = [];
        if (idx > 0) {
          let baseName = `ctl00$SiteContentPlaceHolder$FormView1$dtlOthPermResCntry$ctl0${idx - 1}$`;
          let baseId = baseName.replace(/\$/g, '_');
          block.push({
            dbPath: `permanentResidences.${idx - 1}.country`,
            selector: { type: 'name', value: `${baseName}ddlOthPermResCntry` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}ddlOthPermResCntry` }],
            fieldType: 'select',
            action: 'addAnotherRow',
            id: idx - 1,
          });
        }
        block.push({
          dbPath: `permanentResidences.${idx}.country`,
          selector: { type: 'name', value: `${baseName}ddlOthPermResCntry` },
          fallbackSelectors: [{ type: 'id', value: `${baseId}ddlOthPermResCntry` }],
          fieldType: 'select',
        });
        return block;
      }));


      return dynamic;
    })(),
    travelInfo: (() => {
      if (!clientData['travelInfo'] || clientData['travelInfo'].length === 0) {
        return [];
      }
      const arr = clientData['travelInfo']['travelPurposes'] || [];
      let dynamic = arr.flatMap((entry, idx) => {
        const baseName = `ctl00$SiteContentPlaceHolder$FormView1$dlPrincipalAppTravel$ctl0${idx}$`;
        const baseId = baseName.replace(/\$/g, '_');
        const block = [];
        if (idx > 0) block.push({ action: 'addAnotherRow' });
        block.push({
          dbPath: `travelPurposes.${idx}.visaClass`,
          selector: { type: 'name', value: `${baseName}ddlPurposeOfTrip` },
          fallbackSelectors: [{ type: 'id', value: `${baseId}ddlPurposeOfTrip` }],
          fieldType: 'select',

        });
        block.push({
          dbPath: `travelPurposes.${idx}.specificPurpose`,
          selector: { type: 'name', value: `${baseName}ddlOtherPurpose` },
          fallbackSelectors: [{ type: 'id', value: `${baseId}ddlOtherPurpose` }],
          fieldType: 'select',

        });
        block.push({
          dbPath: `travelPurposes.${idx}.principalApplicantSurname`,
          selector: { type: 'name', value: `${baseName}tbxPrincipleAppSurname` },
          fallbackSelectors: [{ type: 'id', value: `${baseId}tbxPrincipleAppSurname` }],
          fieldType: 'text',

        });
        block.push({
          dbPath: `travelPurposes.${idx}.principalApplicantGivenName`,
          selector: { type: 'name', value: `${baseName}tbxPrincipleAppGivenName` },
          fallbackSelectors: [{ type: 'id', value: `${baseId}tbxPrincipleAppGivenName` }],
          fieldType: 'text',

        });
        return block;
      });
      dynamic.push({
        dbPath: `hasSpecificPlans`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$rblSpecificTravel` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_rblSpecificTravel_0` }],
        fieldType: 'radio',
        valueMap: {
          'Y': '0',
          'N': '1'
        },
        action: 'wait'
      });
      if (clientData['travelInfo']['hasSpecificPlans'] == 'N') {
        dynamic.push({
          dbPath: `intendedDateOfArrival.day`,
          selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$ddlTRAVEL_DTEDay` },
          fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_ddlTRAVEL_DTEDay` }],
          fieldType: 'select',

        });
        dynamic.push({
          dbPath: `intendedDateOfArrival.month`,
          selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$ddlTRAVEL_DTEMonth` },
          fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_ddlTRAVEL_DTEMonth` }],
          fieldType: 'select',

        });
        dynamic.push({
          dbPath: `intendedDateOfArrival.year`,
          selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbxTRAVEL_DTEYear` },
          fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbxTRAVEL_DTEYear` }],
          fieldType: 'text',

        });
        dynamic.push({
          dbPath: `stayDuration`,
          selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbxTRAVEL_LOS` },
          fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbxTRAVEL_LOS` }],
          fieldType: 'text',

        });
        dynamic.push({
          dbPath: `stayDurationType`,
          selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$ddlTRAVEL_LOS_CD` },
          fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_ddlTRAVEL_LOS_CD` }],
          fieldType: 'select',

        });
        
      } else {
        dynamic.push({
          dbPath: `arrivalUSDate.day`,
          selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$ddlARRIVAL_US_DTEDay` },
          fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_ddlARRIVAL_US_DTEDay` }],
          fieldType: 'select',

        });
        dynamic.push({
          dbPath: `arrivalUSDate.month`,
          selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$ddlARRIVAL_US_DTEMonth` },
          fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_ddlARRIVAL_US_DTEMonth` }],
          fieldType: 'select',

        });
        dynamic.push({
          dbPath: `arrivalUSDate.year`,
          selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbxARRIVAL_US_DTEYear` },
          fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbxARRIVAL_US_DTEYear` }],
          fieldType: 'text',

        });
        dynamic.push({
          dbPath: `arrivalCity`,
          selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbxArriveCity` },
          fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbxArriveCity` }],
          fieldType: 'text',

        });
        dynamic.push({
          dbPath: `departureUSDate.day`,
          selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$ddlDEPARTURE_US_DTEDay` },
          fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_ddlDEPARTURE_US_DTEDay` }],
          fieldType: 'select',

        });
        dynamic.push({
          dbPath: `departureUSDate.month`,
          selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$ddlDEPARTURE_US_DTEMonth` },
          fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_ddlDEPARTURE_US_DTEMonth` }],
          fieldType: 'select',

        });
        dynamic.push({
          dbPath: `departureUSDate.year`,
          selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbxDEPARTURE_US_DTEYear` },
          fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbxDepartURE_US_DTEYear` }],
          fieldType: 'text',

        });
        dynamic.push({
          dbPath: `departureCity`,
          selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbxDepartCity` },
          fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbxDepartCity` }],
          fieldType: 'text',

        });
        dynamic.push(...arr.flatMap((entry, idx) => {
          const baseName = `ctl00$SiteContentPlaceHolder$FormView1$dtlTravelLoc$ctl0${idx}$`;
          const baseId = baseName.replace(/\$/g, '_');
          const block = [];
          if (idx > 0) block.push({ action: 'addAnotherRow' });
          block.push({
            dbPath: `visitLocations.${idx}.location`,
            selector: { type: 'name', value: `${baseName}tbxSPECTRAVEL_LOCATION` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbxSPECTRAVEL_LOCATION` }],
            fieldType: 'text',
  
          });
          block.push({
            dbPath: `visitLocations.${idx}.location`,
            selector: { type: 'name', value: `${baseName}tbxSPECTRAVEL_LOCATION` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbxSPECTRAVEL_LOCATION` }],
            fieldType: 'text',
  
          });
          return block;
        }));

      }
      dynamic.push({
        dbPath: `whoIsPaying`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$ddlWhoIsPaying` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_ddlWhoIsPaying` }],
        fieldType: 'select',

      });
      dynamic.push({
        dbPath: `payerSurname`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbxPayerSurname` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbxPayerSurname` }],
        fieldType: 'text',
        action: 'wait'

      });
      dynamic.push({
        dbPath: `payerGivenName`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbxPayerGivenName` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbxPayerGivenName` }],
        fieldType: 'text',
        action: 'wait'

      });
      dynamic.push({
        dbPath: `payerPhone`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbxPayerPhone` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbxPayerPhone` }],
        fieldType: 'text',
      });
      dynamic.push({
        dbPath: `payerEmail`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbxPAYER_EMAIL_ADDR` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbxPAYER_EMAIL_ADDR` }],
        fieldType: 'text',
      });
      dynamic.push({
        dbPath: `payerEmail_na`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$cbxDNAPAYER_EMAIL_ADDR_NA` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_cbxDNAPAYER_EMAIL_ADDR_NA` }],
        fieldType: 'checkbox',
        valueExtractor: value => value === undefined ? false : value
      });
      dynamic.push({
        dbPath: `payerRelationship`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$ddlPayerRelationship` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_ddlPayerRelationship` }],
        fieldType: 'select',
      });
      dynamic.push({
        dbPath: `streetAddress1`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbxStreetAddress1` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbxStreetAddress1` }],
        fieldType: 'text',
      });
      dynamic.push({
        dbPath: `isSameAddress`,
        selector: [{ type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$rblPayerAddrSameAsInd_1` },
          { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$rblPayerAddrSameAsInd_0` },
        ],
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_rblPayerAddrSameAsInd_1` },
          { type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_rblPayerAddrSameAsInd_0` },
        ],
        fieldType: 'radio',
        valueMap: {
          'Y': '0',
          'N': '1'
        },
        action: 'wait'
      });
      dynamic.push({
        dbPath: `streetAddress2`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbxStreetAddress2` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbxStreetAddress2` }],
        fieldType: 'text',

      });
      dynamic.push({
        dbPath: `city`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbxCity` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbxCity` }],
        fieldType: 'text',

      });
      dynamic.push({
        dbPath: `state`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$ddlTravelState` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_ddlTravelState` }],
        fieldType: 'select',

      });
      dynamic.push({
        dbPath: `zipCode`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbZIPCode` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbZIPCode` }],
        fieldType: 'text',

      });

      //company
      dynamic.push({
        dbPath: `companyName`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbxPayingCompany` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbxPayingCompany` }],
        fieldType: 'text',

      });
      dynamic.push({
        dbPath: `companyPhone`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbxPayerPhone` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbxPayerPhone` }],
        fieldType: 'text',

      });
      dynamic.push({
        dbPath: `companyRelation`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbxCompanyRelation` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbxCompanyRelation` }],
        fieldType: 'text',

      });
      dynamic.push({
        dbPath: `companyStreetAddress1`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbxPayerStreetAddress1` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbxPayerStreetAddress1` }],
        fieldType: 'text',

      });
      dynamic.push({
        dbPath: `companyStreetAddress2`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbxPayerStreetAddress2` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbxPayerStreetAddress2` }],
        fieldType: 'text',

      });
      dynamic.push({
        dbPath: `companyCity`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbxPayerCity` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbxPayerCity` }],
        fieldType: 'text',

      });
      dynamic.push({
        dbPath: `companyCountry`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$ddlPayerCountry` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_ddlPayerCountry` }],
        fieldType: 'select',

      });
      // dynamic.push({
      //   dbPath: `companyAddress`,
      //   selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbZIPCode` },
      //   fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbZIPCode` }],
      //   fieldType: 'text',

      // });
      dynamic.push({
        dbPath: `sponsoringMission`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbxMissionOrg` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbxMissionOrg` }],
        fieldType: 'text',

      });
      dynamic.push({
        dbPath: `contactSurname`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbxMissionOrgContactSurname` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbxMissionOrgContactSurname` }],
        fieldType: 'text',

      });
      dynamic.push({
        dbPath: `contactGivenName`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbxMissionOrgContactGivenName` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbxMissionOrgContactGivenName` }],
        fieldType: 'text',

      });
      dynamic.push({
        dbPath: `missionAddressLine1`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbxMissionOrgAddress1` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbxMissionOrgAddress1` }],
        fieldType: 'text',

      });
      dynamic.push({
        dbPath: `missionAddressLine2`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbxMissionOrgAddress2` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbxMissionOrgAddress2` }],
        fieldType: 'text',

      });
      dynamic.push({
        dbPath: `missionCity`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbxMissionOrgCity` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbxMissionOrgCity` }],
        fieldType: 'text',

      });
      dynamic.push({
        dbPath: `missionState`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$ddlMissionOrgState` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_ddlMissionOrgState` }],
        fieldType: 'select',

      });
      dynamic.push({
        dbPath: `missionZipCode`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbxMissionOrgZipCode` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbxMissionOrgZipCode` }],
        fieldType: 'text',

      });
      dynamic.push({
        dbPath: `missionPhoneNumber`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbxMissionOrgTel` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbxMissionOrgTel` }],
        fieldType: 'text',

      });
      dynamic.push({
        dbPath: `companyStateProvince`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbxPayerStateProvince` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbxPayerStateProvince` }],
        fieldType: 'text',

      });
      dynamic.push({
        dbPath: `companyPostalZIPCode`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbxPayerPostalZIPCode` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbxPayerPostalZIPCode` }],
        fieldType: 'text',

      });
      dynamic.push({
        dbPath: `companyStateProvince_na`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$cbxDNAPayerStateProvince` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_cbxDNAPayerStateProvince` }],
        fieldType: 'checkbox',

      });
      dynamic.push({
        dbPath: `companyPostalZIPCode_na`,
        selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$cbxDNAPayerPostalZIPCode` },
        fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_cbxDNAPayerPostalZIPCode` }],
        fieldType: 'checkbox',

      });

      return dynamic;
    })(),
    // Additional mappings for other sections
    travelCompanions: (() => {
      if (!clientData['travelCompanions'] || clientData['travelCompanions'].length === 0) {
        return [];
      }
      const arr = clientData['travelCompanions']['companions'] || [];
      const dynamic = [];

      dynamic.push({
        dbPath: 'hasCompanions',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblOtherPersonsTravelingWithYou' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblOtherPersonsTravelingWithYou_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblOtherPersonsTravelingWithYou_1' }
        ],
        fieldType: 'radio',
        valueMap: {
          'Y': '0',
          'N': '1'
        }
      },
        {
          dbPath: 'groupTravel',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblGroupTravel' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblGroupTravel_0' },
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblGroupTravel_1' }
          ],
          fieldType: 'radio',
          valueMap: {
            'Y': '0',
            'N': '1'
          }
        },
        {
          dbPath: 'groupName',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxGroupName' },
          fallbackSelectors: [
            { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxGroupName' }
          ],
          fieldType: 'text'
        });

      dynamic.push(...arr.flatMap((item, index) => {
        let baseName = `ctl00$SiteContentPlaceHolder$FormView1$dlTravelCompanions$ctl0${index}$`
        let baseId = baseName.replace(/\$/g, '_');
        let block = [];
        if (index > 0) {
          let baseName = `ctl00$SiteContentPlaceHolder$FormView1$dlTravelCompanions$ctl0${index - 1}$`;
          let baseId = baseName.replace(/\$/g, '_');
          block.push({
            dbPath: `companions.${index - 1}.surname`,
            selector: { type: 'name', value: `${baseName}tbxSurname` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbxSurname` }],
            fieldType: 'text',
            action: 'addAnotherRow',
            id: index - 1,
          });
        }
        block.push({
          dbPath: `companions.${index}.surname`,
          selector: { type: 'name', value: `${baseName}tbxSurname` },
          fallbackSelectors: [{ type: 'id', value: `${baseId}tbxSurname` }],
          fieldType: 'text',
        });
        block.push({
          dbPath: `companions.${index}.givenName`,
          selector: { type: 'name', value: `${baseName}tbxGivenName` },
          fallbackSelectors: [{ type: 'id', value: `${baseId}tbxGivenName` }],
          fieldType: 'text',
        });
        block.push({
          dbPath: `companions.${index}.relationship`,
          selector: { type: 'name', value: `${baseName}ddlTCRelationship` },
          fallbackSelectors: [{ type: 'id', value: `${baseId}ddlTCRelationship` }],
          fieldType: 'select',
        });
        return block;
      }))
      return dynamic;
    })(),
    previousTravel: (() => {


      if (!clientData['previousTravel'] || clientData['previousTravel'].length === 0) {
        return [];
      }
      const dynamic = [];
      dynamic.push({
        dbPath: 'hasBeenToUS',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblPREV_US_TRAVEL_IND' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblPREV_US_TRAVEL_IND_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblPREV_US_TRAVEL_IND_1' }
        ],
        fieldType: 'radio',
        valueMap: {
          'Y': '0',
          'N': '1'
        }
      });
      if (clientData['previousTravel']['hasBeenToUS'] === 'Y') {
        const arr = clientData['previousTravel']['previousTrips'] || [];
        dynamic.push(...arr.flatMap((item, index) => {
          let baseName = `ctl00$SiteContentPlaceHolder$FormView1$dtlPREV_US_VISIT$ctl0${index}$`
          let baseId = baseName.replace(/\$/g, '_');
          let block = [];
          if (index > 0) {
            let baseName = `ctl00$SiteContentPlaceHolder$FormView1$dtlPREV_US_VISIT$ctl0${index - 1}$`;
            let baseId = baseName.replace(/\$/g, '_');
            block.push({
              dbPath: `previousTrips.${index - 1}.arrivalDate.day`,
              selector: { type: 'name', value: `${baseName}ddlPREV_US_VISIT_DTEDay` },
              fallbackSelectors: [{ type: 'id', value: `${baseId}ddlPREV_US_VISIT_DTEDay` }],
              fieldType: 'select',
              action: 'addAnotherRow',
              id: index - 1,
            });
          }
          block.push({
            dbPath: `previousTrips.${index}.arrivalDate.day`,
            selector: { type: 'name', value: `${baseName}ddlPREV_US_VISIT_DTEDay` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}ddlPREV_US_VISIT_DTEDay` }],
            fieldType: 'select',
            action: 'wait'
          });
          block.push({
            dbPath: `previousTrips.${index}.arrivalDate.month`,
            selector: { type: 'name', value: `${baseName}ddlPREV_US_VISIT_DTEMonth` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}ddlPREV_US_VISIT_DTEMonth` }],
            fieldType: 'select',
          });
          block.push({
            dbPath: `previousTrips.${index}.arrivalDate.year`,
            selector: { type: 'name', value: `${baseName}tbxPREV_US_VISIT_DTEYear` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbxPREV_US_VISIT_DTEYear` }],
            fieldType: 'text',
          });
          block.push({
            dbPath: `previousTrips.${index}.stayDuration`,
            selector: { type: 'name', value: `${baseName}tbxPREV_US_VISIT_LOS` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbxPREV_US_VISIT_LOS` }],
            fieldType: 'text',
          });
          block.push({
            dbPath: `previousTrips.${index}.stayUnit`,
            selector: { type: 'name', value: `${baseName}ddlPREV_US_VISIT_LOS_CD` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}ddlPREV_US_VISIT_LOS_CD` }],
            fieldType: 'select',
          });

          return block;
        }))
        dynamic.push({
          dbPath: 'hasUSDriverLicense',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblPREV_US_DRIVER_LIC_IND' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblPREV_US_DRIVER_LIC_IND_0' },
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblPREV_US_DRIVER_LIC_IND_1' }
          ],
          fieldType: 'radio',
          valueMap: {
            'Y': '0',
            'N': '1'
          }
        });
        if (clientData['previousTravel']['hasUSDriverLicense'] === 'Y') {
          const driver_arr = clientData['previousTravel']['driverLicenses'];
          dynamic.push(...driver_arr.flatMap((item, index) => {
            let baseName = `ctl00$SiteContentPlaceHolder$FormView1$dtlUS_DRIVER_LICENSE$ctl0${index}$`
            let baseId = baseName.replace(/\$/g, '_');
            let block = [];
            if (index > 0) {
              let baseName = `ctl00$SiteContentPlaceHolder$FormView1$dtlUS_DRIVER_LICENSE$ctl0${index - 1}$`;
              let baseId = baseName.replace(/\$/g, '_');
              block.push({
                dbPath: `driverLicenses.${index - 1}.driver_license_issue_state`,
                selector: { type: 'name', value: `${baseName}ddlUS_DRIVER_LICENSE_STATE` },
                fallbackSelectors: [{ type: 'id', value: `${baseId}ddlUS_DRIVER_LICENSE_STATE` }],
                fieldType: 'select',
                action: 'addAnotherRow',
                id: index - 1,
              });

            }
            block.push({
              dbPath: `driverLicenses.${index}.licenseNumber`,
              selector: { type: 'name', value: `${baseName}tbxUS_DRIVER_LICENSE` },
              fallbackSelectors: [{ type: 'id', value: `${baseId}tbxUS_DRIVER_LICENSE` }],
              fieldType: 'text',
            });
            block.push({
              dbPath: `driverLicenses.${index}.licenseNumber_na`,
              selector: { type: 'name', value: `${baseName}cbxUS_DRIVER_LICENSE_NA` },
              fallbackSelectors: [{ type: 'id', value: `${baseId}cbxUS_DRIVER_LICENSE_NA` }],
              fieldType: 'checkbox',
            });
            block.push({
              dbPath: `driverLicenses.${index}.driver_license_issue_state`,
              selector: { type: 'name', value: `${baseName}ddlUS_DRIVER_LICENSE_STATE` },
              fallbackSelectors: [{ type: 'id', value: `${baseId}ddlUS_DRIVER_LICENSE_STATE` }],
              fieldType: 'select',
            });
            return block;
          }))
        }
      }
      dynamic.push({
        dbPath: 'previousUsVisa',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblPREV_VISA_IND' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblPREV_VISA_IND_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblPREV_VISA_IND_1' }
        ],
        fieldType: 'radio',
        valueMap: {
          'Y': '0',
          'N': '1'
        }
      });
      if (clientData['previousTravel']['previousUsVisa'] === 'Y') {
        dynamic.push({
          dbPath: 'lastVisaIssueDate.day',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlPREV_VISA_ISSUED_DTEDay' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlPREV_VISA_ISSUED_DTEDay' }
          ],
          fieldType: 'select',

        });
        dynamic.push({
          dbPath: 'lastVisaIssueDate.month',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlPREV_VISA_ISSUED_DTEMonth' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlPREV_VISA_ISSUED_DTEMonth' }
          ],
          fieldType: 'select',

        });
        dynamic.push({
          dbPath: 'lastVisaIssueDate.year',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxPREV_VISA_ISSUED_DTEYear' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxPREV_VISA_ISSUED_DTEYear' }
          ],
          fieldType: 'text',

        });
        dynamic.push({
          dbPath: 'lastVisaNumber_na',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbxPREV_VISA_FOIL_NUMBER_NA' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbxPREV_VISA_FOIL_NUMBER_NA' }
          ],
          fieldType: 'checkbox',
        });
        dynamic.push({
          dbPath: 'lastVisaNumber',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxPREV_VISA_FOIL_NUMBER' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxPREV_VISA_FOIL_NUMBER' }
          ],
          fieldType: 'text',
        });

        dynamic.push({
          dbPath: 'sameTypeVisa',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblPREV_VISA_SAME_TYPE_IND' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblPREV_VISA_SAME_TYPE_IND_0' },
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblPREV_VISA_SAME_TYPE_IND_1' }
          ],
          fieldType: 'radio',
          valueMap: {
            'Y': '0',
            'N': '1'
          }
        });
        dynamic.push({
          dbPath: 'sameCountry',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblPREV_VISA_SAME_CNTRY_IND' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblPREV_VISA_SAME_CNTRY_IND_0' },
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblPREV_VISA_SAME_CNTRY_IND_1' }
          ],
          fieldType: 'radio',
          valueMap: {
            'Y': '0',
            'N': '1'
          }
        });
        dynamic.push({
          dbPath: 'tenPrinted',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblPREV_VISA_TEN_PRINT_IND' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblPREV_VISA_TEN_PRINT_IND_0' },
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblPREV_VISA_TEN_PRINT_IND_1' }
          ],
          fieldType: 'radio',
          valueMap: {
            'Y': '0',
            'N': '1'
          }
        });
        dynamic.push({
          dbPath: 'visaLostStolen',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblPREV_VISA_LOST_IND' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblPREV_VISA_LOST_IND_0' },
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblPREV_VISA_LOST_IND_1' }
          ],
          fieldType: 'radio',
          valueMap: {
            'Y': '0',
            'N': '1'
          }
        });
        if (clientData['previousTravel']['visaLostStolen'] === 'Y') {
          dynamic.push({
            dbPath: 'visaLostYear',
            selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxPREV_VISA_LOST_YEAR' },
            fallbackSelectors: [
              { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxPREV_VISA_LOST_YEAR' }
            ],
            fieldType: 'text',
          });
          dynamic.push({
            dbPath: 'visaLostExplanation',
            selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxPREV_VISA_LOST_EXPL' },
            fallbackSelectors: [
              { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxPREV_VISA_LOST_EXPL' }
            ],
            fieldType: 'text',
          });
        }
        dynamic.push({
          dbPath: 'visaCancelled',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblPREV_VISA_CANCELLED_IND' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblPREV_VISA_CANCELLED_IND_0' },
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblPREV_VISA_CANCELLED_IND_1' }
          ],
          fieldType: 'radio',
          valueMap: {
            'Y': '0',
            'N': '1'
          }
        });
        if (clientData['previousTravel']['visaCancelled'] === 'Y') {
          dynamic.push({
            dbPath: 'visaCancelledExplanation',
            selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxPREV_VISA_CANCELLED_EXPL' },
            fallbackSelectors: [
              { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxPREV_VISA_CANCELLED_EXPL' }
            ],
            fieldType: 'text',
          })
        }
      }

      dynamic.push({
        dbPath: 'visaRefused',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblPREV_VISA_REFUSED_IND' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblPREV_VISA_REFUSED_IND_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblPREV_VISA_REFUSED_IND_1' }
        ],
        fieldType: 'radio',
        valueMap: {
          'Y': '0',
          'N': '1'
        }
      });
      if (clientData['previousTravel']['visaRefused'] === 'Y') {
        dynamic.push({
          dbPath: 'refusalDetails',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxPREV_VISA_REFUSED_EXPL' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxPREV_VISA_REFUSED_EXPL' }
          ],
          fieldType: 'text',
          action: 'wait'
        })
      }
      dynamic.push({
        dbPath: 'immigrantPetition',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblIV_PETITION_IND' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblIV_PETITION_IND_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblIV_PETITION_IND_1' }
        ],
        fieldType: 'radio',
        valueMap: {
          'Y': '0',
          'N': '1'
        }
      });
      if (clientData['previousTravel']['immigrantPetition'] === 'Y') {
        dynamic.push({
          dbPath: 'petitionerInfo',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxIV_PETITION_EXPL' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxIV_PETITION_EXPL' }
          ],
          fieldType: 'text',
          action: 'wait'
        })
      }
      return dynamic;
    })(),
    addressAndPhone: (() => {
      //AA00EOJQ5Z
      // Home Address fields
      let dynamic = [];
      dynamic.push({
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
          fieldType: 'checkbox',
          valueExtractor: value => value === undefined ? false : value
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
          fieldType: 'checkbox',
          valueExtractor: value => value === undefined ? false : value
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
          fieldType: 'checkbox',
          valueExtractor: value => value === undefined ? false : value
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
          fieldType: 'checkbox',
          valueExtractor: value => value === undefined ? false : value
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
          fieldType: 'checkbox',
          valueExtractor: value => value === undefined ? false : value
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
          fieldType: 'checkbox',
          valueExtractor: value => value === undefined ? false : value
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
        });
      if (clientData['addressAndPhone']['hasOtherPhones'] == 'Y') {
        const arr = clientData['addressAndPhone']['otherPhones'] || [];
        dynamic.push(...arr.flatMap((item, index) => {
          let baseName = `ctl00$SiteContentPlaceHolder$FormView1$dtlAddPhone$ctl0${index}$`
          let baseId = baseName.replace(/\$/g, '_');
          let block = [];
          if (index > 0) {
            let baseName = `ctl00$SiteContentPlaceHolder$FormView1$dtlAddPhone$ctl0${index - 1}$`;
            let baseId = baseName.replace(/\$/g, '_');
            block.push({
              dbPath: `otherPhones.${index - 1}.phoneNumber`,
              selector: { type: 'name', value: `${baseName}tbxAddPhoneInfo` },
              fallbackSelectors: [{ type: 'id', value: `${baseId}tbxAddPhoneInfo` }],
              fieldType: 'text',
              action: 'addAnotherRow',
              id: index - 1,
            });

          }
          block.push({
            dbPath: `otherPhones.${index}.phoneNumber`,
            selector: { type: 'name', value: `${baseName}tbxAddPhoneInfo` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbxAddPhoneInfo` }],
            fieldType: 'text',
          });
          return block;
        }))
      }
      if (clientData['addressAndPhone']['hasOtherEmails'] == 'Y') {
        const arr = clientData['addressAndPhone']['otherEmails'] || [];
        dynamic.push(...arr.flatMap((item, index) => {
          let baseName = `ctl00$SiteContentPlaceHolder$FormView1$dtlAddEmail$ctl0${index}$`
          let baseId = baseName.replace(/\$/g, '_');
          let block = [];
          if (index > 0) {
            let baseName = `ctl00$SiteContentPlaceHolder$FormView1$dtlAddEmail$ctl0${index - 1}$`;
            let baseId = baseName.replace(/\$/g, '_');
            block.push({
              dbPath: `otherEmails.${index - 1}.emailAddress`,
              selector: { type: 'name', value: `${baseName}tbxAddEmailInfo` },
              fallbackSelectors: [{ type: 'id', value: `${baseId}tbxAddEmailInfo` }],
              fieldType: 'text',
              action: 'addAnotherRow',
              id: index - 1,
            });

          }
          block.push({
            dbPath: `otherEmails.${index}.emailAddress`,
            selector: { type: 'name', value: `${baseName}tbxAddEmailInfo` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbxAddEmailInfo` }],
            fieldType: 'text',
          });
          return block;
        }))
      }
      return dynamic;
    })(),
    passport: (() => {
      let dynamic = [];
      dynamic.push({
        dbPath: 'passportType',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlPPT_TYPE' },
        fallbackSelectors: [
          { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlPPT_TYPE' }
        ],
        fieldType: 'select'
      },
        {
          dbPath: 'passportNumber',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxPPT_NUM' },
          fallbackSelectors: [
            { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxPPT_NUM' }
          ],
          fieldType: 'text',
          action: "wait"
        },
        {
          dbPath: 'passportBookNumber_na',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbexPPT_BOOK_NUM_NA' },
          fallbackSelectors: [
            { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbexPPT_BOOK_NUM_NA' }
          ],
          fieldType: 'checkbox',
          valueExtractor: v => v === undefined ? false : v
        },
        {
          dbPath: 'passportBookNumber',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxPPT_BOOK_NUM' },
          fallbackSelectors: [
            { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxPPT_BOOK_NUM' }
          ],
          fieldType: 'text'
        },
        {
          dbPath: 'passportIssuedCountry',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlPPT_ISSUED_CNTRY' },
          fallbackSelectors: [
            { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlPPT_ISSUED_CNTRY' }
          ],
          fieldType: 'select'
        },
        {
          dbPath: 'passportIssuedCity',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxPPT_ISSUED_IN_CITY' },
          fallbackSelectors: [
            { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxPPT_ISSUED_IN_CITY' }
          ],
          fieldType: 'text'
        },
        {
          dbPath: 'passportIssuedState',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxPPT_ISSUED_IN_STATE' },
          fallbackSelectors: [
            { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxPPT_ISSUED_IN_STATE' }
          ],
          fieldType: 'text'
        },
        {
          dbPath: 'passportIssuedInCountry',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlPPT_ISSUED_IN_CNTRY' },
          fallbackSelectors: [
            { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlPPT_ISSUED_IN_CNTRY' }
          ],
          fieldType: 'select'
        },
        // Issued Date
        {
          dbPath: 'passportIssuedDate.day',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlPPT_ISSUED_DTEDay' },
          fallbackSelectors: [
            { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlPPT_ISSUED_DTEDay' }
          ],
          fieldType: 'select'
        },
        {
          dbPath: 'passportIssuedDate.month',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlPPT_ISSUED_DTEMonth' },
          fallbackSelectors: [
            { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlPPT_ISSUED_DTEMonth' }
          ],
          fieldType: 'select'
        },
        {
          dbPath: 'passportIssuedDate.year',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxPPT_ISSUEDYear' },
          fallbackSelectors: [
            { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxPPT_ISSUEDYear' }
          ],
          fieldType: 'text'
        },
        // Expiration Date
        {
          dbPath: 'passportExpirationDate_na',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbxPPT_EXPIRE_NA' },
          fallbackSelectors: [
            { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbxPPT_EXPIRE_NA' }
          ],
          fieldType: 'checkbox',
          valueExtractor: v => v === undefined ? false : v
        },
        {
          dbPath: 'hasLostPassport',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblLOST_PPT_IND' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblLOST_PPT_IND_0' },
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblLOST_PPT_IND_1' }
          ],
          fieldType: 'radio',
          valueMap: {
            'Y': '0',
            'N': '1'
          }
        })
      if (clientData['passport']['passportExpirationDate_na'] === undefined || !clientData['passport']['passportExpirationDate_na']) {
        //expiration date
        dynamic.push({
          dbPath: 'passportExpirationDate.day',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlPPT_EXPIRE_DTEDay' },
          fallbackSelectors: [
            { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlPPT_EXPIRE_DTEDay' }
          ],
          fieldType: 'select',
          action: 'wait'
        },
          {
            dbPath: 'passportExpirationDate.month',
            selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlPPT_EXPIRE_DTEMonth' },
            fallbackSelectors: [
              { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlPPT_EXPIRE_DTEMonth' }
            ],
            fieldType: 'select'
          },
          {
            dbPath: 'passportExpirationDate.year',
            selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxPPT_EXPIREYear' },
            fallbackSelectors: [
              { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxPPT_EXPIREYear' }
            ],
            fieldType: 'text'
          })
      }
      if (clientData['passport']['hasLostPassport'] == 'Y') {
        const arr = clientData['passport']['lostPassports'] || [];
        dynamic.push(...arr.flatMap((item, index) => {
          let baseName = `ctl00$SiteContentPlaceHolder$FormView1$dtlLostPPT$ctl0${index}$`
          let baseId = baseName.replace(/\$/g, '_');
          let block = [];
          if (index > 0) {
            let baseName = `ctl00$SiteContentPlaceHolder$FormView1$dtlLostPPT$ctl0${index - 1}$`;
            let baseId = baseName.replace(/\$/g, '_');
            block.push({
              dbPath: `lostPassports.${index - 1}.issuingCountry`,
              selector: { type: 'name', value: `${baseName}ddlLOST_PPT_NATL` },
              fallbackSelectors: [{ type: 'id', value: `${baseId}ddlLOST_PPT_NATL` }],
              fieldType: 'select',
              action: 'addAnotherRow',
              id: index - 1,
            });

          }
          block.push({
            dbPath: `lostPassports.${index}.passportNumber_na`,
            selector: { type: 'name', value: `${baseName}cbxLOST_PPT_NUM_UNKN_IND` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}cbxLOST_PPT_NUM_UNKN_IND` }],
            fieldType: 'checkbox',
            valueExtractor: v => v === undefined ? false : v
          });
          if (clientData['passport']['lostPassports'][index]['passportNumber_na'] === undefined || !clientData['passport']['lostPassports'][index]['passportNumber_na']) {
            block.push({
              dbPath: `lostPassports.${index}.passportNumber`,
              selector: { type: 'name', value: `${baseName}tbxLOST_PPT_NUM` },
              fallbackSelectors: [{ type: 'id', value: `${baseId}tbxLOST_PPT_NUM` }],
              fieldType: 'text',
              action: 'wait'
            });
          }
          block.push({
            dbPath: `lostPassports.${index}.issuingCountry`,
            selector: { type: 'name', value: `${baseName}ddlLOST_PPT_NATL` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}ddlLOST_PPT_NATL` }],
            fieldType: 'select',
          });
          block.push({
            dbPath: `lostPassports.${index}.explanation`,
            selector: { type: 'name', value: `${baseName}tbxLOST_PPT_EXPL` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbxLOST_PPT_EXPL` }],
            fieldType: 'text',
          });
          return block;
        }))
      }
      return dynamic;
    })(),
    usContact: (() => {
      const dynamic = [];
      dynamic.push({
        dbPath: 'usPocSurname',
        selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxUS_POC_SURNAME' },
        fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxUS_POC_SURNAME' }],
        fieldType: 'text'
      },
        {
          dbPath: 'usPocGivenName',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxUS_POC_GIVEN_NAME' },
          fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxUS_POC_GIVEN_NAME' }],
          fieldType: 'text',
          action: 'wait'
        },
        {
          dbPath: 'usPocName_na',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbxUS_POC_NAME_NA' },
          fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbxUS_POC_NAME_NA' }],
          fieldType: 'checkbox',
          valueExtractor: v => v === undefined ? false : v,
          action: 'wait'
        },
        {
          dbPath: 'usPocNameNotKnown',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbxUS_POC_NAME_NA' },
          fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbxUS_POC_NAME_NA' }],
          fieldType: 'checkbox',
          valueExtractor: v => v === undefined ? false : v,
          action: 'wait'
        },
        {
          dbPath: 'usPocOrganization',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxUS_POC_ORGANIZATION' },
          fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxUS_POC_ORGANIZATION' }],
          fieldType: 'text',
          action: 'wait'
        },
        {
          dbPath: 'usPocOrganization_na',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbxUS_POC_ORG_NA_IND' },
          fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbxUS_POC_ORG_NA_IND' }],
          fieldType: 'checkbox',
          valueExtractor: v => v === undefined ? false : v
        },
        {
          dbPath: 'usPocOrganizationNotKnown',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbxUS_POC_ORG_NA_IND' },
          fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbxUS_POC_ORG_NA_IND' }],
          fieldType: 'checkbox',
          valueExtractor: v => v === undefined ? false : v
        },
        {
          dbPath: 'usPocRelationship',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlUS_POC_REL_TO_APP' },
          fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlUS_POC_REL_TO_APP' }],
          fieldType: 'select'
        },
        {
          dbPath: 'usPocAddressLine1',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxUS_POC_ADDR_LN1' },
          fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxUS_POC_ADDR_LN1' }],
          fieldType: 'text'
        },
        {
          dbPath: 'usPocAddressLine2',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxUS_POC_ADDR_LN2' },
          fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxUS_POC_ADDR_LN2' }],
          fieldType: 'text'
        },
        {
          dbPath: 'usPocCity',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxUS_POC_ADDR_CITY' },
          fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxUS_POC_ADDR_CITY' }],
          fieldType: 'text'
        },
        {
          dbPath: 'usPocState',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlUS_POC_ADDR_STATE' },
          fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlUS_POC_ADDR_STATE' }],
          fieldType: 'select'
        },
        {
          dbPath: 'usPocZipCode',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxUS_POC_ADDR_POSTAL_CD' },
          fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxUS_POC_ADDR_POSTAL_CD' }],
          fieldType: 'text'
        },
        {
          dbPath: 'usPocPhone',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxUS_POC_HOME_TEL' },
          fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxUS_POC_HOME_TEL' }],
          fieldType: 'text'
        },
        {
          dbPath: 'usPocEmail',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxUS_POC_EMAIL_ADDR' },
          fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxUS_POC_EMAIL_ADDR' }],
          fieldType: 'text'
        },
        {
          dbPath: 'usPocEmail_na',
          selector: { type: 'name', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbexUS_POC_EMAIL_ADDR_NA' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbexUS_POC_EMAIL_ADDR_NA' }],
          fieldType: 'checkbox',
          valueExtractor: v => v === undefined ? false : v
        })
      return dynamic;
    })(),
    familyRelatives: (() => {
      const dynamic = [];
      if (clientData.familyRelatives.fatherSurnameNotKnown) {
        dynamic.push(
          {
            dbPath: 'fatherSurnameNotKnown',
            selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbxFATHER_SURNAME_UNK_IND' },
            fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbxFATHER_SURNAME_UNK_IND' }],
            fieldType: 'checkbox',
            valueExtractor: v => v === undefined ? false : v
          }
        )
      } else {
        dynamic.push(
          {
            dbPath: 'fatherSurname',
            selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxFATHER_SURNAME' },
            fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxFATHER_SURNAME' }],
            fieldType: 'text'
          }
        )
      }
      if (clientData.familyRelatives.fatherGivenNameNotKnown) {
        dynamic.push(
          {
            dbPath: 'fatherGivenNameNotKnown',
            selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbxFATHER_GIVEN_NAME_UNK_IND' },
            fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbxFATHER_GIVEN_NAME_UNK_IND' }],
            fieldType: 'checkbox',
            valueExtractor: v => v === undefined ? false : v
          }
        )
      } else {
        dynamic.push(
          {
            dbPath: 'fatherGivenName',
            selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxFATHER_GIVEN_NAME' },
            fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxFATHER_GIVEN_NAME' }],
            fieldType: 'text',
            action: 'wait'
          }
        )
      }
      if (clientData.familyRelatives.fatherDobNotKnown) {
        dynamic.push(
          {
            dbPath: 'fatherDobNotKnown',
            selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbxFATHER_DOB_UNK_IND' },
            fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbxFATHER_DOB_UNK_IND' }],
            fieldType: 'checkbox',
            valueExtractor: v => v === undefined ? false : v
          }
        )
      } else {
        dynamic.push(
          {
            dbPath: 'fatherDob.day',
            selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlFathersDOBDay' },
            fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlFathersDOBDay' }],
            fieldType: 'select',
            action: 'wait'
          },
          {
            dbPath: 'fatherDob.month',
            selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlFathersDOBMonth' },
            fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlFathersDOBMonth' }],
            fieldType: 'select',
            action: 'wait'
          },
          {
            dbPath: 'fatherDob.year',
            selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxFathersDOBYear' },
            fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxFathersDOBYear' }],
            fieldType: 'text'
          }
        )
      }
      dynamic.push(
        {
          dbPath: 'fatherInUs',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblFATHER_LIVE_IN_US_IND' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblFATHER_LIVE_IN_US_IND_0' },
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblFATHER_LIVE_IN_US_IND_1' }],
          fieldType: 'radio',
          valueMap: { 'Y': '0', 'N': '1' },
          action: 'wait'
        }
      )
      if (clientData.familyRelatives.fatherInUs == "Y") {
        dynamic.push(
          {
            dbPath: 'fatherStatus',
            selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlFATHER_US_STATUS' },
            fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlFATHER_US_STATUS' }],
            fieldType: 'select',
            action: 'wait'
          }
        )
      }


      if (clientData.familyRelatives.motherSurnameNotKnown) {
        dynamic.push(
          {
            dbPath: 'motherSurnameNotKnown',
            selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbxMOTHER_SURNAME_UNK_IND' },
            fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbxMOTHER_SURNAME_UNK_IND' }],
            fieldType: 'checkbox',
            valueExtractor: v => v === undefined ? false : v
          }
        )
      } else {
        dynamic.push(
          {
            dbPath: 'motherSurname',
            selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxMOTHER_SURNAME' },
            fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxMOTHER_SURNAME' }],
            fieldType: 'text',
            action: 'wait'
          }
        )
      }
      if (clientData.familyRelatives.motherGivenNameNotKnown) {
        dynamic.push(
          {
            dbPath: 'motherGivenNameNotKnown',
            selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbxMOTHER_GIVEN_NAME_UNK_IND' },
            fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbxMOTHER_GIVEN_NAME_UNK_IND' }],
            fieldType: 'checkbox',
            valueExtractor: v => v === undefined ? false : v
          }
        )
      } else {
        dynamic.push(
          {
            dbPath: 'motherGivenName',
            selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxMOTHER_GIVEN_NAME' },
            fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxMOTHER_GIVEN_NAME' }],
            fieldType: 'text',
            action: 'wait'
          }
        )
      }
      if (clientData.familyRelatives.motherDobNotKnown) {
        dynamic.push(
          {
            dbPath: 'motherDobNotKnown',
            selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbxMOTHER_DOB_UNK_IND' },
            fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbxMOTHER_DOB_UNK_IND' }],
            fieldType: 'checkbox',
            valueExtractor: v => v === undefined ? false : v
          }
        )
      } else {
        dynamic.push(
          {
            dbPath: 'motherDob.day',
            selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlMothersDOBDay' },
            fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlMothersDOBDay' }],
            fieldType: 'select',
            action: 'wait'
          },
          {
            dbPath: 'motherDob.month',
            selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlMothersDOBMonth' },
            fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlMothersDOBMonth' }],
            fieldType: 'select',
            action: 'wait'
          },
          {
            dbPath: 'motherDob.year',
            selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxMothersDOBYear' },
            fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxMothersDOBYear' }],
            fieldType: 'text'
          }
        )
      }
      dynamic.push(
        {
          dbPath: 'motherInUs',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblMOTHER_LIVE_IN_US_IND' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblMOTHER_LIVE_IN_US_IND_0' },
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblMOTHER_LIVE_IN_US_IND_1' }],
          fieldType: 'radio',
          valueMap: { 'Y': '0', 'N': '1' }
        }
      )
      if (clientData.familyRelatives.motherInUs == "Y") {
        dynamic.push(
          {
            dbPath: 'motherStatus',
            selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlMOTHER_US_STATUS' },
            fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlMOTHER_US_STATUS' }],
            fieldType: 'select',
            action: 'wait'
          }
        )
      }

      dynamic.push(
        {
          dbPath: 'hasUsRelatives',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblUS_IMMED_RELATIVE_IND' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblUS_IMMED_RELATIVE_IND_0' },
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblUS_IMMED_RELATIVE_IND_1' }],
          fieldType: 'radio',
          valueMap: { 'Y': '0', 'N': '1' }
        },
        {
          dbPath: 'hasOtherUsRelatives',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblUS_OTHER_RELATIVE_IND' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblUS_OTHER_RELATIVE_IND_1' },
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblUS_OTHER_RELATIVE_IND_0' }],
          fieldType: 'radio',
          valueMap: { 'Y': '0', 'N': '1' }
        }
      );
      if (clientData.familyRelatives.hasUsRelatives == "Y") {
        const arr = clientData.familyRelatives.relatives || [];
        dynamic.push(...arr.flatMap((item, index) => {
          let baseName = `ctl00$SiteContentPlaceHolder$FormView1$dlUSRelatives$ctl0${index}$`
          let baseId = baseName.replace(/\$/g, '_');
          let block = [];
          if (index > 0) {
            let baseName = `ctl00$SiteContentPlaceHolder$FormView1$dlUSRelatives$ctl0${index - 1}$`;
            let baseId = baseName.replace(/\$/g, '_');
            block.push({
              dbPath: `relatives.${index - 1}.surname`,
              selector: { type: 'name', value: `${baseName}tbxUS_REL_SURNAME` },
              fallbackSelectors: [{ type: 'id', value: `${baseId}tbxUS_REL_SURNAME` }],
              fieldType: 'text',
              action: 'addAnotherRow',
              id: index - 1,
            });

          }
          block.push({
            dbPath: `relatives.${index}.surname`,
            selector: { type: 'name', value: `${baseName}tbxUS_REL_SURNAME` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbxUS_REL_SURNAME` }],
            fieldType: 'text',
          });

          block.push({
            dbPath: `relatives.${index}.givenName`,
            selector: { type: 'name', value: `${baseName}tbxUS_REL_GIVEN_NAME` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbxUS_REL_GIVEN_NAME` }],
            fieldType: 'text',
          });
          block.push({
            dbPath: `relatives.${index}.relationship`,
            selector: { type: 'name', value: `${baseName}ddlUS_REL_TYPE` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}ddlUS_REL_TYPE` }],
            fieldType: 'select',
          });
          block.push({
            dbPath: `relatives.${index}.usStatus`,
            selector: { type: 'name', value: `${baseName}ddlUS_REL_STATUS` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}ddlUS_REL_STATUS` }],
            fieldType: 'select',
          });
          return block;
        }))
      }
      return dynamic;
    })(),

    // ─── Family: Spouse ───────────────────────────────────────────────────────
    familySpouse: (() => {
      const dynamic = [];
      dynamic.push(
        {
          dbPath: 'spouseSurname',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxSpouseSurname' },
          fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxSpouseSurname' }],
          fieldType: 'text'
        },
        {
          dbPath: 'spouseGivenName',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxSpouseGivenName' },
          fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxSpouseGivenName' }],
          fieldType: 'text'
        },
        {
          dbPath: 'spouseDob.day',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlDOBDay' },
          fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlDOBDay' }],
          fieldType: 'select'
        },
        {
          dbPath: 'spouseDob.month',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlDOBMonth' },
          fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlDOBMonth' }],
          fieldType: 'select'
        },
        {
          dbPath: 'spouseDob.year',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxDOBYear' },
          fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxDOBYear' }],
          fieldType: 'text'
        },
        {
          dbPath: 'spouseDob_na',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbexDOBNA' },
          fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbexDOBNA' }],
          fieldType: 'checkbox', valueExtractor: v => v === undefined ? false : v
        },
        {
          dbPath: 'spouseNationality',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlSpouseNatDropDownList' },
          fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlSpouseNatDropDownList' }],
          fieldType: 'select'
        }
      );

      if (clientData.familySpouse.spousePobCity_na) {
        dynamic.push(
          {
            dbPath: 'spousePobCity_na',
            selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbexSPOUSE_POB_CITY_NA' },
            fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbexSPOUSE_POB_CITY_NA' }],
            fieldType: 'checkbox', valueExtractor: v => v === undefined ? false : v
          });
      }
      else {
        dynamic.push(
          {
            dbPath: 'spousePobCity',
            selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxSpousePOBCity' },
            fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxSpousePOBCity' }],
            fieldType: 'text'
          });
      }

      dynamic.push(
        {
          dbPath: 'spousePobCountry',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlSpousePOBCountry' },
          fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlSpousePOBCountry' }],
          fieldType: 'select'
        },
        {
          dbPath: 'spouseAddressType',
          selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlSpouseAddressType' },
          fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlSpouseAddressType' }],
          fieldType: 'select'
        }
      );
      if (clientData.familySpouse.spouseAddressType == "O") {
        dynamic.push(
          {
            dbPath: 'spouseAddressLine1',
            selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxSPOUSE_ADDR_LN1' },
            fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxSPOUSE_ADDR_LN1' }],
            fieldType: 'text'
          },
          {
            dbPath: 'spouseAddressLine2',
            selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxSPOUSE_ADDR_LN2' },
            fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxSPOUSE_ADDR_LN2' }],
            fieldType: 'text'
          },
          {
            dbPath: 'spouseAddressCity',
            selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxSPOUSE_ADDR_CITY' },
            fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxSPOUSE_ADDR_CITY' }],
            fieldType: 'text'
          },
          {
            dbPath: 'spouseAddressState',
            selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxSPOUSE_ADDR_STATE' },
            fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxSPOUSE_ADDR_STATE' }],
            fieldType: 'text'
          },
          {
            dbPath: 'spouseAddressPostalCode',
            selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxSPOUSE_ADDR_POSTAL_CD' },
            fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxSPOUSE_ADDR_POSTAL_CD' }],
            fieldType: 'text'
          },
          {
            dbPath: 'spouseAddressState_na',
            selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbexSPOUSE_ADDR_STATE_NA' },
            fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbexSPOUSE_ADDR_STATE_NA' }],
            fieldType: 'checkbox',
            valueExtractor: v => v === undefined ? false : v
          },
          {
            dbPath: 'spouseAddressPostalCode_na',
            selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbexSPOUSE_ADDR_POSTAL_CD_NA' },
            fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbexSPOUSE_ADDR_POSTAL_CD_NA' }],
            fieldType: 'checkbox',
            valueExtractor: v => v === undefined ? false : v
          },
          {
            dbPath: 'spouseAddressCountry',
            selector: { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlSPOUSE_ADDR_CNTRY' },
            fallbackSelectors: [{ type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlSPOUSE_ADDR_CNTRY' }],
            fieldType: 'select'
          }
        );
      }
      return dynamic;
    })(),
    workEducation: (() => {
      const dynamic = [];
      dynamic.push(
        {
          dbPath: 'presentOccupation',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlPresentOccupation' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlPresentOccupation' }
          ],
          fieldType: 'select',
          action: "preventRefresh"
        });
      dynamic.push(
        {
          dbPath: 'employerSchoolName',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxEmpSchName' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxEmpSchName' }
          ],
          fieldType: 'text',
        },
        {
          dbPath: 'employerAddressLine1',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxEmpSchAddr1' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxEmpSchAddr1' }
          ],
          fieldType: 'text',
        },
        {
          dbPath: 'employerAddressLine2',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxEmpSchAddr2' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxEmpSchAddr2' }
          ],
          fieldType: 'text',
        },
        {
          dbPath: 'employerCity',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxEmpSchCity' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxEmpSchCity' }
          ],
          fieldType: 'text',
        });

      if (clientData.workEducation.employerState_na) {
        dynamic.push(
          {
            dbPath: 'employerState_na',
            selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbxWORK_EDUC_ADDR_STATE_NA' },
            fallbackSelectors: [
              { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbxWORK_EDUC_ADDR_STATE_NA' }
            ],
            fieldType: 'checkbox',
            valueExtractor: v => v === undefined ? false : v
          }
        );
      }
      else {
        dynamic.push(
          {
            dbPath: 'employerState',
            selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxWORK_EDUC_ADDR_STATE' },
            fallbackSelectors: [
              { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxWORK_EDUC_ADDR_STATE' }
            ],
            fieldType: 'text',
          }
        );
      }
      if (clientData.workEducation.employerPostalCode_na) {
        dynamic.push(
          {
            dbPath: 'employerPostalCode_na',
            selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbxWORK_EDUC_ADDR_POSTAL_CD_NA' },
            fallbackSelectors: [
              { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbxWORK_EDUC_ADDR_POSTAL_CD_NA' }
            ],
            fieldType: 'checkbox',
            valueExtractor: v => v === undefined ? false : v
          });
      }
      else {
        dynamic.push(
          {
            dbPath: 'employerPostalCode',
            selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxWORK_EDUC_ADDR_POSTAL_CD' },
            fallbackSelectors: [
              { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxWORK_EDUC_ADDR_POSTAL_CD' }
            ],
            fieldType: 'text',
          });
      }

      dynamic.push(
        {
          dbPath: 'employerPhone',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxWORK_EDUC_TEL' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxWORK_EDUC_TEL' }
          ],
          fieldType: 'text',
        },
        {
          dbPath: 'employerCountry',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlEmpSchCountry' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlEmpSchCountry' }
          ],
          fieldType: 'select',
        },
        {
          dbPath: 'employerStart.day',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlEmpDateFromDay' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlEmpDateFromDay' }
          ],
          fieldType: 'select',
        },
        {
          dbPath: 'employerStart.month',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$ddlEmpDateFromMonth' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_ddlEmpDateFromMonth' }
          ],
          fieldType: 'select',
        },
        {
          dbPath: 'employerStart.year',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxEmpDateFromYear' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxEmpDateFromYear' }
          ],
          fieldType: 'text',
        });


      if (clientData.workEducation.monthlySalary_na) {
        dynamic.push(
          {
            dbPath: 'monthlySalary_na',
            selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$cbxCURR_MONTHLY_SALARY_NA' },
            fallbackSelectors: [
              { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_cbxCURR_MONTHLY_SALARY_NA' }
            ],
            fieldType: 'checkbox',
            valueExtractor: v => v === undefined ? false : v
          });
      } else {
        dynamic.push(
          {
            dbPath: 'monthlySalary',
            selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxCURR_MONTHLY_SALARY' },
            fallbackSelectors: [
              { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxCURR_MONTHLY_SALARY' }
            ],
            fieldType: 'text',
          });
      }


      dynamic.push(
        {
          dbPath: 'jobDuties',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxDescribeDuties' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxDescribeDuties' }
          ],
          fieldType: 'text',
        });
      return dynamic;
    })(),
    workEducationPrevious: (() => {
      const dynamic = [];
      dynamic.push(
        {
          dbPath: 'previouslyEmployed',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblPreviouslyEmployed' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblPreviouslyEmployed_0' },
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblPreviouslyEmployed_1' }
          ],
          fieldType: 'radio',
          valueMap: { 'Y': '0', 'N': '1' }
        },
        {
          dbPath: 'attendedEducation',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblOtherEduc' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblOtherEduc_0' },
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblOtherEduc_1' }
          ],
          fieldType: 'radio',
          valueMap: { 'Y': '0', 'N': '1' }
        }
      );
      if (clientData.workEducationPrevious.previouslyEmployed === 'Y') {
        const arr = clientData.workEducationPrevious.previousEmployments || [];
        dynamic.push(...arr.flatMap((entry, idx) => {
          const baseName = `ctl00$SiteContentPlaceHolder$FormView1$dtlPrevEmpl$ctl0${idx}$`;
          const baseId = baseName.replace(/\$/g, '_');
          const block = [];
          if (idx > 0) {
            const baseName = `ctl00$SiteContentPlaceHolder$FormView1$dtlPrevEmpl$ctl0${idx - 1}$`;
            const baseId = baseName.replace(/\$/g, '_');
            block.push({
              dbPath: `previousEmployments.${idx - 1}.employerName`,
              selector: { type: 'name', value: `${baseName}tbEmployerName` },
              fallbackSelectors: [{ type: 'id', value: `${baseId}tbEmployerName` }],
              fieldType: 'text',
              action: 'addAnotherRow',
              id: idx - 1
            });
          }

          block.push({
            dbPath: `previousEmployments.${idx}.employerName`,
            selector: { type: 'name', value: `${baseName}tbEmployerName` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbEmployerName` }],
            fieldType: 'text',
            action: 'wait'
          });
          block.push({
            dbPath: `previousEmployments.${idx}.employerAddressLine1`,
            selector: { type: 'name', value: `${baseName}tbEmployerStreetAddress1` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbEmployerStreetAddress1` }],
            fieldType: 'text',

          });
          block.push({
            dbPath: `previousEmployments.${idx}.employerAddressLine2`,
            selector: { type: 'name', value: `${baseName}tbEmployerStreetAddress2` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbEmployerStreetAddress2` }],
            fieldType: 'text',

          });
          block.push({
            dbPath: `previousEmployments.${idx}.employerCity`,
            selector: { type: 'name', value: `${baseName}tbEmployerCity` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbEmployerCity` }],
            fieldType: 'text',

          });

          if (clientData.workEducationPrevious.previousEmployments[idx].employerState_na) {

            block.push({
              dbPath: `previousEmployments.${idx}.employerState_na`,
              selector: { type: 'name', value: `${baseName}cbxPREV_EMPL_ADDR_STATE_NA` },
              fallbackSelectors: [{ type: 'id', value: `${baseId}cbxPREV_EMPL_ADDR_STATE_NA` }],
              fieldType: 'checkbox',
              valueExtractor: v => v === undefined ? false : v
            });
          }
          else {
            block.push({
              dbPath: `previousEmployments.${idx}.employerState`,
              selector: { type: 'name', value: `${baseName}tbxPREV_EMPL_ADDR_STATE` },
              fallbackSelectors: [{ type: 'id', value: `${baseId}tbxPREV_EMPL_ADDR_STATE` }],
              fieldType: 'text',

            });
          }
          if (clientData.workEducationPrevious.previousEmployments[idx].employerPostalCode_na) {

            block.push({
              dbPath: `previousEmployments.${idx}.employerPostalCode_na`,
              selector: { type: 'name', value: `${baseName}cbxPREV_EMPL_ADDR_POSTAL_CD_NA` },
              fallbackSelectors: [{ type: 'id', value: `${baseId}cbxPREV_EMPL_ADDR_POSTAL_CD_NA` }],
              fieldType: 'checkbox',
              valueExtractor: v => v === undefined ? false : v
            });
          }
          else {
            block.push({
              dbPath: `previousEmployments.${idx}.employerPostalCode`,
              selector: { type: 'name', value: `${baseName}tbxPREV_EMPL_ADDR_POSTAL_CD` },
              fallbackSelectors: [{ type: 'id', value: `${baseId}tbxPREV_EMPL_ADDR_POSTAL_CD` }],
              fieldType: 'text',

            });
          }

          block.push({
            dbPath: `previousEmployments.${idx}.employerPostalCode`,
            selector: { type: 'name', value: `${baseName}tbxPREV_EMPL_ADDR_POSTAL_CD` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbxPREV_EMPL_ADDR_POSTAL_CD` }],
            fieldType: 'text',

          });
          block.push({
            dbPath: `previousEmployments.${idx}.employerCountry`,
            selector: { type: 'name', value: `${baseName}DropDownList2` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}DropDownList2` }],
            fieldType: 'select',

          });
          block.push({
            dbPath: `previousEmployments.${idx}.employerPhone`,
            selector: { type: 'name', value: `${baseName}tbEmployerPhone` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbEmployerPhone` }],
            fieldType: 'text',

          });
          block.push({
            dbPath: `previousEmployments.${idx}.jobTitle`,
            selector: { type: 'name', value: `${baseName}tbJobTitle` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbJobTitle` }],
            fieldType: 'text',

          });

          if (clientData.workEducationPrevious.previousEmployments[idx].supervisorSurname_na) {
            block.push({
              dbPath: `previousEmployments.${idx}.supervisorSurname_na`,
              selector: { type: 'name', value: `${baseName}cbxSupervisorSurname_NA` },
              fallbackSelectors: [{ type: 'id', value: `${baseId}cbxSupervisorSurname_NA` }],
              fieldType: 'checkbox',
              action: 'wait',
              valueExtractor: v => v === undefined ? false : v
            });
          }
          else {
            block.push({
              dbPath: `previousEmployments.${idx}.supervisorSurname`,
              selector: { type: 'name', value: `${baseName}tbSupervisorSurname` },
              fallbackSelectors: [{ type: 'id', value: `${baseId}tbSupervisorSurname` }],
              fieldType: 'text',

            });

          }
          if (clientData.workEducationPrevious.previousEmployments[idx].supervisorGivenName_na) {
            block.push({
              dbPath: `previousEmployments.${idx}.supervisorGivenName_na`,
              selector: { type: 'name', value: `${baseName}cbxSupervisorGivenName_NA` },
              fallbackSelectors: [{ type: 'id', value: `${baseId}cbxSupervisorGivenName_NA` }],
              fieldType: 'checkbox',
              action: 'wait',
              valueExtractor: v => v === undefined ? false : v
            });
          }
          else {

            block.push({
              dbPath: `previousEmployments.${idx}.supervisorGivenName`,
              selector: { type: 'name', value: `${baseName}tbSupervisorGivenName` },
              fallbackSelectors: [{ type: 'id', value: `${baseId}tbSupervisorGivenName` }],
              fieldType: 'text',

            });
          }

          block.push({
            dbPath: `previousEmployments.${idx}.employmentStart.day`,
            selector: { type: 'name', value: `${baseName}ddlEmpDateFromDay` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}ddlEmpDateFromDay` }],
            fieldType: 'select',
            action: 'wait',

          });
          block.push({
            dbPath: `previousEmployments.${idx}.employmentStart.month`,
            selector: { type: 'name', value: `${baseName}ddlEmpDateFromMonth` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}ddlEmpDateFromMonth` }],
            fieldType: 'select',
            action: 'wait',

          });
          block.push({
            dbPath: `previousEmployments.${idx}.employmentStart.year`,
            selector: { type: 'name', value: `${baseName}tbxEmpDateFromYear` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbxEmpDateFromYear` }],
            fieldType: 'text',

          });
          block.push({
            dbPath: `previousEmployments.${idx}.employmentEnd.day`,
            selector: { type: 'name', value: `${baseName}ddlEmpDateToDay` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}ddlEmpDateToDay` }],
            fieldType: 'select',

          });
          block.push({
            dbPath: `previousEmployments.${idx}.employmentEnd.month`,
            selector: { type: 'name', value: `${baseName}ddlEmpDateToMonth` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}ddlEmpDateToMonth` }],
            fieldType: 'select',

          });
          block.push({
            dbPath: `previousEmployments.${idx}.employmentEnd.year`,
            selector: { type: 'name', value: `${baseName}tbxEmpDateToYear` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbxEmpDateToYear` }],
            fieldType: 'text',

          });


          // block.push({
          //   dbPath: `previousEmployments.${idx}.employmentEnd.year`,
          //   selector: { type: 'name', value: `${baseName}tbxEmpDateToYear` },
          //   fallbackSelectors: [{ type: 'id', value: `${baseId}tbxEmpDateToYear` }],
          //   fieldType: 'text',

          // });
          return block;
        }));
      }
      if (clientData.workEducationPrevious.attendedEducation === 'Y') {
        const arr = clientData.workEducationPrevious.previousEducations || [];
        dynamic.push(...arr.flatMap((entry, idx) => {
          const baseName = `ctl00$SiteContentPlaceHolder$FormView1$dtlPrevEduc$ctl0${idx}$`;
          const baseId = baseName.replace(/\$/g, '_');
          const block = [];
          if (idx > 0) {
            const baseName = `ctl00$SiteContentPlaceHolder$FormView1$dtlPrevEduc$ctl0${idx - 1}$`;
            const baseId = baseName.replace(/\$/g, '_');
            block.push({
              dbPath: `previousEducations.${idx - 1}.institutionName`,
              selector: { type: 'name', value: `${baseName}tbxSchoolName` },
              fallbackSelectors: [{ type: 'id', value: `${baseId}tbxSchoolName` }],
              fieldType: 'text',
              action: 'addAnotherRow',
              id: idx - 1
            });
          }

          block.push({
            dbPath: `previousEducations.${idx}.institutionName`,
            selector: { type: 'name', value: `${baseName}tbxSchoolName` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbxSchoolName` }],
            fieldType: 'text',

          });
          block.push({
            dbPath: `previousEducations.${idx}.institutionAddressLine1`,
            selector: { type: 'name', value: `${baseName}tbxSchoolAddr1` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbxSchoolAddr1` }],
            fieldType: 'text',

          });
          block.push({
            dbPath: `previousEducations.${idx}.institutionAddressLine2`,
            selector: { type: 'name', value: `${baseName}tbxSchoolAddr2` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbxSchoolAddr2` }],
            fieldType: 'text',

          });
          block.push({
            dbPath: `previousEducations.${idx}.institutionCity`,
            selector: { type: 'name', value: `${baseName}tbxSchoolCity` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbxSchoolCity` }],
            fieldType: 'text',

          });
          if (clientData.workEducationPrevious.previousEducations[idx].institutionState_na) {
            block.push({
              dbPath: `previousEducations.${idx}.institutionState_na`,
              selector: { type: 'name', value: `${baseName}cbxEDUC_INST_ADDR_STATE_NA` },
              fallbackSelectors: [{ type: 'id', value: `${baseId}cbxEDUC_INST_ADDR_STATE_NA` }],
              fieldType: 'checkbox',
              action: 'wait',
              valueExtractor: v => v === undefined ? false : v
            });
          }
          else {
            block.push({
              dbPath: `previousEducations.${idx}.institutionState`,
              selector: { type: 'name', value: `${baseName}tbxEDUC_INST_ADDR_STATE` },
              fallbackSelectors: [{ type: 'id', value: `${baseId}tbxEDUC_INST_ADDR_STATE` }],
              fieldType: 'text',

            });
          }
          if (clientData.workEducationPrevious.previousEducations[idx].institutionPostalCode_na) {
            block.push({
              dbPath: `previousEducations.${idx}.institutionPostalCode_na`,
              selector: { type: 'name', value: `${baseName}cbxEDUC_INST_POSTAL_CD_NA` },
              fallbackSelectors: [{ type: 'id', value: `${baseId}cbxEDUC_INST_POSTAL_CD_NA` }],
              fieldType: 'checkbox',
              action: 'wait',
              valueExtractor: v => v === undefined ? false : v
            });
          }
          else {
            block.push({
              dbPath: `previousEducations.${idx}.institutionPostalCode`,
              selector: { type: 'name', value: `${baseName}tbxEDUC_INST_POSTAL_CD` },
              fallbackSelectors: [{ type: 'id', value: `${baseId}tbxEDUC_INST_POSTAL_CD` }],
              fieldType: 'text',

            });
          }

          block.push({
            dbPath: `previousEducations.${idx}.institutionCountry`,
            selector: { type: 'name', value: `${baseName}ddlSchoolCountry` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}ddlSchoolCountry` }],
            fieldType: 'select',

          });
          block.push({
            dbPath: `previousEducations.${idx}.courseOfStudy`,
            selector: { type: 'name', value: `${baseName}tbxSchoolCourseOfStudy` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbxSchoolCourseOfStudy` }],
            fieldType: 'text',

          });
          block.push({
            dbPath: `previousEducations.${idx}.attendanceStart.day`,
            selector: { type: 'name', value: `${baseName}ddlSchoolFromDay` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}ddlSchoolFromDay` }],
            fieldType: 'select',
            action: 'wait',

          });
          block.push({
            dbPath: `previousEducations.${idx}.attendanceStart.month`,
            selector: { type: 'name', value: `${baseName}ddlSchoolFromMonth` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}ddlSchoolFromMonth` }],
            fieldType: 'select',
            action: 'wait',

          });
          block.push({
            dbPath: `previousEducations.${idx}.attendanceStart.year`,
            selector: { type: 'name', value: `${baseName}tbxSchoolFromYear` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbxSchoolFromYear` }],
            fieldType: 'text',

          });
          block.push({
            dbPath: `previousEducations.${idx}.attendanceEnd.day`,
            selector: { type: 'name', value: `${baseName}ddlSchoolToDay` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}ddlSchoolToDay` }],
            fieldType: 'select',

          });
          block.push({
            dbPath: `previousEducations.${idx}.attendanceEnd.month`,
            selector: { type: 'name', value: `${baseName}ddlSchoolToMonth` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}ddlSchoolToMonth` }],
            fieldType: 'select',

          });
          block.push({
            dbPath: `previousEducations.${idx}.attendanceEnd.year`,
            selector: { type: 'name', value: `${baseName}tbxSchoolToYear` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbxSchoolToYear` }],
            fieldType: 'text',

          });


          return block;
        }));
      }
      return dynamic;
    })(),
    workEducationAdditional: (() => {
      if (!clientData['workEducationAdditional'] || clientData['workEducationAdditional'].length === 0) {
        return [];
      }
      const arr = clientData['workEducationAdditional']['languages'] || [];

      let dynamic = arr.flatMap((entry, idx) => {
        const baseName = `ctl00$SiteContentPlaceHolder$FormView1$dtlLANGUAGES$ctl0${idx}$`;
        const baseId = baseName.replace(/\$/g, '_');
        const block = [];
        if (idx > 0) block.push({
          dbPath: `languages.${idx}.languageName`,
          selector: { type: 'name', value: `${baseName}tbxLANGUAGE_NAME` },
          fallbackSelectors: [{ type: 'id', value: `${baseId}tbxLANGUAGE_NAME` }],
          fieldType: 'text', action: 'addAnotherRow'
        });
        block.push({
          dbPath: `languages.${idx}.languageName`,
          selector: { type: 'name', value: `${baseName}tbxLANGUAGE_NAME` },
          fallbackSelectors: [{ type: 'id', value: `${baseId}tbxLANGUAGE_NAME` }],
          fieldType: 'text',

        });
        return block;
      });
      dynamic.push({
        dbPath: 'clanTribeInd',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblCLAN_TRIBE_IND' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblCLAN_TRIBE_IND_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblCLAN_TRIBE_IND_1' }
        ],
        fieldType: 'radio',
        valueMap: { 'Y': '0', 'N': '1' }
      });
      if (clientData.workEducationAdditional.clanTribeInd === 'Y') {
        dynamic.push({
          dbPath: 'clanTribeName',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxCLAN_TRIBE_NAME' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxCLAN_TRIBE_NAME' },
          ],
          fieldType: 'text',
        });
      }
      dynamic.push({
        dbPath: 'countriesVisitedInd',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblCOUNTRIES_VISITED_IND' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblCOUNTRIES_VISITED_IND_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblCOUNTRIES_VISITED_IND_1' }
        ],
        fieldType: 'radio',
        valueMap: { 'Y': '0', 'N': '1' }
      });
      if (clientData.workEducationAdditional.countriesVisitedInd === 'Y') {
        const arr = clientData.workEducationAdditional.countriesVisited || [];
        dynamic.push(...arr.flatMap((entry, idx) => {
          const baseName = `ctl00$SiteContentPlaceHolder$FormView1$dtlCountriesVisited$ctl0${idx}$`;
          const baseId = baseName.replace(/\$/g, '_');
          const block = [];
          if (idx > 0) {
            const baseName = `ctl00$SiteContentPlaceHolder$FormView1$dtlCountriesVisited$ctl0${idx - 1}$`;
            const baseId = baseName.replace(/\$/g, '_');
            block.push({
              dbPath: `countriesVisited.${idx - 1}.country`,
              selector: { type: 'name', value: `${baseName}ddlCOUNTRIES_VISITED` },
              fallbackSelectors: [{ type: 'id', value: `${baseId}ddlCOUNTRIES_VISITED` }],
              fieldType: 'select',
              action: 'addAnotherRow',
              id: idx - 1
            });
          }
          block.push({
            dbPath: `countriesVisited.${idx}.country`,
            selector: { type: 'name', value: `${baseName}ddlCOUNTRIES_VISITED` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}ddlCOUNTRIES_VISITED` }],
            fieldType: 'select',

          });
          return block;
        }));
      }
      dynamic.push({
        dbPath: 'organizationInd',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblORGANIZATION_IND' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblORGANIZATION_IND_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblORGANIZATION_IND_1' }
        ],
        fieldType: 'radio',
        valueMap: { 'Y': '0', 'N': '1' }
      });
      if (clientData.workEducationAdditional.organizationInd === 'Y') {
        const arr = clientData.workEducationAdditional.organizations || [];
        dynamic.push(...arr.flatMap((entry, idx) => {
          const baseName = `ctl00$SiteContentPlaceHolder$FormView1$dtlORGANIZATIONS$ctl0${idx}$`;
          const baseId = baseName.replace(/\$/g, '_');
          const block = [];
          if (idx > 0) {
            const baseName = `ctl00$SiteContentPlaceHolder$FormView1$dtlORGANIZATIONS$ctl0${idx - 1}$`;
            const baseId = baseName.replace(/\$/g, '_');
            block.push({
              dbPath: `organizations.${idx - 1}.organizationName`,
              selector: { type: 'name', value: `${baseName}tbxORGANIZATION_NAME` },
              fallbackSelectors: [{ type: 'id', value: `${baseId}tbxORGANIZATION_NAME` }],
              fieldType: 'text',
              action: 'addAnotherRow',
              id: idx - 1
            });
          }
          block.push({
            dbPath: `organizations.${idx}.organizationName`,
            selector: { type: 'name', value: `${baseName}tbxORGANIZATION_NAME` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbxORGANIZATION_NAME` }],
            fieldType: 'text',

          });
          return block;
        }));
      }
      dynamic.push({
        dbPath: 'specializedSkillsInd',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblSPECIALIZED_SKILLS_IND' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblSPECIALIZED_SKILLS_IND_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblSPECIALIZED_SKILLS_IND_1' }
        ],
        fieldType: 'radio',
        valueMap: { 'Y': '0', 'N': '1' }
      });
      if (clientData.workEducationAdditional.specializedSkillsInd === 'Y') {

        dynamic.push({
          dbPath: `specializedSkillsExpl`,
          selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbxSPECIALIZED_SKILLS_EXPL` },
          fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbxSPECIALIZED_SKILLS_EXPL` }],
          fieldType: 'text',

        });
      }

      dynamic.push({
        dbPath: 'militaryServiceInd',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblMILITARY_SERVICE_IND' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblMILITARY_SERVICE_IND_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblMILITARY_SERVICE_IND_1' }
        ],
        fieldType: 'radio',
        valueMap: { 'Y': '0', 'N': '1' }
      });
      if (clientData.workEducationAdditional.militaryServiceInd === 'Y') {
        const arr = clientData.workEducationAdditional.militaryService || [];
        dynamic.push(...arr.flatMap((entry, idx) => {
          const baseName = `ctl00$SiteContentPlaceHolder$FormView1$dtlMILITARY_SERVICE$ctl0${idx}$`;
          const baseId = baseName.replace(/\$/g, '_');
          const block = [];
          if (idx > 0) {
            const baseName = `ctl00$SiteContentPlaceHolder$FormView1$dtlMILITARY_SERVICE$ctl0${idx - 1}$`;
            const baseId = baseName.replace(/\$/g, '_');
            block.push({
              dbPath: `militaryService.${idx - 1}.country`,
              selector: { type: 'name', value: `${baseName}ddlMILITARY_SVC_CNTRY` },
              fallbackSelectors: [{ type: 'id', value: `${baseId}ddlMILITARY_SVC_CNTRY` }],
              fieldType: 'select',
              action: 'addAnotherRow',
              id: idx - 1
            });
          }
          block.push({
            dbPath: `militaryService.${idx}.country`,
            selector: { type: 'name', value: `${baseName}ddlMILITARY_SVC_CNTRY` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}ddlMILITARY_SVC_CNTRY` }],
            fieldType: 'select',
            action: 'wait'

          });
          block.push({
            dbPath: `militaryService.${idx}.serviceBranch`,
            selector: { type: 'name', value: `${baseName}tbxMILITARY_SVC_BRANCH` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbxMILITARY_SVC_BRANCH` }],
            fieldType: 'text',
            action: 'wait'
          });
          block.push({
            dbPath: `militaryService.${idx}.rank`,
            selector: { type: 'name', value: `${baseName}tbxMILITARY_SVC_RANK` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbxMILITARY_SVC_RANK` }],
            fieldType: 'text',

          });
          block.push({
            dbPath: `militaryService.${idx}.specialty`,
            selector: { type: 'name', value: `${baseName}tbxMILITARY_SVC_SPECIALTY` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbxMILITARY_SVC_SPECIALTY` }],
            fieldType: 'text',

          });

          block.push({
            dbPath: `militaryService.${idx}.serviceFrom.day`,
            selector: { type: 'name', value: `${baseName}ddlMILITARY_SVC_FROMDay` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}ddlMILITARY_SVC_FROMDay` }],
            fieldType: 'select',

          });
          block.push({
            dbPath: `militaryService.${idx}.serviceFrom.month`,
            selector: { type: 'name', value: `${baseName}ddlMILITARY_SVC_FROMMonth` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}ddlMILITARY_SVC_FROMMonth` }],
            fieldType: 'select',

          });
          block.push({
            dbPath: `militaryService.${idx}.serviceFrom.year`,
            selector: { type: 'name', value: `${baseName}tbxMILITARY_SVC_FROMYear` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbxMILITARY_SVC_FROMYear` }],
            fieldType: 'text',

          });
          block.push({
            dbPath: `militaryService.${idx}.serviceTo.day`,
            selector: { type: 'name', value: `${baseName}ddlMILITARY_SVC_TODay` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}ddlMILITARY_SVC_TODay` }],
            fieldType: 'select',

          });
          block.push({
            dbPath: `militaryService.${idx}.serviceTo.month`,
            selector: { type: 'name', value: `${baseName}ddlMILITARY_SVC_TOMonth` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}ddlMILITARY_SVC_TOMonth` }],
            fieldType: 'select',

          });
          block.push({
            dbPath: `militaryService.${idx}.serviceTo.year`,
            selector: { type: 'name', value: `${baseName}tbxMILITARY_SVC_TOYear` },
            fallbackSelectors: [{ type: 'id', value: `${baseId}tbxMILITARY_SVC_TOYear` }],
            fieldType: 'text',

          });
          return block;
        }));
      }


      dynamic.push({
        dbPath: 'insurgentOrgInd',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblINSURGENT_ORG_IND' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblINSURGENT_ORG_IND_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblINSURGENT_ORG_IND_1' }
        ],
        fieldType: 'radio',
        valueMap: { 'Y': '0', 'N': '1' }
      });
      if (clientData.workEducationAdditional.insurgentOrgInd === 'Y') {

        dynamic.push({
          dbPath: `insurgentOrgExpl`,
          selector: { type: 'name', value: `ctl00$SiteContentPlaceHolder$FormView1$tbxINSURGENT_ORG_EXPL` },
          fallbackSelectors: [{ type: 'id', value: `ctl00_SiteContentPlaceHolder_FormView1_tbxINSURGENT_ORG_EXPL` }],
          fieldType: 'text',

        });
      }
      return dynamic;
    })(),
    // ─── Security & Background: Part 1 ─────────────────────────────────────
    securityBackground: (() => {
      const dynamic = [];
      dynamic.push({
        dbPath: 'hasDisease',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblDisease' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblDisease_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblDisease_1' }
        ],
        fieldType: 'radio', valueMap: { 'Y': '0', 'N': '1' }
      });
      if (clientData.securityBackground.hasDisease === 'Y') {
        dynamic.push({
          dbPath: 'diseaseExplanation',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxDisease' },
          fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxDisease' }],
          fieldType: 'text',
        });
      }

      dynamic.push({
        dbPath: 'hasDisorder',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblDisorder' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblDisorder_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblDisorder_1' }
        ],
        fieldType: 'radio', valueMap: { 'Y': '0', 'N': '1' }
      });
      if (clientData.securityBackground.hasDisorder === 'Y') {
        dynamic.push({
          dbPath: 'disorderExplanation',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxDisorder' },
          fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxDisorder' }],
          fieldType: 'text',
        });
      }
      dynamic.push({
        dbPath: 'isDrugUser',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblDruguser' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblDruguser_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblDruguser_1' }
        ],
        fieldType: 'radio', valueMap: { 'Y': '0', 'N': '1' }
      });
      if (clientData.securityBackground.isDrugUser === 'Y') {
        dynamic.push({
          dbPath: 'drugUserExplanation',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxDruguser' },
          fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxDruguser' }],
          fieldType: 'text',
        });
      }
      return dynamic;
    })(),
    // ─── Security & Background: Part 2 ─────────────────────────────────────
    securityBackground2: (() => {
      const dynamic = [];
      dynamic.push(
        {
          dbPath: 'hasArrest',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblArrested' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblArrested_0' },
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblArrested_1' }
          ],
          fieldType: 'radio', valueMap: { 'Y': '0', 'N': '1' }
        });
      if (clientData.securityBackground2.hasArrest === 'Y') {
        dynamic.push({
          dbPath: 'arrestExplanation',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxArrested' },
          fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxArrested' }],
          fieldType: 'text',
        });
      }
      dynamic.push({
        dbPath: 'hasControlledSubstances',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblControlledSubstances' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblControlledSubstances_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblControlledSubstances_1' }
        ],
        fieldType: 'radio', valueMap: { 'Y': '0', 'N': '1' }
      });
      if (clientData.securityBackground2.hasControlledSubstances === 'Y') {
        dynamic.push({
          dbPath: 'controlledSubstancesExplanation',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxControlledSubstances' },
          fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxControlledSubstances' }],
          fieldType: 'text',
        });
      }
      dynamic.push({
        dbPath: 'hasProstitution',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblProstitution' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblProstitution_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblProstitution_1' }
        ],
        fieldType: 'radio', valueMap: { 'Y': '0', 'N': '1' }
      });
      if (clientData.securityBackground2.hasProstitution === 'Y') {
        dynamic.push({
          dbPath: 'prostitutionExplanation',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxProstitution' },
          fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxProstitution' }],
          fieldType: 'text',
        });
      }
      dynamic.push({
        dbPath: 'hasMoneyLaundering',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblMoneyLaundering' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblMoneyLaundering_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblMoneyLaundering_1' }
        ],
        fieldType: 'radio', valueMap: { 'Y': '0', 'N': '1' }
      });
      if (clientData.securityBackground2.hasMoneyLaundering === 'Y') {
        dynamic.push({
          dbPath: 'moneyLaunderingExplanation',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxMoneyLaundering' },
          fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxMoneyLaundering' }],
          fieldType: 'text',
        });
      }
      dynamic.push({
        dbPath: 'hasHumanTrafficking',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblHumanTrafficking' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblHumanTrafficking_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblHumanTrafficking_1' }
        ],
        fieldType: 'radio', valueMap: { 'Y': '0', 'N': '1' }
      });
      if (clientData.securityBackground2.hasHumanTrafficking === 'Y') {
        dynamic.push({
          dbPath: 'humanTraffickingExplanation',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxHumanTrafficking' },
          fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxHumanTrafficking' }],
          fieldType: 'text',
        });
      }
      dynamic.push({
        dbPath: 'hasAssistedTrafficking',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblAssistedSevereTrafficking' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblAssistedSevereTrafficking_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblAssistedSevereTrafficking_1' }
        ],
        fieldType: 'radio', valueMap: { 'Y': '0', 'N': '1' }
      });
      if (clientData.securityBackground2.hasAssistedTrafficking === 'Y') {
        dynamic.push({
          dbPath: 'assistedTraffickingExplanation',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxAssistedSevereTrafficking' },
          fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxAssistedSevereTrafficking' }],
          fieldType: 'text',
        });
      }
      dynamic.push({
        dbPath: 'hasTraffickingRelated',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblHumanTraffickingRelated' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblHumanTraffickingRelated_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblHumanTraffickingRelated_1' }
        ],
        fieldType: 'radio', valueMap: { 'Y': '0', 'N': '1' }
      });
      if (clientData.securityBackground2.hasTraffickingRelated === 'Y') {
        dynamic.push({
          dbPath: 'traffickingRelatedExplanation',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxHumanTraffickingRelated' },
          fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxHumanTraffickingRelated' }],
          fieldType: 'text',
        });
      }
      return dynamic;
    })(),
    // ─── Security & Background: Part 3 ─────────────────────────────────────
    securityBackground3: (() => {
      const dynamic = [];
      dynamic.push({
        dbPath: 'hasIllegalActivity',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblIllegalActivity' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblIllegalActivity_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblIllegalActivity_1' }
        ],
        fieldType: 'radio', valueMap: { 'Y': '0', 'N': '1' }
      });
      if (clientData.securityBackground3.hasIllegalActivity === 'Y') {
        dynamic.push({
          dbPath: 'illegalActivityExplanation',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxIllegalActivity' },
          fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxIllegalActivity' }],
          fieldType: 'text',
        });
      }
      dynamic.push({
        dbPath: 'hasTerroristActivity',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblTerroristActivity' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblTerroristActivity_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblTerroristActivity_1' }
        ],
        fieldType: 'radio', valueMap: { 'Y': '0', 'N': '1' }
      });
      if (clientData.securityBackground3.hasTerroristActivity === 'Y') {
        dynamic.push({
          dbPath: 'terroristActivityExplanation',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxTerroristActivity' },
          fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxTerroristActivity' }],
          fieldType: 'text',
        });
      }
      dynamic.push({
        dbPath: 'hasTerroristSupport',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblTerroristSupport' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblTerroristSupport_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblTerroristSupport_1' }
        ],
        fieldType: 'radio', valueMap: { 'Y': '0', 'N': '1' }
      });
      if (clientData.securityBackground3.hasTerroristSupport === 'Y') {
        dynamic.push({
          dbPath: 'terroristSupportExplanation',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxTerroristSupport' },
          fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxTerroristSupport' }],
          fieldType: 'text',
        });
      }
      dynamic.push({
        dbPath: 'hasTerroristOrg',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblTerroristOrg' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblTerroristOrg_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblTerroristOrg_1' }
        ],
        fieldType: 'radio', valueMap: { 'Y': '0', 'N': '1' }
      });
      if (clientData.securityBackground3.hasTerroristOrg === 'Y') {
        dynamic.push({
          dbPath: 'terroristOrgExplanation',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxTerroristOrg' },
          fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxTerroristOrg' }],
          fieldType: 'text',
        });
      }
      dynamic.push({
        dbPath: 'hasTerroristRel',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblTerroristRel' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblTerroristRel_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblTerroristRel_1' }
        ],
        fieldType: 'radio', valueMap: { 'Y': '0', 'N': '1' }
      });
      if (clientData.securityBackground3.hasTerroristRel === 'Y') {
        dynamic.push({
          dbPath: 'terroristRelExplanation',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxTerroristRel' },
          fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxTerroristRel' }],
          fieldType: 'text',
        });
      }
      dynamic.push({
        dbPath: 'hasGenocide',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblGenocide' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblGenocide_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblGenocide_1' }
        ],
        fieldType: 'radio', valueMap: { 'Y': '0', 'N': '1' }
      });
      if (clientData.securityBackground3.hasGenocide === 'Y') {
        dynamic.push({
          dbPath: 'genocideExplanation',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxGenocide' },
          fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxGenocide' }],
          fieldType: 'text',
        });
      }
      dynamic.push({
        dbPath: 'hasTorture',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblTorture' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblTorture_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblTorture_1' }
        ],
        fieldType: 'radio', valueMap: { 'Y': '0', 'N': '1' }
      });
      if (clientData.securityBackground3.hasTorture === 'Y') {
        dynamic.push({
          dbPath: 'tortureExplanation',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxTorture' },
          fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxTorture' }],
          fieldType: 'text',
        });
      }
      dynamic.push({
        dbPath: 'hasExViolence',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblExViolence' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblExViolence_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblExViolence_1' }
        ],
        fieldType: 'radio', valueMap: { 'Y': '0', 'N': '1' }
      });
      if (clientData.securityBackground3.hasExViolence === 'Y') {
        dynamic.push({
          dbPath: 'exViolenceExplanation',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxExViolence' },
          fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxExViolence' }],
          fieldType: 'text',
        });
      }
      dynamic.push({
        dbPath: 'hasChildSoldier',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblChildSoldier' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblChildSoldier_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblChildSoldier_1' }
        ],
        fieldType: 'radio', valueMap: { 'Y': '0', 'N': '1' }
      });
      if (clientData.securityBackground3.hasChildSoldier === 'Y') {
        dynamic.push({
          dbPath: 'childSoldierExplanation',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxChildSoldier' },
          fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxChildSoldier' }],
          fieldType: 'text',
        });
      }
      dynamic.push({
        dbPath: 'hasReligiousFreedom',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblReligiousFreedom' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblReligiousFreedom_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblReligiousFreedom_1' }
        ],
        fieldType: 'radio', valueMap: { 'Y': '0', 'N': '1' }
      });
      if (clientData.securityBackground3.hasReligiousFreedom === 'Y') {
        dynamic.push({
          dbPath: 'religiousFreedomExplanation',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxReligiousFreedom' },
          fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxReligiousFreedom' }],
          fieldType: 'text',
        });
      }
      dynamic.push({
        dbPath: 'hasPopulationControls',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblPopulationControls' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblPopulationControls_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblPopulationControls_1' }
        ],
        fieldType: 'radio', valueMap: { 'Y': '0', 'N': '1' }
      });
      if (clientData.securityBackground3.hasPopulationControls === 'Y') {
        dynamic.push({
          dbPath: 'populationControlsExplanation',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxPopulationControls' },
          fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxPopulationControls' }],
          fieldType: 'text',
        });
      }
      dynamic.push({
        dbPath: 'hasTransplant',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblTransplant' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblTransplant_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblTransplant_1' }
        ],
        fieldType: 'radio', valueMap: { 'Y': '0', 'N': '1' }
      });
      if (clientData.securityBackground3.hasTransplant === 'Y') {
        dynamic.push({
          dbPath: 'transplantExplanation',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxTransplant' },
          fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxTransplant' }],
          fieldType: 'text',
        });
      }
      return dynamic;
    })(),
    // ─── Security & Background: Part 4 ─────────────────────────────────────
    securityBackground4: (() => {
      const dynamic = [];
      dynamic.push(
        {
          dbPath: 'hasImmigrationFraud',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblImmigrationFraud' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblImmigrationFraud_0' },
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblImmigrationFraud_1' }
          ],
          fieldType: 'radio', valueMap: { 'Y': '0', 'N': '1' }
        })
      if (clientData.securityBackground4.hasImmigrationFraud === 'Y') {
        dynamic.push({
          dbPath: 'immigrationFraudExplanation',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxImmigrationFraud' },
          fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxImmigrationFraud' }],
          fieldType: 'text',
        });
      }
      dynamic.push({
        dbPath: 'hasDeportation',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblDeport' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblDeport_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblDeport_1' }
        ],
        fieldType: 'radio',
        valueMap: { 'Y': '0', 'N': '1' },
        action: 'wait'
      });
      if (clientData.securityBackground4.hasDeportation === 'Y') {
        dynamic.push({
          dbPath: 'deportationExplanation',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxDeport_EXPL' },
          fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxDeport_EXPL' }],
          fieldType: 'text',
          action: 'wait'
        });
      }
      return dynamic;
    })(),
    // ─── Security & Background: Part 5 ─────────────────────────────────────
    securityBackground5: (() => {
      const dynamic = [];
      dynamic.push(
        {
          dbPath: 'hasChildCustody',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblChildCustody' },
          fallbackSelectors: [
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblChildCustody_0' },
            { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblChildCustody_1' }
          ],
          fieldType: 'radio', valueMap: { 'Y': '0', 'N': '1' }
        })
      if (clientData.securityBackground5.hasChildCustody === 'Y') {
        dynamic.push({
          dbPath: 'childCustodyExplanation',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxChildCustody' },
          fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxChildCustody' }],
          fieldType: 'text',
        });
      }
      dynamic.push({
        dbPath: 'hasVotingViolation',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblVotingViolation' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblVotingViolation_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblVotingViolation_1' }
        ],
        fieldType: 'radio', valueMap: { 'Y': '0', 'N': '1' }
      })
      if (clientData.securityBackground5.hasVotingViolation === 'Y') {
        dynamic.push({
          dbPath: 'votingViolationExplanation',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxVotingViolation' },
          fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxVotingViolation' }],
          fieldType: 'text',
        });
      }
      dynamic.push({
        dbPath: 'hasRenounced',
        selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$rblRenounceExp' },
        fallbackSelectors: [
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblRenounceExp_0' },
          { type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_rblRenounceExp_1' }
        ],
        fieldType: 'radio', valueMap: { 'Y': '0', 'N': '1' }
      })
      if (clientData.securityBackground5.hasRenounced === 'Y') {
        dynamic.push({
          dbPath: 'renouncedExplanation',
          selector: { type: 'name', value: 'ctl00$SiteContentPlaceHolder$FormView1$tbxRenounceExp' },
          fallbackSelectors: [{ type: 'id', value: 'ctl00_SiteContentPlaceHolder_FormView1_tbxRenounceExp' }],
          fieldType: 'text',
        });
      }
      return dynamic;
    })(),

  };
  console.log(mappings[section]);
  return mappings[section] || [];
}