import React, { memo, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';
import { Download, FileDown } from 'lucide-react';
import { CustomTooltip } from './ChartComponents.jsx';
import { CONFIG } from '../config/constants.js';
import ErrorBoundary from './ErrorBoundary.jsx';

/**
 * Visualization Panel Component - Memoized for performance
 * Contains charts, KPI displays, and export functionality
 */
export const VisualizationPanel = memo(({ 
  chartData, 
  highContrast, 
  getChartConfig,
  downloadResults,
  downloadChart,
  predictionResult,
  setPredictionResult
}) => {
  // Memoize chart configuration
  const chartConfig = useMemo(() => {
    if (!chartData || !chartData.data || chartData.data.length === 0) {
      return { xKey: '', dataKey: '', displayMode: 'none' };
    }
    
    const data = chartData.data;
    const keys = Object.keys(data[0]);

    // Find first string key for X-Axis (Category)
    let xKey = keys.find(k => typeof data[0][k] === 'string');
    if (!xKey) xKey = keys[0];

    // Find first number key for Data (Value) that isn't the xKey
    let dataKey = keys.find(k => typeof data[0][k] === 'number' && k !== xKey);
    if (!dataKey) dataKey = keys.find(k => k !== xKey) || keys[0];

    return {
      xKey,
      dataKey,
      displayMode: chartData.displayMode || 'chart',
      visualHint: chartData.visualHint || 'chart'
    };
  }, [chartData]);

  // Memoize empty states
  const renderEmptyState = useMemo(() => {
    if (!chartData) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center select-none">
          <svg className="w-24 h-24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3.055 11H5a2 2 0 012 2v1a1 1 0 001 1h11a2 2 0 002-2v-1a1 1 0 00-1-1H6a1 1 0 00-1-1v-1a2 2 0 00-2-2H3.055zM9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6h6zM20 8a1 1 0 011 1v3a1 1 0 001 1h-3a1 1 0 01-1-1V9a1 1 0 011-1h3z" />
          </svg>
          <p className="text-sm tracking-[0.3em] font-bold opacity-80">VISUALIZATION OFFLINE</p>
        </div>
      );
    }

    if (chartData.data.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 select-none">
          <div className="backdrop-blur-md border rounded-lg shadow-[0_0_15px_rgba(0,0,0,0.2)] p-8 text-center bg-white/5 border-white/10">
            <span className="text-2xl font-bold text-zinc-300">No Data Found</span>
            <p className="text-sm mt-2 text-zinc-500">Your query returned no results. Try different filters.</p>
          </div>
        </div>
      );
    }

    return null;
  }, [chartData]);

  // Memoize KPI display
  const renderKPI = useMemo(() => {
    if (chartData.data.length === 1 && chartConfig.displayMode === 'kpi') {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 select-none">
          <div className="backdrop-blur-md border rounded-lg shadow-[0_0_15px_rgba(0,0,0,0.2)] p-8 text-center bg-white/5 border-white/10">
            <span className="text-6xl font-bold uppercase tracking-wider text-zinc-300">{chartConfig.dataKey}</span>
            <p className="text-6xl font-mono mt-4 font-bold text-white">{chartData.data[0][chartConfig.dataKey]}</p>
          </div>
        </div>
      );
    }
    return null;
  }, [chartData, chartConfig]);

  // Memoize export buttons
  const renderExportButtons = useMemo(() => {
    if (!chartData || !chartData.data || chartData.data.length === 0) return null;

    return (
      <div className="flex gap-2">
        <button
          onClick={downloadResults}
          className="px-3 py-1.5 text-xs rounded transition-colors border bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700 hover:border-zinc-600"
        >
          Export CSV
        </button>
        <button
          onClick={downloadChart}
          className="px-3 py-1.5 text-xs rounded transition-colors border bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700 hover:border-zinc-600"
        >
          Save Chart
        </button>
        {predictionResult && (
          <button
            onClick={() => setPredictionResult(null)}
            className={`px-3 py-1.5 text-xs rounded transition-colors border ${
              highContrast 
                ? 'bg-zinc-200 hover:bg-zinc-300 text-black border-zinc-400' 
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700 hover:border-zinc-600'
            }`}
          >
            Close Analysis
          </button>
        )}
      </div>
    );
  }, [chartData, highContrast, downloadResults, downloadChart, predictionResult, setPredictionResult]);

  return (
    <ErrorBoundary fallbackType="chart" maxRetries={2}>
      <div className="flex-1 bg-black relative flex flex-col min-w-0">
        {/* Empty State */}
        {renderEmptyState}
        
        {/* KPI Display */}
        {renderKPI}
        
        {/* Chart Display */}
        {chartData && chartData.data.length > 1 && (
          <>
            <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-8">
              <div className="text-center flex-1">
                <h3 className={`text-lg font-bold tracking-wide uppercase flex items-center justify-center gap-2 ${highContrast ? 'text-black' : 'text-white'}`}>
                  {chartConfig.dataKey} by {chartConfig.xKey}
                </h3>
              </div>
              {/* Export Buttons */}
              {renderExportButtons}
            </div>
            <div className="flex-1 p-8 overflow-hidden transition-colors duration-300">
              <div className="w-full h-full border rounded-2xl relative flex flex-col p-4 transition-colors duration-300">
                {/* Chart content will be rendered by parent */}
                <div className="flex-1 min-h-0">
                  {/* Placeholder for chart rendering */}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </ErrorBoundary>
  );
});

VisualizationPanel.displayName = 'VisualizationPanel';

export default VisualizationPanel;