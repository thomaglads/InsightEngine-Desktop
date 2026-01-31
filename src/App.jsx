import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as duckdb from '@duckdb/duckdb-wasm';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Label } from 'recharts';
import { Folder, Play, Activity, Database, Globe, GripVertical, Download, FileDown } from 'lucide-react';

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
      const suggestionPrompt = `You are a Data Assistant. The available columns are: ${columnNames.join(', ')}. Generate 3 distinct, simple business questions a non-technical user might ask about this data. Format: JSON Array only. Example: ["Show top 5 sales", "Count employees by region", "Average salary"].`;

      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'phi3',
          messages: [{ role: 'system', content: suggestionPrompt }, { role: 'user', content: columnNames.join(', ') }],
          stream: false
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
    img.onload = function() {
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

      // Inject Context into AI with the new System Prompt including history
      const systemPrompt = `You are a strict SQL generator for DuckDB.
The table name is 'dataset'.
THE AVAILABLE COLUMNS ARE: ${dbSchema.join(', ')}.
RULES:

Use ONLY the columns listed above.

Return ONLY raw SQL. No markdown.

DUCKDB DIALECT ONLY:

Use 'current_date' for today.

FOR DATE MATH, USE INTERVALS ONLY. Example: current_date - INTERVAL 1 YEAR. DO NOT use DATEADD, DATEDIFF, or DATE_SUB.

To calculate Age: (date_part('year', current_date) - date_part('year', DOB)).

If a column is a string, use strptime(column, '%m/%d/%Y') or CAST(column AS DATE).

SINGLE TABLE MODE: Assume dataset is a single flat table. Do NOT use JOIN statements. Use WHERE clauses to filter data instead.

If the user asks for the meaning of a value (e.g., "What is 0?"), do NOT apologize. Instead, write a SQL query to inspect the data. Try to find the distinct value and any related text columns that might explain it.

Example Logic: SELECT DISTINCT column_name, other_text_column FROM dataset LIMIT 20;

NO Explanations: Return ONLY raw SQL string. Do NOT add any text, comments, or explanations before or after the code.

No Markdown: Do NOT use markdown code blocks (```sql).

Strict Ending: The output must start with SELECT and end with a semicolon ;. Nothing else.

[PREVIOUS CONTEXT]
${historyContext}
[CURRENT REQUEST]`;

      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'phi3',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userText }],
          stream: false
        })
      });
      if (!response.ok) throw new Error("Ollama offline.");
      const data = await response.json();

      const content = data.message.content;
      const sqlMatch = content.match(/```sql([\s\S]*?)```/);
      let cleanSQL = sqlMatch ? sqlMatch[1].trim() : content.replace(/```sql|```/g, '').trim();

      // Force Clean SQL - Strip any text after first semicolon
      if (cleanSQL.includes(';')) {
        cleanSQL = cleanSQL.split(';')[0] + ';';
      }
      
      if (cleanSQL.toUpperCase().includes('TOP')) cleanSQL = cleanSQL.replace(/TOP\s*\(?\d+\)?/i, '') + ' LIMIT 10';

      setMessages(prev => [...prev, { text: cleanSQL, sender: 'bot' }]);
      
      // Update chat history with new exchange (only if query was successful)
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
          <div className="flex items-center gap-3">
            <Activity size={16} className={conn ? "text-emerald-500" : "text-red-500"} />
            {conn ? "SYSTEM ONLINE" : "OFFLINE"}
          </div>
        </div>

        <div className="flex-1 p-8 overflow-hidden">
          <div className="w-full h-full border border-zinc-800 rounded-2xl bg-zinc-900/30 relative flex flex-col p-4">
            {!chartData ? (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 select-none">
                <Globe size={96} strokeWidth={0.5} className="mb-6 opacity-40 animate-pulse" />
                <p className="text-sm tracking-[0.3em] font-bold opacity-80 text-zinc-500">VISUALIZATION OFFLINE</p>
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 select-none">
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg shadow-[0_0_15px_rgba(0,0,0,0.2)] p-8 text-center">
                  <span className="text-2xl text-zinc-300 font-bold">No Data Found</span>
                  <p className="text-sm text-zinc-500 mt-2">Your query returned no results. Try different filters.</p>
                </div>
              </div>
            ) : chartData.length === 1 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 select-none">
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg shadow-[0_0_15px_rgba(0,0,0,0.2)] p-8 text-center max-w-md">
                  <span className="text-2xl text-zinc-300 font-bold uppercase tracking-wider">{dataKey}</span>
                  <p className="text-6xl text-white font-mono mt-4 font-bold">{chartData[0][dataKey]}</p>
                </div>
              </div>
            ) : (
              <>
                {/* DYNAMIC CHART TITLE */}
                <div className="flex items-center justify-between mb-2">
                  <div className="text-center flex-1">
                    <h3 className="text-lg font-bold text-white tracking-wide uppercase">
                      {dataKey} by {xKey}
                    </h3>
                  </div>
                  {/* Export Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={downloadResults}
                      className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors border border-zinc-700 hover:border-zinc-600 flex items-center gap-1"
                      title="Export filtered results as CSV"
                    >
                      <FileDown size={12} />
                      Export Results
                    </button>
                    <button
                      onClick={downloadChart}
                      className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors border border-zinc-700 hover:border-zinc-600 flex items-center gap-1"
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
                        <CartesianGrid stroke="#333" strokeDasharray="3 3" />
                        <XAxis dataKey={xKey} stroke="#999" tick={{ fontSize: 12, fill: '#aaa' }}>
                          <Label value={xKey} offset={0} position="insideBottom" fill="#fff" style={{ fontSize: '14px', fontWeight: 'bold' }} />
                        </XAxis>
                        <YAxis stroke="#999" tick={{ fontSize: 12, fill: '#aaa' }}>
                          <Label value={dataKey} angle={-90} position="insideLeft" fill="#fff" style={{ fontSize: '14px', fontWeight: 'bold' }} />
                        </YAxis>
                        <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #555', color: '#fff', fontSize: '14px' }} />
                        <Line type="monotone" dataKey={dataKey} stroke="#eab308" dot={false} strokeWidth={3} activeDot={{ r: 8 }} />
                      </LineChart>
                    ) : (
                      <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
                        <CartesianGrid stroke="#333" strokeDasharray="3 3" />
                        <XAxis dataKey={xKey} stroke="#999" tick={{ fontSize: 12, fill: '#aaa' }}>
                          <Label value={xKey} offset={0} position="insideBottom" fill="#fff" style={{ fontSize: '14px', fontWeight: 'bold' }} />
                        </XAxis>
                        <YAxis stroke="#999" tick={{ fontSize: 12, fill: '#aaa' }}>
                          <Label value={dataKey} angle={-90} position="insideLeft" fill="#fff" style={{ fontSize: '14px', fontWeight: 'bold' }} />
                        </YAxis>
                        <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #555', color: '#fff', fontSize: '14px' }} />
                        <Bar dataKey={dataKey} fill="#eab308" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
