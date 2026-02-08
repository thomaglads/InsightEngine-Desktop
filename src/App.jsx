import React, { useReducer, useEffect, useRef, useCallback, useMemo } from 'react';
import * as duckdb from '@duckdb/duckdb-wasm';
import { Database, Globe, Activity, TrendingUp } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import ControlBanner from './components/ControlBanner.jsx';
import DiscoveryService from './services/discoveryService';
import ConversationMemory from './services/conversationMemory';
import { aiService } from './services/aiService';
import { pythonForecaster } from './services/pythonForecaster';
import { sanitizeDuckDBRows } from './utils/bigintUtils.js';

// NEW: Reducer & Components
import { appReducer, initialState } from './services/appReducer';
import ChatSidebar from './components/ChatSidebar';
import MainVisualization from './components/MainVisualization';

const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Destructure for easier access
  const {
    db, conn, tables, activeTable,
    messages, input, loading, chartData,
    sidebarWidth, isResizing, highContrast,
    awaitingClarification, clarificationOptions
  } = state;

  // --- INITIALIZATION ---
  // --- INITIALIZATION ---
  useEffect(() => {
    // 1. AI Status Check (Independent of DB)
    const checkAI = async () => {
      try {
        const isOnline = await aiService.isServiceAvailable();
        dispatch({ type: 'SET_AI_ONLINE', payload: isOnline });
      } catch (e) {
        console.warn("AI Status Check Error:", e);
      }
    };

    checkAI(); // Run immediately
    const aiInterval = setInterval(checkAI, 10000);

    // 2. Data Core Init (DuckDB)
    const initDataCore = async () => {
      try {
        // Init DuckDB
        const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

        // Fix: Use Blob to bypass CORS for Worker if loaded from CDN
        const workerResponse = await fetch(bundle.mainWorker);
        const workerBlob = await workerResponse.blob();
        const workerUrl = URL.createObjectURL(workerBlob);
        const worker = new Worker(workerUrl);

        const logger = new duckdb.ConsoleLogger();
        const newDb = new duckdb.AsyncDuckDB(logger, worker);
        await newDb.instantiate(bundle.mainModule, bundle.pthreadWorker);
        const newConn = await newDb.connect();

        // Init Services
        const discovery = new DiscoveryService(newConn);
        const memory = new ConversationMemory();

        dispatch({
          type: 'INITIALIZE_CORES',
          payload: {
            db: newDb,
            conn: newConn,
            discoveryService: discovery,
            conversationMemory: memory
          }
        });
      } catch (err) {
        console.error("DuckDB Initialization Failed:", err);
        dispatch({ type: 'SET_ERROR', payload: "Database Engine Failed: Check Internet Connection" });
      }
    };

    initDataCore();

    // 3. Lazy Load Python (2s delay)
    setTimeout(() => {
      pythonForecaster.initialize().then(() => {
        dispatch({ type: 'SET_PYTHON_READY', payload: true });
      });
    }, 2000);

    return () => clearInterval(aiInterval);
  }, []);

  // --- FILE UPLOAD (MULTI-TABLE) ---
  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      for (const file of files) {
        const tableName = file.name.split('.')[0].replace(/[^a-zA-Z0-9_]/g, '_');

        // Load into DuckDB
        if (file.name.endsWith('.csv')) {
          const text = await file.text();
          await db.registerFileText(file.name, text);
          await conn.insertCSVFromPath(file.name, {
            name: tableName,
            detect: true,
            header: true
          });
        } else if (file.name.endsWith('.json')) {
          const text = await file.text();
          await db.registerFileText(file.name, text);
          await conn.insertJSONFromPath(file.name, { name: tableName });
        }

        // Schema Discovery
        const discovery = await state.discoveryService.discover(tableName);

        // Update State
        dispatch({
          type: 'ADD_TABLE',
          payload: {
            name: tableName,
            columns: discovery.columns,
            rowCount: discovery.rowCount,
            entities: discovery.entities
          }
        });

        dispatch({
          type: 'ADD_MESSAGE',
          payload: {
            text: `Loaded **${tableName}** (${discovery.rowCount} rows). I found ${Object.keys(discovery.entities).length} entities.`,
            sender: 'bot'
          }
        });
      }

      // Auto-detect relationships if >1 table
      // (This logic resides in discoveryService, we just need to use it eventually)

    } catch (err) {
      console.error(err);
      dispatch({ type: 'SET_ERROR', payload: `Upload failed: ${err.message}` });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // --- CHAT LOGIC ---
  const handleChat = async (input) => {
    // Handle object input (from Clarification Chips)
    const text = typeof input === 'object' ? (input.value || input.label || '') : input;

    if (!text || !text.trim() || !conn) return;

    // 1. Add User Message
    dispatch({ type: 'ADD_MESSAGE', payload: { text, sender: 'user' } });
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      // Clarification Response?
      if (awaitingClarification) {
        // ... handle clarification logic ...
        // For now simplified
        dispatch({ type: 'CLEAR_CLARIFICATION' });
      }

      // 2. AI Processing
      // We need to gather context from ALL tables
      const tableContext = (tables || []).map(t => ({
        name: t.name,
        columns: Object.keys(t.columns)
      }));

      // TODO: Pass multi-table context to SQL Generator
      // For now, we fallback to the active table or simple logic
      // Use the ReAct-enabled generateQuery method
      console.log('🤖 Query context:', {
        activeTable: state.activeTable,
        tableName: state.activeTable || CONFIG.DATABASE.TABLE_NAME,
        tablesCount: tables?.length || 0,
        firstTable: tables?.[0]?.name || 'none'
      });

      const response = await aiService.generateQuery(
        text,
        {
          discoveryCache: { columns: (tables && tables[0])?.columns || {} }, // Simplified single-table context for now
          conversationHistory: state.conversationMemory.getHistoryForPrompt(),
          schema: tableContext,
          tableName: state.activeTable || CONFIG.DATABASE.TABLE_NAME
        }
      );

      // 3. Handle ReAct Response
      console.log("🤖 AI Plan:", response);
      console.log("🤖 AI Action:", response.action);
      console.log("🤖 AI Payload:", response.payload);

      if (response.action === 'CLARIFY') {
        const clarificationData = response.payload;
        dispatch({
          type: 'SET_CLARIFICATION',
          payload: {
            options: clarificationData.options,
            query: text
          }
        });
        dispatch({
          type: 'ADD_MESSAGE',
          payload: {
            text: clarificationData.message || "I need some clarification.",
            sender: 'bot',
            isClarification: true
          }
        });
        return;
      }

      let rows = [];
      let resultMessage = response.thought || "Here is the data:";

      if (response.action === 'SQL') {
        // Execute SQL Payload
        const result = await conn.query(response.payload);
        rows = result.toArray().map(row => Object.fromEntries(row)); // Sanitize DuckDB rows
      } else if (response.action === 'PREDICT') {
        // Placeholder for Python execution
        dispatch({
          type: 'ADD_MESSAGE',
          payload: { text: "Python analysis is not yet fully connected in this view.", sender: 'bot' }
        });
        return;
      }

      // 4. Update State
      if (rows.length > 0) {
        dispatch({
          type: 'EXECUTE_QUERY_SUCCESS',
          payload: {
            data: {
              data: rows,
              title: "Query Results",
              isPrediction: false,
              visualHint: response.visual_hint
            }
          }
        });
        dispatch({
          type: 'ADD_MESSAGE',
          payload: { text: resultMessage, sender: 'bot' }
        });
      } else {
        dispatch({
          type: 'ADD_MESSAGE',
          payload: { text: "No results found for that query.", sender: 'bot' }
        });
      }

    } catch (err) {
      console.error('🤖 Chat processing error:', err);
      
// Fallback: Try to generate a simple SQL query
        try {
          const fallbackQuery = generateFallbackQuery(text, state.activeTable);
          console.log('🤖 Using fallback query:', fallbackQuery);
        
        const result = await conn.query(fallbackQuery);
        const rows = result.toArray().map(row => Object.fromEntries(row));
        
        if (rows.length > 0) {
          dispatch({
            type: 'EXECUTE_QUERY_SUCCESS',
            payload: {
              data: {
                data: rows,
                title: "Query Results (Fallback)",
                isPrediction: false,
                visual_hint: 'table'
              }
            }
          });
          
          dispatch({
            type: 'ADD_MESSAGE',
            payload: { 
              text: `Here are the results (AI was unavailable, used fallback query):`, 
              sender: 'bot' 
            }
          });
        } else {
          dispatch({
            type: 'ADD_MESSAGE',
            payload: { text: "No results found. Try rephrasing your question.", sender: 'bot' }
          });
        }
      } catch (fallbackErr) {
        console.error('🤖 Fallback query also failed:', fallbackErr);
        dispatch({ 
          type: 'ADD_MESSAGE', 
          payload: { 
            text: `I'm having trouble processing your request. The AI service may be unavailable. Please check if Ollama is running and try again.`, 
            sender: 'bot' 
          } 
        });
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // --- FALLBACK QUERY GENERATION ---
  const generateFallbackQuery = (question, tableName) => {
    const lowerQuestion = question.toLowerCase();
    
    // Simple keyword-based query generation
    if (lowerQuestion.includes('total') && lowerQuestion.includes('sale')) {
      return `SELECT SUM(sale_amount) as total_sales FROM ${tableName || 'dataset'};`;
    } else if (lowerQuestion.includes('count') || lowerQuestion.includes('total')) {
      return `SELECT COUNT(*) as total_count FROM ${tableName || 'dataset'};`;
    } else if (lowerQuestion.includes('region') && lowerQuestion.includes('sale')) {
      return `SELECT region, SUM(sale_amount) as total_sales FROM ${tableName || 'dataset'} GROUP BY region;`;
    } else if (lowerQuestion.includes('average')) {
      return `SELECT AVG(sale_amount) as average_sale FROM ${tableName || 'dataset'};`;
    } else {
      // Default: show sample data
      return `SELECT * FROM ${tableName || 'dataset'} LIMIT 10;`;
    }
  };

  // --- RESIZE LOGIC ---
  const handleResizeStart = useCallback(() => {
    dispatch({ type: 'SET_RESIZING', payload: true });
  }, []);

  const handleResize = useCallback((e) => {
    if (isResizing) {
      const newWidth = Math.max(300, Math.min(600, e.clientX));
      dispatch({ type: 'SET_SIDEBAR_WIDTH', payload: newWidth });
    }
  }, [isResizing]);

  const handleResizeEnd = useCallback(() => {
    dispatch({ type: 'SET_RESIZING', payload: false });
  }, []);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResize);
      window.addEventListener('mouseup', handleResizeEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleResize);
      window.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [isResizing, handleResize, handleResizeEnd]);


  // --- RENDER ---
  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-white font-sans overflow-hidden selection:bg-blue-500 selection:text-white">
      <ControlBanner
        conn={conn}
        isAIOnline={state.isAIOnline}
        currentFile={activeTable}
        isPythonReady={state.isPythonReady}
        highContrast={highContrast}
        toggleHighContrast={() => dispatch({ type: 'TOGGLE_HIGH_CONTRAST' })}
      />

      <div className="flex-1 flex overflow-hidden">
        <ChatSidebar
          messages={messages}
          isLoading={loading}
          onChat={handleChat}
          onFileUpload={handleFileUpload}
          sidebarWidth={sidebarWidth}
          isResizing={isResizing}
          onResizeStart={handleResizeStart}
          activeTable={activeTable}
          tables={tables || []}
          awaitingClarification={awaitingClarification}
          clarificationOptions={clarificationOptions}
          onClarificationSelect={(opt) => handleChat(opt)} // Treat option as chat input
        />

        <ErrorBoundary>
          <MainVisualization
            chartData={chartData}
            highContrast={highContrast}
            onGenerateReport={() => dispatch({ type: 'SET_SHOW_REPORT', payload: true })}
            isGeneratingReport={state.isGeneratingReport}
          />
        </ErrorBoundary>
      </div>
    </div>
  );
}