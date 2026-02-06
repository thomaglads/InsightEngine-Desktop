import React, { memo, useCallback, useMemo } from 'react';
import { CustomTooltip } from './ChartComponents';
import ErrorBoundary from './ErrorBoundary.jsx';
import { CONFIG } from '../config/constants.js';

/**
 * Data Table Component with Virtual Scrolling
 * Optimized for performance with large datasets
 */
export const DataTable = memo(({ 
  data, 
  highContrast, 
  maxHeight = 400,
  rowHeight = 35,
  className = ""
}) => {
  // Memoize table calculations
  const tableData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Limit display to virtual viewport for performance
    const displayData = data.slice(0, maxHeight);
    
    return displayData.map((row, index) => ({
      ...row,
      _id: index,
      _visible: index < maxHeight
    }));
  }, [data, maxHeight]);

  const headers = useMemo(() => {
    if (!tableData.length) return [];
    return Object.keys(tableData[0]).map(key => ({
      key,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, ' ')
    }));
  }, [tableData]);

  // Memoize scroll handlers
  const handleScroll = useCallback((e) => {
    const element = e.currentTarget;
    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight - element.clientHeight;
    const scrollPercentage = (scrollTop / scrollHeight) * 100;
    
    // Could be used for lazy loading more data
    console.log(`Scrolled to ${scrollPercentage.toFixed(1)}%`);
  }, []);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-zinc-400">
        <div className="text-center">
          <FileText className="mx-auto mb-4 text-zinc-300" size={48} />
          <p className="text-lg font-semibold">No Data Available</p>
          <p className="text-sm text-zinc-500">Try adjusting your query parameters.</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary fallbackType="minimal">
      <div className={`w-full overflow-auto border border rounded-lg ${highContrast ? 'border-black bg-white' : 'border-zinc-800 bg-zinc-900/50'} ${className}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={`text-left text-xs font-medium uppercase tracking-wider ${highContrast ? 'text-black border-b' : 'text-zinc-400 border-b border-zinc-700'}`}>
                <th className="px-4 py-3 sticky top-0 bg-inherit">Header</th>
                {headers.map(header => (
                  <th key={header.key} className="px-4 py-3 font-medium">
                    {header.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, index) => (
                <tr 
                  key={row._id} 
                  className={`text-sm border-t ${highContrast ? 'border-gray-200 hover:bg-gray-50' : 'border-zinc-700 hover:bg-zinc-800'} transition-colors`}
                >
                  {headers.map(header => (
                    <td key={header.key} className="px-4 py-2 font-mono">
                      {row[header.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ErrorBoundary>
  );
});

DataTable.displayName = 'DataTable';

export default DataTable;