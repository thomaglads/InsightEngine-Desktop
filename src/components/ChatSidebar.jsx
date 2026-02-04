import React, { useState, useRef, useEffect } from 'react';
import { FileUploader } from './FileUploader.jsx';
import { CONFIG } from '../config/constants.js';

export const ChatSidebar = ({
  messages = [],
  input = '',
  setInput,
  onSendMessage,
  loading = false,
  suggestions = [],
  onSuggestionClick,
  sidebarWidth = 400,
  onResizeStart,
  onResizeEnd,
  isResizing = false,
  onFileUpload
}) => {
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setInput(suggestion);
    onSuggestionClick(suggestion);
  };

  return (
    <div 
      className={`flex flex-col border-r border-zinc-800 bg-black relative flex-shrink-0 ${isResizing ? 'cursor-col-resize select-none' : ''}`}
      style={{ width: sidebarWidth }}
    >
      {/* Resize Handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1 bg-zinc-900 hover:bg-yellow-600 cursor-col-resize z-50 flex items-center justify-center transition-colors group"
        onMouseDown={onResizeStart}
        onMouseUp={onResizeEnd}
      >
        <div className="h-8 w-[2px] bg-zinc-700 group-hover:bg-black rounded-full" />
      </div>

      <FileUploader onFileUpload={onFileUpload} loading={loading} />
      
      {/* Messages Area */}
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
          <MessageBubble key={i} message={msg} />
        ))}
        
        <div ref={chatEndRef} />
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && messages.length <= 2 && (
        <div className="px-6 pt-4 pb-2">
          <div className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">Suggested Questions</div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, index) => (
              <SuggestionChip
                key={index}
                suggestion={suggestion}
                onClick={() => handleSuggestionClick(suggestion)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-6 border-t border-zinc-800 bg-black">
        <div className="flex items-stretch border border-zinc-700 rounded-lg overflow-hidden focus-within:border-white transition-colors h-12">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask a question..."
            disabled={loading}
            className="flex-1 bg-black px-4 text-base focus:outline-none text-white placeholder-zinc-500 disabled:opacity-50"
          />
          <button
            onClick={onSendMessage}
            disabled={loading || !input.trim()}
            className="bg-white text-black px-6 text-sm font-bold hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed tracking-wider transition-colors"
          >
            RUN
          </button>
        </div>
      </div>
    </div>
  );
};

// Message Bubble Component
const MessageBubble = ({ message }) => {
  const isUser = message.sender === 'user';
  
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] px-4 py-2 bg-gradient-to-b from-zinc-700 to-zinc-800 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.15)] border border-zinc-600/50">
          <span className="text-white font-sans font-bold text-sm">{message.text}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] bg-white/5 backdrop-blur-md border border-white/10 rounded-lg shadow-[0_0_15px_rgba(0,0,0,0.2)] p-4">
        <span className="opacity-50 mr-2 font-bold select-none text-xs text-zinc-400">#</span>
        <span
          className={`font-mono text-sm ${
            message.text.includes('SELECT') || /\d/.test(message.text) 
              ? 'text-zinc-300 font-mono' 
              : 'text-zinc-300 font-sans'
          }`}
          dangerouslySetInnerHTML={{
            __html: message.text
              // Highlight Status Words
              .replace(/(DATASET LOADED|DETECTED COLUMNS|ERROR|AI ERROR|SQL ERROR)/g, '<span class="text-yellow-400 font-bold">$1</span>')
              // Highlight SQL Keywords
              .replace(/(SELECT|FROM|WHERE|GROUP BY|ORDER BY|LIMIT|CREATE|TABLE|DROP)/g, '<span class="text-emerald-400 font-mono">$1</span>')
          }}
        />
      </div>
    </div>
  );
};

// Suggestion Chip Component
const SuggestionChip = ({ suggestion, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-full transition-colors border border-zinc-700 hover:border-zinc-600 cursor-pointer"
    >
      {suggestion}
    </button>
  );
};

export default ChatSidebar;