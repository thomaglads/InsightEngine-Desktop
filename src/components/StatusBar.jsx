import React, { memo } from 'react';
import { Database, Globe, Activity, TrendingUp } from 'lucide-react';

/**
 * Status Bar Component - Memoized for performance
 * Displays database status, file info, and system readiness indicators
 */
export const StatusBar = memo(({ 
  currentFile, 
  conn, 
  isPythonReady, 
  isGeneratingReport, 
  generateReport,
  highContrast,
  setHighContrast 
}) => {
  return (
    <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-8 text-xs tracking-widest text-zinc-400 uppercase font-bold">
      <div className="flex items-center gap-3">
        <Database size={16} />
        {currentFile || "NO DATABASE MOUNTED"}
      </div>
      <div className="flex items-center gap-6">
        {currentFile && (
          <button
            onClick={generateReport}
            disabled={isGeneratingReport}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-900 text-emerald-100 hover:bg-emerald-800 transition-all disabled:opacity-50 animate-in fade-in"
          >
            {isGeneratingReport ? <Activity className="animate-spin" size={14} /> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19c1 0 1.5-.5 1.5-.5s-.5.5-.5-.5-1.5c0-1-.5-.5-1.5-.5h-1c-1 0-2 .5-2 1.5s.5 1.5 1.5 1.5z" /></svg>}
            {isGeneratingReport ? 'ANALYZING...' : 'GENERATE BOARD BRIEFING'}
          </button>
        )}
        <button
          onClick={() => setHighContrast(!highContrast)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all ${highContrast
            ? 'bg-white text-black hover:bg-zinc-200'
            : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
        >
          {highContrast ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.078 0-7.737-1.558-10.458-4.098M12 22a10 10 0 0110-10 10 10 0 0110 10" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7a8.959 8.959 0 01-4.752 4.045 7.632 7.632 0 005.341-5.163A9.98 9.98 0 0112 22c0-.003 0-.007 0-.01a9.96 9.96 0 01-6.541-2.42" /></svg>}
          {highContrast ? 'HIGH CONTRAST ON' : 'HIGH CONTRAST OFF'}
        </button>
        <div className="flex items-center gap-3">
          <Activity size={16} className={conn ? "text-emerald-500" : "text-red-500"} />
          {conn ? "SYSTEM ONLINE" : "OFFLINE"}
          {isPythonReady && (
            <span className="ml-2 text-blue-400 flex items-center gap-1">
              <TrendingUp size={12} />
              SCIENTIST READY
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

StatusBar.displayName = 'StatusBar';

export default StatusBar;