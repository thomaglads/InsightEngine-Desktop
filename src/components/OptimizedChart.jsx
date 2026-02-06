import React, { useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush } from 'recharts';
import { CustomTooltip } from './ChartComponents.jsx';
import { CONFIG } from '../config/constants.js';

/**
 * Performance-optimized chart component
 * Handles large datasets by intelligently sampling data
 * Maintains visual accuracy while improving rendering performance
 */
export const OptimizedChart = ({
  data,
  xKey,
  dataKey,
  highContrast = false,
  maxDataPoints = 100, // Maximum points to render for performance
  chartType = 'auto', // 'line', 'bar', or 'auto'
  height = '100%',
  showBrush = true
}) => {
  // Intelligently sample data for large datasets
  const sampledData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (data.length <= maxDataPoints) return data;
    
    // For time-series or ordered data, use strategic sampling
    const samplingRate = Math.ceil(data.length / maxDataPoints);
    const sampled = [];
    
    // Always include first and last points
    sampled.push(data[0]);
    
    // Sample middle points
    for (let i = samplingRate; i < data.length - samplingRate; i += samplingRate) {
      // For each bucket, find the point with max value to preserve peaks
      const bucket = data.slice(i, Math.min(i + samplingRate, data.length - 1));
      const maxPoint = bucket.reduce((max, current) => 
        current[dataKey] > max[dataKey] ? current : max
      , bucket[0]);
      
      sampled.push(maxPoint);
    }
    
    // Always include last point
    if (data.length > 1) {
      sampled.push(data[data.length - 1]);
    }
    
    return sampled;
  }, [data, dataKey, maxDataPoints]);
  
  // Determine chart type based on data size
  const shouldUseLineChart = useMemo(() => {
    if (chartType !== 'auto') return chartType === 'line';
    return data && data.length > CONFIG.UI.CHART_TYPES.LINE_THRESHOLD;
  }, [data, chartType]);
  
  // Memoize chart configuration to prevent unnecessary re-renders
  const chartConfig = useMemo(() => ({
    stroke: highContrast ? '#000' : CONFIG.UI.COLORS.PRIMARY,
    fill: highContrast ? '#000' : CONFIG.UI.COLORS.PRIMARY,
    gridStroke: highContrast ? '#000' : CONFIG.UI.COLORS.SECONDARY,
    axisStroke: highContrast ? '#000' : CONFIG.UI.COLORS.MUTED,
    tickFill: highContrast ? '#000' : CONFIG.UI.COLORS.MUTED,
  }), [highContrast]);
  
  if (!data || data.length === 0) {
    return null;
  }
  
  const showSamplingNotice = data.length > maxDataPoints;
  
  return (
    <div className="relative w-full h-full">
      {/* Sampling notice for large datasets */}
      {showSamplingNotice && (
        <div className={`absolute top-2 right-2 z-10 px-2 py-1 text-xs rounded ${
          highContrast 
            ? 'bg-zinc-200 text-black' 
            : 'bg-zinc-800/80 text-zinc-400'
        }`}>
          Showing {sampledData.length.toLocaleString()} of {data.length.toLocaleString()} points
        </div>
      )}
      
      <ResponsiveContainer width="100%" height={height}>
        {shouldUseLineChart ? (
          <LineChart 
            data={sampledData} 
            margin={{ top: 5, right: 30, left: 20, bottom: showBrush ? 50 : 25 }}
          >
            <CartesianGrid 
              stroke={chartConfig.gridStroke} 
              strokeDasharray="3 3" 
            />
            <XAxis
              dataKey={xKey}
              stroke={chartConfig.axisStroke}
              tick={{ fontSize: 12, fill: chartConfig.tickFill }}
              interval="preserveStartEnd"
              minTickGap={30}
            />
            <YAxis
              stroke={chartConfig.axisStroke}
              tick={{ fontSize: 12, fill: chartConfig.tickFill }}
              tickFormatter={(value) => {
                // Format large numbers
                if (Math.abs(value) >= 1e9) return (value / 1e9).toFixed(1) + 'B';
                if (Math.abs(value) >= 1e6) return (value / 1e6).toFixed(1) + 'M';
                if (Math.abs(value) >= 1e3) return (value / 1e3).toFixed(1) + 'K';
                return value;
              }}
            />
            <Tooltip 
              content={<CustomTooltip highContrast={highContrast} />} 
              labelFormatter={(label) => `${xKey}: ${label}`}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={chartConfig.stroke}
              dot={sampledData.length < 50} // Only show dots for small datasets
              strokeWidth={2}
              activeDot={{ r: 6 }}
              isAnimationActive={sampledData.length < 200} // Disable animation for large datasets
            />
            {showBrush && (
              <Brush
                dataKey={xKey}
                height={30}
                stroke={chartConfig.stroke}
                fill={highContrast ? '#f4f4f5' : CONFIG.UI.COLORS.SECONDARY}
                travellerWidth={8}
              />
            )}
          </LineChart>
        ) : (
          <BarChart 
            data={sampledData} 
            margin={{ top: 5, right: 30, left: 20, bottom: showBrush ? 50 : 25 }}
          >
            <CartesianGrid 
              stroke={chartConfig.gridStroke} 
              strokeDasharray="3 3" 
            />
            <XAxis
              dataKey={xKey}
              stroke={chartConfig.axisStroke}
              tick={{ fontSize: 12, fill: chartConfig.tickFill }}
              interval={0}
              angle={sampledData.length > 10 ? -45 : 0}
              textAnchor={sampledData.length > 10 ? 'end' : 'middle'}
              height={sampledData.length > 10 ? 60 : 30}
            />
            <YAxis
              stroke={chartConfig.axisStroke}
              tick={{ fontSize: 12, fill: chartConfig.tickFill }}
              tickFormatter={(value) => {
                if (Math.abs(value) >= 1e9) return (value / 1e9).toFixed(1) + 'B';
                if (Math.abs(value) >= 1e6) return (value / 1e6).toFixed(1) + 'M';
                if (Math.abs(value) >= 1e3) return (value / 1e3).toFixed(1) + 'K';
                return value;
              }}
            />
            <Tooltip 
              content={<CustomTooltip highContrast={highContrast} />}
              labelFormatter={(label) => `${xKey}: ${label}`}
            />
            <Bar
              dataKey={dataKey}
              fill={chartConfig.fill}
              radius={[4, 4, 0, 0]}
              isAnimationActive={sampledData.length < 100}
            />
            {showBrush && (
              <Brush
                dataKey={xKey}
                height={30}
                stroke={chartConfig.stroke}
                fill={highContrast ? '#f4f4f5' : CONFIG.UI.COLORS.SECONDARY}
                travellerWidth={8}
              />
            )}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};

export default OptimizedChart;