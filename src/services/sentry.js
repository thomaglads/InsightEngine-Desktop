import * as Sentry from '@sentry/electron';
import { CONFIG } from '../config/constants.js';

/**
 * Initialize Sentry for error tracking and crash reporting
 */
export function initializeSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN || process.env.SENTRY_DSN;
  
  if (!dsn || import.meta.env.DEV) {
    console.log('Sentry disabled in development or no DSN provided');
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE || 'production',
    release: `${CONFIG.APP.NAME}@${CONFIG.APP.VERSION}`,
    
    // Performance monitoring
    tracesSampleRate: 0.1, // 10% of transactions
    
    // Error sampling
    sampleRate: 1.0,
    
    // Enable debug mode in development
    debug: import.meta.env.DEV,
    
    // Before sending, filter out sensitive data
    beforeSend(event) {
      // Filter out PII
      if (event.request && event.request.data) {
        delete event.request.data;
      }
      
      // Filter out file paths that might contain usernames
      if (event.exception && event.exception.values) {
        event.exception.values.forEach(value => {
          if (value.stacktrace && value.stacktrace.frames) {
            value.stacktrace.frames.forEach(frame => {
              if (frame.filename) {
                // Remove user-specific paths
                frame.filename = frame.filename.replace(/\/Users\/[^/]+/g, '/Users/<user>');
                frame.filename = frame.filename.replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\<user>');
              }
            });
          }
        });
      }
      
      return event;
    },
    
    // Ignore common non-actionable errors
    ignoreErrors: [
      // Network errors
      'Network Error',
      'Failed to fetch',
      'Network request failed',
      
      // Chrome extension errors
      'chrome-extension',
      'extension',
      
      // ResizeObserver loop limit exceeded (benign)
      'ResizeObserver loop limit exceeded',
      
      // DuckDB WASM loading errors
      'WebAssembly',
      
      // Common aborted requests
      'The user aborted a request',
      'AbortError'
    ],
    
    // Deny URLs that are not your own
    denyUrls: [
      // Chrome extensions
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,
      
      // External scripts
      /^(https?:)?\/\/localhost/i,
    ]
  });

  console.log('Sentry initialized for error tracking');
}

/**
 * Manually capture an exception
 */
export function captureException(error, context = {}) {
  Sentry.captureException(error, {
    extra: context
  });
}

/**
 * Capture a message
 */
export function captureMessage(message, level = 'info') {
  Sentry.captureMessage(message, level);
}

/**
 * Set user context
 */
export function setUser(user) {
  Sentry.setUser(user);
}

/**
 * Clear user context
 */
export function clearUser() {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(message, category = 'info', data = {}) {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info'
  });
}