import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDevices } from '../context/DeviceContext';
import { useTranslation } from '../i18n';
import {
  MessageSquare, Plus, Pin, Send, Paperclip, Copy,
  Check, Sparkles, Bot, Database, Search,
  Zap, Cpu, BookOpen, ShieldCheck, MapPin,
  Radio, Activity, Globe, Waves, ArrowUpRight
} from 'lucide-react';
import { AIMapPanel } from '../components/common/AIMapPanel';
import { PromptInjectionBlockAlert } from '../components/security/PromptInjectionBlockAlert';
import { VoiceInputControl } from '../components/common/VoiceInputControl';
import { TTSAudioPlayer } from '../components/common/TTSAudioPlayer';

const INTENT_BADGE_ICONS: Record<string, string> = {
  GENERAL_AI:        '🤖',
  OCEAN_RESEARCH:    '🌊',
  DEVICE_DATA:       '📡',
  DATASET_SQL:       '📊',
  MAP_LOCATION:      '🗺️',
  MAP_REQUEST:       '🗺️',
  TRAJECTORY_REQUEST:'📍',
  OCEAN_OBSERVATION: '🌊',
  RESEARCH_WEB:      '🔬',
  ANOMALY_DETECTION: '⚠️',
  SECURITY_BLOCKED:  '🛡️',
  SECURITY_INVESTIGATION: '🔍',
  DEVICE_CONTROL:    '⚡',
};

const CAPABILITY_KEYS = [
  { key: 'generalAi', defaultLabel: 'General AI', color: 'cyan' },
  { key: 'oceanIntelligence', defaultLabel: 'Ocean Intelligence', color: 'blue' },
  { key: 'deviceAnalytics', defaultLabel: 'Device Analytics', color: 'emerald' },
  { key: 'datasetAnalysis', defaultLabel: 'Dataset Analysis', color: 'indigo' },
  { key: 'mapIntelligence', defaultLabel: 'Map Intelligence', color: 'amber' },
  { key: 'security', defaultLabel: 'Security Gateway', color: 'rose' },
];

