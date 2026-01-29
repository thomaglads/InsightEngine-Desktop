import React, { useState, useEffect, useRef } from 'react';
import DataChart from './components/DataChart';
// import ollama from 'ollama'; 
// Use window.require for Electron, or fallback for Browser Dev Mode
const ollama = window.require ? window.require('ollama') : {
  chat: async () => ({ message: { content: "Error: Ollama not found. Run in Electron or use a Mock." } })
};

import * as duckdb from '@duckdb/duckdb-wasm';

let db = null;
let conn = null;

const initDB = async () => {
  if (db) return;
  try {
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
    const worker_url = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
    );
    const worker = new Worker(worker_url);
    const logger = new duckdb.ConsoleLogger();
    db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    conn = await db.connect();
    console.log("DB Ready");
  } catch (e) { console.error(e); }
};

function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [schema, setSchema] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    initDB();
    document.documentElement.classList.add('dark');
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // --- FIX 1: SAFETY GUARD + FLUSH MEMORY ---
  const handleFile = async (file) => {
    // STOP if file is undefined (Prevents table disappearance)
    if (!file || !conn) return;
    setLoading(true);

    try {
      // 1. CLEANUP: Delete the old table to prevent "Already Exists" error
      await conn.query("DROP TABLE IF EXISTS dataset;");

      // 2. READ & REGISTER
      const text = await file.text();
      const firstLine = text.split('\n')[0];
      setSchema(firstLine);

      await db.registerFileText(file.name, text);

      // 3. CREATE NEW TABLE
      await conn.insertCSVFromPath(file.name, {
        schema: 'main',
        name: 'dataset',
        detect: true,
        header: true
      });

      setFileName(file.name);
      setMessages(prev => [...prev, { role: 'system', content: `SWITCHED DATABASE TO: ${file.name}\nCOLUMNS: ${firstLine}` }]);

    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'error', content: `UPLOAD ERROR: ${err.message}` }]);
    }
    setLoading(false);
  };

  // --- UPGRADED HANDLE CHAT WITH ZERO TOLERANCE ---
  const handleChat = async () => {
    if (!input.trim()) return;
    const userText = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setLoading(true);

    try {
      if (userText.startsWith('CHART:')) {
        const sql = userText.replace('CHART:', '').trim();
        await runQuery(sql);
        setLoading(false);
        return;
      }

      // --- FIX: ZERO TOLERANCE SPELLING ---
      const systemPrompt = `You are a SQL generator for DuckDB.
      Table: dataset
      VALID COLUMNS: ${schema}
      
      CRITICAL RULES:
      0. **SPELLING:** You MUST use the exact column names from the list above. Do NOT guess. (e.g. use "Absences", not "Abossees").
      1. **NEVER use 'TOP()'.** Use 'LIMIT n' at the very end.
      2. **Column Order:** SELECT the TEXT column FIRST, then the NUMBER.
      3. **Quoting:** ALWAYS double-quote column names to prevent errors (e.g. "Employee_Name", "Absences").
      4. **Sorting:** ALWAYS use 'ORDER BY 2 DESC'.
      5. Output strict SQL only. End with ;`;

      const response = await ollama.chat({
        model: 'phi3',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText }
        ]
      });

      let cleanSQL = "";
      if (response && response.message) {
        cleanSQL = response.message.content.replace(/```sql/g, '').replace(/```/g, '').trim();
      } else {
        throw new Error("Invalid AI Response. Check if Ollama is running.");
      }

      // AUTO-CORRECTOR
      const topMatch = cleanSQL.match(/TOP\(?(\d+)\)?/i);
      if (topMatch) {
        const limitNum = topMatch[1];
        cleanSQL = cleanSQL.replace(/TOP\(?\d+\)?/i, '').replace(/;/, '') + ` LIMIT ${limitNum};`;
      }

      const selectIndex = cleanSQL.toUpperCase().indexOf('SELECT');
      if (selectIndex > -1) {
        cleanSQL = cleanSQL.substring(selectIndex);
        const semiIndex = cleanSQL.indexOf(';');
        if (semiIndex > -1) cleanSQL = cleanSQL.substring(0, semiIndex + 1);
      }

      setMessages(prev => [...prev, { role: 'assistant', content: cleanSQL }]);
      await runQuery(cleanSQL);

    } catch (err) {
      setMessages(prev => [...prev, { role: 'error', content: `AI ERROR: ${err.message}` }]);
    }
    setLoading(false);
  };

  const runQuery = async (sql) => {
    try {
      if (!conn) throw new Error("Database not ready");
      const arrowResult = await conn.query(sql);
      const result = arrowResult.toArray().map(row => row.toJSON());

      if (result.length === 0) {
        setMessages(prev => [...prev, { role: 'system', content: "Query returned no data." }]);
      } else {
        setChartData(result);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'error', content: `SQL ERROR: ${err.message}` }]);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white font-mono selection:bg-white selection:text-black">

      {/* HEADER */}
      <header className="px-8 py-6 flex items-center gap-4 border-b border-zinc-800">
        <img src="/logo.png" alt="Logo" className="h-10 w-10 object-contain rounded-full border border-zinc-800" />
        <div>
          <h1 className="text-xl font-bold tracking-[0.2em] uppercase">InsightEngine</h1>
          <div className="text-xs text-zinc-500 uppercase tracking-widest">Enterprise Analytics v1.0</div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">

        {/* SIDEBAR */}
        <div className="w-[450px] flex flex-col border-r border-zinc-800 bg-zinc-950">

          <div className="p-6 border-b border-zinc-800">
            <label className={`block w-full py-8 border-2 border-dashed transition-all cursor-pointer
               ${fileName ? 'border-green-500 bg-green-500/10' : 'border-zinc-700 hover:border-white hover:bg-zinc-900'}`}>
              <input type="file" accept=".csv" onChange={(e) => handleFile(e.target.files[0])} className="hidden" />
              <div className="text-3xl mb-3 text-center">{fileName ? '✅' : '📂'}</div>
              <div className="text-sm font-bold uppercase tracking-widest text-white text-center">
                {fileName ? 'System Online' : 'Upload Data'}
              </div>
              {fileName && <div className="text-xs mt-2 text-green-400 text-center font-bold">SCHEMA DETECTED</div>}
            </label>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((m, i) => (
              <div key={i} className="animate-fade-in border-b border-zinc-900 pb-4 last:border-0">
                <div className={`text-[10px] font-bold tracking-widest uppercase mb-2 
                  ${m.role === 'user' ? 'text-zinc-500' : m.role === 'error' ? 'text-red-500' : 'text-green-500'}`}>
                  {m.role === 'user' ? 'USER' : m.role === 'error' ? 'ERROR' : 'ENGINE'}
                </div>
                <div className={`text-sm leading-relaxed whitespace-pre-wrap 
                  ${m.role === 'assistant' ? 'text-zinc-400 font-mono text-xs' : m.role === 'error' ? 'text-red-400' : 'text-white'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && <div className="text-xs text-green-500 animate-pulse">PROCESSING...</div>}
            <div ref={chatEndRef} />
          </div>

          <div className="p-6 border-t border-zinc-800 bg-black">
            <div className="flex gap-0 border border-zinc-700 focus-within:border-white transition-colors">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                placeholder="Ask a question..."
                className="flex-1 bg-transparent p-4 text-white focus:outline-none placeholder-zinc-700"
              />
              <button onClick={handleChat} className="bg-white text-black px-6 font-bold hover:bg-zinc-300">RUN</button>
            </div>
          </div>
        </div>

        {/* CHART AREA */}
        <div className="flex-1 bg-black p-10 flex flex-col justify-center items-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900/50 to-black -z-10"></div>
          {chartData ? (
            <div className="w-full h-full max-h-[600px] border border-zinc-800 p-6 bg-black/50 backdrop-blur-sm shadow-2xl">
              <DataChart data={chartData} theme="dark" />
            </div>
          ) : (
            <div className="text-center opacity-30">
              <div className="text-6xl mb-4 grayscale">🪐</div>
              <div className="text-sm tracking-[0.3em] font-bold text-zinc-500">VISUALIZATION OFFLINE</div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default App;
