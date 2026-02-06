import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initializeSentry } from './services/sentry.js'
import { CONSTANTS } from './config/constants'

// EMERGENCY FIX 1: Global BigInt Patch
// Prevents "Do not know how to serialize a BigInt" crashes during JSON.stringify
BigInt.prototype.toJSON = function () { return Number(this) };

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
initializeSentry();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
