import React, { useRef, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * ChatSidebar - The Conversation Hub
 * 
 * Handles:
 * 1. Messages List (Scrollable)
 * 2. File Upload (Multi-Table Aware)
 * 3. Chat Input
 * 4. Clarification Prompts
 */
const ChatSidebar = ({
  messages,
  isLoading,
  onChat,
  onFileUpload,
  sidebarWidth,
  isResizing,
  onResizeStart,
  activeTable,
  tables, // New: List of tables
  awaitingClarification,
  clarificationOptions,
  onClarificationSelect
}) => {
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [localInput, setLocalInput] = React.useState('');

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = (e) => {
    e?.preventDefault();
    if (!localInput.trim()) return;
    onChat(localInput);
    setLocalInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="h-full bg-white border-r border-gray-200 flex flex-col relative flex-shrink-0 transition-all duration-75 ease-linear"
      style={{ width: sidebarWidth }}
    >
      {/* Header / Table Status */}
      <div className="p-4 border-b border-gray-100 bg-white shadow-sm z-10">
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-bold text-xl tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            InsightEngine
          </h1>
          <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-500">
            BETA 1.1
          </span>
        </div>

        {/* Active Table Indicator */}
        <div className="flex gap-2 text-xs overflow-x-auto pb-1 scrollbar-hide">
          {tables && tables.length > 0 ? (
            tables.map(t => (
              <span
                key={t.name}
                className={`px-2 py-1 rounded-full border transition-colors ${t.name === activeTable
                    ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium'
                    : 'bg-gray-50 border-gray-200 text-gray-500'
                  }`}
              >
                📄 {t.name}
              </span>
            ))
          ) : (
            <span className="text-gray-400 italic">No data loaded</span>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50/50 scroll-smooth">
        {tables.length === 0 && messages.length === 0 && (
          <div className="text-center py-10 space-y-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <span className="text-2xl">📂</span>
            </div>
            <h3 className="text-gray-900 font-medium">Start Discovery</h3>
            <p className="text-gray-500 text-sm max-w-xs mx-auto">
              Upload a CSV file to begin expecting insights.
              <br />
              <span className="text-xs bg-yellow-100 text-yellow-800 px-1 rounded mt-1 inline-block">
                Phase 3: Try uploading 2 files to test Joins!
              </span>
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="mt-4 border-dashed border-2 hover:border-blue-500 hover:bg-blue-50 text-gray-600"
            >
              Select Data File(s)
            </Button>
          </div>
        )}

        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2 duration-300`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${msg.sender === 'user'
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-200'
              }`}>
              {msg.sender === 'user' ? '👤' : '🤖'}
            </div>

            <div className={`max-w-[85%] rounded-2xl px-5 py-3.5 shadow-sm text-sm leading-relaxed ${msg.sender === 'user'
                ? 'bg-indigo-600 text-white rounded-tr-sm'
                : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm'
              }`}>
              {msg.text}
              {/* Render Clarification Options Inline */}
              {msg.isClarification && awaitingClarification && index === messages.length - 1 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {clarificationOptions.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => onClarificationSelect(opt)}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm">
              🤖
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm flex items-center gap-2">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
              </span>
              <span className="text-xs text-gray-400 font-medium ml-2">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-100 z-10">
        <form onSubmit={handleSend} className="relative flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={onFileUpload}
            className="hidden"
            accept=".csv,.xlsx,.xls,.json,.parquet"
            multiple // ENABLE MULTI-FILE UPLOAD
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-3 text-gray-400 hover:text-indigo-600 hover:bg-gray-50 rounded-xl transition-colors"
            title="Upload Context"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>

          <input
            type="text"
            value={localInput}
            onChange={(e) => setLocalInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isLoading ? "Thinking..." : "Ask your data anything..."}
            disabled={isLoading}
            className="flex-1 bg-gray-50 border-0 rounded-xl px-4 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all outline-none"
          />

          <button
            type="submit"
            disabled={!localInput.trim() || isLoading}
            className="p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shadow-indigo-200"
          >
            <svg className="w-5 h-5 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>

      {/* Resizer Handle */}
      <div
        className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 transition-colors z-50 ${isResizing ? 'bg-blue-600 w-1.5' : 'bg-transparent'}`}
        onMouseDown={onResizeStart}
      />
    </div>
  );
};

export default ChatSidebar;