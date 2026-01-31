import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as duckdb from '@duckdb/duckdb-wasm';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Label } from 'recharts';
import { Folder, Play, Activity, Database, Globe, GripVertical } from 'lucide-react';

const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

function App() {
  const [db, setDb] = useState(null);
  const [conn, setConn] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [schema, setSchema] = useState(null);
  const [dbSchema, setDbSchema] = useState([]);
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
      setMessages(prev => [...prev, { role: 'system', content: `DATASET LOADED. Detected Columns: [${columnNames.join(', ')}]` }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'error', content: `ERROR: ${err.message}` }]);
    }
    setLoading(false);
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
      setMessages(prev => [...prev, { role: 'error', content: `SQL ERROR: ${err.message}` }]);
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
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setLoading(true);

    try {
      // Inject Context into AI with the new System Prompt
      const systemPrompt = `You are a strict SQL generator. The table name is 'dataset'. THE AVAILABLE COLUMNS ARE: ${dbSchema.join(', ')}. RULES:

Use ONLY the columns listed above.

Return ONLY raw SQL. No markdown.

If the user asks 'what is this?', return 'SELECT * FROM dataset LIMIT 5;'.`;

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

      if (cleanSQL.toUpperCase().includes('TOP')) cleanSQL = cleanSQL.replace(/TOP\s*\(?\d+\)?/i, '') + ' LIMIT 10';

      setMessages(prev => [...prev, { role: 'assistant', content: cleanSQL }]);
      await runQuery(cleanSQL);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'error', content: `AI ERROR: ${err.message}` }]);
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

        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-sm leading-relaxed">
          {messages.map((msg, i) => (
            <div key={i} className={`${msg.role === 'error' ? 'text-red-400' : msg.role === 'user' ? 'text-zinc-300' : 'text-emerald-400'} border-l-2 pl-3 ${msg.role === 'error' ? 'border-red-900' : 'border-zinc-800'}`}>
              <span className="opacity-50 mr-2 font-bold select-none">
                {msg.role === 'user' ? '>' : msg.role === 'error' ? '!' : '#'}
              </span>
              {msg.content}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

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
              {loading ? '...' : 'RUN'}
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
            ) : (
              <>
                {/* DYNAMIC CHART TITLE */}
                <div className="text-center mb-2">
                  <h3 className="text-lg font-bold text-white tracking-wide uppercase">
                    {dataKey} by {xKey}
                  </h3>
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
