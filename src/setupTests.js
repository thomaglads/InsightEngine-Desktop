import '@testing-library/jest-dom';

// Mock Electron APIs
const electronAPI = {
  openFile: jest.fn(),
  saveFile: jest.fn(),
  getVersion: jest.fn(),
  showItemInFolder: jest.fn(),
  executeQuery: jest.fn(),
  generateQuery: jest.fn(),
  generateSuggestions: jest.fn(),
  exportToPNG: jest.fn(),
  exportToCSV: jest.fn(),
};

global.window.electronAPI = electronAPI;

// Mock DuckDB
const mockDuckDB = {
  getJsDelivrBundles: jest.fn(() => ({ mainWorker: 'worker.js', mainModule: 'module.wasm', pthreadWorker: 'pthread.js' })),
  selectBundle: jest.fn(() => Promise.resolve({ mainWorker: 'worker.js', mainModule: 'module.wasm', pthreadWorker: 'pthread.js' })),
  createWorker: jest.fn(() => Promise.resolve({})),
  ConsoleLogger: jest.fn(),
  AsyncDuckDB: jest.fn(() => ({
    instantiate: jest.fn(() => Promise.resolve()),
    connect: jest.fn(() => Promise.resolve({
      query: jest.fn(() => Promise.resolve({
        toArray: jest.fn(() => [])
      }))
    }))
  })),
  DuckDBDataProtocol: {
    BROWSER_FILEREADER: 'BROWSER_FILEREADER'
  }
};

global.duckdb = mockDuckDB;

// Mock fetch for Ollama API
global.fetch = jest.fn();

// Mock console methods to reduce noise in tests
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' && 
      (args[0].includes('Warning:') || args[0].includes('validateDOMNesting'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' && 
      args[0].includes('componentWillReceiveProps')
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

// Helper function to mock file uploads
export const createMockFile = (name = 'test.csv', content = 'header1,header2\nvalue1,value2', type = 'text/csv') => {
  const file = new File([content], name, { type });
  Object.defineProperty(file, 'size', { value: content.length });
  return file;
};

// Helper function to mock Ollama responses
export const mockOllamaResponse = (content) => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      message: { content }
    })
  });
};

// Helper function to mock DuckDB responses
export const mockDuckDBResponse = (data) => {
  const mockQuery = {
    toArray: jest.fn(() => data)
  };
  
  // Mock the chain of async calls
  const mockConnection = {
    query: jest.fn(() => Promise.resolve(mockQuery))
  };
  
  return mockConnection;
};