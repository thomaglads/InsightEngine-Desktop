export const initialState = {
    // Multi-Table State
    tables: [], // Array of { name, rowCount, columns, entities }
    activeTable: null,
    relationships: [], // Derived foreign keys

    // Database & Logic Cores
    db: null,
    conn: null,
    sqlGenerator: null,
    discoveryService: null,
    conversationMemory: null,

    // Chat State
    messages: [],
    input: '',
    loading: false,
    suggestions: [],

    // Visualization State
    chartData: null,
    currentFile: null, // Legacy tracking for UI display

    // Reports
    showReport: false,
    reportData: null,
    isGeneratingReport: false,

    // UI Preferences
    highContrast: false,
    sidebarWidth: 400,
    isResizing: false,

    // Performance & Async State
    isPythonReady: false,
    pendingQuery: null,
    awaitingClarification: false,
    clarificationOptions: []
};

export function appReducer(state, action) {
    switch (action.type) {
        // --- CORE INITIALIZATION ---
        case 'INITIALIZE_CORES':
            return { ...state, ...action.payload };

        // --- DATA MANAGEMENT (MULTI-TABLE) ---
        case 'ADD_TABLE':
            const newTables = [...state.tables, action.payload];
            return {
                ...state,
                tables: newTables,
                currentFile: action.payload.name, // Set focus to newest
                activeTable: action.payload.name,
                // Fresh start rule: Clear messages only on FIRST upload to avoid confusion
                messages: state.tables.length === 0 ? [] : state.messages,
                queryResult: null
            };

        case 'SET_RELATIONSHIPS':
            return { ...state, relationships: action.payload };

        case 'SET_ACTIVE_TABLE':
            return { ...state, activeTable: action.payload };

        // --- CHAT & INTERACTION ---
        case 'SET_INPUT':
            return { ...state, input: action.payload };

        case 'ADD_MESSAGE':
            return { ...state, messages: [...state.messages, action.payload] };

        case 'SET_LOADING':
            return { ...state, loading: action.payload };

        case 'SET_SUGGESTIONS':
            return { ...state, suggestions: action.payload };

        // --- EXECUTION & VISUALIZATION ---
        case 'EXECUTE_QUERY_START':
            return { ...state, loading: true, error: null };

        case 'EXECUTE_QUERY_SUCCESS':
            return {
                ...state,
                loading: false,
                chartData: action.payload.data, // Expects sanitized data
                error: null
            };

        case 'SET_ERROR':
            return {
                ...state,
                loading: false,
                messages: [...state.messages, { text: `ERROR: ${action.payload}`, sender: 'bot' }]
            };

        // --- UI ACTIONS ---
        case 'TOGGLE_HIGH_CONTRAST':
            return { ...state, highContrast: !state.highContrast };

        case 'RESIZE_SIDEBAR':
            return { ...state, sidebarWidth: action.payload };

        case 'SET_RESIZING':
            return { ...state, isResizing: action.payload };

        case 'SET_SHOW_REPORT':
            return { ...state, showReport: action.payload };

        case 'SET_REPORT_DATA':
            return { ...state, reportData: action.payload };

        case 'SET_GENERATING_REPORT':
            return { ...state, isGeneratingReport: action.payload };

        // --- AGENT STATE ---
        case 'SET_PYTHON_READY':
            return { ...state, isPythonReady: action.payload };

        case 'SET_CLARIFICATION':
            return {
                ...state,
                awaitingClarification: true,
                clarificationOptions: action.payload.options,
                pendingQuery: action.payload.query
            };

        case 'CLEAR_CLARIFICATION':
            return {
                ...state,
                awaitingClarification: false,
                clarificationOptions: [],
                pendingQuery: null
            };

        default:
            return state;
    }
}