export const FlowChatAIPage: React.FC = () => {
  const {
    conversations, activeConversationId, setActiveConversationId,
    addChatMessage, createNextConversation, datasets, aiLoadingStep
  } = useData();
  const { user } = useAuth();
  const { addToast } = useToast();
  const { devices } = useDevices();
  const { t } = useTranslation();

  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [selectedAttachedDatasetId, setSelectedAttachedDatasetId] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  const [searchConvQuery, setSearchConvQuery] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentConv = conversations.find(c => c.id === activeConversationId) || conversations[0];
  const attachedDataset = datasets.find(d => d.id === selectedAttachedDatasetId);

  const suggestedQuestions = [
    t('chat.suggestedQuestions.columns', {}, 'What columns are available?'),
    t('chat.suggestedQuestions.depth', {}, 'What is the deepest measurement?'),
    t('chat.suggestedQuestions.temp', {}, 'What is the average temperature?'),
    t('chat.suggestedQuestions.locations', {}, 'Where were these measurements collected?'),
    t('chat.suggestedQuestions.dev001', {}, 'Where is DEV-001?'),
    t('chat.suggestedQuestions.dev004Anomaly', {}, 'Why is DEV-004 showing a temperature anomaly and where is it?'),
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentConv?.messages, isTyping, aiLoadingStep]);

  const handleSend = (e?: React.FormEvent, customText?: string, inputMode: 'voice' | 'text' = 'text', language?: string) => {
    if (e) e.preventDefault();
    const textToSend = customText || inputMessage;
    if (!textToSend.trim()) return;

    setInputMessage('');
    setIsTyping(true);
    addChatMessage(currentConv.id, textToSend, selectedDeviceId, selectedAttachedDatasetId || undefined, inputMode, language);
    setTimeout(() => { setIsTyping(false); }, 700);
  };

  const filteredConversations = conversations.filter(c =>
    c.title.toLowerCase().includes(searchConvQuery.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-100px)] flex gap-4 overflow-hidden">
      {/* ═══════════════════════════════════════════════
          LEFT SIDEBAR — CONVERSATION & CONTEXT
      ═══════════════════════════════════════════════ */}
      <div className="w-72 shrink-0 glass-panel rounded-3xl border border-cyan-500/20 p-4 flex flex-col justify-between space-y-4">
        <div className="space-y-3">
          {/* New Chat Button */}
          <button
            onClick={() => {
              const newId = createNextConversation();
              setActiveConversationId(newId);
              addToast('info', t('chat.newChat'), t('alerts.newSessionStarted'));
            }}
            className="w-full py-2.5 px-4 rounded-2xl font-bold text-xs text-white bg-gradient-to-r from-ocean-500 to-cyan-500 hover:from-ocean-400 hover:to-cyan-400 shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> {t('chat.newChat')}
          </button>

          {/* Search Conversations */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchConvQuery}
              onChange={(e) => setSearchConvQuery(e.target.value)}
              placeholder={t('chat.searchHistory')}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs glass-input placeholder-slate-500"
            />
          </div>

          {/* Chat List */}
          <div className="space-y-1 overflow-y-auto max-h-[calc(100vh-360px)] pr-1">
            <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              {t('chat.history')}
            </div>
            {filteredConversations.map((conv) => {
              const isActive = conv.id === activeConversationId;
              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConversationId(conv.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-colors text-left ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30'
                      : 'text-slate-300 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                    <span className="truncate">{conv.title}</span>
                  </div>
                  {conv.isPinned && <Pin className="w-3 h-3 text-cyan-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Context: Attached Dataset Indicator */}
        <div className="space-y-3">
          {attachedDataset ? (
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-cyan-500/40 text-[11px] space-y-1">
              <div className="flex items-center justify-between text-cyan-400 font-semibold">
                <span className="flex items-center gap-1"><Database className="w-3 h-3" /> {t('chat.attachDataset')}</span>
                <button onClick={() => setSelectedAttachedDatasetId(null)} className="text-slate-400 hover:text-white">✕</button>
              </div>
              <p className="text-slate-200 font-mono text-[10px] truncate">{attachedDataset.filename}</p>
              <p className="text-[9px] text-slate-400 font-mono">{attachedDataset.rowCount?.toLocaleString() || 'N/A'} {t('chat.recordsFound', { count: attachedDataset.rowCount || 0 })}</p>
            </div>
          ) : (
            <button
              onClick={() => setShowAttachModal(true)}
              className="w-full py-1.5 px-3 rounded-xl border border-dashed border-slate-700 hover:border-cyan-500/50 text-[10px] text-slate-400 hover:text-cyan-300 flex items-center justify-center gap-1.5 transition-all"
            >
              <Paperclip className="w-3 h-3" /> {t('chat.attachDataset')}
            </button>
          )}

          {/* Capability badges */}
          <div className="flex flex-wrap gap-1">
            {CAPABILITY_KEYS.map(c => (
              <span key={c.key} className="text-[9px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
                {t(`chat.capabilitiesList.${c.key}`, {}, c.defaultLabel)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          MAIN CHAT AREA
      ═══════════════════════════════════════════════ */}
      <div className="flex-1 glass-panel rounded-3xl border border-cyan-500/20 flex flex-col justify-between overflow-hidden">
        {/* Header */}
        <div className="px-6 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/30">
              <Zap className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">{t('chat.title')}</h3>
              <p className="text-[10px] text-slate-400">{t('chat.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Device Context Selector */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400 hidden sm:inline">{t('common.details')}:</span>
              <select
                value={selectedDeviceId || ''}
                onChange={(e) => {
                  const val = e.target.value || undefined;
                  setSelectedDeviceId(val);
                  if (val) {
                    addToast('info', 'Device Context Set', `AI queries will now prioritize context for ${val}`);
                  }
                }}
                className="bg-transparent text-cyan-300 font-bold text-xs focus:outline-none cursor-pointer"
              >
                <option value="" className="bg-slate-900 text-slate-300">{t('chat.allDevices')}</option>
                {devices.map(d => (
                  <option key={d.id} value={d.id} className="bg-slate-900 text-cyan-300">
                    {d.id} ({d.name})
                  </option>
                ))}
              </select>
            </div>

            <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 hidden md:inline">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block mr-1" />
              {t('common.online')}
            </span>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════
            MESSAGES AREA
        ═══════════════════════════════════════════════ */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Welcome state */}
          {currentConv?.messages.length === 0 && (
            <div className="relative flex flex-col items-center justify-center min-h-[540px] text-center space-y-6 py-8 px-4 overflow-hidden">
              {/* Background ambient lighting effects */}
              <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
              <div className="pointer-events-none absolute top-1/3 left-1/3 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl" />

              {/* Glowing Graphic Avatar */}
              <div className="relative z-10">
                <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/30 via-blue-600/30 to-teal-400/30 rounded-full blur-xl animate-pulse" />
                <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-400 via-ocean-500 to-blue-600 p-[2px] shadow-2xl shadow-cyan-500/30">
                  <div className="w-full h-full bg-slate-950/80 rounded-[22px] backdrop-blur-md flex items-center justify-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-transparent opacity-50" />
                    <div className="relative flex items-center justify-center">
                      <Zap className="w-8 h-8 text-cyan-400 drop-shadow-[0_0_12px_rgba(6,182,212,0.8)]" />
                      <Waves className="w-4 h-4 text-white/80 absolute -bottom-1 -right-2" />
                    </div>
                  </div>
                </div>
                {/* Micro Online Badge */}
                <div className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full bg-cyan-500 border-2 border-slate-950 text-[9px] font-black text-slate-950 shadow-lg tracking-wider">
                  AI
                </div>
              </div>

              {/* Status Pill & Header */}
              <div className="relative z-10 space-y-3 max-w-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/90 border border-cyan-500/30 text-cyan-300 text-[11px] font-mono shadow-inner shadow-cyan-500/20">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                  </span>
                  <span className="font-semibold tracking-wider">TEMP NEURAL ENGINE • ONLINE</span>
                </div>

                <h1 className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-cyan-400 tracking-tight">
                  Hi, I am Temp! How can I assist you?
                </h1>

                <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
                  Autonomous Marine Telemetry & Deep Oceanographic Intelligence. Ask about real-time ARGO floats, sensor diagnostics, thermocline anomalies, or depth profiles.
                </p>
              </div>

              {/* 4 Graphic Feature / Capability Cards */}
              <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full text-left pt-2">
                <button
                  onClick={() => handleSend(undefined, 'Where is DEV-001 and what is its latest telemetry?')}
                  className="p-3.5 rounded-2xl bg-slate-900/70 hover:bg-slate-800/90 border border-slate-800/90 hover:border-cyan-500/50 transition-all duration-200 group text-left relative overflow-hidden shadow-lg hover:shadow-cyan-500/10 backdrop-blur-sm"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/15 transition-all" />
                  <div className="flex items-start justify-between">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-2.5 group-hover:scale-110 transition-transform">
                      <Radio className="w-4 h-4" />
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </div>
                  <div className="font-semibold text-xs text-slate-200 group-hover:text-white">
                    Fleet Telemetry & Tracking
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                    Query active ARGO floats, live coordinates, and sensor transmission health.
                  </p>
                </button>

                <button
                  onClick={() => handleSend(undefined, 'Why is DEV-004 showing a temperature anomaly and where is it?')}
                  className="p-3.5 rounded-2xl bg-slate-900/70 hover:bg-slate-800/90 border border-slate-800/90 hover:border-amber-500/50 transition-all duration-200 group text-left relative overflow-hidden shadow-lg hover:shadow-amber-500/10 backdrop-blur-sm"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/15 transition-all" />
                  <div className="flex items-start justify-between">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-2.5 group-hover:scale-110 transition-transform">
                      <Activity className="w-4 h-4" />
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </div>
                  <div className="font-semibold text-xs text-slate-200 group-hover:text-white">
                    Anomaly & Outlier Alerts
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                    Inspect thermal spikes, sensor deviation flags, and automated incident logs.
                  </p>
                </button>

                <button
                  onClick={() => handleSend(undefined, 'Where were these measurements collected?')}
                  className="p-3.5 rounded-2xl bg-slate-900/70 hover:bg-slate-800/90 border border-slate-800/90 hover:border-blue-500/50 transition-all duration-200 group text-left relative overflow-hidden shadow-lg hover:shadow-blue-500/10 backdrop-blur-sm"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/15 transition-all" />
                  <div className="flex items-start justify-between">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-2.5 group-hover:scale-110 transition-transform">
                      <Globe className="w-4 h-4" />
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </div>
                  <div className="font-semibold text-xs text-slate-200 group-hover:text-white">
                    Geospatial Mapping & Drift
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                    Render interactive geospatial trajectories across North Atlantic & Pacific basins.
                  </p>
                </button>

                <button
                  onClick={() => handleSend(undefined, 'What is the deepest measurement in the dataset?')}
                  className="p-3.5 rounded-2xl bg-slate-900/70 hover:bg-slate-800/90 border border-slate-800/90 hover:border-emerald-500/50 transition-all duration-200 group text-left relative overflow-hidden shadow-lg hover:shadow-emerald-500/10 backdrop-blur-sm"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/15 transition-all" />
                  <div className="flex items-start justify-between">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2.5 group-hover:scale-110 transition-transform">
                      <Waves className="w-4 h-4" />
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </div>
                  <div className="font-semibold text-xs text-slate-200 group-hover:text-white">
                    Water Column & NetCDF
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                    Analyze depth strata, pressure gradients, and biogeochemical profiles.
                  </p>
                </button>
              </div>

              {/* Suggested Questions Pills */}
              <div className="relative z-10 space-y-2 pt-1 max-w-2xl w-full">
                <div className="flex items-center gap-1.5 justify-center text-[10px] uppercase font-mono tracking-wider text-slate-500">
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  <span>Suggested Quick Inquiries</span>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {suggestedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(undefined, q)}
                      className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-900/80 hover:bg-cyan-500/15 border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 transition-all shadow-sm"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* High-Tech Status Footer Strip */}
              <div className="relative z-10 flex flex-wrap items-center justify-center gap-4 text-[10px] font-mono text-slate-500 pt-3 border-t border-slate-800/60 max-w-xl w-full">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  Global Floats: 4,000+
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Telemetry: Active
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  Sync: INCOIS / Argo WMO
                </span>
              </div>
            </div>
          )}

          {/* Message List */}
          {currentConv?.messages.map((msg) => {
            const isUser = msg.sender === 'user';
            const isBlocked = !isUser && (msg.intent === 'SECURITY_BLOCKED' || msg.isBlocked);

            if (isBlocked) {
              return (
                <div key={msg.id} className="flex justify-start py-1">
                  <PromptInjectionBlockAlert timestamp={msg.timestamp} />
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shrink-0 shadow-md">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}

                <div className={`max-w-2xl space-y-3 ${isUser ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`p-4 rounded-2xl text-xs leading-relaxed space-y-3 ${
                      isUser
                        ? 'bg-gradient-to-r from-ocean-600 to-cyan-600 text-white rounded-tr-none shadow-lg'
                        : 'glass-panel border border-slate-800 text-slate-200 rounded-tl-none shadow-xl'
                    }`}
                  >
                    {/* Intent Badge & TTS Player */}
                    {!isUser && msg.content && (
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 text-[10px] font-mono">
                        <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider ${
                          msg.intent === 'SECURITY_BLOCKED' 
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                        }`}>
                          <Sparkles className="w-3 h-3" />
                          {INTENT_BADGE_ICONS[msg.intent || 'GENERAL_AI'] || '🤖'} {t(`chat.intents.${msg.intent || 'GENERAL_AI'}`, {}, msg.intent || 'GENERAL_AI')}
                        </span>
                        <div className="flex items-center gap-2">
                          {msg.datasetUsed && (
                            <span className="text-slate-400 flex items-center gap-1">
                              <Database className="w-3 h-3 text-cyan-400" />
                              <strong className="text-cyan-300 font-mono">{msg.datasetUsed}</strong>
                            </span>
                          )}
                          <TTSAudioPlayer text={msg.content} language={msg.detectedLanguage || 'en'} />
                        </div>
                      </div>
                    )}

                    {/* User Voice Input Badge */}
                    {isUser && msg.inputMode === 'voice' && (
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-200 mb-1">
                        <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 flex items-center gap-1 font-semibold">
                          🎤 Voice ({msg.detectedLanguage === 'te' ? 'Telugu' : msg.detectedLanguage === 'hi' ? 'Hindi' : 'English'})
                        </span>
                      </div>
                    )}

                    {/* 1. ACTUAL ANSWER DISPLAY (MUST APPEAR FIRST) */}
                    {!isUser && msg.observationData && (
                      <div className="mb-3 p-4 rounded-2xl bg-gradient-to-br from-cyan-950/70 via-slate-900 to-blue-950/70 border border-cyan-500/40 shadow-xl shadow-cyan-950/30">
                        <div className="flex items-center justify-between gap-2 border-b border-cyan-900/50 pb-2 mb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                            <span className="text-[11px] font-black uppercase tracking-wider text-cyan-300 font-mono">
                              {msg.observationData.title}
                            </span>
                          </div>
                          {msg.observationData.quality_flag && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 font-mono font-bold border border-emerald-500/30">
                              {msg.observationData.quality_flag}
                            </span>
                          )}
                        </div>

                        <div className="my-2">
                          <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight flex items-baseline gap-2">
                            <span className="bg-gradient-to-r from-white via-cyan-100 to-cyan-300 bg-clip-text text-transparent">
                              {msg.observationData.value_display}
                            </span>
                          </div>
                          {msg.observationData.subtitle && (
                            <p className="text-xs text-slate-300 mt-1 font-medium">
                              {msg.observationData.subtitle}
                            </p>
                          )}
                        </div>

                        {/* Statistical Calculation Breakdown */}
                        {msg.observationData.stats && (
                          <div className="mt-3 pt-2.5 border-t border-cyan-900/40 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                            {msg.observationData.stats.count !== undefined && (
                              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                                <span className="text-[10px] text-slate-400 block font-medium">Observations</span>
                                <span className="text-cyan-300 font-mono font-bold">
                                  {msg.observationData.stats.count.toLocaleString()} soundings
                                </span>
                              </div>
                            )}
                            {msg.observationData.stats.mean !== undefined && (
                              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                                <span className="text-[10px] text-slate-400 block font-medium">Calculated Mean</span>
                                <span className="text-white font-mono font-bold">
                                  {msg.observationData.stats.mean} {msg.observationData.unit}
                                </span>
                              </div>
                            )}
                            {msg.observationData.stats.min !== undefined && (
                              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                                <span className="text-[10px] text-slate-400 block font-medium">Observed Range</span>
                                <span className="text-slate-300 font-mono text-[10px]">
                                  {msg.observationData.stats.min} – {msg.observationData.stats.max} {msg.observationData.unit}
                                </span>
                              </div>
                            )}
                            {msg.observationData.stats.max_z_score !== undefined && (
                              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                                <span className="text-[10px] text-slate-400 block font-medium">Robust Z-Score</span>
                                <span className="text-amber-400 font-mono font-bold">
                                  Z = {msg.observationData.stats.max_z_score.toFixed(2)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Message Body */}
                    <p className="whitespace-pre-wrap font-sans">{msg.content}</p>

                    {/* Interactive Multi-Point Map Panel — only when user explicitly requested map */}
                    {!isUser && msg.requiresMap === true && (
                      <AIMapPanel
                        locations={msg.locations || []}
                        intent={msg.intent}
                        onAIAnalyze={(devId, name) => {
                          handleSend(undefined, `Analyze telemetry, sensor health, and historical anomaly trends for device ${devId} (${name}).`);
                        }}
                      />
                    )}

                    {/* VIEW ON MAP button — when geo data is available but map wasn't explicitly requested */}
                    {!isUser && msg.hasGeoData && msg.requiresMap !== true && msg.locations && msg.locations.length > 0 && (
                      <button
                        onClick={() => handleSend(undefined, `Show ${msg.locations![0]?.name || 'this float'} on the map.`)}
                        className="mt-2 flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition-all font-medium"
                      >
                        <span>🗺️</span>
                        <span>View on Map</span>
                      </button>
                    )}

                    {/* Scientific Provenance Card */}
                    {!isUser && msg.provenance && (
                      <div className="mt-3 p-3.5 rounded-xl bg-slate-900/90 border border-cyan-900/50 shadow-lg space-y-2.5">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                            <span className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider">
                              Scientific Provenance (SIH25040)
                            </span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                            Confidence: {msg.confidenceLabel || msg.provenance.confidence_label || 'HIGH'} ({msg.confidenceScore || msg.provenance.evidence_score || 88}%)
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                            <span className="text-[10px] text-slate-500 block uppercase font-medium">Source Feed</span>
                            <span className="text-slate-200 font-medium truncate block" title={msg.provenance.source}>
                              {msg.provenance.source || 'ARGO Global Data Assembly Centre'}
                            </span>
                          </div>
                          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                            <span className="text-[10px] text-slate-500 block uppercase font-medium">Platform / WMO ID</span>
                            <span className="text-cyan-400 font-mono font-bold">
                              {msg.provenance.wmo_id ? `WMO #${msg.provenance.wmo_id}` : 'Global In-Situ Array'}
                            </span>
                          </div>
                          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                            <span className="text-[10px] text-slate-500 block uppercase font-medium">Observation Time</span>
                            <span className="text-slate-300 font-mono text-[10px]">
                              {msg.provenance.observation_time || 'Recent In-situ Sync'}
                            </span>
                          </div>
                          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] text-slate-500 block uppercase font-medium">Data Age</span>
                              <span className="text-emerald-400 font-mono font-semibold text-[11px]">
                                {msg.provenance.data_age || 'Valid (<7d)'}
                              </span>
                            </div>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-700/50 text-emerald-300 font-mono">
                              {msg.provenance.quality_flag || 'QC 1: Good'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Research Sources */}
                    {!isUser && msg.sources && msg.sources.length > 0 && !msg.provenance && (
                      <div className="mt-3 p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300">
                          <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{t('chat.sources')}:</span>
                        </div>
                        <ul className="space-y-1 text-[10px] text-slate-400">
                          {msg.sources.map((src, idx) => (
                            <li key={idx} className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                              <span className="font-mono text-slate-300">{src}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Contextual Next-Step Suggestions */}
                    {!isUser && msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="pt-2 border-t border-slate-800/60 flex flex-wrap gap-1.5">
                        <span className="text-[10px] text-slate-400 mr-1 flex items-center gap-1">{t('chat.suggestions')}:</span>
                        {msg.suggestions.map((sug, sIdx) => (
                          <button
                            key={sIdx}
                            onClick={() => handleSend(undefined, sug)}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-all hover:scale-[1.02]"
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    )}

                    {!isUser && (
                      <div className="text-[9px] font-mono text-slate-500 text-right">
                        {msg.timestamp}
                      </div>
                    )}
                  </div>
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 text-slate-300 font-bold text-xs border border-slate-700">
                    {user?.name.slice(0, 1) || 'U'}
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing indicator */}
          {(isTyping || !!aiLoadingStep) && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-white animate-spin" />
              </div>
              <div className="p-3.5 rounded-2xl glass-panel border border-slate-800 text-xs text-cyan-400 flex items-center gap-2">
                <span>{aiLoadingStep || t('chat.processingEngine')}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ═══════════════════════════════════════════════
            INPUT FORM
        ═══════════════════════════════════════════════ */}
        <form onSubmit={handleSend} className="p-4 border-t border-slate-800 flex items-center gap-3 bg-slate-950/80">
          <button
            type="button"
            onClick={() => setShowAttachModal(true)}
            className={`p-2.5 rounded-xl border transition-colors ${
              selectedAttachedDatasetId
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border-slate-700'
            }`}
            title={t('chat.attachDataset')}
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={
              attachedDataset 
                ? `Ask about ${attachedDataset.filename}...`
                : t('chat.inputPlaceholder')
            }
            className="flex-1 px-4 py-2.5 rounded-xl text-xs glass-input focus:ring-2 focus:ring-cyan-500/40"
          />

          <VoiceInputControl
            onTranscriptReady={(transcript, detectedLang, normalizedQuery) => {
              setInputMessage(transcript);
              handleSend(undefined, transcript, 'voice', detectedLang);
            }}
          />

          <button
            type="submit"
            disabled={!inputMessage.trim()}
            className="p-2.5 rounded-xl text-white bg-gradient-to-r from-ocean-500 to-cyan-500 hover:from-ocean-400 hover:to-cyan-400 disabled:opacity-40 transition-all shadow-lg shadow-cyan-500/20"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* ═══════════════════════════════════════════════
          ATTACH DATASET MODAL
      ═══════════════════════════════════════════════ */}
      {showAttachModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-3xl border border-cyan-500/30 max-w-md w-full space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" /> {t('chat.attachDataset')}
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {datasets.map((ds) => (
                <div
                  key={ds.id}
                  onClick={() => {
                    setSelectedAttachedDatasetId(ds.id);
                    setShowAttachModal(false);
                    addToast('info', 'Dataset Attached', `Context set to ${ds.filename}`);
                  }}
                  className={`p-3 rounded-xl border cursor-pointer text-xs space-y-1 transition-all ${
                    selectedAttachedDatasetId === ds.id
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                  }`}
                >
                  <p className="font-semibold text-slate-200">{ds.filename}</p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {ds.format} • {ds.fileSize} • {ds.rowCount?.toLocaleString() || 'N/A'} records
                  </p>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowAttachModal(false)}
              className="w-full py-2 rounded-xl text-xs text-slate-400 hover:text-white bg-slate-800"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlowChatAIPage;
