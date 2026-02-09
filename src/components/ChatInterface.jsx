import React, { useState, useEffect, useRef } from 'react';
import useAppStore from '../stores/useAppStore';
import insightEngine from '../services/InsightEngine';
import { Send, Upload, Loader2, Database, Bot, Cpu, CheckCircle2, Terminal, Shield, Info, ChevronDown, ChevronUp } from 'lucide-react';

const ChatInterface = () => {
    const {
        messages,
        addMessage,
        isThinking,
        setThinking,
        activeTable,
        schema,
        isModelLoaded,
        setModelLoaded,
        setVisualConfig
    } = useAppStore();
    const [input, setInput] = useState('');
    const [expandedLogic, setExpandedLogic] = useState({});
    const bottomRef = useRef(null);

    // Auto-scroll
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isThinking]);

    const handleLoadModel = async () => {
        try {
            const path = await window.electronAPI.openModel();
            if (path) {
                setThinking(true);
                addMessage({ text: `Initializing Neural Engine from: \`${path}\`...`, sender: 'bot' });
                await insightEngine.loadModel(path);
                setModelLoaded(true);
                setThinking(false);
                addMessage({ text: "✅ **System Ready**\nNeural Engine online and awaiting instructions.", sender: 'bot' });
            }
        } catch (error) {
            setThinking(false);
            addMessage({ text: `❌ **Initialization Error**: ${error.message}`, sender: 'bot' });
        }
    };

    const handleLoadDefaultModel = async () => {
        try {
            setThinking(true);
            addMessage({ text: "**Initializing Core Logic**\nLoading embedded `Llama-3.2-1B` parameters...", sender: 'bot' });
            await insightEngine.loadDefaultModel();
            setModelLoaded(true);
            setThinking(false);
            addMessage({ text: "✅ **Core Online**\nEmbedded intelligence ready for secure analysis.", sender: 'bot' });
        } catch (error) {
            setThinking(false);
            addMessage({ text: `❌ **Core Failure**: ${error.message}`, sender: 'bot' });
        }
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        addMessage({ text: input, sender: 'user' });
        const question = input;
        setInput('');

        if (!activeTable) {
            addMessage({ text: "⚠️ **Data Required**\nPlease ingest a CSV dataset to begin analysis.", sender: 'bot' });
            return;
        }

        if (!isModelLoaded) {
            addMessage({ text: "⚠️ **Engine Offline**\nPlease initialize the Neural Engine to proceed.", sender: 'bot' });
            return;
        }

        setThinking(true);
        try {
            const schemaContext = `Table "${activeTable}" columns: (${schema.join(', ')})`;
            const response = await insightEngine.ask(question, schemaContext);

            let userMessage = "";
            if (response.data && response.data.length > 0) {
                userMessage = "Analysis complete. Visualizing results on the dashboard.";

                let type = 'table';
                const keys = Object.keys(response.data[0]);
                const hasNumbers = response.data.some(row => Object.values(row).some(v => typeof v === 'number'));
                const hasDate = keys.some(k => /date|time|year|month|day/i.test(k));

                if (response.data.length === 1 && keys.length === 1) {
                    type = 'single';
                } else if (response.data.length > 1 && hasNumbers) {
                    type = hasDate ? 'line' : 'bar';
                }

                setVisualConfig({
                    type: type,
                    data: response.data,
                    title: question,
                    sql: response.sql,
                    thought: response.thought
                });

            } else if (response.success) {
                userMessage = "Query executed successfully, but returned zero results matching criteria.";
                setVisualConfig(null);
            } else {
                userMessage = `**Execution Error**\n${response.error}`;
            }

            // Determine routing type for Logic Trace
            const routingType = response.thought?.includes('[Intent Router]') ? 'Direct Math Engine' : 'SQL LLM';
            const isPrediction = response.thought?.includes('Forecasting') || response.thought?.includes('Prediction Intent');

            addMessage({
                text: userMessage,
                sender: 'bot',
                reasoning: response.thought,
                sql: response.sql,
                routingType: routingType,
                isPrediction: isPrediction
            });

        } catch (error) {
            addMessage({ text: `❌ **System Error**: ${error.message}`, sender: 'bot' });
        } finally {
            setThinking(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#050505] border-r border-slate-800/60 w-[400px] min-w-[350px] relative z-20 shadow-2xl">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-800/60 bg-[#050505]/95 backdrop-blur flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20">
                            <Shield size={16} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-slate-100 font-bold tracking-tight">Coconut AI</h2>
                            <div className="flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${isModelLoaded ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-600'}`}></span>
                                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-medium">
                                    {isModelLoaded ? 'System Online' : 'Standby'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {!isModelLoaded && (
                        <button
                            onClick={handleLoadDefaultModel}
                            className="text-xs px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-600/30 rounded-md transition-all flex items-center gap-2"
                        >
                            <Cpu size={12} />
                            Initialize
                        </button>
                    )}
                </div>

                {activeTable && (
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-900/50 rounded-md border border-slate-800/50">
                        <div className="flex items-center gap-2">
                            <Database size={12} className="text-slate-500" />
                            <span className="text-xs text-slate-300 font-mono">{activeTable}</span>
                        </div>
                        <span className="text-[10px] text-emerald-500 uppercase tracking-wider font-semibold">Active</span>
                    </div>
                )}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`group flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`flex items-end gap-3 max-w-[90%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            {/* Avatar */}
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${msg.sender === 'user'
                                    ? 'bg-blue-600 border-blue-500 text-white'
                                    : 'bg-slate-800 border-slate-700 text-slate-400'
                                }`}>
                                {msg.sender === 'user' ? <Terminal size={12} /> : <Bot size={12} />}
                            </div>

                            {/* Bubble */}
                            <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm backdrop-blur-sm ${msg.sender === 'user'
                                    ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-tr-sm shadow-blue-900/20'
                                    : 'bg-slate-900/80 border border-slate-800 text-slate-300 rounded-tl-sm'
                                }`}>
                                <div className="markdown-prose" dangerouslySetInnerHTML={{
                                    __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                        .replace(/`(.*?)`/g, '<code class="bg-black/20 px-1 rounded font-mono text-xs">$1</code>')
                                        .replace(/\n/g, '<br/>')
                                }} />

                                {/* Logic Trace - New Feature */}
                                {msg.routingType && (
                                    <div className="mt-3 pt-3 border-t border-white/10">
                                        <div 
                                            className="flex items-center justify-between cursor-pointer group"
                                            onClick={() => setExpandedLogic(prev => ({ 
                                                ...prev, 
                                                [idx]: !prev[idx] 
                                            }))}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Info size={12} className="text-blue-400" />
                                                <span className="text-xs text-blue-400 font-medium">Show Work</span>
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium ${
                                                    msg.routingType === 'Direct Math Engine' 
                                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                                }`}>
                                                    {msg.routingType}
                                                </span>
                                                {msg.isPrediction && (
                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
                                                        Forecasting
                                                    </span>
                                                )}
                                            </div>
                                            {expandedLogic[idx] ? (
                                                <ChevronUp size={12} className="text-slate-500 group-hover:text-slate-400 transition-colors" />
                                            ) : (
                                                <ChevronDown size={12} className="text-slate-500 group-hover:text-slate-400 transition-colors" />
                                            )}
                                        </div>

                                        {expandedLogic[idx] && (
                                            <div className="mt-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
                                                {/* Routing Decision */}
                                                <div className="bg-gradient-to-r from-slate-900/50 to-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                                                    <div className="text-xs text-slate-400 mb-2 font-mono uppercase tracking-wider">Routing Decision</div>
                                                    <div className="text-sm text-slate-200">
                                                        This request was handled by the <span className="font-semibold text-white">{msg.routingType}</span>
                                                        {msg.isPrediction && (
                                                            <span> because forecasting/prediction was detected</span>
                                                        )}.
                                                    </div>
                                                </div>

                                                {/* Technical Details */}
                                                {msg.reasoning && (
                                                    <div className="text-xs text-slate-500 font-mono">
                                                        <span className="opacity-50 uppercase tracking-widest text-[9px] mb-1 block">AI Reasoning</span>
                                                        <div className="pl-2 border-l-2 border-slate-700 text-slate-400 whitespace-pre-wrap">
                                                            {msg.reasoning}
                                                        </div>
                                                    </div>
                                                )}
                                                {msg.sql && (
                                                    <div className="bg-[#0a0a0a] p-2 rounded border border-white/5 font-mono text-[10px] text-emerald-500 overflow-x-auto">
                                                        <div className="text-[9px] text-slate-500 mb-1 uppercase tracking-wider">Generated SQL</div>
                                                        {msg.sql}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Fallback for old messages without routing info */}
                                {!msg.routingType && (msg.reasoning || msg.sql) && (
                                    <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                                        {msg.reasoning && (
                                            <div className="text-xs text-slate-500 font-mono">
                                                <span className="opacity-50 uppercase tracking-widest text-[9px] mb-1 block">Reasoning Logic</span>
                                                <div className="pl-2 border-l-2 border-slate-700 line-clamp-3 hover:line-clamp-none transition-all cursor-crosshair">
                                                    {msg.reasoning}
                                                </div>
                                            </div>
                                        )}
                                        {msg.sql && (
                                            <div className="bg-[#0a0a0a] p-2 rounded border border-white/5 font-mono text-[10px] text-emerald-500 overflow-x-auto">
                                                {msg.sql}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Timestamp helper (optional, skipping for now to keep clean) */}
                    </div>
                ))}

                {isThinking && (
                    <div className="flex items-center gap-3 px-2 animate-pulse">
                        <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                            <Bot size={12} className="text-blue-400" />
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                            <Loader2 size={12} className="animate-spin text-blue-500" />
                            <span className="tracking-widest uppercase">Processing</span>
                        </div>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-[#050505] border-t border-slate-800/60">
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl opacity-20 group-focus-within:opacity-50 transition duration-500 blur"></div>
                    <div className="relative flex items-center bg-[#0a0a0a] rounded-xl border border-slate-800 overflow-hidden">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={isModelLoaded ? "Enter executive query..." : "System initializing..."}
                            className="w-full bg-transparent text-slate-200 pl-4 pr-12 py-3.5 text-sm focus:outline-none resize-none h-[52px] scrollbar-none placeholder:text-slate-600"
                            disabled={isThinking}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isThinking}
                            className="absolute right-2 p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg disabled:opacity-30 disabled:hover:bg-slate-800 disabled:hover:text-slate-400 transition-all"
                        >
                            <Send size={16} />
                        </button>
                    </div>
                </div>
                <div className="mt-3 flex justify-between px-1">
                    <span className="text-[9px] text-slate-600 font-mono uppercase tracking-widest">
                        v1.0.0 Enterprise
                    </span>
                    <span className="text-[9px] text-slate-600 font-mono uppercase tracking-widest flex items-center gap-1">
                        <Shield size={8} /> Secure Enclave
                    </span>
                </div>
            </div>
        </div>
    );
};

export default ChatInterface;
