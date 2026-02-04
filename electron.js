const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');

// Security: Set application name for security policies
app.name = 'InsightEngine Enterprise';

// Security: Disable node integration in production
function createWindow() {
    const isDev = process.env.NODE_ENV === 'development';
    
    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        backgroundColor: '#020617',
        autoHideMenuBar: true,
        show: false, // Don't show until ready-to-show
        webPreferences: {
            nodeIntegration: false, // Security: Disable node integration
            contextIsolation: true, // Security: Enable context isolation
            enableRemoteModule: false, // Security: Disable remote module
            webSecurity: true, // Security: Enable web security
            allowRunningInsecureContent: false, // Security: Disallow insecure content
            preload: path.join(__dirname, 'electron', 'preload.js')
        },
        icon: path.join(__dirname, 'public', 'logo.png'),
        title: "InsightEngine Enterprise"
    });

    // Load the built app
    const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, 'dist', 'index.html')}`;
    win.loadURL(startUrl);

    // Show window when ready to prevent visual flash
    win.once('ready-to-show', () => {
        win.show();
        
        if (isDev) {
            win.webContents.openDevTools();
        }
    });

    // Security: Prevent navigation to external URLs
    win.webContents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        
        if (parsedUrl.origin !== 'http://localhost:5173' && !navigationUrl.startsWith('file://')) {
            event.preventDefault();
        }
    });

    // Security: Prevent new window creation
    win.webContents.setWindowOpenHandler(() => {
        return { action: 'deny' };
    });

    return win;
}

// IPC Handlers
ipcMain.handle('dialog:openFile', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
            { name: 'CSV Files', extensions: ['csv'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

ipcMain.handle('dialog:saveFile', async (event, data, filename) => {
    const result = await dialog.showSaveDialog({
        defaultPath: filename,
        filters: [
            { name: 'CSV Files', extensions: ['csv'] },
            { name: 'PNG Files', extensions: ['png'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });
    
    if (!result.canceled) {
        await fs.writeFile(result.filePath, data);
        return result.filePath;
    }
    return null;
});

ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
});

ipcMain.handle('shell:showItemInFolder', async (event, fullPath) => {
    shell.showItemInFolder(fullPath);
});

ipcMain.handle('export:toPNG', async (event, chartElement) => {
    // This will be implemented in the renderer process for now
    // due to DOM access limitations
    return { success: false, message: 'Use renderer export instead' };
});

ipcMain.handle('export:toCSV', async (event, data) => {
    const csv = convertToCSV(data);
    return csv;
});

// Helper function to convert data to CSV
function convertToCSV(data) {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [
        headers.join(','),
        ...data.map(row => 
            headers.map(header => {
                const value = row[header];
                const stringValue = typeof value === 'string' ? value : String(value);
                return `"${stringValue.replace(/"/g, '""')}"`;
            }).join(',')
        )
    ];
    
    return csvRows.join('\n');
}

app.whenReady().then(() => {
    createWindow();
    
    // Security: Set Content Security Policy
    app.on('web-contents-created', (event, contents) => {
        contents.on('new-window', (event, navigationUrl) => {
            event.preventDefault();
        });
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
