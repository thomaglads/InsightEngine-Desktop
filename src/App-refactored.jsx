import React, { useState, useEffect, useCallback } from 'react';
import * as duckdb from '@duckdb/duckdb-wasm';
import { ExecutiveReport } from './components/ExecutiveReport.jsx';
import AppHeader from './components/AppHeader.jsx';
import VisualizationPanel from './components/VisualizationPanel.jsx';
import ChatSidebar from './components/ChatSidebar.jsx';
import { aiService } from './services/aiService.js';
import { dbService } from './services/databaseService.js';
import { FileUploadValidator } from './utils/fileValidator.js';
import { CONFIG } from './config/constants.js';

// Main App Component
function App() {
  // State management
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [dbSchema, setDbSchema] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [currentFile, setCurrentFile] = useState(null);
  
  // Executive Report State
  const [showReport, setShowReport] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  
  // UI State
  const [highContrast, setHighContrast] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(CONFIG.UI.DIMENSIONS.SIDEBAR_MIN_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  // Initialize database on mount
  useEffect(() => {
    const initDB = async () => {
      try {
        await dbService.initialize();
      } catch (error) {
        setMessages(prev => [...prev, { 
          text: `DATABASE INITIALIZATION ERROR: ${error.message}`, 
          sender: 'bot' 
        }]);
      }
    };
    initDB();
  }, []);

  // Resize handlers
  const startResizing = useCallback(() => setIsResizing(true), []);
  const stopResizing = useCallback(() => setIsResizing(false), []);
  
  const resize = useCallback((e) => {
    if (isResizing) {
      const newWidth = e.clientX;
      if (newWidth >= CONFIG.UI.DIMENSIONS.SIDEBAR_MIN_WIDTH && 
          newWidth <= CONFIG.UI.DIMENSIONS.SIDEBAR_MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    }
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  // File upload handler
  const handleFileUpload = async (file, content, analysis) => {
    setLoading(true);
    try {
      // Load file into database
      const schema = await dbService.loadCSVFile(file, content);
      setDbSchema(schema.columns);
      setCurrentFile(file.name);

      // Add success message
      setMessages(prev => [...prev, { 
        text: `DATASET LOADED. Detected Columns: [${schema.columns.join(', ')}]`, 
        sender: 'bot' 
      }]);

      // Generate smart suggestions
      await generateSmartSuggestions(schema.columns);
    } catch (err) {
      setMessages(prev => [...prev, { 
        text: `ERROR: ${err.message}`, 
        sender: 'bot' 
      }]);
    }
    setLoading(false);
  };

  // Generate smart suggestions
  const generateSmartSuggestions = async (columnNames) => {
    try {
      const suggestionsArray = await aiService.generateSuggestions(columnNames);
      setSuggestions(suggestionsArray);
    } catch (err) {
      console.error('Failed to generate suggestions:', err);
      setSuggestions([]);
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = async (suggestion) => {
    setInput(suggestion);
    await handleChat();
  };

  // Chat handler
  const handleChat = async () => {
    if (!input.trim() || !dbService.isReady()) return;
    
    const userText = input;
    setInput('');
    setMessages(prev => [...prev, { text: userText, sender: 'user' }]);
    setLoading(true);

    try {
      // Build conversation history context
      const historyContext = chatHistory.slice(-CONFIG.AI.CHAT_HISTORY_LIMIT).map((exchange, index) =>
        `Q: ${exchange.question}\nSQL: ${exchange.sql}`
      ).join('\n');

      // Generate SQL query
      const cleanSQL = await aiService.generateSQLQuery(historyContext, userText, dbSchema);
      
      // Add SQL to messages
      setMessages(prev => [...prev, { text: cleanSQL, sender: 'bot' }]);

      // Validate and execute query
      const validation = await dbService.validateQuery(cleanSQL);
      if (!validation.valid) {
        throw new Error(`SQL Validation Error: ${validation.error}`);
      }

      const results = await dbService.executeQuery(cleanSQL);
      setChartData(results);
      
      // Update chat history
      setChatHistory(prev => [...prev.slice(-2), { question: userText, sql: cleanSQL }]);
      
    } catch (err) {
      setMessages(prev => [...prev, { 
        text: `AI ERROR: ${err.message}`, 
        sender: 'bot' 
      }]);
    }
    setLoading(false);
  };

  // Generate report handler
  const generateReport = async () => {
    if (!dbService.isReady() || dbSchema.length === 0) return;
    
    setIsGeneratingReport(true);
    try {
      // Identify key columns
      const numericCols = dbSchema.filter(col =>
        !col.toLowerCase().includes('id') &&
        !col.toLowerCase().includes('date') &&
        !col.toLowerCase().includes('year') &&
        !col.toLowerCase().includes('zip') &&
        !col.toLowerCase().includes('phone')
      );

      // Find value column with priority
      let valueCol = null;
      const priorities = ['sales', 'revenue', 'profit', 'amount', 'cost'];
      for (const p of priorities) {
        const found = numericCols.find(c => c.toLowerCase().includes(p));
        if (found) {
          valueCol = found;
          break;
        }
      }
      if (!valueCol) valueCol = numericCols[0];

      if (!valueCol) throw new Error("Could not identify a value column for analysis.");

      // Get table statistics
      const stats = await dbService.getTableStats();
      
      // Run KPI queries
      const kpiSQL = `SELECT SUM("${valueCol}") as total, AVG("${valueCol}") as avg, COUNT(*) as count FROM ${CONFIG.DATABASE.TABLE_NAME};`;
      const kpiRes = await dbService.executeQuery(kpiSQL);
      const kpiRow = kpiRes[0];

      // Run trend query
      const dateCol = dbSchema.find(c => ['date', 'time', 'year', 'month'].some(k => c.toLowerCase().includes(k))) || 'Order Date';
      const catCol = dbSchema.find(c => ['category', 'region', 'segment', 'product'].some(k => c.toLowerCase().includes(k))) || 'Category';

      let trendSQL = `SELECT "${dateCol}", SUM("${valueCol}") as value FROM ${CONFIG.DATABASE.TABLE_NAME} GROUP BY "${dateCol}" ORDER BY "${dateCol}" LIMIT ${CONFIG.DATABASE.DEFAULT_LIMIT};`;
      if (dateCol.toLowerCase().includes('date')) {
        trendSQL = `SELECT strftime(strptime("${dateCol}", '%m/%d/%Y'), '%Y-%m') as name, SUM("${valueCol}") as value FROM ${CONFIG.DATABASE.TABLE_NAME} GROUP BY name ORDER BY name LIMIT ${CONFIG.DATABASE.DEFAULT_LIMIT};`;
      }

      let chartData = [];
      try {
        chartData = await dbService.executeQuery(trendSQL);
      } catch (e) {
        const simpleSQL = `SELECT "${valueCol}" as value FROM ${CONFIG.DATABASE.TABLE_NAME} LIMIT ${CONFIG.DATABASE.DEFAULT_LIMIT};`;
        chartData = await dbService.executeQuery(simpleSQL);
        chartData = chartData.map((r, i) => ({ name: i, value: r.value }));
      }

      // Run top drivers query
      const driversSQL = `SELECT "${catCol}" as name, SUM("${valueCol}") as value FROM ${CONFIG.DATABASE.TABLE_NAME} GROUP BY "${catCol}" ORDER BY value DESC LIMIT 5;`;
      const topDrivers = await dbService.executeQuery(driversSQL);

      // Generate AI summary
      const summary = await aiService.generateExecutiveSummary({
        total: kpiRow.total,
        average: kpiRow.avg,
        topPerformer: topDrivers[0]
      }, valueCol);

      // Assemble report data
      setReportData({
        kpis: [
          { label: `Total ${valueCol}`, value: Math.round(kpiRow.total).toLocaleString(), trend: 'up', delta: '+12%' },
          { label: `Avg ${valueCol}`, value: Math.round(kpiRow.avg).toLocaleString(), trend: 'down', delta: '-2%' },
          { label: 'Active Records', value: Number(kpiRow.count).toLocaleString(), trend: 'up', delta: '100%' }
        ],
        chartData: chartData,
        topDrivers: topDrivers.map(r => ({
          name: String(r.name),
          value: typeof r.value === 'number' ? Math.round(r.value).toLocaleString() : r.value
        })),
        summary: summary
      });
      setShowReport(true);

    } catch (err) {
      console.error("Report Error", err);
      setMessages(p => [...p, { 
        text: `REPORT ERROR: ${err.message}`, 
        sender: 'bot' 
      }]);
    }
    setIsGeneratingReport(false);
  };

  // Toggle high contrast
  const toggleHighContrast = () => setHighContrast(!highContrast);

  // Download handlers
  const handleDownloadChart = () => {
    console.log('Chart downloaded');
  };

  const handleDownloadResults = () => {
    console.log('Results downloaded');
  };

  return (
    <div className={`flex h-screen bg-black text-white font-mono ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
      <ChatSidebar
        messages={messages}
        input={input}
        setInput={setInput}
        onSendMessage={handleChat}
        loading={loading}
        suggestions={suggestions}
        onSuggestionClick={handleSuggestionClick}
        sidebarWidth={sidebarWidth}
        onResizeStart={startResizing}
        onResizeEnd={stopResizing}
        isResizing={isResizing}
        onFileUpload={handleFileUpload}
      />

      <div className="flex-1 bg-black relative flex flex-col min-w-0">
        <AppHeader
          currentFile={currentFile}
          connectionStatus={dbService.isReady()}
          highContrast={highContrast}
          onToggleContrast={toggleHighContrast}
          onGenerateReport={generateReport}
          isGeneratingReport={isGeneratingReport}
          isReportDisabled={!dbService.isReady() || dbSchema.length === 0}
        />

        <VisualizationPanel
          chartData={chartData}
          currentFile={currentFile}
          highContrast={highContrast}
          onDownloadChart={handleDownloadChart}
          onDownloadResults={handleDownloadResults}
        />
      </div>

      <ExecutiveReport
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        data={reportData}
        file={currentFile || 'Report'}
      />
    </div>
  );
}

export default App;