import React, { useReducer, useEffect, useRef, useCallback, useMemo } from 'react';
import * as duckdb from '@duckdb/duckdb-wasm';
import { Database, Globe, Activity, TrendingUp } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import ControlBanner from './components/ControlBanner.jsx';
import IntelligentSQLGenerator from './services/intelligentSQLGenerator';
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
  useEffect(() => {
    const init = async () => {
      // 1. Init DuckDB
      const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
      const worker = new Worker(bundle.mainWorker);
      const logger = new duckdb.ConsoleLogger();
      const newDb = new duckdb.AsyncDuckDB(logger, worker);
      await newDb.instantiate(bundle.mainModule, bundle.pthreadWorker);
      const newConn = await newDb.connect();

      // 2. Init Services
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

      // 3. Lazy Load Python (2s delay)
      setTimeout(() => {
        pythonForecaster.init().then(() => {
          dispatch({ type: 'SET_PYTHON_READY', payload: true });
        });
      }, 2000);
    };

    init().catch(console.error);
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
  const handleChat = async (text) => {
    if (!text.trim() || !conn) return;

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
      const tableContext = tables.map(t => ({
        name: t.name,
        columns: Object.keys(t.columns)
      }));

      // TODO: Pass multi-table context to SQL Generator
      // For now, we fallback to the active table or simple logic
      const response = await aiService.generateSQL(
        text,
        { tables: tableContext, dbSchema: tableContext }, // Mock schema structure
        state.conversationMemory.getHistory()
      );

      if (response.needsClarification) {
        dispatch({
          type: 'SET_CLARIFICATION',
          payload: { options: response.options, query: text }
        });
        dispatch({
          type: 'ADD_MESSAGE',
          payload: { text: response.clarificationPrompt, sender: 'bot', isClarification: true }
        });
        return; // EXIT
      }

      // 3. Execute SQL
      const result = await conn.query(response.sql);
      const rows = sanitizeDuckDBRows(result.toArray());

      // 4. Update State
      if (rows.length > 0) {
        dispatch({
          type: 'EXECUTE_QUERY_SUCCESS',
          payload: {
            data: {
              data: rows,
              title: "Query Results",
              isPrediction: false
            }
          }
        });
        dispatch({
          type: 'ADD_MESSAGE',
          payload: { text: response.explanation || "Here is the data:", sender: 'bot' }
        });
      } else {
        dispatch({
          type: 'ADD_MESSAGE',
          payload: { text: "No results found for that query.", sender: 'bot' }
        });
      }

    } catch (err) {
      console.error(err);
      dispatch({ type: 'SET_ERROR', payload: err.message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
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
    <div className="h-screen w-screen flex flex-col bg-gray-50 text-gray-900 font-sans overflow-hidden">
      <ControlBanner
        db={db}
        activeTable={activeTable}
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