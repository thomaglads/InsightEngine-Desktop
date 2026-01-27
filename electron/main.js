import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import duckdb from 'duckdb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow;

// Initialize persistent database
const db = new duckdb.Database(path.join(__dirname, '../insight_engine.duckdb'));

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true, // <--- ADDS THIS LINE TO HIDE THE MENU
    webPreferences: {
      nodeIntegration: true, // REQUIRED for drag-and-drop
      contextIsolation: false, // REQUIRED for drag-and-drop
      webSecurity: false // REQUIRED for local files
    }
  });

  // Optional: Completely remove the menu for production feel
  mainWindow.setMenuBarVisibility(false);

  // In dev mode, use Vite server. In prod, use built file.
  const startUrl = 'http://localhost:5173';
  mainWindow.loadURL(startUrl);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// --- IPC HANDLERS ---

// 1. Load File (Drag & Drop)
ipcMain.handle('load-file', async (event, filepath) => {
  return new Promise((resolve, reject) => {
    const safePath = filepath.replace(/\\/g, '/'); // Fix Windows paths
    console.log("Loading file from:", safePath);

    db.all(`CREATE OR REPLACE TABLE dataset AS SELECT * FROM read_csv_auto('${safePath}'); SELECT count(*) as count FROM dataset;`, (err, res) => {
      if (err) {
        console.error("DuckDB Error:", err);
        reject(err.message);
      } else {
        resolve(res[0].count);
      }
    });
  });
});

// 2. Get Schema (For AI)
ipcMain.handle('get-schema', async () => {
  return new Promise((resolve, reject) => {
    db.all("DESCRIBE dataset;", (err, res) => {
      if (err) {
        reject(err);
      } else {
        const schema = res.map(row => `${row.column_name} (${row.column_type})`).join(', ');
        resolve(schema);
      }
    });
  });
});

// 3. Run Query (For AI)
ipcMain.handle('run-query', async (event, sql) => {
  return new Promise((resolve, reject) => {
    console.log("Running SQL:", sql);
    db.all(sql, (err, res) => {
      if (err) {
        resolve([{ error: err.message }]);
      } else {
        resolve(res);
      }
    });
  });
});
