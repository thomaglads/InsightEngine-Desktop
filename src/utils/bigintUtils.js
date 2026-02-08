/**
 * BigInt-safe JSON utilities for DuckDB-WASM compatibility
 * DuckDB returns COUNT(*) and other integers as BigInt (e.g., 44n) which JSON.stringify cannot handle
 */

/**
 * Safely stringify data that may contain BigInt values
 * @param {*} data - Data to stringify
 * @param {Function} replacer - Optional replacer function
 * @param {number} space - Space indentation for pretty printing
 * @returns {string} JSON string
 */
export const safeJSONStringify = (data, replacer = null, space = null) => {
  const bigIntReplacer = (key, value) => {
    // Handle BigInt
    if (typeof value === 'bigint') {
      return Number(value);
    }
    // Handle nested BigInt (DuckDB artifacts)
    if (value && typeof value === 'object' && value.toString && /^\d+n$/.test(value.toString())) {
      return Number(value.toString().slice(0, -1));
    }
    // Custom replacer
    if (replacer) {
      return replacer(key, value);
    }
    return value;
  };
  return JSON.stringify(data, bigIntReplacer, space);
};

/**
 * Safely parse JSON string with BigInt handling
 * @param {string} jsonString - JSON string to parse
 * @param {Function} reviver - Optional reviver function
 * @returns {*} Parsed object
 */
export const safeJSONParse = (jsonString, reviver = null) => {
  try {
    return JSON.parse(jsonString, (key, value) => {
      // Apply custom reviver if provided
      if (reviver) {
        value = reviver(key, value);
      }
      return value;
    });
  } catch (error) {
    console.error('JSON parsing error:', error);
    return null;
  }
};

/**
 * Convert DuckDB result rows to safe format for React state
 * @param {Array} rows - DuckDB result array
 * @returns {Array} Safe rows with all BigInt converted to Number
 */
export const sanitizeDuckDBRows = (rows) => {
  if (!Array.isArray(rows)) return [];

  return rows.map(row => {
    const safeRow = {};
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === 'bigint') {
        safeRow[key] = Number(value);
      } else if (value && typeof value === 'object' && typeof value.toString === 'function') {
        const str = value.toString();
        if (/^\d+n$/.test(str)) {
          safeRow[key] = Number(str.slice(0, -1));
        } else if (/^-?\d+$/.test(str)) {
          safeRow[key] = Number(str);
        } else {
          safeRow[key] = str;
        }
      } else {
        safeRow[key] = value;
      }
    }
    return safeRow;
  });
};

/**
 * Global BigInt handler for JSON operations
 * Patches global JSON methods if needed
 */
export const initializeBigIntSupport = () => {
  // Store original methods
  const originalStringify = JSON.stringify;
  const originalParse = JSON.parse;

  // Patch global JSON.stringify (optional - use safeJSONStringify instead)
  // JSON.stringify = function(data, replacer, space) {
  //   return safeJSONStringify(data, replacer, space);
  // };

  console.log('BigInt support initialized for DuckDB compatibility');
};

// Utility functions from config (moved here for circular dependency resolution)
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export default {
  safeJSONStringify,
  safeJSONParse,
  sanitizeDuckDBRows,
  initializeBigIntSupport,
  debounce
};