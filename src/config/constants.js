// Centralized configuration for InsightEngine Enterprise
export const CONFIG = {
  // Application settings
  APP: {
    NAME: 'InsightEngine Enterprise',
    VERSION: '1.0.0',
    DESCRIPTION: 'The Autonomous, Privacy-First AI Data Analyst for the Enterprise.',
    AUTHOR: 'InsightEngine'
  },

  // Database configuration
  DATABASE: {
    TABLE_NAME: 'dataset',
    DEFAULT_LIMIT: 50,
    MAX_QUERY_LIMIT: 1000,
    SUPPORTED_FORMATS: ['csv']
  },

  // AI/LLM configuration
  AI: {
    OLLAMA_API: (typeof process !== 'undefined' && process.env?.OLLAMA_API) || 'http://localhost:11434',
    DEFAULT_MODEL: 'phi3:latest',
    FALLBACK_MODEL: 'mistral',
    TEMPERATURE: {
      SQL_GENERATION: 0,
      SUGGESTION_GENERATION: 0.1,
      SUMMARY_GENERATION: 0.3
    },
    MAX_CONTEXT_LENGTH: 4000,
    CHAT_HISTORY_LIMIT: 3
  },

  // UI/UX configuration
  UI: {
    CHART_TYPES: {
      BAR_THRESHOLD: 20,
      LINE_THRESHOLD: 20
    },
    COLORS: {
      PRIMARY: '#eab308',
      BACKGROUND: '#000000',
      SECONDARY: '#18181b',
      TEXT: '#ffffff',
      MUTED: '#999999'
    },
    DIMENSIONS: {
      SIDEBAR_MIN_WIDTH: 300,
      SIDEBAR_MAX_WIDTH: 800,
      WINDOW_DEFAULT_WIDTH: 1400,
      WINDOW_DEFAULT_HEIGHT: 900
    }
  },

  // Security configuration
  SECURITY: {
    MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
    ALLOWED_FILE_TYPES: ['.csv'],
    VALIDATION_PATTERNS: {
      CSV_HEADER: /^[a-zA-Z0-9_\- ]+$/,
      COLUMN_NAME: /^[a-zA-Z0-9_\- ]+$/
    }
  },

  // Export configuration
  EXPORT: {
    DEFAULT_FILENAME: 'results',
    DATE_FORMAT: 'YYYY-MM-DD',
    PNG_QUALITY: 0.9
  },

  // Performance configuration
  PERFORMANCE: {
    // Chart optimization
    CHART_MAX_POINTS: 100, // Maximum points to render for performance
    CHART_SAMPLING_THRESHOLD: 200, // When to start sampling data

    // Pagination
    DEFAULT_PAGE_SIZE: 100, // Default rows per page
    MAX_PAGE_SIZE: 1000, // Maximum rows per page

    // Data table
    VIRTUAL_SCROLL_THRESHOLD: 100, // When to enable virtual scrolling

    // Debouncing
    DEBOUNCE_DELAY: 300, // Input debounce delay
    SEARCH_DEBOUNCE: 150, // Search input debounce

    // Memory management
    MEMORY_CLEANUP_THRESHOLD: 100, // Cleanup after X operations
    CACHE_TTL: 5 * 60 * 1000, // Cache TTL in ms (5 minutes)
    MAX_CACHED_QUERIES: 50, // Maximum cached queries

    // Monitoring
    MONITORING_ENABLED: true,
    SLOW_QUERY_THRESHOLD: 1000, // Log queries slower than this (ms)

    // Animation
    ENABLE_ANIMATIONS: true,
    ANIMATION_MAX_POINTS: 200 // Disable animations above this threshold
  },

  // Development configuration
  DEVELOPMENT: {
    LOG_LEVEL: process.env.NODE_ENV === 'development' ? 'debug' : 'error',
    DEV_TOOLS: process.env.NODE_ENV === 'development'
  },

  // Storage Keys for LocalStorage
  STORAGE_KEYS: {
    SETTINGS: 'insight_engine_settings',
    CHAT_HISTORY: 'insight_engine_chat_history',
    THEME: 'insight_engine_theme'
  }
};

// Alias for semantic usage
export const CONSTANTS = CONFIG;

// Utility functions
export const getAIEndpoint = (path) => `${CONFIG.AI.OLLAMA_API}${path}`;

export const isValidFileType = (filename) => {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return CONFIG.SECURITY.ALLOWED_FILE_TYPES.includes(ext);
};

export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

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

// Default export
export default CONFIG;