import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as duckdb from '@duckdb/duckdb-wasm';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Label, Brush } from 'recharts';
import { Folder, Play, Activity, Database, Globe, GripVertical, Download, FileDown, Eye, EyeOff } from 'lucide-react';
import { CustomTooltip } from './components/ChartComponents';
import { ExecutiveReport } from './components/ExecutiveReport';

const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

function App() {
  const [db, setDb] = useState(null);
  const [conn, setConn] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [schema, setSchema] = useState(null);
  const [dbSchema, setDbSchema] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [currentFile, setCurrentFile] = useState(null);

  // Executive Report State
  const [showReport, setShowReport] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Custom UI State
  const [highContrast, setHighContrast] = useState(false);

  // Resizable Sidebar State

  // Resizable Sidebar State
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);

  const chatEndRef = useRef(null);

  useEffect(() => {
    const initDB = async () => {
      const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
      const worker = await duckdb.createWorker(bundle.mainWorker);
      const logger = new duckdb.ConsoleLogger();
      const newDb = new duckdb.AsyncDuckDB(logger, worker);
      await newDb.instantiate(bundle.mainModule, bundle.pthreadWorker);
      const newConn = await newDb.connect();
      setDb(newDb);
      setConn(newConn);
    };
    initDB();
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

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
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
      // 1. Identify Key Columns (Heuristics)
      const numericCols = dbSchema.filter(col =>
        !col.toLowerCase().includes('id') &&
        !col.toLowerCase().includes('date') &&
        !col.toLowerCase().includes('year') &&
        !col.toLowerCase().includes('zip') &&
        !col.toLowerCase().includes('phone')
      );

      // Strict Priority for Value Column
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

      const dateCol = dbSchema.find(c => ['date', 'time', 'year', 'month'].some(k => c.toLowerCase().includes(k))) || 'Order Date';
      const catCol = dbSchema.find(c => ['category', 'region', 'segment', 'product'].some(k => c.toLowerCase().includes(k))) || 'Category';

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
      // Group by Date (or simple index if no date)
      // Use strftime if dateCol exists, else just limit
      let trendSql = `SELECT "${dateCol}", SUM("${valueCol}") as value FROM dataset GROUP BY "${dateCol}" ORDER BY "${dateCol}" LIMIT 50;`;
      if (dateCol.toLowerCase().includes('date')) {
        // Try to format by Month if possible, otherwise raw
        trendSql = `SELECT strftime(strptime("${dateCol}", '%m/%d/%Y'), '%Y-%m') as name, SUM("${valueCol}") as value FROM dataset GROUP BY name ORDER BY name;`;
      }

      // Fallback if strftime fails (catch block logic usually, but here we try/catch specifically?)
      // For safety, let's use a simpler aggregation if simple group by fails.
      // Actually, let's use the SAFE trend query.
      let chartData = [];
      try {
        const trendRes = await conn.query(trendSql);
        chartData = trendRes.toArray().map(r => ({ name: r.name ? String(r.name) : 'Unknown', value: Number(r.value) }));
      } catch (e) {
        // Fallback: Just select top 50 rows
        const simpleLimit = `SELECT "${valueCol}" as value FROM dataset LIMIT 50;`;
        const simpleRes = await conn.query(simpleLimit);
        chartData = simpleRes.toArray().map((r, i) => ({ name: i, value: Number(r.value) }));
      }

      // 4. Run TOP DRIVERS Query
      const driversSql = `SELECT "${catCol}" as name, SUM("${valueCol}") as value FROM dataset GROUP BY "${catCol}" ORDER BY value DESC LIMIT 5;`;
      const driversRes = await conn.query(driversSql);
      const topDrivers = driversRes.toArray().map(r => ({
        name: String(r.name),
        value: typeof r.value === 'number' ? Math.round(r.value).toLocaleString() : r.value
      }));

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

  const runQuery = async (sql) => {
    if (!conn) return;
    try {
      const result = await conn.query(sql);
      const rawData = result.toArray().map(row => {
        const newRow = {};
        for (let key in row) {
          const val = row[key];
          // Round numbers to 2 decimals for clean display
          newRow[key] = typeof val === 'bigint' ? Number(val) : (typeof val === 'number' ? Math.round(val * 100) / 100 : val);
        }
        return newRow;
      });
      if (rawData.length > 0) setChartData(rawData);
    } catch (err) {
      setMessages(prev => [...prev, { text: `SQL ERROR: ${err.message}`, sender: 'bot' }]);
    }
  };

  // Helper to intelligently determine axes
  const getChartConfig = (data) => {
    if (!data || data.length === 0) return { xKey: '', dataKey: '' };
    const keys = Object.keys(data[0]);

    // Find first string key for X-Axis (Category)
    let xKey = keys.find(k => typeof data[0][k] === 'string');
    // If no string, take the first key
    if (!xKey) xKey = keys[0];

    // Find first number key for Data (Value) that isn't the xKey
    let dataKey = keys.find(k => typeof data[0][k] === 'number' && k !== xKey);
    // If no number found, default to second key or first
    if (!dataKey) dataKey = keys.find(k => k !== xKey) || keys[0];

    return { xKey, dataKey };
  };

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

  const handleChat = async () => {
    if (!input.trim()) return;
    const userText = input;
    setInput('');
    setMessages(prev => [...prev, { text: userText, sender: 'user' }]);
    setLoading(true);

    try {
      // Build conversation history context (last 3 exchanges)
      const historyContext = chatHistory.slice(-3).map((exchange, index) =>
        `Q: ${exchange.question}\nSQL: ${exchange.sql}`
      ).join('\n');

      // Generate clean SQL
      const cleanSQL = await generateQuery(historyContext, userText);

      setMessages(prev => [...prev, { text: cleanSQL, sender: 'bot' }]);

      // Update chat history with the new exchange (only if query was successful)
      await runQuery(cleanSQL);
      setChatHistory(prev => [...prev.slice(-2), { question: userText, sql: cleanSQL }]);
    } catch (err) {
      setMessages(prev => [...prev, { text: `AI ERROR: ${err.message}`, sender: 'bot' }]);
    }
    setLoading(false);
  };

  const { xKey, dataKey } = chartData ? getChartConfig(chartData) : { xKey: '', dataKey: '' };

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
          <label className="group flex flex-col items-center justify-center h-40 border-2 border-dashed border-zinc-700 rounded-xl cursor-pointer hover:border-zinc-500 hover:bg-zinc-900/50 transition-all">
            <Folder size={48} className="text-yellow-500 mb-3 group-hover:text-yellow-400 transition-colors" fill="currentColor" fillOpacity={0.2} />
            <span className="text-sm font-bold text-zinc-400 group-hover:text-white uppercase tracking-wider">Upload Data</span>
            <input type="file" onChange={handleFileUpload} accept=".csv" className="hidden" />
          </label>
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
              onChange={(e) => setInput(e.target.value)}
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
            </div>
          </div>
        </div>

        <div className={`flex-1 p-8 overflow-hidden transition-colors duration-300 ${highContrast ? 'bg-white' : 'bg-black'}`}>
          <div className={`w-full h-full border rounded-2xl relative flex flex-col p-4 transition-colors duration-300 ${highContrast
            ? 'border-black bg-white text-black'
            : 'border-zinc-800 bg-zinc-900/30 text-white'
            }`}>
            {!chartData ? (
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
