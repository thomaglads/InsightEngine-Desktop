import { useState } from 'react';

const DropZone = ({ onDataLoaded }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        setIsDragging(false);
        setError(null);

        const file = e.dataTransfer.files[0];
        if (!file) return;

        // 1. Get the path (Try standard property first, then fallback to webUtils)
        let filePath = file.path;
        let ipcRenderer; // Declare variable

        if (window.require) {
            try {
                const electron = window.require('electron');
                ipcRenderer = electron.ipcRenderer; // <--- GET IPC HERE

                // Fallback for path if file.path is empty
                if (!filePath && electron.webUtils) {
                    filePath = electron.webUtils.getPathForFile(file);
                }
            } catch (err) {
                console.error("Electron require failed:", err);
            }
        }

        console.log("File Path:", filePath);

        if (!filePath) {
            setError("Error: Could not determine file path.");
            return;
        }

        if (!ipcRenderer) {
            // Fallback if window.ipcRenderer is available (unlikely if require worked, but good for safety)
            if (window.ipcRenderer) {
                ipcRenderer = window.ipcRenderer;
            } else {
                setError("Error: ipcRenderer not found. Ensure nodeIntegration is true.");
                return;
            }
        }

        setLoading(true);
        try {
            // 2. Use the imported ipcRenderer, NOT window.ipcRenderer
            console.log('Dropping file:', filePath);
            const rowCount = await ipcRenderer.invoke('load-file', filePath);
            console.log('Loaded rows:', rowCount);
            onDataLoaded(rowCount);
        } catch (err) {
            console.error(err);
            setError(`Failed to load file: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className={`drop-zone ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px dashed var(--border-color)',
                borderRadius: '16px',
                margin: '20px',
                backgroundColor: isDragging ? 'rgba(122, 162, 247, 0.1)' : 'var(--bg-color)',
                color: 'var(--text-color)',
                transition: 'all 0.2s',
            }}
        >
            {loading ? (
                <div className="loading-spinner">Loading Data...</div>
            ) : (
                <>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📂</div>
                    <h2>Drag & Drop your CSV/Parquet file here</h2>
                    <p style={{ opacity: 0.7 }}>Analyzing strictly on your device. Offline.</p>
                    {error && <p style={{ color: '#ff6b6b', marginTop: '1rem' }}>{error}</p>}
                </>
            )}
        </div>
    );
};

export default DropZone;
