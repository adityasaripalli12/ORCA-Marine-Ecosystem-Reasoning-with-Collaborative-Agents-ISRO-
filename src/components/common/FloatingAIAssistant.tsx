import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import {
  Bot, MessageSquare, X, Send, Sparkles, Database,
  Cpu, MapPin, ChevronDown, Maximize2, Minimize2, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AIMapPanel } from './AIMapPanel';

export const FloatingAIAssistant: React.FC = () => {
  const { user } = useAuth();
  const {
    conversations, activeConversationId, addChatMessage,
    aiLoadingStep, datasets
  } = useData();
  const { addToast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Visibility check: ONLY visible to Administrator and Government roles
  const isAuthorized = user?.role === 'Admin' || user?.role === 'Government';

  const currentConv = conversations.find(c => c.id === activeConversationId) || conversations[0];

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentConv?.messages, isOpen, isTyping, aiLoadingStep]);

  if (!isAuthorized) {
    return null;
  }

  const handleSend = (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = customText || inputMessage;
    if (!textToSend.trim()) return;

    setInputMessage('');
    setIsTyping(true);
    addChatMessage(currentConv.id, textToSend);
    setTimeout(() => setIsTyping(false), 600);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Floating Chat Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className={`mb-3 glass-panel rounded-3xl border border-cyan-500/30 shadow-2xl flex flex-col overflow-hidden transition-all ${
              isExpanded ? 'w-[750px] h-[650px]' : 'w-[420px] h-[520px]'
            }`}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    ORCA AI Assistant
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono">
                      {user?.role}
                    </span>
                  </h4>
                  <p className="text-[10px] text-slate-400">Unified Marine & Telemetry AI</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsExpanded(p => !p)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                  title={isExpanded ? 'Collapse window' : 'Expand window'}
                >
                  {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    window.location.hash = '#/flowchat-ai';
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 transition-all"
                  title="Open Full AI Chat"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Full Chat</span>
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/50">
              {currentConv?.messages.length === 0 && (
                <div className="text-center py-8 space-y-3">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto text-cyan-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-200">Hi, I am Temp! How can I assist you?</p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Ask about active ARGO floats, device diagnostics, anomalies, or physical ocean profiles.
                  </p>
                  <div className="flex flex-wrap gap-1.5 justify-center pt-2">
                    {['Where is DEV-001?', 'Show all devices', 'Where is DEV-004?'].map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(undefined, q)}
                        className="px-2.5 py-1 rounded-lg text-[10px] bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {currentConv?.messages.map((msg) => {
                const isUser = msg.sender === 'user';
                return (
                  <div key={msg.id} className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    {!isUser && (
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                        <Bot className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                    <div className={`max-w-[85%] space-y-2 ${isUser ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`p-3 rounded-2xl text-[11px] leading-relaxed space-y-2 ${
                          isUser
                            ? 'bg-gradient-to-r from-ocean-600 to-cyan-600 text-white rounded-tr-none shadow-md'
                            : 'glass-panel border border-slate-800 text-slate-200 rounded-tl-none shadow-lg'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>

                        {/* Interactive map — only when user explicitly requested */}
                        {!isUser && msg.requiresMap === true && (
                          <AIMapPanel
                            locations={msg.locations || []}
                            intent={msg.intent}
                            onAIAnalyze={(devId, name) => {
                              handleSend(undefined, `Analyze telemetry and anomaly diagnostics for ${devId} (${name}).`);
                            }}
                          />
                        )}

                        {/* View on Map chip — compact version for floating assistant */}
                        {!isUser && msg.hasGeoData && msg.requiresMap !== true && msg.locations && msg.locations.length > 0 && (
                          <button
                            onClick={() => handleSend(undefined, `Show ${msg.locations![0]?.name || 'this float'} on the map.`)}
                            className="mt-1.5 flex items-center gap-1 text-[9px] px-2 py-1 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-all"
                          >
                            <span>🗺️</span>
                            <span>View on Map</span>
                          </button>
                        )}

                        {/* Suggestions */}
                        {!isUser && msg.suggestions && msg.suggestions.length > 0 && (
                          <div className="pt-1.5 border-t border-slate-800/60 flex flex-wrap gap-1">
                            {msg.suggestions.map((sug, sIdx) => (
                              <button
                                key={sIdx}
                                onClick={() => handleSend(undefined, sug)}
                                className="px-2 py-0.5 rounded-md text-[9px] font-medium bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-all"
                              >
                                {sug}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {(isTyping || !!aiLoadingStep) && (
                <div className="flex gap-2.5 justify-start">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 text-white animate-spin" />
                  </div>
                  <div className="p-2.5 rounded-xl glass-panel border border-slate-800 text-[10px] text-cyan-400 flex items-center gap-1.5">
                    <span>{aiLoadingStep || 'Analyzing with ORCA AI...'}</span>
                    <span className="w-1 h-1 rounded-full bg-cyan-400 animate-ping" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input form */}
            <form onSubmit={handleSend} className="p-3 border-t border-slate-800 bg-slate-950 flex items-center gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask ORCA AI..."
                className="flex-1 px-3 py-2 rounded-xl text-xs glass-input focus:ring-1 focus:ring-cyan-500/40"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim()}
                className="p-2 rounded-xl text-white bg-gradient-to-r from-ocean-500 to-cyan-500 hover:from-ocean-400 hover:to-cyan-400 disabled:opacity-40 transition-all shadow-md shadow-cyan-500/20"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(p => !p)}
        className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 via-ocean-500 to-blue-600 text-white shadow-2xl shadow-cyan-500/40 border border-cyan-400/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-all group relative"
        title="ORCA AI Assistant"
      >
        <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-950 animate-pulse" />
        <Bot className="w-6 h-6 group-hover:rotate-6 transition-transform" />
      </button>
    </div>
  );
};
