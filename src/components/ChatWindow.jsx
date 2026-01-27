import { useState, useRef, useEffect } from 'react';
import { generateResponse } from '../services/ai';
import DataChart from './DataChart';

const ChatWindow = () => {
    const [messages, setMessages] = useState([
        { sender: 'ai', text: 'Hello! I am your Offline Data Analyst. How can I help you today?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [schema, setSchema] = useState('');
    const messagesEndRef = useRef(null);

    // Helper to safely get IPC
    const getIpc = () => {
        if (window.require) {
            try {
                return window.require('electron').ipcRenderer;
            } catch (e) {
                console.error("Could not require electron:", e);
            }
        }
        return null;
    };

    // 1. Fetch Schema on Mount
    useEffect(() => {
        const fetchSchema = async () => {
            const ipc = getIpc();
            if (ipc) {
                try {
                    const schemaText = await ipc.invoke('get-schema');
                    setSchema(schemaText);
                    console.log("Schema loaded:", schemaText);
                } catch (err) {
                    console.error("Failed to load schema:", err);
                }
            }
        };
        fetchSchema();
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        // 1. Add User Message to Chat
        const userMessage = { sender: 'user', text: input };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const ipc = getIpc();
            if (!ipc) throw new Error("IPC connection failed");

            // --- POWER USER MODE: DIRECT SQL EXECUTION ---
            if (input.startsWith('SQL:') || input.startsWith('CHART:')) {
                // Extract the SQL string after the prefix
                const sql = input.replace(/^(SQL:|CHART:)/, '').trim();
                const isChart = input.startsWith('CHART:');

                // Show a system message saying we are running raw SQL
                setMessages(prev => [...prev, { sender: 'ai', text: `🔄 Executing Raw SQL...` }]);

                const results = await ipc.invoke('run-query', sql);

                if (results.error) {
                    setMessages(prev => [...prev, { sender: 'ai', text: `❌ SQL Error: ${results.error}` }]);
                } else {
                    if (isChart) {
                        // FORCE RENDER CHART
                        setMessages(prev => [...prev, {
                            sender: 'ai',
                            component: <DataChart data={results} type="BAR" />
                        }]);
                    } else {
                        // RENDER TABLE (Simple JSON dump for verification)
                        setMessages(prev => [...prev, {
                            sender: 'ai',
                            text: `✅ Rows: ${results.length}. \n` + JSON.stringify(results.slice(0, 3), null, 2)
                        }]);
                    }
                }
                setIsLoading(false);
                return; // <--- STOP HERE (Do not call AI)
            }
            // --- END POWER USER MODE ---

            // 2. Normal AI Flow (If not starting with SQL:/CHART:)
            // 1. Construct System Prompt with Schema
            const systemPrompt = `You are a SQL expert. Table 'dataset' has schema: ${schema || 'Unknown'}. 
            If the user asks for visualization, prepend [BAR_CHART] or [LINE_CHART].
            Generate a DuckDB SQL query to answer the user. 
            Output ONLY the SQL query wrapped in markdown code blocks. Do not explain.`;

            const fullPrompt = `${systemPrompt}\n\nUser Question: ${userMessage.text}`;

            // 2. Get AI Response
            const aiText = await generateResponse(fullPrompt);

            // 3. Check for SQL
            const sqlMatch = aiText.match(/```sql\s*([\s\S]*?)\s*```/);

            if (sqlMatch) {
                const sql = sqlMatch[1].trim();

                // --- INTELLIGENT DETECTION START ---
                let chartType = null;
                const lowerInput = userMessage.text.toLowerCase(); // Check USER input too

                // Priority 1: AI explicit tag
                if (aiText.includes('[BAR_CHART]')) chartType = 'BAR';
                else if (aiText.includes('[LINE_CHART]')) chartType = 'LINE';

                // Priority 2: User explicit request (Force Override)
                else if (lowerInput.includes('bar chart') || lowerInput.includes('bar graph')) chartType = 'BAR';
                else if (lowerInput.includes('line chart') || lowerInput.includes('line graph')) chartType = 'LINE';
                // --- INTELLIGENT DETECTION END ---

                // 4. EXECUTE SQL via IPC
                const results = await ipc.invoke('run-query', sql);

                if (results.error) {
                    setMessages(prev => [...prev, { sender: 'ai', text: `SQL Error: ${results.error}` }]);
                } else if (chartType && results.length > 0) {
                    // Render Chart
                    setMessages(prev => [...prev, {
                        sender: 'ai',
                        component: <DataChart data={results} type={chartType} />
                    }]);
                } else if (Array.isArray(results) && results.length > 0) {
                    // Render Table
                    const tableHtml = (
                        <div style={{ overflowX: 'auto', maxWidth: '100%', marginTop: '10px', background: 'rgba(0,0,0,0.2)', padding: '5px', borderRadius: '4px' }}>
                            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85em', fontFamily: 'monospace' }}>
                                <thead>
                                    <tr>
                                        {Object.keys(results[0]).map((key) => (
                                            <th key={key} style={{ borderBottom: '1px solid #777', padding: '5px', textAlign: 'left' }}>{key}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((row, i) => (
                                        <tr key={i}>
                                            {Object.values(row).map((val, j) => (
                                                <td key={j} style={{ borderBottom: '1px solid #444', padding: '5px', whiteSpace: 'nowrap' }}>{String(val)}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );
                    setMessages(prev => [...prev, { sender: 'ai', component: tableHtml }]);
                } else {
                    setMessages(prev => [...prev, { sender: 'ai', text: 'Query executed successfully but returned no results.' }]);
                }
            } else {
                // Normal Text Response
                let visibleText = aiText.replace(/\[(BAR|LINE)_CHART\]/g, '').trim();
                setMessages(prev => [...prev, { sender: 'ai', text: visibleText }]);
            }
        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { sender: 'ai', text: `Execution failed: ${error.message}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="chat-container">
            <div className="messages-area">
                {messages.map((msg, index) => (
                    <div key={index} className={`message-row ${msg.sender}`}>
                        <div className={`message-bubble ${msg.sender}`}>
                            {msg.component ? msg.component : msg.text}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="message-row ai">
                        <div className="message-bubble ai loading">Thinking...</div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form className="input-area" onSubmit={handleSend}>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask something about your data..."
                    disabled={isLoading}
                />
                <button type="submit" disabled={isLoading || !input.trim()}>
                    Send
                </button>
            </form>
        </div>
    );
};

export default ChatWindow;
