import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiFetch, getApiUrl } from '../utils/api';
import {
  ResearchConversation,
  ResearchMessage,
  ConversationDetail,
  ResearcherProfile,
  PinnedFinding,
  Attachment,
  DatasetRef,
  AIResearchResponse,
  ResearchNotification
} from '../types/researchChat';
import {
  MessageSquare,
  Users,
  Search,
  Plus,
  Send,
  Paperclip,
  Database,
  Bot,
  Pin,
  Sparkles,
  Smile,
  X,
  CheckCircle2,
  AlertCircle,
  FileText,
  FileCode,
  Download,
  Trash2,
  Edit2,
  Reply,
  Info,
  ChevronRight,
  ShieldCheck,
  Zap,
  HelpCircle,
  TrendingUp,
  Scale,
  RefreshCw,
  Clock,
  UserPlus,
  UserMinus,
  Lock,
  Globe,
  Bell,
  Eye,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const ResearchChatPage: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  // Conversations & active selection
  const [conversations, setConversations] = useState<ResearchConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<ResearchMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [tabFilter, setTabFilter] = useState<'all' | 'direct' | 'group'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Composer state
  const [inputMessage, setInputMessage] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [replyingTo, setReplyingTo] = useState<ResearchMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ResearchMessage | null>(null);

  // Right sidebar drawer state
  const [showRightDrawer, setShowRightDrawer] = useState<boolean>(true);
  const [rightDrawerTab, setRightDrawerTab] = useState<'overview' | 'findings' | 'files' | 'datasets'>('overview');

  // Modals state
  const [showCreateGroupModal, setShowCreateGroupModal] = useState<boolean>(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState<boolean>(false);
  const [showShareDatasetModal, setShowShareDatasetModal] = useState<boolean>(false);
  const [showDirectoryModal, setShowDirectoryModal] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<ResearcherProfile | null>(null);
  const [showAIAskModal, setShowAIAskModal] = useState<boolean>(false);

  // Form states
  const [newGroupTitle, setNewGroupTitle] = useState<string>('');
  const [newGroupDesc, setNewGroupDesc] = useState<string>('');
  const [selectedInitialMembers, setSelectedInitialMembers] = useState<string[]>([]);
  const [availableResearchers, setAvailableResearchers] = useState<ResearcherProfile[]>([]);
  const [availableDatasets, setAvailableDatasets] = useState<any[]>([]);
  const [aiCustomQuestion, setAiCustomQuestion] = useState<string>('');
  const [aiExecuting, setAiExecuting] = useState<boolean>(false);

  // Real-time socket & polling
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ---------------------------------------------------------------------------
  // 1. Initial Load & Fetching
  // ---------------------------------------------------------------------------
  const fetchConversations = async (selectFirst: boolean = false) => {
    try {
      const res = await apiFetch('/api/v1/research-chat/conversations');
      if (res.ok) {
        const data: ResearchConversation[] = await res.json();
        setConversations(data);
        if (data.length > 0) {
          if (selectFirst || !activeConvId) {
            setActiveConvId(data[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchResearchers = async () => {
    try {
      const res = await apiFetch('/api/v1/research-chat/researchers');
      if (res.ok) {
        const data = await res.json();
        setAvailableResearchers(data);
      }
    } catch (err) {
      console.error('Error fetching researchers:', err);
    }
  };

  const fetchDatasets = async () => {
    try {
      const res = await apiFetch('/api/v1/datasets');
      if (res.ok) {
        const data = await res.json();
        setAvailableDatasets(Array.isArray(data) ? data : (data.datasets || []));
      }
    } catch (err) {
      console.error('Error fetching datasets:', err);
    }
  };

  useEffect(() => {
    fetchConversations(true);
    fetchResearchers();
    fetchDatasets();
  }, []);

  // ---------------------------------------------------------------------------
  // 2. Active Conversation Details & Messages
  // ---------------------------------------------------------------------------
  const loadConversationData = async (convId: string) => {
    setLoadingMessages(true);
    try {
      // 1. Get messages
      const msgsRes = await apiFetch(`/api/v1/research-chat/conversations/${convId}/messages?limit=60`);
      if (msgsRes.ok) {
        const msgsData = await msgsRes.json();
        setMessages(msgsData);
      }

      // 2. Get details (members, findings, files, datasets)
      const detailsRes = await apiFetch(`/api/v1/research-chat/conversations/${convId}/details`);
      if (detailsRes.ok) {
        const detailsData: ConversationDetail = await detailsRes.json();
        setActiveDetail(detailsData);
      }
    } catch (err) {
      console.error('Error loading conversation:', err);
    } finally {
      setLoadingMessages(false);
      setTimeout(scrollToBottom, 100);
    }
  };

  useEffect(() => {
    if (activeConvId) {
      loadConversationData(activeConvId);
      setupWebSocket(activeConvId);
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [activeConvId]);

  // Periodic polling fallback to guarantee synced messages
  useEffect(() => {
    if (!activeConvId) return;
    const interval = setInterval(() => {
      loadConversationData(activeConvId);
    }, 8000);
    return () => clearInterval(interval);
  }, [activeConvId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ---------------------------------------------------------------------------
  // 3. WebSocket Real-time Connectivity
  // ---------------------------------------------------------------------------
  const setupWebSocket = (convId: string) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const baseUrl = getApiUrl() || window.location.origin;
    const wsProto = baseUrl.startsWith('https') ? 'wss:' : 'ws:';
    const wsHost = baseUrl.replace(/^https?:\/\//, '');
    const wsUrl = `${wsProto}//${wsHost}/ws/research-chat/${convId}`;

    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setSocketConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'NEW_MESSAGE' && payload.message) {
            setMessages((prev) => {
              const exists = prev.some((m) => m.id === payload.message.id);
              if (exists) return prev;
              return [...prev, payload.message];
            });
            setTimeout(scrollToBottom, 100);
          } else if (payload.type === 'AI_UPDATED') {
            loadConversationData(convId);
          }
        } catch (e) {
          // Heartbeat pong etc.
        }
      };

      socket.onclose = () => {
        setSocketConnected(false);
      };

      socket.onerror = () => {
        setSocketConnected(false);
      };
    } catch (e) {
      setSocketConnected(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 4. Message Actions: Send, Edit, Delete, Reply, React
  // ---------------------------------------------------------------------------
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || !activeConvId || sending) return;

    setSending(true);
    try {
      if (editingMessage) {
        const res = await apiFetch(`/api/v1/research-chat/messages/${editingMessage.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ content: inputMessage.trim() })
        });
        if (res.ok) {
          const updated = await res.json();
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
          setEditingMessage(null);
          setInputMessage('');
          addToast('success', 'Message Updated', 'Your message was successfully edited.');
        }
      } else {
        const payload = {
          content: inputMessage.trim(),
          parent_message_id: replyingTo?.id || null,
          message_type: 'text'
        };

        const res = await apiFetch(`/api/v1/research-chat/conversations/${activeConvId}/messages`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const newMsg = await res.json();
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setInputMessage('');
          setReplyingTo(null);
          setTimeout(scrollToBottom, 50);
        } else {
          const err = await res.json();
          addToast('error', 'Send Failed', err.detail || 'Failed to send message');
        }
      }
    } catch (err) {
      addToast('error', 'Network Error', 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return;
    try {
      const res = await apiFetch(`/api/v1/research-chat/messages/${msgId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
        addToast('info', 'Message Deleted', 'The message has been removed.');
      } else {
        const err = await res.json();
        addToast('error', 'Delete Failed', err.detail || 'Could not delete message');
      }
    } catch (err) {
      addToast('error', 'Error', 'Error deleting message');
    }
  };

  const handleToggleReaction = async (msgId: string, emoji: string) => {
    try {
      const res = await apiFetch(`/api/v1/research-chat/messages/${msgId}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji })
      });
      if (res.ok) {
        const updated = await res.json();
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      }
    } catch (err) {
      console.error('Error toggling reaction:', err);
    }
  };

  // ---------------------------------------------------------------------------
  // 5. File & Dataset Sharing
  // ---------------------------------------------------------------------------
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConvId) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('note', `Uploaded file: ${file.name}`);

    const token = localStorage.getItem('floatchat_token');
    try {
      addToast('info', 'Uploading File', `Scanning and uploading ${file.name}...`);
      const res = await fetch(`${getApiUrl()}/api/v1/research-chat/conversations/${activeConvId}/files`, {
        method: 'POST',
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: formData
      });

      if (res.ok) {
        const newMsg = await res.json();
        setMessages((prev) => [...prev, newMsg]);
        loadConversationData(activeConvId);
        addToast('success', 'File Shared', `File ${file.name} shared successfully!`);
      } else {
        const err = await res.json();
        addToast('error', 'Upload Failed', err.detail || 'File upload failed');
      }
    } catch (err) {
      addToast('error', 'Upload Error', 'Failed to upload research file');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleShareDataset = async (datasetId: string, datasetName: string) => {
    if (!activeConvId) return;
    try {
      const res = await apiFetch(`/api/v1/research-chat/conversations/${activeConvId}/datasets`, {
        method: 'POST',
        body: JSON.stringify({
          dataset_id: datasetId,
          note: `Shared NetCDF/CSV Dataset: **${datasetName}**`
        })
      });

      if (res.ok) {
        const newMsg = await res.json();
        setMessages((prev) => [...prev, newMsg]);
        loadConversationData(activeConvId);
        setShowShareDatasetModal(false);
        addToast('success', 'Dataset Referenced', `Referenced dataset ${datasetName}`);
      } else {
        const err = await res.json();
        addToast('error', 'Reference Failed', err.detail || 'Could not reference dataset');
      }
    } catch (err) {
      addToast('error', 'Share Error', 'Error sharing dataset reference');
    }
  };

  // ---------------------------------------------------------------------------
  // 6. Pinned Research Findings
  // ---------------------------------------------------------------------------
  const handlePinFinding = async (msg: ResearchMessage) => {
    if (!activeConvId) return;
    try {
      const res = await apiFetch(`/api/v1/research-chat/conversations/${activeConvId}/findings`, {
        method: 'POST',
        body: JSON.stringify({
          message_id: msg.id,
          finding_text: msg.content,
          related_dataset_id: msg.dataset_refs?.[0]?.dataset_id || null
        })
      });

      if (res.ok) {
        addToast('success', 'Finding Pinned', '📌 Research Finding pinned to collaboration board!');
        loadConversationData(activeConvId);
      } else {
        const err = await res.json();
        addToast('error', 'Pin Failed', err.detail || 'Could not pin finding');
      }
    } catch (err) {
      addToast('error', 'Pin Error', 'Error pinning finding');
    }
  };

  const handleUnpinFinding = async (findingId: string) => {
    try {
      const res = await apiFetch(`/api/v1/research-chat/findings/${findingId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        addToast('info', 'Finding Unpinned', 'Finding removed from board.');
        if (activeConvId) loadConversationData(activeConvId);
      }
    } catch (err) {
      addToast('error', 'Unpin Error', 'Error unpinning finding');
    }
  };

  // ---------------------------------------------------------------------------
  // 7. AI Research Assistant & Commands
  // ---------------------------------------------------------------------------
  const handleAskAI = async (customQ?: string) => {
    const q = customQ || aiCustomQuestion;
    if (!q.trim() || !activeConvId || aiExecuting) return;

    setAiExecuting(true);
    try {
      const res = await apiFetch(`/api/v1/research-chat/conversations/${activeConvId}/ai-ask`, {
        method: 'POST',
        body: JSON.stringify({
          question: q.trim(),
          include_context: true,
          dataset_ids: activeDetail?.shared_datasets.map((d) => d.dataset_id) || []
        })
      });

      if (res.status === 403) {
        const err = await res.json();
        const blockMsg = typeof err.detail === 'object' && err.detail?.message
          ? err.detail.message
          : 'Prompt injection attempt detected and blocked before reaching AI.';
        addToast('prompt_blocked', '🔒 PROMPT INJECTION BLOCKED', blockMsg);
        setShowAIAskModal(false);
        setAiCustomQuestion('');
        return;
      }

      if (res.ok) {
        const aiRes: AIResearchResponse = await res.json();
        if (aiRes.blocked) {
          addToast('prompt_blocked', '🔒 PROMPT INJECTION BLOCKED', 'AI request blocked by Prompt Defender security');
        } else {
          addToast('success', 'AI Analysis Complete', 'ORCA AI generated research insights.');
          loadConversationData(activeConvId);
        }
        setShowAIAskModal(false);
        setAiCustomQuestion('');
      } else {
        const err = await res.json();
        addToast('error', 'AI Request Failed', typeof err.detail === 'string' ? err.detail : 'AI Assistant request failed');
      }
    } catch (err) {
      addToast('error', 'AI Error', 'Error communicating with ORCA AI');
    } finally {
      setAiExecuting(false);
    }
  };

  const handleRunAICommand = async (command: string, label: string) => {
    if (!activeConvId || aiExecuting) return;
    setAiExecuting(true);
    addToast('info', 'Running AI Action', `Analyzing research context: ${label}...`);
    try {
      const res = await apiFetch(`/api/v1/research-chat/conversations/${activeConvId}/ai-command`, {
        method: 'POST',
        body: JSON.stringify({ command })
      });

      if (res.status === 403) {
        const err = await res.json();
        const blockMsg = typeof err.detail === 'object' && err.detail?.message
          ? err.detail.message
          : 'Prompt injection attempt detected and blocked before reaching AI.';
        addToast('prompt_blocked', '🔒 PROMPT INJECTION BLOCKED', blockMsg);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        if (data.blocked) {
          addToast('prompt_blocked', '🔒 PROMPT INJECTION BLOCKED', 'Command blocked by Prompt Defender security');
        } else {
          addToast('success', 'Action Completed', `Completed: ${label}`);
          loadConversationData(activeConvId);
        }
      } else {
        const err = await res.json();
        addToast('error', 'Action Failed', typeof err.detail === 'string' ? err.detail : 'Command failed');
      }
    } catch (err) {
      addToast('error', 'Execution Error', 'Error running AI research command');
    } finally {
      setAiExecuting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 8. Group & Direct Conversation Creation
  // ---------------------------------------------------------------------------
  const handleCreateGroup = async () => {
    if (!newGroupTitle.trim()) {
      addToast('error', 'Validation Error', 'Please enter a group title');
      return;
    }

    try {
      const res = await apiFetch('/api/v1/research-chat/conversations/group', {
        method: 'POST',
        body: JSON.stringify({
          title: newGroupTitle.trim(),
          description: newGroupDesc.trim() || undefined,
          initial_member_ids: selectedInitialMembers
        })
      });

      if (res.ok) {
        const newGroup = await res.json();
        addToast('success', 'Group Created', `Created group '${newGroup.title}'`);
        setShowCreateGroupModal(false);
        setNewGroupTitle('');
        setNewGroupDesc('');
        setSelectedInitialMembers([]);
        fetchConversations();
        setActiveConvId(newGroup.id);
      } else {
        const err = await res.json();
        addToast('error', 'Creation Failed', err.detail || 'Could not create group');
      }
    } catch (err) {
      addToast('error', 'Group Error', 'Error creating research group');
    }
  };

  const handleStartDirectChat = async (targetUserId: string) => {
    try {
      const res = await apiFetch('/api/v1/research-chat/conversations/direct', {
        method: 'POST',
        body: JSON.stringify({ target_user_id: targetUserId })
      });

      if (res.ok) {
        const conv = await res.json();
        setShowDirectoryModal(false);
        fetchConversations();
        setActiveConvId(conv.id);
      } else {
        const err = await res.json();
        addToast('error', 'Chat Start Failed', err.detail || 'Could not start direct chat');
      }
    } catch (err) {
      addToast('error', 'Chat Error', 'Error starting direct chat');
    }
  };

  const handleAddMember = async (targetUserId: string) => {
    if (!activeConvId) return;
    try {
      const res = await apiFetch(`/api/v1/research-chat/conversations/${activeConvId}/members`, {
        method: 'POST',
        body: JSON.stringify({ user_id: targetUserId, role: 'member' })
      });

      if (res.ok) {
        addToast('success', 'Member Added', 'Member added to group');
        setShowAddMemberModal(false);
        loadConversationData(activeConvId);
      } else {
        const err = await res.json();
        addToast('error', 'Add Failed', err.detail || 'Could not add member');
      }
    } catch (err) {
      addToast('error', 'Member Error', 'Error adding member');
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    if (!activeConvId) return;
    if (!confirm('Remove this researcher from the group?')) return;
    try {
      const res = await apiFetch(`/api/v1/research-chat/conversations/${activeConvId}/members/${targetUserId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        addToast('info', 'Member Removed', 'Member removed from group.');
        loadConversationData(activeConvId);
      } else {
        const err = await res.json();
        addToast('error', 'Remove Failed', err.detail || 'Could not remove member');
      }
    } catch (err) {
      addToast('error', 'Remove Error', 'Error removing member');
    }
  };

  // ---------------------------------------------------------------------------
  // Filters & Computation
  // ---------------------------------------------------------------------------
  const filteredConversations = conversations.filter((c) => {
    const matchesTab =
      tabFilter === 'all' ||
      (tabFilter === 'direct' && c.type === 'direct') ||
      (tabFilter === 'group' && c.type === 'group');

    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesTab && matchesSearch;
  });

  const activeConversation = conversations.find((c) => c.id === activeConvId);

  // ---------------------------------------------------------------------------
  // Render Main Layout
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col h-[calc(100vh-80px)] -m-6 bg-[#030712] text-slate-100 overflow-hidden font-sans">
      {/* ── TOP HEADER BANNER ── */}
      <header className="px-6 py-3.5 bg-slate-900/80 border-b border-ocean-500/20 backdrop-blur-xl flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-ocean-500 to-cyan-500 p-0.5 shadow-lg shadow-cyan-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white">Research Chat</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                COLLABORATIVE HUB
              </span>
              {socketConnected ? (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded-full">
                  SYNCED
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Collaborate with researchers, share NetCDF datasets, pin empirical findings, and consult ORCA AI
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowDirectoryModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition"
          >
            <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
            <span>Find Researcher</span>
          </button>
          <button
            onClick={() => setShowCreateGroupModal(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-ocean-600 to-cyan-600 hover:from-ocean-500 hover:to-cyan-500 text-xs font-semibold text-white shadow-md shadow-cyan-500/20 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Research Group</span>
          </button>
        </div>
      </header>

      {/* ── 3-COLUMN WORKSPACE BODY ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ──────────────────────────────────────────────────────────── */}
        {/* LEFT SIDEBAR: Conversations, Groups, Search                 */}
        {/* ──────────────────────────────────────────────────────────── */}
        <aside className="w-80 shrink-0 border-r border-slate-800/80 bg-slate-950/70 flex flex-col justify-between">
          <div className="p-3.5 space-y-3 flex flex-col flex-1 overflow-hidden">
            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search conversations & groups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex p-1 rounded-xl bg-slate-900 border border-slate-800/80 text-[11px] font-medium">
              {(['all', 'direct', 'group'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setTabFilter(tab)}
                  className={`flex-1 py-1 rounded-lg capitalize transition ${
                    tabFilter === tab
                      ? 'bg-gradient-to-r from-ocean-600/80 to-cyan-600/80 text-white font-semibold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab === 'all' ? 'All Chats' : tab === 'direct' ? 'Direct' : 'Groups'}
                </button>
              ))}
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {loading ? (
                <div className="p-6 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-500" />
                  Loading research conversations...
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 space-y-2">
                  <MessageSquare className="w-8 h-8 mx-auto text-slate-700" />
                  <p className="font-semibold text-slate-400">No conversations found</p>
                  <p className="text-[11px] text-slate-600">
                    {searchQuery
                      ? 'Try a different search term.'
                      : 'Start a direct conversation with another researcher or create a research group.'}
                  </p>
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const isActive = conv.id === activeConvId;
                  const isGroup = conv.type === 'group';

                  return (
                    <button
                      key={conv.id}
                      onClick={() => setActiveConvId(conv.id)}
                      className={`w-full text-left p-3 rounded-2xl transition flex items-start gap-3 relative ${
                        isActive
                          ? 'bg-slate-800/90 border border-cyan-500/40 shadow-lg shadow-cyan-950/30 text-white'
                          : 'hover:bg-slate-900/60 border border-transparent text-slate-300'
                      }`}
                    >
                      {/* Avatar */}
                      <div className="relative shrink-0 mt-0.5">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                            isGroup
                              ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white'
                              : 'bg-gradient-to-br from-ocean-600 to-cyan-600 text-white'
                          }`}
                        >
                          {isGroup ? <Users className="w-4 h-4" /> : conv.title.slice(0, 2).toUpperCase()}
                        </div>
                        {!isGroup && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-950" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <p className="text-xs font-semibold truncate text-slate-100">{conv.title}</p>
                          {conv.last_message && (
                            <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                              {conv.last_message.created_at.split(' ')[1] || ''}
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-400 truncate leading-snug">
                          {conv.last_message ? (
                            <span>
                              <span className="font-semibold text-slate-300">
                                {conv.last_message.sender_name.split(' ')[0]}:{' '}
                              </span>
                              {conv.last_message.content}
                            </span>
                          ) : (
                            <span className="italic text-slate-600">No messages yet</span>
                          )}
                        </p>
                      </div>

                      {/* Unread badge */}
                      {conv.unread_count > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-cyan-500 text-slate-950 shadow-sm">
                          {conv.unread_count}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* User Profile Mini Bar */}
          <div className="p-3 border-t border-slate-800/80 bg-slate-900/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-xs font-bold text-cyan-400 shrink-0">
                {user?.name ? user.name[0] : 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">{user?.name}</p>
                <p className="text-[10px] text-slate-500 truncate">{user?.role} • Online</p>
              </div>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          </div>
        </aside>

        {/* ──────────────────────────────────────────────────────────── */}
        {/* CENTER PANEL: Active Conversation & Messages                */}
        {/* ──────────────────────────────────────────────────────────── */}
        <section className="flex-1 flex flex-col bg-slate-950 min-w-0 overflow-hidden relative">
          {activeConversation ? (
            <>
              {/* Active Conversation Header */}
              <div className="px-5 py-3 border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                      activeConversation.type === 'group'
                        ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white'
                        : 'bg-gradient-to-br from-ocean-600 to-cyan-600 text-white'
                    }`}
                  >
                    {activeConversation.type === 'group' ? (
                      <Users className="w-4 h-4" />
                    ) : (
                      activeConversation.title.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-white truncate">{activeConversation.title}</h2>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
                        {activeConversation.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {activeConversation.description ||
                        `${activeDetail?.members.length || activeConversation.members.length} participating researchers`}
                    </p>
                  </div>
                </div>

                {/* Header Action Tools */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowAIAskModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-semibold transition"
                    title="Consult ORCA AI on current discussion"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Ask ORCA AI</span>
                  </button>

                  <button
                    onClick={() => {
                      setRightDrawerTab('findings');
                      setShowRightDrawer(true);
                    }}
                    className="p-2 rounded-xl text-slate-400 hover:text-amber-400 hover:bg-slate-800/80 transition relative"
                    title="View Pinned Findings"
                  >
                    <Pin className="w-4 h-4" />
                    {(activeDetail?.pinned_findings.length || 0) > 0 && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-slate-900" />
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setRightDrawerTab('overview');
                      setShowRightDrawer(!showRightDrawer);
                    }}
                    className={`p-2 rounded-xl transition ${
                      showRightDrawer
                        ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                    }`}
                    title="Toggle Context Panel"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Messages Scroll Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {loadingMessages ? (
                  <div className="py-20 text-center text-xs text-slate-500 flex flex-col items-center gap-3">
                    <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
                    Loading research messages & datasets...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-24 text-center max-w-sm mx-auto space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-cyan-400">
                      <MessageSquare className="w-7 h-7" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-200">Start the research discussion</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Send a message, attach an oceanographic NetCDF file, reference a dataset, or ask ORCA AI to analyze patterns.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.sender_id === user?.id;
                    const isSystem = msg.message_type === 'system';
                    const isAI = msg.message_type === 'ai_response';

                    if (isSystem) {
                      return (
                        <div key={msg.id} className="flex justify-center my-3">
                          <div className="px-4 py-1.5 rounded-full bg-slate-900/90 border border-slate-800/90 text-[11px] text-slate-400 max-w-md text-center shadow-sm">
                            {msg.content}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col group ${isMe ? 'items-end' : 'items-start'} transition-all`}
                      >
                        {/* Sender info */}
                        <div className="flex items-center gap-2 mb-1 px-1">
                          <span className="text-xs font-semibold text-slate-300">{msg.sender_name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {msg.sender_role} • {msg.created_at.split(' ')[1] || msg.created_at}
                          </span>
                          {msg.is_edited && <span className="text-[9px] text-slate-500 italic">(edited)</span>}
                        </div>

                        {/* Message Card / Bubble */}
                        <div
                          className={`max-w-xl rounded-2xl p-4 relative shadow-md transition-all ${
                            isAI
                              ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 border border-cyan-500/40 text-slate-100'
                              : msg.is_pinned
                              ? 'bg-slate-900 border-2 border-amber-500/50 text-slate-100 shadow-amber-950/20'
                              : isMe
                              ? 'bg-gradient-to-br from-ocean-700 to-cyan-700 text-white'
                              : 'bg-slate-900/90 border border-slate-800 text-slate-200'
                          }`}
                        >
                          {/* Pinned Finding Indicator */}
                          {msg.is_pinned && (
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400 mb-2 pb-1.5 border-b border-amber-500/20">
                              <Pin className="w-3 h-3 text-amber-400" />
                              <span>📌 PINNED RESEARCH FINDING</span>
                            </div>
                          )}

                          {/* Quoted parent message */}
                          {msg.parent_message_preview && (
                            <div className="mb-2 p-2 rounded-lg bg-black/20 border-l-2 border-cyan-400 text-[11px] text-slate-300 italic">
                              {msg.parent_message_preview}
                            </div>
                          )}

                          {/* Message Content */}
                          <div className="text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</div>

                          {/* Attachment Cards */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {msg.attachments.map((att) => (
                                <div
                                  key={att.id}
                                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                                      <FileCode className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-slate-200 truncate">{att.filename}</p>
                                      <p className="text-[10px] text-slate-500 font-mono">
                                        {att.file_size} • {att.file_type}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                        att.duplicate_status === 'Duplicate'
                                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      }`}
                                    >
                                      {att.duplicate_status}
                                    </span>
                                    <a
                                      href={`${getApiUrl()}/${att.file_path.replace('./', '')}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      download
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition"
                                      title="Download File"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Referenced Dataset Cards */}
                          {msg.dataset_refs && msg.dataset_refs.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {msg.dataset_refs.map((ds) => (
                                <div
                                  key={ds.id}
                                  className="p-3 rounded-xl bg-slate-950/80 border border-cyan-500/30 flex items-center justify-between gap-3"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-600 to-ocean-600 flex items-center justify-center text-white shrink-0">
                                      <Database className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="text-xs font-bold text-cyan-300 truncate">{ds.dataset_name}</p>
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300">
                                          {ds.verification_status || 'Verified'}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-slate-400 font-mono">
                                        Type: {ds.dataset_type} • ID: {ds.dataset_id.slice(0, 8)}...
                                      </p>
                                    </div>
                                  </div>

                                  <a
                                    href="#/datasets"
                                    className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-[11px] font-semibold transition shrink-0"
                                  >
                                    Open Dataset
                                  </a>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Hover action bar */}
                          <div
                            className={`absolute top-2 right-2 hidden group-hover:flex items-center gap-1 p-1 rounded-lg bg-slate-950/90 border border-slate-800 shadow-lg text-slate-400`}
                          >
                            {/* Pin as finding */}
                            <button
                              onClick={() => handlePinFinding(msg)}
                              className="p-1 hover:text-amber-400 hover:bg-slate-800 rounded transition"
                              title="Pin as Research Finding"
                            >
                              <Pin className="w-3.5 h-3.5" />
                            </button>

                            {/* React with emoji */}
                            <button
                              onClick={() => handleToggleReaction(msg.id, '🔬')}
                              className="p-1 hover:text-cyan-400 hover:bg-slate-800 rounded transition text-xs"
                              title="React 🔬"
                            >
                              🔬
                            </button>
                            <button
                              onClick={() => handleToggleReaction(msg.id, '👍')}
                              className="p-1 hover:text-cyan-400 hover:bg-slate-800 rounded transition text-xs"
                              title="React 👍"
                            >
                              👍
                            </button>
                            <button
                              onClick={() => handleToggleReaction(msg.id, '💡')}
                              className="p-1 hover:text-cyan-400 hover:bg-slate-800 rounded transition text-xs"
                              title="React 💡"
                            >
                              💡
                            </button>

                            {/* Reply */}
                            <button
                              onClick={() => setReplyingTo(msg)}
                              className="p-1 hover:text-cyan-400 hover:bg-slate-800 rounded transition"
                              title="Reply"
                            >
                              <Reply className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit / Delete for author or admin */}
                            {(isMe || user?.role === 'Admin') && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingMessage(msg);
                                    setInputMessage(msg.content);
                                  }}
                                  className="p-1 hover:text-slate-200 hover:bg-slate-800 rounded transition"
                                  title="Edit"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteMessage(msg.id)}
                                  className="p-1 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Reaction pills */}
                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5 px-1">
                            {Object.entries(msg.reactions).map(([emoji, uids]) => {
                              const hasReacted = uids.includes(user?.id || '');
                              return (
                                <button
                                  key={emoji}
                                  onClick={() => handleToggleReaction(msg.id, emoji)}
                                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border transition ${
                                    hasReacted
                                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-bold'
                                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                                  }`}
                                >
                                  <span>{emoji}</span>
                                  <span>{uids.length}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* ── MESSAGE COMPOSER & AI COMMAND BAR ── */}
              <div className="p-4 border-t border-slate-800/80 bg-slate-900/70 backdrop-blur-xl shrink-0 space-y-2.5">
                {/* Replying banner */}
                {replyingTo && (
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/90 border border-slate-700 text-xs text-slate-300">
                    <div className="flex items-center gap-2 truncate">
                      <Reply className="w-3.5 h-3.5 text-cyan-400" />
                      <span>
                        Replying to <strong className="text-white">{replyingTo.sender_name}</strong>: "
                        {replyingTo.content.slice(0, 40)}..."
                      </span>
                    </div>
                    <button onClick={() => setReplyingTo(null)} className="text-slate-400 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Editing banner */}
                {editingMessage && (
                  <div className="flex items-center justify-between p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
                    <div className="flex items-center gap-2 truncate">
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Editing message</span>
                    </div>
                    <button
                      onClick={() => {
                        setEditingMessage(null);
                        setInputMessage('');
                      }}
                      className="text-amber-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Quick AI Action Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-medium custom-scrollbar">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold shrink-0 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-cyan-400" /> AI Actions:
                  </span>
                  <button
                    disabled={aiExecuting}
                    onClick={() => handleRunAICommand('summarize', 'Summarize Discussion')}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 shrink-0 transition"
                  >
                    ⚡ Summarize
                  </button>
                  <button
                    disabled={aiExecuting}
                    onClick={() => handleRunAICommand('extract_findings', 'Extract Findings')}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 shrink-0 transition"
                  >
                    📌 Extract Findings
                  </button>
                  <button
                    disabled={aiExecuting}
                    onClick={() => handleRunAICommand('compare_datasets', 'Compare Datasets')}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 shrink-0 transition"
                  >
                    📊 Compare Datasets
                  </button>
                  <button
                    disabled={aiExecuting}
                    onClick={() => handleRunAICommand('identify_questions', 'Open Questions')}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 shrink-0 transition"
                  >
                    ❓ Open Questions
                  </button>
                  <button
                    disabled={aiExecuting}
                    onClick={() => handleRunAICommand('find_contradictions', 'Contradiction Check')}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 shrink-0 transition"
                  >
                    🔍 Contradictions
                  </button>
                </div>

                {/* Input form */}
                <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".nc,.csv,.json,.pdf,.txt,.png,.jpg,.jpeg"
                  />

                  {/* Attachment & Dataset buttons */}
                  <div className="flex items-center gap-1 shrink-0 pb-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 border border-slate-700 transition"
                      title="Share File (.nc, .csv, .json, .pdf)"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowShareDatasetModal(true)}
                      className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 border border-slate-700 transition"
                      title="Reference NetCDF Dataset"
                    >
                      <Database className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Textarea Input */}
                  <div className="flex-1 relative">
                    <textarea
                      rows={2}
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Type a research note, mention @Researcher, or paste data..."
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                    />
                  </div>

                  {/* Send Button */}
                  <button
                    type="submit"
                    disabled={!inputMessage.trim() || sending}
                    className="p-3 rounded-2xl bg-gradient-to-r from-ocean-600 to-cyan-600 hover:from-ocean-500 hover:to-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg shadow-cyan-500/20 transition shrink-0"
                  >
                    {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 shadow-xl">
                <MessageSquare className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Select a Research Conversation</h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Choose a direct researcher chat or research group from the left sidebar to start collaborating.
                </p>
              </div>
              <button
                onClick={() => setShowCreateGroupModal(true)}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow transition"
              >
                Create Research Group
              </button>
            </div>
          )}
        </section>

        {/* ──────────────────────────────────────────────────────────── */}
        {/* RIGHT PANEL: Group Info, Members, Findings, Datasets         */}
        {/* ──────────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {showRightDrawer && activeConversation && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-l border-slate-800/80 bg-slate-950/80 flex flex-col shrink-0 overflow-hidden"
            >
              {/* Drawer Tabs */}
              <div className="p-3 border-b border-slate-800 flex items-center gap-1 bg-slate-900/40">
                <button
                  onClick={() => setRightDrawerTab('overview')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                    rightDrawerTab === 'overview' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Members
                </button>
                <button
                  onClick={() => setRightDrawerTab('findings')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                    rightDrawerTab === 'findings' ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Findings ({activeDetail?.pinned_findings.length || 0})
                </button>
                <button
                  onClick={() => setRightDrawerTab('datasets')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                    rightDrawerTab === 'datasets' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Datasets
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {/* ── TAB 1: MEMBERS & OVERVIEW ── */}
                {rightDrawerTab === 'overview' && (
                  <div className="space-y-4">
                    {/* Overview summary */}
                    <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">About</p>
                      <p className="text-xs text-slate-200">
                        {activeConversation.description || 'Collaborative oceanographic research workspace.'}
                      </p>
                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span>Created: {activeConversation.created_at.split(' ')[0]}</span>
                        <span>Type: {activeConversation.type.toUpperCase()}</span>
                      </div>
                    </div>

                    {/* Members List */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Members ({activeDetail?.members.length || 0})
                        </p>
                        {activeConversation.type === 'group' && (
                          <button
                            onClick={() => setShowAddMemberModal(true)}
                            className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Add
                          </button>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        {(activeDetail?.members || activeConversation.members).map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/80 hover:bg-slate-900 transition"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold shrink-0">
                                {m.name[0]}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-200 truncate">{m.name}</p>
                                <p className="text-[10px] text-slate-500 truncate">{m.user_role}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-800 text-slate-400 border border-slate-700">
                                {m.role}
                              </span>
                              {activeConversation.type === 'group' && m.user_id !== user?.id && (
                                <button
                                  onClick={() => handleRemoveMember(m.user_id)}
                                  className="text-slate-500 hover:text-rose-400 p-1"
                                  title="Remove from group"
                                >
                                  <UserMinus className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── TAB 2: PINNED RESEARCH FINDINGS ── */}
                {rightDrawerTab === 'findings' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Pinned Research Findings
                      </p>
                    </div>

                    {(!activeDetail?.pinned_findings || activeDetail.pinned_findings.length === 0) ? (
                      <div className="p-6 text-center text-xs text-slate-500 space-y-2">
                        <Pin className="w-6 h-6 mx-auto text-slate-700" />
                        <p>No pinned findings yet.</p>
                        <p className="text-[11px] text-slate-600">
                          Hover over any message and click the pin icon to preserve key oceanographic insights.
                        </p>
                      </div>
                    ) : (
                      activeDetail.pinned_findings.map((finding) => (
                        <div
                          key={finding.id}
                          className="p-3.5 rounded-2xl bg-slate-900 border border-amber-500/30 space-y-2 shadow-sm relative group"
                        >
                          <div className="flex items-center justify-between text-[10px] text-amber-400 font-bold">
                            <span className="flex items-center gap-1">
                              <Pin className="w-3 h-3" /> FINDING
                            </span>
                            <button
                              onClick={() => handleUnpinFinding(finding.id)}
                              className="text-slate-500 hover:text-rose-400 transition"
                              title="Unpin finding"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <p className="text-xs text-slate-200 leading-relaxed font-medium">{finding.finding_text}</p>

                          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
                            <span>Author: {finding.author_name}</span>
                            <span>{finding.created_at.split(' ')[0]}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* ── TAB 3: SHARED DATASETS & FILES ── */}
                {rightDrawerTab === 'datasets' && (
                  <div className="space-y-4">
                    {/* Datasets */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Referenced Datasets ({activeDetail?.shared_datasets.length || 0})
                        </p>
                        <button
                          onClick={() => setShowShareDatasetModal(true)}
                          className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Share
                        </button>
                      </div>

                      {(!activeDetail?.shared_datasets || activeDetail.shared_datasets.length === 0) ? (
                        <p className="text-xs text-slate-500 italic p-3">No datasets referenced in this chat yet.</p>
                      ) : (
                        activeDetail.shared_datasets.map((ds) => (
                          <div
                            key={ds.id}
                            className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-cyan-300 truncate">{ds.dataset_name}</p>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                                {ds.verification_status}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500">Shared by {ds.shared_by_name || 'Researcher'}</p>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Files */}
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Shared Files ({activeDetail?.shared_files.length || 0})
                      </p>
                      {(!activeDetail?.shared_files || activeDetail.shared_files.length === 0) ? (
                        <p className="text-xs text-slate-500 italic p-3">No files uploaded yet.</p>
                      ) : (
                        activeDetail.shared_files.map((f) => (
                          <div
                            key={f.id}
                            className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-200 truncate">{f.filename}</p>
                              <p className="text-[10px] text-slate-500">{f.file_size}</p>
                            </div>
                            <a
                              href={`${getApiUrl()}/${f.file_path.replace('./', '')}`}
                              target="_blank"
                              rel="noreferrer"
                              download
                              className="p-1.5 rounded text-slate-400 hover:text-cyan-400 hover:bg-slate-800"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* MODAL: CREATE RESEARCH GROUP                                 */}
      {/* ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCreateGroupModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Create Research Group</h3>
                </div>
                <button onClick={() => setShowCreateGroupModal(false)} className="text-slate-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Group Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Pacific Salinity Anomaly Group"
                    value={newGroupTitle}
                    onChange={(e) => setNewGroupTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Description</label>
                  <textarea
                    rows={2}
                    placeholder="Research focus, project goals, datasets examined..."
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500 resize-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                    Select Initial Colleagues
                  </label>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-slate-950 border border-slate-800 custom-scrollbar">
                    {availableResearchers
                      .filter((r) => r.id !== user?.id)
                      .map((r) => {
                        const isSelected = selectedInitialMembers.includes(r.id);
                        return (
                          <div
                            key={r.id}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedInitialMembers(selectedInitialMembers.filter((id) => id !== r.id));
                              } else {
                                setSelectedInitialMembers([...selectedInitialMembers, r.id]);
                              }
                            }}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition text-xs ${
                              isSelected
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                : 'text-slate-300 hover:bg-slate-900'
                            }`}
                          >
                            <span>{r.name} ({r.role})</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  onClick={() => setShowCreateGroupModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateGroup}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white shadow transition"
                >
                  Create Group
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* MODAL: DIRECT RESEARCHER DIRECTORY                           */}
      {/* ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showDirectoryModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Researcher Directory</h3>
                </div>
                <button onClick={() => setShowDirectoryModal(false)} className="text-slate-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2 custom-scrollbar">
                {availableResearchers
                  .filter((r) => r.id !== user?.id)
                  .map((r) => (
                    <div
                      key={r.id}
                      className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between hover:border-cyan-500/40 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-ocean-600 to-cyan-600 text-white font-bold text-xs flex items-center justify-center">
                          {r.name[0]}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">{r.name}</p>
                          <p className="text-[10px] text-slate-400">
                            {r.role} • {r.organization || 'Ocean Institute'}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleStartDirectChat(r.id)}
                        className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-semibold transition"
                      >
                        Message
                      </button>
                    </div>
                  ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* MODAL: SHARE DATASET SELECTOR                                */}
      {/* ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showShareDatasetModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                    <Database className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Reference ORCA Dataset</h3>
                </div>
                <button onClick={() => setShowShareDatasetModal(false)} className="text-slate-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2 custom-scrollbar">
                {availableDatasets.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No datasets found on system.</p>
                ) : (
                  availableDatasets.map((ds) => (
                    <div
                      key={ds.id}
                      className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between hover:border-cyan-500/40 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                          <Database className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">{ds.filename || ds.dataset_name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {ds.format || ds.dataset_type} • {ds.size || ds.file_size}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleShareDataset(ds.id, ds.filename || ds.dataset_name)}
                        className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition"
                      >
                        Share in Chat
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* MODAL: ADD GROUP MEMBER                                      */}
      {/* ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddMemberModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Add Member to Group</h3>
                </div>
                <button onClick={() => setShowAddMemberModal(false)} className="text-slate-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2 custom-scrollbar">
                {availableResearchers
                  .filter((r) => !activeDetail?.members.some((m) => m.user_id === r.id))
                  .map((r) => (
                    <div
                      key={r.id}
                      className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between hover:border-cyan-500/40 transition"
                    >
                      <div>
                        <p className="text-xs font-bold text-white">{r.name}</p>
                        <p className="text-[10px] text-slate-400">{r.role}</p>
                      </div>

                      <button
                        onClick={() => handleAddMember(r.id)}
                        className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition"
                      >
                        Add
                      </button>
                    </div>
                  ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* MODAL: ASK ORCA AI DIRECT QUESTION                           */}
      {/* ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAIAskModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-slate-900 border border-cyan-500/40 rounded-3xl p-6 shadow-2xl space-y-4 shadow-cyan-950/40"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-ocean-500 to-cyan-500 text-white flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Ask ORCA AI</h3>
                    <p className="text-[11px] text-cyan-400">Context-aware oceanographic research assistant</p>
                  </div>
                </div>
                <button onClick={() => setShowAIAskModal(false)} className="text-slate-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-slate-300">
                  Ask ORCA AI a question based on current discussion history and shared NetCDF datasets.
                </p>

                <textarea
                  rows={3}
                  placeholder="e.g. How does the salinity profile compare between the shared datasets? What anomalies are evident?"
                  value={aiCustomQuestion}
                  onChange={(e) => setAiCustomQuestion(e.target.value)}
                  className="w-full p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                />

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <p className="font-semibold text-slate-300">🛡️ Prompt Injection Defender Active</p>
                  <p>All inputs are sanitized. Answers are strictly grounded in authorized research sources.</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  onClick={() => setShowAIAskModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  disabled={!aiCustomQuestion.trim() || aiExecuting}
                  onClick={() => handleAskAI()}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-ocean-600 to-cyan-600 hover:from-ocean-500 hover:to-cyan-500 text-xs font-bold text-white shadow-md shadow-cyan-500/20 disabled:opacity-50 transition"
                >
                  {aiExecuting ? 'Analyzing...' : 'Generate Analysis'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ResearchChatPage;
