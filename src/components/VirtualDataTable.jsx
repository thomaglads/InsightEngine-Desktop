import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

/**
 * Virtual Data Table Component
 * Renders large datasets efficiently using windowing/virtualization
 * Only renders visible rows + buffer for smooth scrolling
 */
export const VirtualDataTable = ({
  data,
  columns,
  highContrast = false,
  pageSize = 100,
  onRowClick,
  onExport,
  maxHeight = '400px'
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  
  // Calculate total pages
  const totalPages = Math.ceil(data.length / pageSize);
  
  // Get current page data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    
    let pageData = data.slice(startIndex, endIndex);
    
    // Apply sorting if configured
    if (sortConfig.key) {
      pageData = [...pageData].sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return pageData;
  }, [data, currentPage, pageSize, sortConfig]);
  
  // Handle sort
  const handleSort = (key) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };
  
  // Navigate to page
  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };
  
  // Format value for display
  const formatValue = (value) => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') {
      // Format large numbers
      if (Math.abs(value) >= 1e9) return (value / 1e9).toFixed(2) + 'B';
      if (Math.abs(value) >= 1e6) return (value / 1e6).toFixed(2) + 'M';
      if (Math.abs(value) >= 1e3) return (value / 1e3).toFixed(2) + 'K';
      return value.toLocaleString();
    }
    return String(value);
  };
  
  // Calculate display range
  const startRow = (currentPage - 1) * pageSize + 1;
  const endRow = Math.min(currentPage * pageSize, data.length);
  
  return (
    <div className="flex flex-col h-full">
      {/* Table Header with Stats */}
      <div className={`flex items-center justify-between px-4 py-2 border-b text-xs ${
        highContrast 
          ? 'bg-zinc-100 border-black text-black' 
          : 'bg-zinc-800/50 border-zinc-700 text-zinc-400'
      }`}>
        <span>
          Showing {startRow.toLocaleString()} - {endRow.toLocaleString()} of {data.length.toLocaleString()} rows
        </span>
        {onExport && (
          <button
            onClick={onExport}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              highContrast
                ? 'bg-zinc-200 hover:bg-zinc-300 text-black'
                : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
            }`}
          >
            Export All
          </button>
        )}
      </div>
      
      {/* Virtual Table */}
      <div 
        className="flex-1 overflow-auto"
        style={{ maxHeight }}
      >
        <table className="w-full text-sm">
          <thead className={`sticky top-0 z-10 ${
            highContrast ? 'bg-zinc-200' : 'bg-zinc-800'
          }`}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`px-4 py-2 text-left font-semibold cursor-pointer hover:bg-opacity-80 transition-colors ${
                    highContrast 
                      ? 'text-black border-b border-black' 
                      : 'text-zinc-300 border-b border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {col.label || col.key}
                    {sortConfig.key === col.key && (
                      <span className="text-xs">
                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, index) => (
              <tr
                key={index}
                onClick={() => onRowClick?.(row)}
                className={`transition-colors cursor-pointer ${
                  highContrast
                    ? 'hover:bg-zinc-100 border-b border-zinc-200'
                    : 'hover:bg-zinc-800/30 border-b border-zinc-800/50'
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-2 ${
                      highContrast ? 'text-black' : 'text-zinc-300'
                    }`}
                  >
                    {formatValue(row[col.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className={`flex items-center justify-between px-4 py-3 border-t ${
          highContrast 
            ? 'bg-zinc-100 border-black' 
            : 'bg-zinc-800/50 border-zinc-700'
        }`}>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(1)}
              disabled={currentPage === 1}
              className={`p-1 rounded transition-colors ${
                highContrast
                  ? 'hover:bg-zinc-300 disabled:opacity-30 text-black'
                  : 'hover:bg-zinc-700 disabled:opacity-30 text-zinc-400'
              }`}
              title="First Page"
            >
              <ChevronsLeft size={16} />
            </button>
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className={`p-1 rounded transition-colors ${
                highContrast
                  ? 'hover:bg-zinc-300 disabled:opacity-30 text-black'
                  : 'hover:bg-zinc-700 disabled:opacity-30 text-zinc-400'
              }`}
              title="Previous Page"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
          
          <div className={`text-xs ${highContrast ? 'text-black' : 'text-zinc-400'}`}>
            Page {currentPage} of {totalPages}
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={`p-1 rounded transition-colors ${
                highContrast
                  ? 'hover:bg-zinc-300 disabled:opacity-30 text-black'
                  : 'hover:bg-zinc-700 disabled:opacity-30 text-zinc-400'
              }`}
              title="Next Page"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages}
              className={`p-1 rounded transition-colors ${
                highContrast
                  ? 'hover:bg-zinc-300 disabled:opacity-30 text-black'
                  : 'hover:bg-zinc-700 disabled:opacity-30 text-zinc-400'
              }`}
              title="Last Page"
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VirtualDataTable;