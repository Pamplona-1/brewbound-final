const SPREADSHEET_ID = '16oBhwwDdGxsEfuDcAvoVma1KV34dN6-ZzQaGEileV1U';
const SHEET_NAME = 'CoffeeShops';
const REQUIRED_HEADERS = [
  'id', 'name', 'barangayId', 'barangayName', 'address', 'landmark', 'priceRange',
  'operatingHoursText', 'daysOpen', 'bannerImage', 'galleryImage1', 'galleryImage2',
  'panorama360Url', 'description', 'minPrice', 'maxPrice', 'openingTime', 'closingTime',
  'lat', 'lng', 'latitude', 'longitude', 'airconAvailable', 'socketAvailable', 'wifiAvailable',
  'rating', 'reviewCount', 'verified', 'navigationCount', 'phone', 'socials',
  'amenities', 'menu', 'reviews', 'recordVersion',
];
const HIDDEN_HEADERS = [
  'description', 'minPrice', 'maxPrice', 'openingTime', 'closingTime', 'lat', 'lng',
  'rating', 'reviewCount', 'verified', 'navigationCount', 'phone', 'socials',
  'reviews', 'recordVersion',
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('BrewBound')
    .addItem('Clean Sheet Layout', 'cleanupSheetLayout')
    .addItem('Hide Unneeded Columns', 'hideUnneededColumns')
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
  applyHiddenColumns(sheet);
}

function hideUnneededColumns() {
  applyHiddenColumns(getOrCreateSheet());
}

function applyHiddenColumns(sheet) {
  const headers = sheet.getRange(1, 1, 1, REQUIRED_HEADERS.length).getValues()[0].map(String);
  HIDDEN_HEADERS.forEach(function(header) {
    const index = headers.indexOf(header);
    if (index !== -1) sheet.hideColumns(index + 1);
  });

  const extraColumnsStart = REQUIRED_HEADERS.length + 1;
  const extraColumnsCount = Math.min(5, sheet.getMaxColumns() - REQUIRED_HEADERS.length);
  if (extraColumnsCount > 0) {
    sheet.hideColumns(extraColumnsStart, extraColumnsCount);
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
    } else if (action === 'incrementNavigation' && payload.id) {
      var shopFound = false;
      updatedShops = shops.map(function(shop) {
        if (shop.id !== payload.id) return shop;
        shopFound = true;
        return Object.assign({}, shop, {
          navigationCount: Number(shop.navigationCount) + 1 || 1,
        });
      });
      if (!shopFound) throw new Error('Coffee shop not found for navigation count update.');
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

  if (headerMatches && REQUIRED_HEADERS.length === existingHeaders.length) {
    const rows = values.slice(1).map(function(row) {
      return fillDerivedColumns(row);
    });
    const hasDerivedColumnUpdates = rows.some(function(row, index) {
      return JSON.stringify(row) !== JSON.stringify(values[index + 1]);
    });
    if (hasDerivedColumnUpdates) {
      sheet.getRange(2, 1, rows.length, REQUIRED_HEADERS.length).setValues(rows);
    }
    applyHiddenColumns(sheet);
    return sheet;
  }

  const rows = remapRowsToRequiredHeaders(values).map(function(row) {
    return fillDerivedColumns(row);
  });

  sheet.clearContents();
  sheet.getRange(1, 1, 1, REQUIRED_HEADERS.length).setValues([REQUIRED_HEADERS]);
  if (rows.length > 0) sheet.getRange(2, 1, rows.length, REQUIRED_HEADERS.length).setValues(rows);
  applyHiddenColumns(sheet);
  return sheet;
}

function fillDerivedColumns(row) {
  const result = row.slice();
  const latitudeIndex = REQUIRED_HEADERS.indexOf('latitude');
  const longitudeIndex = REQUIRED_HEADERS.indexOf('longitude');
  const lat = result[REQUIRED_HEADERS.indexOf('lat')];
  const lng = result[REQUIRED_HEADERS.indexOf('lng')];
  if (result[latitudeIndex] === '' && lat !== '') result[latitudeIndex] = lat;
  if (result[longitudeIndex] === '' && lng !== '') result[longitudeIndex] = lng;

  let amenities = {};
  const rawAmenities = result[REQUIRED_HEADERS.indexOf('amenities')];
  if (rawAmenities && typeof rawAmenities === 'string') {
    try {
      amenities = JSON.parse(rawAmenities);
    } catch (error) {
      console.warn('Could not parse shop amenities while filling sheet columns:', error);
    }
  } else if (rawAmenities && typeof rawAmenities === 'object') {
    amenities = rawAmenities;
  }

  const airconIndex = REQUIRED_HEADERS.indexOf('airconAvailable');
  const socketIndex = REQUIRED_HEADERS.indexOf('socketAvailable');
  const wifiIndex = REQUIRED_HEADERS.indexOf('wifiAvailable');
  if (result[airconIndex] === '' && amenities.acAvailable !== undefined) {
    result[airconIndex] = Boolean(amenities.acAvailable);
  }
  if (result[socketIndex] === '' && amenities.outletCount !== undefined) {
    result[socketIndex] = Number(amenities.outletCount) > 0;
  }
  if (result[wifiIndex] === '' && amenities.wifiAvailable !== undefined) {
    result[wifiIndex] = Boolean(amenities.wifiAvailable);
  }
  return result;
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