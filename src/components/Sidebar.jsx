import React, { memo, useCallback } from 'react';
import { FileUploader } from './FileUploader';
import ErrorBoundary from './ErrorBoundary.jsx';

/**
 * Sidebar Component - Memoized for performance
 * Contains file upload, chat messages, and input controls
 */
export const Sidebar = memo(({ 
  sidebarWidth, 
  startResizing,
  loading,
  db,
  messages,
  suggestions,
  input,
  setInput,
  handleChat,
  awaitingClarification,
  clarificationOptions,
  handleClarificationSelect,
  chatEndRef
}) => {
  // Memoize chat message rendering
  const renderMessage = useCallback((msg, i) => (
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
  ), [handleClarificationSelect]);

  return (
    <div className="flex flex-col border-r border-zinc-800 bg-black relative flex-shrink-0" style={{ width: sidebarWidth }}>
      <div
        className="absolute right-0 top-0 bottom-0 w-1 bg-zinc-900 hover:bg-yellow-600 cursor-col-resize z-50 flex items-center justify-center transition-colors group"
        onMouseDown={startResizing}
      >
        <div className="h-8 w-[2px] bg-zinc-700 group-hover:bg-black rounded-full" />
      </div>

      <div className="p-6">
        <FileUploader
          onFileUpload={() => {}} // Will be passed via props
          loading={loading}
          disabled={!db}
        />
      </div>

      <ErrorBoundary fallbackType="chat" maxRetries={2}>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading && (
            <div className="px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1 bg-gradient-to-r from-yellow-600/50 via-yellow-400 to-yellow-600/50 rounded-full animate-pulse shadow-[0_0_15px_rgba(250,204,21,0.3)]"></div>
                <span className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Data Crunching...</span>
              </div>
            </div>
          )}
          
          {messages.map(renderMessage)}
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
                  onClick={() => setInput(suggestion)}
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
      </ErrorBoundary>
    </div>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;