/**
 * Application State Reducer for Performance Optimization
 * Replaces 20+ useState hooks with centralized state management
 * Prevents cascading re-renders and improves performance
 */

// Action Types
export const ACTIONS = {
  // Database & Connection
  SET_DB: 'SET_DB',
  SET_CONN: 'SET_CONN',
  SET_SQL_GENERATOR: 'SET_SQL_GENERATOR',
  SET_DISCOVERY_SERVICE: 'SET_DISCOVERY_SERVICE',
  SET_CONVERSATION_MEMORY: 'SET_CONVERSATION_MEMORY',
  
  // Schema & Data
  SET_SCHEMA: 'SET_SCHEMA',
  SET_DB_SCHEMA: 'SET_DB_SCHEMA',
  SET_CHAT_HISTORY: 'SET_CHAT_HISTORY',
  
  // UI State
  SET_LOADING: 'SET_LOADING',
  SET_AWAITING_CLARIFICATION: 'SET_AWAITING_CLARIFICATION',
  SET_CLARIFICATION_OPTIONS: 'SET_CLARIFICATION_OPTIONS',
  SET_PENDING_QUERY: 'SET_PENDING_QUERY',
  
  // User Input
  SET_INPUT: 'SET_INPUT',
  SET_MESSAGES: 'SET_MESSAGES',
  ADD_MESSAGE: 'ADD_MESSAGE',
  SET_SUGGESTIONS: 'SET_SUGGESTIONS',
  
  // Chart & Visualization
  SET_CHART_DATA: 'SET_CHART_DATA',
  SET_CURRENT_FILE: 'SET_CURRENT_FILE',
  
  // Reports
  SET_SHOW_REPORT: 'SET_SHOW_REPORT',
  SET_REPORT_DATA: 'SET_REPORT_DATA',
  SET_GENERATING_REPORT: 'SET_GENERATING_REPORT',
  
  // UI Preferences
  SET_HIGH_CONTRAST: 'SET_HIGH_CONTRAST',
  SET_SIDEBAR_WIDTH: 'SET_SIDEBAR_WIDTH',
  SET_RESIZING: 'SET_RESIZING',
  
  // Python Engine
  SET_PREDICTION_RESULT: 'SET_PREDICTION_RESULT',
  SET_PYTHON_READY: 'SET_PYTHON_READY'
};

// Initial State
export const initialState = {
  // Database & Connection
  db: null,
  conn: null,
  sqlGenerator: null,
  discoveryService: null,
  conversationMemory: null,
  
  // Schema & Data
  schema: null,
  dbSchema: [],
  chatHistory: [],
  
  // UI State
  loading: false,
  awaitingClarification: false,
  clarificationOptions: [],
  pendingQuery: null,
  
  // User Input
  input: '',
  messages: [],
  suggestions: [],
  
  // Chart & Visualization
  chartData: null,
  currentFile: null,
  
  // Reports
  showReport: false,
  reportData: null,
  isGeneratingReport: false,
  
  // UI Preferences
  highContrast: false,
  sidebarWidth: 400,
  isResizing: false,
  
  // Python Engine
  predictionResult: null,
  isPythonReady: false
};

/**
 * Main Application Reducer
 * @param {Object} state - Current state
 * @param {Object} action - Action to dispatch
 * @returns {Object} New state
 */
