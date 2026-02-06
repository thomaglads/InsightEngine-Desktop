import React, { memo, useCallback } from 'react';
import { Download, FileDown, FileText, Database, Activity } from 'lucide-react';

/**
 * Control Banner Component - Memoized for performance
 * Contains report generation button and status indicators
 */
export const ControlBanner = memo(({ 
  currentFile, 
  isGeneratingReport, 
  generateReport,
  conn,
  isPythonReady,
  highContrast
}) => {
  // Memoize file upload handler
  const handleFileUpload = useCallback(async (file, content, analysis) => {
    // Will be passed from parent
  }, []);

  return (
    <div className="flex gap-3">
      {currentFile && (
        <button
          onClick={generateReport}
          disabled={isGeneratingReport}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-900 text-emerald-100 hover:bg-emerald-800 transition-all disabled:opacity-50 animate-in fade-in"
        >
          {isGeneratingReport ? <Activity className="animate-spin" size={14} /> : <Download size={14} />}
          {isGeneratingReport ? 'ANALYZING...' : 'GENERATE BOARD BRIEFING'}
        </button>
      )}
      
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all ${
        highContrast 
          ? 'bg-white text-black hover:bg-zinc-200' 
          : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
        }`}
      >
        <FileText size={14} />
        <span className="ml-1 text-xs font-bold uppercase tracking-wider">
          {currentFile || 'No Dataset'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Database size={16} className={conn ? "text-emerald-500" : "text-red-500"} />
        <span className={`text-xs font-bold uppercase tracking-wider ${
          conn ? "text-emerald-400" : "text-red-400"
        }`}>
          {conn ? "SYSTEM ONLINE" : "OFFLINE"}
        </span>
        
        {isPythonReady && (
          <span className="ml-3 text-blue-400 flex items-center gap-1">
            <Activity size={12} />
            SCIENTIST READY
          </span>
        )}
      </div>
    </div>
  );
});

ControlBanner.displayName = 'ControlBanner';

export default ControlBanner;