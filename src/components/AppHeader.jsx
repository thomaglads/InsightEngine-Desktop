import React from 'react';
import { Database, Activity, FileDown, Eye, EyeOff } from 'lucide-react';
import { CONFIG } from '../config/constants.js';

export const AppHeader = ({
  currentFile,
  connectionStatus,
  highContrast,
  onToggleContrast,
  onGenerateReport,
  isGeneratingReport,
  isReportDisabled
}) => {
  return (
    <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-8 text-xs tracking-widest text-zinc-400 uppercase font-bold">
      {/* Database Status */}
      <div className="flex items-center gap-3">
        <Database size={16} />
        <span className={currentFile ? 'text-white' : 'text-zinc-500'}>
          {currentFile || "NO DATABASE MOUNTED"}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-6">
        {/* Generate Report Button */}
        {currentFile && (
          <button
            onClick={onGenerateReport}
            disabled={isGeneratingReport || isReportDisabled}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-900 text-emerald-100 hover:bg-emerald-800 transition-all disabled:opacity-50 animate-in fade-in"
          >
            {isGeneratingReport ? (
              <Activity className="animate-spin" size={14} />
            ) : (
              <FileDown size={14} />
            )}
            {isGeneratingReport ? 'ANALYZING...' : 'GENERATE BOARD BRIEFING'}
          </button>
        )}

        {/* High Contrast Toggle */}
        <button
          onClick={onToggleContrast}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all ${
            highContrast
              ? 'bg-white text-black hover:bg-zinc-200'
              : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
        >
          {highContrast ? <EyeOff size={14} /> : <Eye size={14} />}
          {highContrast ? 'HIGH CONTRAST ON' : 'HIGH CONTRAST OFF'}
        </button>

        {/* System Status */}
        <div className="flex items-center gap-3">
          <Activity 
            size={16} 
            className={connectionStatus ? "text-emerald-500" : "text-red-500"}
          />
          <span className={connectionStatus ? "text-emerald-400" : "text-red-400"}>
            {connectionStatus ? "SYSTEM ONLINE" : "OFFLINE"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default AppHeader;