const { contextBridge, ipcRenderer } = require('electron');

// Expose secure APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (data, filename) => ipcRenderer.invoke('dialog:saveFile', data, filename),
  
  // Application info
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  
  // System operations
  showItemInFolder: (path) => ipcRenderer.invoke('shell:showItemInFolder', path),
  
  // Database operations
  executeQuery: (sql) => ipcRenderer.invoke('db:executeQuery', sql),
  
  // AI operations
  generateQuery: (context, question) => ipcRenderer.invoke('ai:generateQuery', context, question),
  generateSuggestions: (columns) => ipcRenderer.invoke('ai:generateSuggestions', columns),
  
  // Export operations
  exportToPNG: (chartElement) => ipcRenderer.invoke('export:toPNG', chartElement),
  exportToCSV: (data) => ipcRenderer.invoke('export:toCSV', data),
});

// Error handling for unhandled rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Security: Prevent access to node APIs
delete window.require;
delete window.exports;
delete window.module;