export const appReducer = (state, action) => {
  switch (action.type) {
    // Database & Connection
    case ACTIONS.SET_DB:
      return { ...state, db: action.payload };
    case ACTIONS.SET_CONN:
      return { ...state, conn: action.payload };
    case ACTIONS.SET_SQL_GENERATOR:
      return { ...state, sqlGenerator: action.payload };
    case ACTIONS.SET_DISCOVERY_SERVICE:
      return { ...state, discoveryService: action.payload };
    case ACTIONS.SET_CONVERSATION_MEMORY:
      return { ...state, conversationMemory: action.payload };
    
    // Schema & Data
    case ACTIONS.SET_SCHEMA:
      return { ...state, schema: action.payload };
    case ACTIONS.SET_DB_SCHEMA:
      return { ...state, dbSchema: action.payload };
    case ACTIONS.SET_CHAT_HISTORY:
      return { ...state, chatHistory: action.payload };
    
    // UI State
    case ACTIONS.SET_LOADING:
      return { ...state, loading: action.payload };
    case ACTIONS.SET_AWAITING_CLARIFICATION:
      return { ...state, awaitingClarification: action.payload };
    case ACTIONS.SET_CLARIFICATION_OPTIONS:
      return { ...state, clarificationOptions: action.payload };
    case ACTIONS.SET_PENDING_QUERY:
      return { ...state, pendingQuery: action.payload };
    
    // User Input (optimized)
    case ACTIONS.SET_INPUT:
      return { ...state, input: action.payload };
    case ACTIONS.ADD_MESSAGE:
      return { ...state, messages: [...state.messages, action.payload] };
    case ACTIONS.SET_MESSAGES:
      return { ...state, messages: action.payload };
    case ACTIONS.SET_SUGGESTIONS:
      return { ...state, suggestions: action.payload };
    
    // Chart & Visualization
    case ACTIONS.SET_CHART_DATA:
      return { ...state, chartData: action.payload };
    case ACTIONS.SET_CURRENT_FILE:
      return { ...state, currentFile: action.payload };
    
    // Reports
    case ACTIONS.SET_SHOW_REPORT:
      return { ...state, showReport: action.payload };
    case ACTIONS.SET_REPORT_DATA:
      return { ...state, reportData: action.payload };
    case ACTIONS.SET_GENERATING_REPORT:
      return { ...state, isGeneratingReport: action.payload };
    
    // UI Preferences
    case ACTIONS.SET_HIGH_CONTRAST:
      return { ...state, highContrast: action.payload };
    case ACTIONS.SET_SIDEBAR_WIDTH:
      return { ...state, sidebarWidth: action.payload };
    case ACTIONS.SET_RESIZING:
      return { ...state, isResizing: action.payload };
    
    // Python Engine
    case ACTIONS.SET_PREDICTION_RESULT:
      return { ...state, predictionResult: action.payload };
    case ACTIONS.SET_PYTHON_READY:
      return { ...state, isPythonReady: action.payload };
    
    default:
      console.warn('Unknown action type:', action.type);
      return state;
  }
};

/**
 * Action Creators for common operations
 * These provide typed, consistent action creation
 */
export const actions = {
  // Database
  setDb: (db) => ({ type: ACTIONS.SET_DB, payload: db }),
  setConn: (conn) => ({ type: ACTIONS.SET_CONN, payload: conn }),
  
  // Data
  setSchema: (schema) => ({ type: ACTIONS.SET_SCHEMA, payload: schema }),
  setDbSchema: (dbSchema) => ({ type: ACTIONS.SET_DB_SCHEMA, payload: dbSchema }),
  
  // UI
  setLoading: (loading) => ({ type: ACTIONS.SET_LOADING, payload: loading }),
  setInput: (input) => ({ type: ACTIONS.SET_INPUT, payload: input }),
  addMessage: (message) => ({ type: ACTIONS.ADD_MESSAGE, payload: message }),
  setMessages: (messages) => ({ type: ACTIONS.SET_MESSAGES, payload: messages }),
  setSuggestions: (suggestions) => ({ type: ACTIONS.SET_SUGGESTIONS, payload: suggestions }),
  
  // Visualization
  setChartData: (chartData) => ({ type: ACTIONS.SET_CHART_DATA, payload: chartData }),
  setCurrentFile: (currentFile) => ({ type: ACTIONS.SET_CURRENT_FILE, payload: currentFile }),
  
  // Python
  setPythonReady: (isPythonReady) => ({ type: ACTIONS.SET_PYTHON_READY, payload: isPythonReady })
};

export default { ACTIONS, initialState, appReducer, actions };