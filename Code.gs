const SPREADSHEET_ID = '16oBhwwDdGxsEfuDcAvoVma1KV34dN6-ZzQaGEileV1U';
const SHEET_NAME = 'CoffeeShops';
const REQUIRED_HEADERS = [
  'id', 'name', 'barangayId', 'barangayName', 'address', 'landmark', 'priceRange',
  'operatingHoursText', 'daysOpen', 'bannerImage', 'galleryImage1', 'galleryImage2',
  'panorama360Url',
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('BrewBound')
    .addItem('Clean Sheet Layout', 'cleanupSheetLayout')
    .addToUi();
}

function getHeaderIndex(headers, candidates) {
  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    const index = headers.findIndex(function(header) {
      return String(header).trim().toLowerCase() === candidate.toLowerCase();
    });
    if (index !== -1) return index;
  }
  return -1;
}

function remapRowsToRequiredHeaders(values) {
  if (!values || values.length === 0) return [];

  const existingHeaders = values[0].map(String);
  const headerMap = {};

  REQUIRED_HEADERS.forEach(function(header) {
    const aliases = [header, header.replace(/([a-z])([A-Z])/g, '$1 $2')];
    headerMap[header] = getHeaderIndex(existingHeaders, aliases);
  });

  return values.slice(1).filter(function(row) {
    return Array.isArray(row) && row.some(function(value) {
      return value !== '' && value !== null && value !== undefined;
    });
  }).map(function(row) {
    return REQUIRED_HEADERS.map(function(header) {
      const index = headerMap[header];
      if (index === -1) return '';
      return row[index] ?? '';
    });
  });
}

function cleanupSheetLayout() {
  const sheet = getOrCreateSheet();
  const values = sheet.getDataRange().getValues();
  if (!values.length) return;

  const rows = remapRowsToRequiredHeaders(values);

  sheet.clearContents();
  sheet.getRange(1, 1, 1, REQUIRED_HEADERS.length).setValues([REQUIRED_HEADERS]);
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, REQUIRED_HEADERS.length).setValues(rows);
  }

}

function doGet(e) {
  const sheet = getSheet();
  const initialized = isCatalogueInitialized(sheet);
  const result = {
    success: true,
    initialized: initialized,
    shops: initialized ? readShops(sheet) : [],
  };
  const callback = e && e.parameter && e.parameter.callback;

  if (callback && /^[A-Za-z_$][\w$.]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + JSON.stringify(result) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    const shops = readShops(getOrCreateSheet());
    let updatedShops;

    if (action === 'replaceAll') {
      updatedShops = Array.isArray(payload.shops) ? payload.shops : [];
    } else if (action === 'upsert' && payload.shop && payload.shop.id) {
      updatedShops = shops.filter(function(shop) { return shop.id !== payload.shop.id; });
      updatedShops.push(payload.shop);
    } else if (action === 'delete' && payload.id) {
      updatedShops = shops.filter(function(shop) { return shop.id !== payload.id; });
    } else {
      throw new Error('Unsupported action or missing coffee shop ID.');
    }

    writeShops(getOrCreateSheet(), updatedShops);
    PropertiesService.getScriptProperties().setProperty('BREWBOUND_CATALOGUE_INITIALIZED', 'true');
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function isCatalogueInitialized(sheet) {
  const properties = PropertiesService.getScriptProperties();
  if (properties.getProperty('BREWBOUND_CATALOGUE_INITIALIZED') === 'true') return true;

  const initialized = Boolean(sheet && sheet.getLastRow() > 1);
  if (initialized) properties.setProperty('BREWBOUND_CATALOGUE_INITIALIZED', 'true');
  return initialized;
}

function getSheet() {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet ? spreadsheet.getSheetByName(SHEET_NAME) : null;
  return sheet ? ensureSheetSchema(sheet) : null;
}

function getOrCreateSheet() {
  const spreadsheet = getSpreadsheet();

  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
  return ensureSheetSchema(sheet);
}

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function ensureSheetSchema(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, REQUIRED_HEADERS.length).setValues([REQUIRED_HEADERS]);
    return sheet;
  }

  const values = sheet.getDataRange().getValues();
  const existingHeaders = values[0].map(String);
  const headerMatches = REQUIRED_HEADERS.every(function(header, index) {
    return existingHeaders[index] === header;
  });

  if (headerMatches && REQUIRED_HEADERS.length === existingHeaders.length) return sheet;

  const rows = remapRowsToRequiredHeaders(values);

  sheet.clearContents();
  sheet.getRange(1, 1, 1, REQUIRED_HEADERS.length).setValues([REQUIRED_HEADERS]);
  if (rows.length > 0) sheet.getRange(2, 1, rows.length, REQUIRED_HEADERS.length).setValues(rows);
  return sheet;
}

function readShops(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getRange(1, 1, sheet.getLastRow(), REQUIRED_HEADERS.length).getValues();
  const headers = values[0].map(String);
  return values.slice(1).filter(function(row) { return row[headers.indexOf('id')]; }).map(function(row) {
    const shop = {};
    headers.forEach(function(header, index) {
      const value = row[index];
      if ((value === '' || value === null) &&
          ['bannerImage', 'galleryImage1', 'galleryImage2', 'panorama360Url'].indexOf(header) === -1) return;
      shop[header] = value;
    });
    return shop;
  });
}

function writeShops(sheet, shops) {
  sheet.clearContents();
  sheet.getRange(1, 1, 1, REQUIRED_HEADERS.length).setValues([REQUIRED_HEADERS]);
  if (shops.length === 0) return;

  const rows = shops.map(function(shop) {
    return REQUIRED_HEADERS.map(function(header) {
      const value = shop[header];
      if (value === undefined || value === null) return '';
      return value;
    });
  });
  sheet.getRange(2, 1, rows.length, REQUIRED_HEADERS.length).setValues(rows);
}