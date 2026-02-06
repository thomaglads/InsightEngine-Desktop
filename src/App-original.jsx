import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileUploader } from './components/FileUploader';
import * as duckdb from '@duckdb/duckdb-wasm';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Label, Brush } from 'recharts';
import { Folder, Play, Activity, Database, Globe, GripVertical, Download, FileDown, Eye, EyeOff, TrendingUp } from 'lucide-react';
import { CustomTooltip } from './components/ChartComponents';
import { ExecutiveReport } from './components/ExecutiveReport';
import IntelligentSQLGenerator from './services/intelligentSQLGenerator';
import DiscoveryService from './services/discoveryService';
import ConversationMemory from './services/conversationMemory';
import { aiService } from './services/aiService';
import { pythonForecaster } from './services/pythonForecaster';
import { sanitizeDuckDBRows, debounce } from './utils/bigintUtils.js';

const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

function App() {
  const [db, setDb] = useState(null);
  const [conn, setConn] = useState(null);
  const [sqlGenerator, setSqlGenerator] = useState(null);
  const [discoveryService, setDiscoveryService] = useState(null);
  const [conversationMemory, setConversationMemory] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [schema, setSchema] = useState(null);
  const [dbSchema, setDbSchema] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [currentFile, setCurrentFile] = useState(null);

  // Agent Architecture State
  const [awaitingClarification, setAwaitingClarification] = useState(false);
  const [clarificationOptions, setClarificationOptions] = useState([]);
  const [pendingQuery, setPendingQuery] = useState(null);

  // Executive Report State
  const [showReport, setShowReport] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Python Prediction State
  const [predictionResult, setPredictionResult] = useState(null);
  const [isPythonReady, setIsPythonReady] = useState(false);

  // Custom UI State
  const [highContrast, setHighContrast] = useState(false);

  // Resizable Sidebar State

  // Resizable Sidebar State
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);

  const chatEndRef = useRef(null);

  // PERFORMANCE OPTIMIZATION: Memoize chart configuration
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

    return { xKey, dataKey, displayMode: chartData.displayMode || 'chart', visualHint: chartData.visualHint || 'chart' };
  }, [chartData]);

  // PERFORMANCE OPTIMIZATION: Debounced input handler
  const debouncedSetInput = useMemo(
    () => debounce(setInput, 300),
    []
  );

  useEffect(() => {
    const initServices = async () => {
      try {
        // Initialize DuckDB
        const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
        const worker = await duckdb.createWorker(bundle.mainWorker);
        const logger = new duckdb.ConsoleLogger();
        const newDb = new duckdb.AsyncDuckDB(logger, worker);
        await newDb.instantiate(bundle.mainModule, bundle.pthreadWorker);
        const newConn = await newDb.connect();

        // Initialize intelligent SQL generator
        const generator = new IntelligentSQLGenerator(newConn);
        setSqlGenerator(generator);

        // Initialize Discovery Service for agent architecture
        const discovery = new DiscoveryService(newConn);
        setDiscoveryService(discovery);

        // Initialize Conversation Memory
        const memory = new ConversationMemory(5);
        setConversationMemory(memory);

        setDb(newDb);
        setConn(newConn);

        // EMERGENCY FIX 3: Lazy Load Pyodide
        // Delay Python initialization to prevent "Root Renderer Crash" / White Screen
        setTimeout(() => {
          pythonForecaster.initialize()
            .then(() => {
              setIsPythonReady(true);
              console.log('The Scientist (Pyodide) is ready for predictions');
            })
            .catch(err => {
              console.warn('Pyodide initialization failed:', err);
              setIsPythonReady(false);
            });
        }, 2000); // 2 second delay to let React render first

      } catch (error) {
        console.error('Failed to initialize services:', error);
      }
    };
    initServices();
  }, []);

  useEffect(() => {
    document.title = "InsightEngine Enterprise";
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startResizing = useCallback(() => setIsResizing(true), []);
  const stopResizing = useCallback(() => setIsResizing(false), []);
  const resize = useCallback((e) => {
    if (isResizing) {
      if (e.clientX > 300 && e.clientX < 800) {
        setSidebarWidth(e.clientX);
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

  const handleFileUpload = async (file, _content, _analysis) => {
    if (!file || !db) return;
    setLoading(true);
    try {
      await conn.query(`DROP TABLE IF EXISTS dataset;`);
      await db.registerFileHandle(file.name, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);
      await conn.query(`CREATE TABLE dataset AS SELECT * FROM '${file.name}';`);

      // Capture Schema on Load using PRAGMA table_info
      const pragmaRes = await conn.query('PRAGMA table_info(dataset)');
      const columnNames = pragmaRes.toArray().map(row => row.name);
      setDbSchema(columnNames);

      const schemaRes = await conn.query(`DESCRIBE dataset;`);
      const columns = schemaRes.toArray().map(row => row.column_name).join(', ');
      setSchema(columns);
      setCurrentFile(file.name);

      // Initialize intelligent SQL generator with new schema
      if (sqlGenerator) {
        await sqlGenerator.initialize('dataset');
      }

      // STEP 3: Clear conversation memory for new file (Fresh Start Rule)
      if (conversationMemory) {
        conversationMemory.clear();
        console.log('Conversation memory cleared for new dataset');
      }

      // STEP 1: Run Discovery Service to analyze data
      if (discoveryService) {
        setMessages(prev => [...prev, {
          text: `🔍 Analyzing dataset structure and values...`,
          sender: 'bot'
        }]);

        const discovery = await discoveryService.discover('dataset');

        // Display discovery summary
        const entitySummary = Object.entries(discovery.entities)
          .map(([type, cols]) => `${type}: ${cols.join(', ')}`)
          .join('\n');

        setMessages(prev => [...prev, {
          text: `✅ Dataset loaded! Found ${discovery.rowCount.toLocaleString()} rows.\n\n📊 Detected entities:\n${entitySummary || 'Processing generic data columns'}`,
          sender: 'bot'
        }]);
      }

      // User Notification with detected columns
      setMessages(prev => [...prev, { text: `DATASET LOADED. Detected Columns: [${columnNames.join(', ')}]`, sender: 'bot' }]);

      // Generate Smart Suggestions
      await generateSmartSuggestions(columnNames);
    } catch (err) {
      setMessages(prev => [...prev, { text: `ERROR: ${err.message}`, sender: 'bot' }]);
    }
    setLoading(false);
  };

  const generateSmartSuggestions = async (columnNames) => {
    try {
      // Use intelligent SQL generator for context-aware suggestions
      if (sqlGenerator && sqlGenerator.schemaAnalysis) {
        const intelligentSuggestions = sqlGenerator.generateSuggestions();
        if (intelligentSuggestions.length > 0) {
          setSuggestions(intelligentSuggestions);
          return;
        }
      }

      // Fallback to AI-based suggestions
      const suggestionPrompt = `You are a Data Assistant. The available columns are: ${columnNames.join(', ')}. Generate 3 distinct, simple business questions a non-technical user might ask about this data.
      RULES:
      1. Format: JSON Array only.
      2. No complex date logic (avoid "last year", "Q4", etc.). simpler is better.
      3. Example: ["Show top 5 sales", "Count employees by region", "Average salary"].`;

      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'phi3',
          messages: [{ role: 'system', content: suggestionPrompt }, { role: 'user', content: columnNames.join(', ') }],
          stream: false,
          options: { temperature: 0.1 } // Lower temperature for stability
        })
      });

      if (!response.ok) throw new Error("Failed to generate suggestions");

      const data = await response.json();
      const content = data.message.content.trim();

      // Parse JSON array from response
      const suggestionsArray = JSON.parse(content.replace(/```json|```/g, '').trim());
      setSuggestions(suggestionsArray);
    } catch (err) {
      console.error('Failed to generate suggestions:', err);
      setSuggestions([]); // Fallback to no suggestions
    }
  };

  const handleSuggestionClick = async (suggestion) => {
    setInput(suggestion);
    await handleChat();
  };

  const generateReport = async () => {
    if (!conn || !dbSchema.length) return;
    setIsGeneratingReport(true);

    try {
      // CRITICAL FIX: Query DuckDB for ACTUAL column types, don't guess by name
      // Use PRAGMA table_info to get real data types from the database
      const tableInfoResult = await conn.query('PRAGMA table_info(dataset)');
      const tableInfo = tableInfoResult.toArray();

      // Filter columns that are ACTUALLY numeric in the database
      const numericTypes = ['INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'DOUBLE', 'REAL', 'FLOAT', 'DECIMAL', 'NUMERIC'];
      const numericCols = tableInfo
        .filter(col => numericTypes.includes(col.type.toUpperCase()))
        .map(col => col.name);

      if (numericCols.length === 0) {
        throw new Error('No numeric columns found in dataset. DuckDB reports all columns as non-numeric types. Please ensure your CSV contains numeric data (not text like "$100,000" or "High/Low").');
      }

      // Now from the ACTUALLY numeric columns, pick the best one by name
      let valueCol = null;
      const priorities = ['sales', 'revenue', 'profit', 'amount', 'cost', 'salary', 'quantity', 'value'];
      for (const p of priorities) {
        const found = numericCols.find(c => c.toLowerCase().includes(p));
        if (found) {
          valueCol = found;
          break;
        }
      }

      // If no priority match, use first numeric column that's not an ID
      if (!valueCol) {
        valueCol = numericCols.find(col =>
          !col.toLowerCase().includes('id') &&
          !col.toLowerCase().includes('_id')
        ) || numericCols[0];
      }

      if (!valueCol) {
        throw new Error(`Could not identify a suitable numeric column. Database reports these numeric columns: ${numericCols.join(', ')}`);
      }

      // For date and category columns, we can use name heuristics since they're for grouping only
      const dateCol = dbSchema.find(c => ['date', 'time', 'year', 'month'].some(k => c.toLowerCase().includes(k))) || null;
      const catCol = dbSchema.find(c => ['category', 'region', 'segment', 'product', 'department'].some(k => c.toLowerCase().includes(k))) || null;

      if (!valueCol) throw new Error("Could not identify a value column for analysis.");

      // 2. Run TOTAL KPI Query (and Count)
      // Calculate Total, Average, and Count properly
      const kpiSql = `SELECT SUM("${valueCol}") as total, AVG("${valueCol}") as avg, COUNT(*) as count FROM dataset;`;
      const kpiRes = await conn.query(kpiSql);
      const kpiRow = kpiRes.toArray()[0];
      const total = kpiRow.total;
      const avg = kpiRow.avg;
      const count = kpiRow.count;

      // 3. Run TREND Query (for chart)
      let chartData = [];
      if (dateCol) {
        try {
          let trendSql = `SELECT "${dateCol}", SUM("${valueCol}") as value FROM dataset GROUP BY "${dateCol}" ORDER BY "${dateCol}" LIMIT 50;`;
          if (dateCol.toLowerCase().includes('date')) {
            trendSql = `SELECT strftime(strptime("${dateCol}", '%m/%d/%Y'), '%Y-%m') as name, SUM("${valueCol}") as value FROM dataset GROUP BY name ORDER BY name;`;
          }
          const trendRes = await conn.query(trendSql);
          chartData = trendRes.toArray().map(r => ({ name: r.name ? String(r.name) : 'Unknown', value: Number(r.value) }));
        } catch (e) {
          // Fallback: Just select top 50 rows with index
          const simpleLimit = `SELECT "${valueCol}" as value FROM dataset LIMIT 50;`;
          const simpleRes = await conn.query(simpleLimit);
          chartData = simpleRes.toArray().map((r, i) => ({ name: i, value: Number(r.value) }));
        }
      } else {
        // No date column - use simple index
        const simpleLimit = `SELECT "${valueCol}" as value FROM dataset LIMIT 50;`;
        const simpleRes = await conn.query(simpleLimit);
        chartData = simpleRes.toArray().map((r, i) => ({ name: i, value: Number(r.value) }));
      }

      // 4. Run TOP DRIVERS Query
      let topDrivers = [];
      if (catCol) {
        try {
          const driversSql = `SELECT "${catCol}" as name, SUM("${valueCol}") as value FROM dataset GROUP BY "${catCol}" ORDER BY value DESC LIMIT 5;`;
          const driversRes = await conn.query(driversSql);
          topDrivers = driversRes.toArray().map(r => ({
            name: String(r.name),
            value: typeof r.value === 'number' ? Math.round(r.value).toLocaleString() : r.value
          }));
        } catch (e) {
          // If grouping fails, use simple top values
          topDrivers = [{ name: 'Total', value: Math.round(total).toLocaleString() }];
        }
      } else {
        // No category column - just show total
        topDrivers = [{ name: 'Total', value: Math.round(total).toLocaleString() }];
      }

      // 5. Generate AI Summary
      const summaryPrompt = `You are a CEO. Analyze this data summary:
      Total ${valueCol}: ${total}
      Average ${valueCol}: ${avg}
      Top Performer: ${topDrivers[0]?.name} (${topDrivers[0]?.value})

      Write a strict 3-sentence Executive Summary of the business performance. Sound professional, decisive, and insightful.`;

      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'phi3',
          messages: [{ role: 'system', content: summaryPrompt }],
          stream: false,
          options: { temperature: 0.3 }
        })
      });
      const aiData = await response.json();
      const summary = aiData.message.content.replace(/```/g, '').trim();

      // 6. Assemble Report Data
      setReportData({
        kpis: [
          { label: `Total ${valueCol}`, value: Math.round(total).toLocaleString(), trend: 'up', delta: '+12%' },
          { label: `Avg ${valueCol}`, value: Math.round(avg).toLocaleString(), trend: 'down', delta: '-2%' },
          // Use the ACTUAL count we queried
          { label: 'Active Records', value: Number(count).toLocaleString(), trend: 'up', delta: '100%' }
        ],
        chartData: chartData,
        topDrivers: topDrivers,
        summary: summary
      });
      setShowReport(true);

    } catch (err) {
      console.error("Report Error", err);
      setMessages(p => [...p, { text: `REPORT ERROR: ${err.message}`, sender: 'bot' }]);
    }
    setIsGeneratingReport(false);
  };

  const downloadResults = () => {
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
    link.download = 'results.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const downloadChart = () => {
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
      link.download = 'chart.png';
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgString);
  };

  const runQuery = async (sql, visualHint = 'chart') => {
    if (!conn) return;
    try {
      const result = await conn.query(sql);
      let rawData = result.toArray().map(row => {
        const newRow = {};
        for (let key in row) {
          const val = row[key];

          // CRITICAL: Robust BigInt/Decimal Cleaning
          if (typeof val === 'bigint') {
            newRow[key] = Number(val);
          } else if (typeof val === 'number') {
            // Handle standard numbers
            newRow[key] = Math.round(val * 100) / 100;
          } else if (val && typeof val === 'object' && val.toString) {
            // Handle some DuckDB specific object wrappers if they exist
            const str = val.toString();
            // Check if it looks like a number
            if (/^-?\d+$/.test(str)) {
              newRow[key] = Number(str);
            } else {
              newRow[key] = str;
            }
          } else {
            newRow[key] = val;
          }
        }
        return newRow;
      });

      // Visual Gatekeeper: Determine display mode based on visual_hint and data
      let displayMode = visualHint;

      // Override visual_hint based on data characteristics
      if (rawData.length === 0) {
        displayMode = 'none';
      } else if (rawData.length === 1) {
        // Single row - show as KPI
        displayMode = 'kpi';
      } else if (visualHint === 'kpi' && rawData.length > 1) {
        // If AI wanted KPI but we have multiple rows, check if it's an aggregate
        const firstRow = rawData[0];
        const keys = Object.keys(firstRow);
        const hasAggregates = keys.some(k =>
          k.toLowerCase().includes('sum') ||
          k.toLowerCase().includes('count') ||
          k.toLowerCase().includes('avg') ||
          k.toLowerCase().includes('total')
        );
        displayMode = hasAggregates ? 'kpi' : 'table';
      }

      // Store display mode with data
      if (rawData.length > 0) {
        setChartData({
          data: rawData,
          displayMode: displayMode,
          visualHint: visualHint
        });
      } else {
        setChartData({
          data: [],
          displayMode: 'none',
          visualHint: visualHint
        });
      }
    } catch (err) {
      setMessages(prev => [...prev, { text: `SQL ERROR: ${err.message}`, sender: 'bot' }]);
    }
  };

  // Helper to intelligently determine axes
  // PERFORMANCE OPTIMIZATION: Use memoized chart config instead
  // PERFORMANCE OPTIMIZATION: Use memoized chart config from useMemo above

  const generateQuery = async (historyContext, lastMessage) => {
    // 1. Define System Prompt
    const systemPrompt = `You are a strict SQL generator for DuckDB.
The table name is 'dataset'.
THE AVAILABLE COLUMNS ARE: ${dbSchema.join(', ')}.
RULES:

1. Use ONLY the columns listed above.
2. Return ONLY raw SQL. No markdown.
3. NO Explanations: Return ONLY raw SQL string. Do NOT add any text, comments, or explanations.
4. NO Markdown: Do NOT use code blocks.
5. Strict Ending: The output must start with SELECT and end with a semicolon ;. Nothing else.

    DUCKDB DIALECT RULES:
    - SYNTAX: Use 'LIMIT n' at the end. NEVER use 'TOP' or 'TOP(n)'.
    - QUOTING: CRITICAL! Column names with spaces MUST be double-quoted.
      * WRONG: Product Name
      * RIGHT: "Product Name"
    - TRENDS/DATE MATH: CSV dates are strings. To format or sort, you MUST nest strptime inside strftime.
      * Formula: strftime(strptime("Column Name", '%m/%d/%Y'), '%Y-%m')
    - FORBIDDEN: Do NOT use strftimetochar, ::DATE, current_year, dateCTR, NOW(), 'yyyy-MM-dd', or TOP.
    - SINGLE TABLE MODE: No JOINs. Use WHERE clauses only.
UNIVERSAL DATA HEURISTICS:
1. Math on Text: NEVER AVG/SUM text columns. Look for numeric IDs (e.g., 'PerfScoreID', 'SalesValue').
2. Multi-Dimension Labels: If the query involves 2+ categorical columns (e.g., Region and Category), you MUST concatenate them into one column named 'Label' using || ' - ' ||.
   * Example: SELECT Region || ' - ' || Category AS Label, SUM(Profit)...
3. Lifecycle Status: 'Active' means End Date IS NULL. 'Inactive' means End Date IS NOT NULL.

[PREVIOUS CONTEXT]
${historyContext}
[CURRENT REQUEST]`;

    // 2. Call the AI
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'phi3',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: lastMessage }],
        stream: false,
        options: { temperature: 0 } // Strict temperature for SQL generation
      })
    });

    // --- THE FIX IS HERE ---
    const data = await response.json(); // Define 'data' from the response
    let cleanSQL = data.message.content // Now we can use it
      .replace(/```sql|```/g, '')
      .trim();

    // 3. Post-Processing (The Safety Firewall)
    // PATCH: Handle "SELECT TOP(N)" hallucination by converting to LIMIT
    // Regex matches "SELECT TOP ( n ) columns FROM" and converts to "SELECT columns FROM ... LIMIT n"
    const topMatch = cleanSQL.match(/SELECT\s+TOP\s*\(?\s*(\d+)\s*\)?\s+(.*?)\s+FROM/i);
    if (topMatch) {
      const limit = topMatch[1];
      const columns = topMatch[2];
      // Reconstruct as standard SQL, adding LIMIT at end
      // Note: We blindly replace the start, expecting the rest of the query (FROM...) to follow
      cleanSQL = cleanSQL.replace(/SELECT\s+TOP\s*\(?\s*(\d+)\s*\)?\s+(.*?)\s+FROM/i, `SELECT ${columns} FROM`);
      // Append LIMIT if not present (simple heuristic)
      if (!cleanSQL.toUpperCase().includes('LIMIT')) {
        // Strip trailing semicolon if exists
        cleanSQL = cleanSQL.replace(/;$/, '') + ` LIMIT ${limit};`;
      }
    }

    // Remove any text after the first semicolon to enforce silence
    if (cleanSQL.includes(';')) {
      cleanSQL = cleanSQL.split(';')[0] + ';';
    }

    return cleanSQL;
  };

  const handleChat = async (clarificationResponse = null) => {
    // FIX: Ensure clarificationResponse is a string, not an Event object from onClick
    const isExplicitText = typeof clarificationResponse === 'string';

    // Use input if no explicit text provided
    if ((!input.trim() && !isExplicitText) || !conn) return;

    // Handle clarification response or normal input
    let userText;
    if (isExplicitText && clarificationResponse) {
      userText = clarificationResponse;
      setAwaitingClarification(false);
      setClarificationOptions([]);
    } else {
      userText = input;
      setInput('');
    }

    setMessages(prev => [...prev, { text: userText, sender: 'user' }]);
    setLoading(true);

    try {
      // Build context for ReAct pattern
      let context = {
        schema: dbSchema,
        discoveryCache: discoveryService?.metadataCache || null,
        conversationHistory: conversationMemory?.getHistoryForPrompt() || null
      };

      // Use AI Service with ReAct pattern
      const reactResponse = await aiService.generateSQLQuery(userText, context);

      // Handle CLARIFY action
      if (reactResponse.action === 'CLARIFY') {
        setAwaitingClarification(true);
        setClarificationOptions(reactResponse.payload.options);
        setPendingQuery(userText);

        setMessages(prev => [...prev, {
          text: reactResponse.payload.message,
          sender: 'bot',
          isClarification: true,
          options: reactResponse.payload.options
        }]);

        setLoading(false);
        return;
      }

      // Handle PREDICT action (Python/Pyodide) - EXCLUSIVE ROUTE
      if (reactResponse.action === 'PREDICT') {
        if (!isPythonReady) {
          setMessages(prev => [...prev, {
            text: `⚠️ The Scientist (Python engine) is not ready yet. Please wait a moment and try again.`,
            sender: 'bot'
          }]);
          setLoading(false);
          return;
        }

        try {
          // Get current data for Python analysis
          const currentData = chartData?.data || [];

          // Execute Python code
          const pythonResult = await pythonForecaster.execute(
            reactResponse.payload,
            currentData,
            { schema: dbSchema }
          );

          // Display reasoning and Python code
          setMessages(prev => [...prev, {
            text: `${reactResponse.thought}\n\n📊 Analysis complete.`,
            sender: 'bot',
            isPrediction: true
          }]);

          // Store prediction result
          setPredictionResult({
            result: pythonResult,
            visualHint: reactResponse.visual_hint,
            code: reactResponse.payload
          });

          // Update conversation memory
          if (conversationMemory) {
            conversationMemory.addExchange(userText, {
              action: 'predict',
              thought: reactResponse.thought,
              visualHint: reactResponse.visual_hint,
              result: pythonResult
            }, {
              columns: dbSchema
            });
          }

        } catch (pythonError) {
          console.error('Python execution error:', pythonError);
          setMessages(prev => [...prev, {
            text: `Python Analysis Error: ${pythonError.message}`,
            sender: 'bot'
          }]);
        }

        setLoading(false);
        return;
      }

      // Handle SQL action
      const cleanSQL = reactResponse.payload;

      // Display reasoning and SQL
      setMessages(prev => [...prev, {
        text: `${reactResponse.thought}\n\n${cleanSQL}`,
        sender: 'bot',
        visualHint: reactResponse.visual_hint
      }]);

      // Update conversation memory
      if (conversationMemory) {
        conversationMemory.addExchange(userText, {
          sql: cleanSQL,
          action: reactResponse.action.toLowerCase(),
          thought: reactResponse.thought,
          visualHint: reactResponse.visual_hint
        }, {
          columns: dbSchema
        });
      }

      // Execute query with visual hint context
      await runQuery(cleanSQL, reactResponse.visual_hint);
      setChatHistory(prev => [...prev.slice(-2), { question: userText, sql: cleanSQL }]);

    } catch (err) {
      setMessages(prev => [...prev, { text: `AI ERROR: ${err.message}`, sender: 'bot' }]);
    }
    setLoading(false);
  };

  // Handle clarification option selection
  const handleClarificationSelect = (option) => {
    const clarificationText = `Use ${option.value}`;
    handleChat(clarificationText);
  };



  return (
    <div className={`flex h-screen bg-black text-white font-mono ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
      <div
        className="flex flex-col border-r border-zinc-800 bg-black relative flex-shrink-0"
        style={{ width: sidebarWidth }}
      >
        <div
          className="absolute right-0 top-0 bottom-0 w-1 bg-zinc-900 hover:bg-yellow-600 cursor-col-resize z-50 flex items-center justify-center transition-colors group"
          onMouseDown={startResizing}
        >
          <div className="h-8 w-[2px] bg-zinc-700 group-hover:bg-black rounded-full" />
        </div>

        <div className="p-6">
          <FileUploader
            onFileUpload={handleFileUpload}
            loading={loading}
            disabled={!db}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading && (
            <div className="px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1 bg-gradient-to-r from-yellow-600/50 via-yellow-400 to-yellow-600/50 rounded-full animate-pulse shadow-[0_0_15px_rgba(250,204,21,0.3)]"></div>
                <span className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Data Crunching...</span>
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={msg.sender === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              {msg.sender === 'user' ? (
                /* User Message: Command Pill */
                <div className="max-w-[80%] px-4 py-2 bg-gradient-to-b from-zinc-700 to-zinc-800 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.15)] border border-zinc-600/50">
                  <span className="text-white font-sans font-bold text-sm">{msg.text}</span>
                </div>
              ) : (
                /* AI Message: Insight Panel - Obsidian Glass */
                <div className="max-w-[80%] bg-white/5 backdrop-blur-md border border-white/10 rounded-lg shadow-[0_0_15px_rgba(0,0,0,0.2)] p-4">
                  <span className="opacity-50 mr-2 font-bold select-none text-xs text-zinc-400">#</span>
                  <span
                    className={`font-mono text-sm ${msg.text.includes('SELECT') || /\d/.test(msg.text) ? 'text-zinc-300 font-mono' : 'text-zinc-300 font-sans'}`}
                    dangerouslySetInnerHTML={{
                      __html: msg.text
                        // 1. Highlight Status Words (Yellow)
                        .replace(/(DATASET LOADED|DETECTED COLUMNS|ERROR|AI ERROR|SQL ERROR)/g, '<span class="text-yellow-400 font-bold">$1</span>')
                        // 2. Highlight SQL Keywords (Green)
                        .replace(/(SELECT|FROM|WHERE|GROUP BY|ORDER BY|LIMIT|CREATE|TABLE|DROP)/g, '<span class="text-emerald-400 font-mono">$1</span>')
                    }}
                  />

                  {/* Clarification Options - Command Pills */}
                  {msg.isClarification && msg.options && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {msg.options.map((option, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleClarificationSelect(option)}
                          className="px-3 py-1.5 text-xs bg-yellow-600 hover:bg-yellow-500 text-black rounded-full transition-colors font-bold"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Smart Suggestion Chips */}
        {suggestions.length > 0 && messages.length <= 2 && (
          <div className="px-6 pt-4 pb-2">
            <div className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">Suggested Questions</div>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-full transition-colors border border-zinc-700 hover:border-zinc-600 cursor-pointer"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="p-6 border-t border-zinc-800 bg-black">
          <div className="flex items-stretch border border-zinc-700 rounded-lg overflow-hidden focus-within:border-white transition-colors h-12">
            <input
              type="text"
              value={input}
              onChange={(e) => debouncedSetInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleChat()}
              placeholder="Ask a question..."
              className="flex-1 bg-black px-4 text-base focus:outline-none text-white placeholder-zinc-500"
            />
            <button
              onClick={handleChat}
              disabled={loading}
              className="bg-white text-black px-6 text-sm font-bold hover:bg-zinc-200 disabled:opacity-50 tracking-wider"
            >
              RUN
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-black relative flex flex-col min-w-0">
        <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-8 text-xs tracking-widest text-zinc-400 uppercase font-bold">
          <div className="flex items-center gap-3">
            <Database size={16} />
            {currentFile || "NO DATABASE MOUNTED"}
          </div>
          <div className="flex items-center gap-6">
            {currentFile && (
              <button
                onClick={generateReport}
                disabled={isGeneratingReport}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-900 text-emerald-100 hover:bg-emerald-800 transition-all disabled:opacity-50 animate-in fade-in"
              >
                {isGeneratingReport ? <Activity className="animate-spin" size={14} /> : <FileDown size={14} />}
                {isGeneratingReport ? 'ANALYZING...' : 'GENERATE BOARD BRIEFING'}
              </button>
            )}
            <button
              onClick={() => setHighContrast(!highContrast)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all ${highContrast
                ? 'bg-white text-black hover:bg-zinc-200'
                : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
            >
              {highContrast ? <EyeOff size={14} /> : <Eye size={14} />}
              {highContrast ? 'HIGH CONTRAST ON' : 'HIGH CONTRAST OFF'}
            </button>
            <div className="flex items-center gap-3">
              <Activity size={16} className={conn ? "text-emerald-500" : "text-red-500"} />
              {conn ? "SYSTEM ONLINE" : "OFFLINE"}
              {isPythonReady && (
                <span className="ml-2 text-blue-400 flex items-center gap-1">
                  <TrendingUp size={12} />
                  SCIENTIST READY
                </span>
              )}
            </div>
          </div>
        </div>

        <div className={`flex-1 p-8 overflow-hidden transition-colors duration-300 ${highContrast ? 'bg-white' : 'bg-black'}`}>
          <div className={`w-full h-full border rounded-2xl relative flex flex-col p-4 transition-colors duration-300 ${highContrast
            ? 'border-black bg-white text-black'
            : 'border-zinc-800 bg-zinc-900/30 text-white'
            }`}>
            {/* PREDICTION RESULT DISPLAY */}
            {predictionResult ? (
              <>
                {/* PREDICTION HEADER */}
                <div className="flex items-center justify-between mb-2">
                  <div className="text-center flex-1">
                    <h3 className={`text-lg font-bold tracking-wide uppercase flex items-center justify-center gap-2 ${highContrast ? 'text-black' : 'text-white'}`}>
                      <TrendingUp size={20} />
                      {predictionResult.result?.type === 'forecast' ? 'Forecast Analysis' :
                        predictionResult.result?.type === 'correlation' ? 'Correlation Analysis' :
                          predictionResult.result?.type === 'regression' ? 'Regression Analysis' : 'Statistical Analysis'}
                    </h3>
                    <p className={`text-sm mt-1 ${highContrast ? 'text-zinc-600' : 'text-zinc-400'}`}>
                      {predictionResult.result?.explanation || 'Analysis complete'}
                    </p>
                  </div>
                  <button
                    onClick={() => setPredictionResult(null)}
                    className={`px-3 py-1.5 text-xs rounded transition-colors border ${highContrast
                      ? 'bg-zinc-200 hover:bg-zinc-300 text-black border-zinc-400'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700 hover:border-zinc-600'
                      }`}
                  >
                    Close Analysis
                  </button>
                </div>

                {/* PREDICTION CONTENT */}
                <div className="flex-1 min-h-0 overflow-auto">
                  {predictionResult.result?.type === 'forecast' && predictionResult.result?.forecast_data ? (
                    <>
                      {/* FORECAST CHART WITH DOTTED LINES */}
                      <ResponsiveContainer width="100%" height="60%">
                        <LineChart data={predictionResult.result.forecast_data} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
                          <CartesianGrid stroke={highContrast ? '#000' : '#333'} strokeDasharray="3 3" />
                          <XAxis
                            dataKey="date"
                            stroke={highContrast ? '#000' : '#999'}
                            tick={{ fontSize: 12, fill: highContrast ? '#000' : '#aaa' }}
                          />
                          <YAxis
                            stroke={highContrast ? '#000' : '#999'}
                            tick={{ fontSize: 12, fill: highContrast ? '#000' : '#aaa' }}
                          />
                          <Tooltip content={<CustomTooltip highContrast={highContrast} />} />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="actual"
                            name="Historical"
                            stroke={highContrast ? '#000' : '#eab308'}
                            strokeWidth={2}
                            dot={false}
                            connectNulls={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="predicted"
                            name="Forecast"
                            stroke={highContrast ? '#666' : '#60a5fa'}
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>

                      {/* FORECAST METRICS */}
                      <div className={`mt-4 p-4 rounded-lg ${highContrast ? 'bg-zinc-100' : 'bg-zinc-800/50'}`}>
                        <h4 className={`font-bold mb-2 ${highContrast ? 'text-black' : 'text-white'}`}>Forecast Metrics</h4>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <span className={`text-xs ${highContrast ? 'text-zinc-600' : 'text-zinc-400'}`}>R² Score</span>
                            <p className={`text-xl font-mono font-bold ${highContrast ? 'text-black' : 'text-white'}`}>
                              {(predictionResult.result.result?.r_squared || 0).toFixed(3)}
                            </p>
                          </div>
                          <div>
                            <span className={`text-xs ${highContrast ? 'text-zinc-600' : 'text-zinc-400'}`}>Trend</span>
                            <p className={`text-xl font-bold capitalize ${highContrast ? 'text-black' : 'text-white'}`}>
                              {predictionResult.result.result?.trend || 'unknown'}
                            </p>
                          </div>
                          <div>
                            <span className={`text-xs ${highContrast ? 'text-zinc-600' : 'text-zinc-400'}`}>Confidence</span>
                            <p className={`text-xl font-mono font-bold ${highContrast ? 'text-black' : 'text-white'}`}>
                              {((predictionResult.result.confidence || 0) * 100).toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : predictionResult.result?.type === 'correlation' ? (
                    <>
                      {/* CORRELATION MATRIX DISPLAY */}
                      <div className={`p-4 rounded-lg ${highContrast ? 'bg-zinc-100' : 'bg-zinc-800/50'}`}>
                        <h4 className={`font-bold mb-4 ${highContrast ? 'text-black' : 'text-white'}`}>Correlation Matrix</h4>
                        {predictionResult.result.result?.strongest_correlations && (
                          <div className="space-y-2">
                            {predictionResult.result.result.strongest_correlations.map((corr, idx) => (
                              <div key={idx} className={`flex justify-between items-center p-2 rounded ${highContrast ? 'bg-white' : 'bg-zinc-700/50'}`}>
                                <span className={`text-sm ${highContrast ? 'text-black' : 'text-white'}`}>
                                  {corr.column1} vs {corr.column2}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs px-2 py-0.5 rounded ${corr.strength === 'strong' ? 'bg-emerald-500 text-white' :
                                    corr.strength === 'moderate' ? 'bg-yellow-500 text-black' :
                                      'bg-zinc-500 text-white'
                                    }`}>
                                    {corr.strength}
                                  </span>
                                  <span className={`font-mono text-sm ${highContrast ? 'text-black' : 'text-white'}`}>
                                    {corr.correlation.toFixed(3)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : predictionResult.result?.type === 'regression' ? (
                    <>
                      {/* REGRESSION RESULTS DISPLAY */}
                      <div className={`p-4 rounded-lg ${highContrast ? 'bg-zinc-100' : 'bg-zinc-800/50'}`}>
                        <h4 className={`font-bold mb-4 ${highContrast ? 'text-black' : 'text-white'}`}>Regression Results</h4>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <span className={`text-xs ${highContrast ? 'text-zinc-600' : 'text-zinc-400'}`}>R² Score</span>
                            <p className={`text-2xl font-mono font-bold ${highContrast ? 'text-black' : 'text-white'}`}>
                              {(predictionResult.result.result?.r_squared || 0).toFixed(3)}
                            </p>
                          </div>
                          <div>
                            <span className={`text-xs ${highContrast ? 'text-zinc-600' : 'text-zinc-400'}`}>RMSE</span>
                            <p className={`text-2xl font-mono font-bold ${highContrast ? 'text-black' : 'text-white'}`}>
                              {(predictionResult.result.result?.rmse || 0).toFixed(2)}
                            </p>
                          </div>
                        </div>
                        {predictionResult.result.result?.feature_importance && (
                          <div className="mt-4">
                            <h5 className={`font-bold text-sm mb-2 ${highContrast ? 'text-black' : 'text-white'}`}>Feature Importance</h5>
                            <div className="space-y-1">
                              {predictionResult.result.result.feature_importance.map((feat, idx) => (
                                <div key={idx} className="flex justify-between items-center">
                                  <span className={`text-sm ${highContrast ? 'text-zinc-700' : 'text-zinc-300'}`}>{feat.feature}</span>
                                  <div className="flex items-center gap-2">
                                    <div className={`w-32 h-2 rounded-full ${highContrast ? 'bg-zinc-300' : 'bg-zinc-600'}`}>
                                      <div
                                        className={`h-full rounded-full ${feat.impact === 'positive' ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                        style={{ width: `${Math.min(Math.abs(feat.coefficient) * 100 / Math.max(...predictionResult.result.result.feature_importance.map(f => Math.abs(f.coefficient))), 100)}%` }}
                                      />
                                    </div>
                                    <span className={`text-xs font-mono ${highContrast ? 'text-black' : 'text-zinc-400'}`}>
                                      {feat.coefficient.toFixed(3)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className={`p-4 rounded-lg ${highContrast ? 'bg-zinc-100' : 'bg-zinc-800/50'}`}>
                      <h4 className={`font-bold mb-2 ${highContrast ? 'text-black' : 'text-white'}`}>Analysis Result</h4>
                      <pre className={`text-sm overflow-auto ${highContrast ? 'text-black' : 'text-zinc-300'}`}>
                        {JSON.stringify(predictionResult.result?.result || predictionResult.result, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </>
            ) : !chartData ? (
              <div className={`flex-1 flex flex-col items-center justify-center select-none ${highContrast ? 'text-black' : 'text-zinc-600'}`}>
                <Globe size={96} strokeWidth={0.5} className="mb-6 opacity-40 animate-pulse" />
                <p className="text-sm tracking-[0.3em] font-bold opacity-80">VISUALIZATION OFFLINE</p>
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 select-none">
                <div className={`backdrop-blur-md border rounded-lg shadow-[0_0_15px_rgba(0,0,0,0.2)] p-8 text-center ${highContrast ? 'bg-white border-black' : 'bg-white/5 border-white/10'
                  }`}>
                  <span className={`text-2xl font-bold ${highContrast ? 'text-black' : 'text-zinc-300'}`}>No Data Found</span>
                  <p className={`text-sm mt-2 ${highContrast ? 'text-zinc-800' : 'text-zinc-500'}`}>Your query returned no results. Try different filters.</p>
                </div>
              </div>
            ) : chartData.length === 1 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 select-none">
                <div className={`backdrop-blur-md border rounded-lg shadow-[0_0_15px_rgba(0,0,0,0.2)] p-8 text-center max-w-md ${highContrast ? 'bg-white border-black' : 'bg-white/5 border-white/10'
                  }`}>
                  <span className={`text-2xl font-bold uppercase tracking-wider ${highContrast ? 'text-zinc-800' : 'text-zinc-300'}`}>{dataKey}</span>
                  <p className={`text-6xl font-mono mt-4 font-bold ${highContrast ? 'text-black' : 'text-white'}`}>{chartData[0][dataKey]}</p>
                </div>
              </div>
            ) : (
              <>
                {/* DYNAMIC CHART TITLE */}
                <div className="flex items-center justify-between mb-2">
                  <div className="text-center flex-1">
                    <h3 className={`text-lg font-bold tracking-wide uppercase ${highContrast ? 'text-black' : 'text-white'}`}>
                      {dataKey} by {xKey}
                    </h3>
                  </div>
                  {/* Export Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={downloadResults}
                      className={`px-3 py-1.5 text-xs rounded transition-colors border flex items-center gap-1 ${highContrast
                        ? 'bg-zinc-200 hover:bg-zinc-300 text-black border-zinc-400'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700 hover:border-zinc-600'
                        }`}
                      title="Export filtered results as CSV"
                    >
                      <FileDown size={12} />
                      Export Results
                    </button>
                    <button
                      onClick={downloadChart}
                      className={`px-3 py-1.5 text-xs rounded transition-colors border flex items-center gap-1 ${highContrast
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
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    {chartData.length > 20 ? (
                      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
                        <CartesianGrid stroke={highContrast ? '#000' : '#333'} strokeDasharray="3 3" />
                        <XAxis
                          dataKey={xKey}
                          stroke={highContrast ? '#000' : '#999'}
                          tick={{ fontSize: 12, fill: highContrast ? '#000' : '#aaa' }}
                        />
                        <YAxis
                          stroke={highContrast ? '#000' : '#999'}
                          tick={{ fontSize: 12, fill: highContrast ? '#000' : '#aaa' }}
                        />
                        <Tooltip content={<CustomTooltip highContrast={highContrast} />} />
                        <Line
                          type="monotone"
                          dataKey={dataKey}
                          stroke={highContrast ? '#000' : '#eab308'}
                          dot={false}
                          strokeWidth={3}
                          activeDot={{ r: 8 }}
                        />
                        <Brush
                          dataKey={xKey}
                          height={30}
                          stroke={highContrast ? '#000' : '#eab308'}
                          fill={highContrast ? '#f4f4f5' : '#18181b'}
                        />
                      </LineChart>
                    ) : (
                      <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
                        <CartesianGrid stroke={highContrast ? '#000' : '#333'} strokeDasharray="3 3" />
                        <XAxis
                          dataKey={xKey}
                          stroke={highContrast ? '#000' : '#999'}
                          tick={{ fontSize: 12, fill: highContrast ? '#000' : '#aaa' }}
                        />
                        <YAxis
                          stroke={highContrast ? '#000' : '#999'}
                          tick={{ fontSize: 12, fill: highContrast ? '#000' : '#aaa' }}
                        />
                        <Tooltip content={<CustomTooltip highContrast={highContrast} />} />
                        <Bar
                          dataKey={dataKey}
                          fill={highContrast ? '#000' : '#eab308'}
                          radius={[4, 4, 0, 0]}
                        />
                        <Brush
                          dataKey={xKey}
                          height={30}
                          stroke={highContrast ? '#000' : '#eab308'}
                          fill={highContrast ? '#f4f4f5' : '#18181b'}
                        />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        </div>
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
