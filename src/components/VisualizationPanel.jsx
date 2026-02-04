import React from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';
import { Download, FileDown } from 'lucide-react';
import { CustomTooltip } from './ChartComponents.jsx';
import { CONFIG } from '../config/constants.js';

export const VisualizationPanel = ({
  chartData,
  currentFile,
  highContrast,
  onDownloadChart,
  onDownloadResults
}) => {
  // Smart chart type selection
  const shouldUseLineChart = chartData && chartData.length > CONFIG.UI.CHART_TYPES.LINE_THRESHOLD;

  // Get chart configuration (axes assignment)
  const getChartConfig = (data) => {
    if (!data || data.length === 0) return { xKey: '', dataKey: '' };
    const keys = Object.keys(data[0]);

    // Find first string key for X-Axis (Category)
    let xKey = keys.find(k => typeof data[0][k] === 'string');
    if (!xKey) xKey = keys[0];

    // Find first number key for Data (Value) that isn't the xKey
    let dataKey = keys.find(k => typeof data[0][k] === 'number' && k !== xKey);
    if (!dataKey) dataKey = keys.find(k => k !== xKey) || keys[0];

    return { xKey, dataKey };
  };

  const { xKey, dataKey } = chartData ? getChartConfig(chartData) : { xKey: '', dataKey: '' };

  const handleDownloadResults = () => {
    if (!chartData || chartData.length === 0) return;

    // Convert JSON to CSV
    const headers = Object.keys(chartData[0]);
    const csvContent = [
      headers.join(','),
      ...chartData.map(row => headers.map(header => `"${row[header]}"`).join(','))
    ].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${CONFIG.EXPORT.DEFAULT_FILENAME}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    if (onDownloadResults) onDownloadResults();
  };

  const handleDownloadChart = () => {
    const chartElement = document.querySelector('.recharts-responsive-container');
    if (!chartElement) return;

    // Create canvas from SVG
    const svgElement = chartElement.querySelector('svg');
    if (!svgElement) return;

    const svgString = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.onload = function () {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Download as PNG
      const link = document.createElement('a');
      link.download = `${CONFIG.EXPORT.DEFAULT_FILENAME}.png`;
      link.href = canvas.toDataURL('image/png', CONFIG.EXPORT.PNG_QUALITY);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgString);

    if (onDownloadChart) onDownloadChart();
  };

  // Render empty state
  if (!chartData) {
    return (
      <div className="flex-1 p-8 overflow-hidden transition-colors duration-300">
        <div className={`w-full h-full border rounded-2xl relative flex flex-col p-4 transition-colors duration-300 ${
          highContrast 
            ? 'border-black bg-white text-black' 
            : 'border-zinc-800 bg-zinc-900/30 text-white'
        }`}>
          <EmptyState highContrast={highContrast} />
        </div>
      </div>
    );
  }

  // Render no data state
  if (chartData.length === 0) {
    return (
      <div className="flex-1 p-8 overflow-hidden transition-colors duration-300">
        <div className={`w-full h-full border rounded-2xl relative flex flex-col p-4 transition-colors duration-300 ${
          highContrast 
            ? 'border-black bg-white text-black' 
            : 'border-zinc-800 bg-zinc-900/30 text-white'
        }`}>
          <NoDataState highContrast={highContrast} />
        </div>
      </div>
    );
  }

  // Render single value state
  if (chartData.length === 1) {
    return (
      <div className="flex-1 p-8 overflow-hidden transition-colors duration-300">
        <div className={`w-full h-full border rounded-2xl relative flex flex-col p-4 transition-colors duration-300 ${
          highContrast 
            ? 'border-black bg-white text-black' 
            : 'border-zinc-800 bg-zinc-900/30 text-white'
        }`}>
          <SingleValueState value={chartData[0][dataKey]} label={dataKey} highContrast={highContrast} />
        </div>
      </div>
    );
  }

  // Render chart
  return (
    <div className="flex-1 p-8 overflow-hidden transition-colors duration-300">
      <div className={`w-full h-full border rounded-2xl relative flex flex-col p-4 transition-colors duration-300 ${
        highContrast 
          ? 'border-black bg-white text-black' 
          : 'border-zinc-800 bg-zinc-900/30 text-white'
      }`}>
        {/* Chart Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-center flex-1">
            <h3 className={`text-lg font-bold tracking-wide uppercase ${
              highContrast ? 'text-black' : 'text-white'
            }`}>
              {dataKey} by {xKey}
            </h3>
          </div>
          
          {/* Export Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleDownloadResults}
              className={`px-3 py-1.5 text-xs rounded transition-colors border flex items-center gap-1 ${
                highContrast
                  ? 'bg-zinc-200 hover:bg-zinc-300 text-black border-zinc-400'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700 hover:border-zinc-600'
              }`}
              title="Export filtered results as CSV"
            >
              <FileDown size={12} />
              Export Results
            </button>
            <button
              onClick={handleDownloadChart}
              className={`px-3 py-1.5 text-xs rounded transition-colors border flex items-center gap-1 ${
                highContrast
                  ? 'bg-zinc-200 hover:bg-zinc-300 text-black border-zinc-400'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700 hover:border-zinc-600'
              }`}
              title="Save chart as PNG image"
            >
              <Download size={12} />
              Save Image
            </button>
          </div>
        </div>

        {/* Chart Content */}
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            {shouldUseLineChart ? (
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
                <CartesianGrid 
                  stroke={highContrast ? '#000' : CONFIG.UI.COLORS.SECONDARY} 
                  strokeDasharray="3 3" 
                />
                <XAxis
                  dataKey={xKey}
                  stroke={highContrast ? '#000' : CONFIG.UI.COLORS.MUTED}
                  tick={{ fontSize: 12, fill: highContrast ? '#000' : CONFIG.UI.COLORS.MUTED }}
                />
                <YAxis
                  stroke={highContrast ? '#000' : CONFIG.UI.COLORS.MUTED}
                  tick={{ fontSize: 12, fill: highContrast ? '#000' : CONFIG.UI.COLORS.MUTED }}
                />
                <Tooltip content={<CustomTooltip highContrast={highContrast} />} />
                <Line
                  type="monotone"
                  dataKey={dataKey}
                  stroke={highContrast ? '#000' : CONFIG.UI.COLORS.PRIMARY}
                  dot={false}
                  strokeWidth={3}
                  activeDot={{ r: 8 }}
                />
                <Brush
                  dataKey={xKey}
                  height={30}
                  stroke={highContrast ? '#000' : CONFIG.UI.COLORS.PRIMARY}
                  fill={highContrast ? '#f4f4f5' : CONFIG.UI.COLORS.SECONDARY}
                />
              </LineChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
                <CartesianGrid 
                  stroke={highContrast ? '#000' : CONFIG.UI.COLORS.SECONDARY} 
                  strokeDasharray="3 3" 
                />
                <XAxis
                  dataKey={xKey}
                  stroke={highContrast ? '#000' : CONFIG.UI.COLORS.MUTED}
                  tick={{ fontSize: 12, fill: highContrast ? '#000' : CONFIG.UI.COLORS.MUTED }}
                />
                <YAxis
                  stroke={highContrast ? '#000' : CONFIG.UI.COLORS.MUTED}
                  tick={{ fontSize: 12, fill: highContrast ? '#000' : CONFIG.UI.COLORS.MUTED }}
                />
                <Tooltip content={<CustomTooltip highContrast={highContrast} />} />
                <Bar
                  dataKey={dataKey}
                  fill={highContrast ? '#000' : CONFIG.UI.COLORS.PRIMARY}
                  radius={[4, 4, 0, 0]}
                />
                <Brush
                  dataKey={xKey}
                  height={30}
                  stroke={highContrast ? '#000' : CONFIG.UI.COLORS.PRIMARY}
                  fill={highContrast ? '#f4f4f5' : CONFIG.UI.COLORS.SECONDARY}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// Empty State Component
const EmptyState = ({ highContrast }) => {
  const [isPulsing, setIsPulsing] = React.useState(true);
  
  React.useEffect(() => {
    const interval = setInterval(() => setIsPulsing(prev => !prev), 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`flex-1 flex flex-col items-center justify-center select-none ${
      highContrast ? 'text-black' : 'text-zinc-600'
    }`}>
      <div className={`text-6xl mb-6 ${isPulsing ? 'opacity-40' : 'opacity-20'} transition-opacity duration-1000`}>
        📊
      </div>
      <p className="text-sm tracking-[0.3em] font-bold uppercase">Visualization Offline</p>
      <p className="text-xs mt-2 opacity-60">Upload a CSV file to begin analysis</p>
    </div>
  );
};

// No Data State Component
const NoDataState = ({ highContrast }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center">
      <div className={`backdrop-blur-md border rounded-lg shadow-[0_0_15px_rgba(0,0,0,0.2)] p-8 text-center ${
        highContrast ? 'bg-white border-black' : 'bg-white/5 border-white/10'
      }`}>
        <span className={`text-2xl font-bold ${
          highContrast ? 'text-black' : 'text-zinc-300'
        }`}>No Data Found</span>
        <p className={`text-sm mt-2 ${
          highContrast ? 'text-zinc-800' : 'text-zinc-500'
        }`}>Your query returned no results. Try different filters.</p>
      </div>
    </div>
  );
};

// Single Value State Component
const SingleValueState = ({ value, label, highContrast }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center">
      <div className={`backdrop-blur-md border rounded-lg shadow-[0_0_15px_rgba(0,0,0,0.2)] p-8 text-center max-w-md ${
        highContrast ? 'bg-white border-black' : 'bg-white/5 border-white/10'
      }`}>
        <span className={`text-2xl font-bold uppercase tracking-wider ${
          highContrast ? 'text-zinc-800' : 'text-zinc-300'
        }`}>{label}</span>
        <p className={`text-6xl font-mono mt-4 font-bold ${
          highContrast ? 'text-black' : 'text-white'
        }`}>{value}</p>
      </div>
    </div>
  );
};

export default VisualizationPanel;