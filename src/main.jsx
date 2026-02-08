import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initializeSentry } from './services/sentry.js'
import { CONSTANTS } from './config/constants'
import { initializeBigIntSupport } from './utils/bigintUtils.js'

// EMERGENCY FIX 1: Enhanced BigInt Support
// Comprehensive BigInt handling for DuckDB-WASM compatibility
initializeBigIntSupport();

// REMOVED: Global BigInt prototype patch was interfering with React
// Use safeJSONStringify() instead for BigInt handling

// EMERGENCY FIX 2: Initial State Sanity
// Clears potential corrupted state from previous sessions that might cause white screen
try {
  const settings = localStorage.getItem(CONSTANTS.STORAGE_KEYS.SETTINGS);
  if (settings && settings.includes('n"')) { // Detection of BigInt literal in string (rare but fatal)
    console.warn('Corrupted settings detected. Clearing local storage.');
    localStorage.removeItem(CONSTANTS.STORAGE_KEYS.SETTINGS);
  }
} catch (e) {
  console.error('State sanity check failed:', e);
}

// Initialize error tracking
// initializeSentry();

try {
  console.log("Attempting to mount React app...");
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  console.log("React app mounted successfully");
} catch (e) {
  console.error("CRITICAL: React mount failed:", e);
  document.body.innerHTML = `<div style="color:red; padding:20px;"><h1>App Crash</h1><pre>${e.stack}</pre></div>`;
}
