import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useTranslation } from '../i18n';
import { GlassCard } from '../components/common/GlassCard';
import { 
  Users, Database, MessageSquare, Waves, ShieldAlert, 
  Terminal, HardDrive, CheckCircle2, ArrowUpRight, 
  Activity, Zap, Clock, ShieldCheck
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  Tooltip, BarChart, Bar, CartesianGrid 
} from 'recharts';
import { OceanExplorer } from '../components/ocean/OceanExplorer';
import { OceanHazardAlertBanner } from '../components/ocean/OceanHazardAlertBanner';

import { ShippingDashboard } from '../components/dashboard/ShippingDashboard';
import { CoastalGuardDashboard } from '../components/dashboard/CoastalGuardDashboard';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { datasets, securityEvents, auditLogs } = useData();
  const { t } = useTranslation();

  const role = user?.role || 'Student';

  if (role === 'Shipping') {
    return <ShippingDashboard />;
  }

  if (role === 'Coastal Guard') {
    return <CoastalGuardDashboard />;
  }

  // Chart Data
  const uploadTrendData = [
    { date: 'Aug 01', uploads: 12, storage: 45 },
    { date: 'Aug 02', uploads: 18, storage: 72 },
    { date: 'Aug 03', uploads: 24, storage: 110 },
    { date: 'Aug 04', uploads: 19, storage: 140 },
    { date: 'Aug 05', uploads: 32, storage: 210 },
    { date: 'Aug 06', uploads: 28, storage: 280 },
    { date: 'Aug 07', uploads: 42, storage: 350 },
  ];

  const aiRequestsData = [
    { hour: '00:00', requests: 140, sqlGenerated: 135 },
    { hour: '04:00', requests: 85, sqlGenerated: 80 },
    { hour: '08:00', requests: 420, sqlGenerated: 410 },
    { hour: '12:00', requests: 890, sqlGenerated: 875 },
    { hour: '16:00', requests: 640, sqlGenerated: 620 },
    { hour: '20:00', requests: 310, sqlGenerated: 300 },
  ];

  const kpiCards = [
    { labelKey: 'dashboard.kpi.totalUsers', value: '1,420', changeKey: 'dashboard.kpiChanges.users', icon: Users, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { labelKey: 'dashboard.kpi.uploadedDatasets', value: '348', changeKey: 'dashboard.kpiChanges.verified', icon: Database, color: 'text-ocean-400', bg: 'bg-ocean-500/10' },
    { labelKey: 'dashboard.kpi.aiQueriesExecuted', value: '12,850', changeKey: 'dashboard.kpiChanges.confidence', icon: MessageSquare, color: 'text-sky-400', bg: 'bg-sky-500/10' },
    { labelKey: 'dashboard.kpi.argoProfiles', value: '1.42 M', changeKey: 'dashboard.kpiChanges.sync', icon: Waves, color: 'text-teal-400', bg: 'bg-teal-500/10' },
    { labelKey: 'dashboard.kpi.securityEvents', value: '84', changeKey: 'dashboard.kpiChanges.incidents', icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { labelKey: 'dashboard.kpi.promptInjectionAttempts', value: '14', changeKey: 'dashboard.kpiChanges.intercepted', icon: ShieldAlert, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { labelKey: 'dashboard.kpi.sqlInjectionAttempts', value: '8', changeKey: 'dashboard.kpiChanges.waf', icon: Terminal, color: 'text-rose-400', bg: 'bg-rose-500/10' },
    { labelKey: 'dashboard.kpi.storageUsed', value: '1.84 / 5 TB', changeKey: 'dashboard.kpiChanges.capacity', icon: HardDrive, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-slate-900/90 via-navy-900/80 to-ocean-950/90 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">{t('dashboard.title', {}, 'Enterprise Operations Dashboard')}</h2>
          <p className="text-xs text-slate-300 mt-1">{t('dashboard.headerDesc', {}, 'Real-time telemetric monitoring for ARGO float discovery, SHA-256 dataset integrity & WAF security.')}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            {t('common.systemOperational', {}, 'System Operational')}
          </div>
          <a
            href="#/flowchat-ai"
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-ocean-500 to-cyan-500 hover:from-ocean-400 hover:to-cyan-400 shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-1.5"
          >
            {t('dashboard.launchAiChat', {}, 'Launch AI Chat')} <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Real-time Ocean Hazard Alert Banner */}
      <OceanHazardAlertBanner />

      {/* Top KPI Cards (Grid of 8) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <GlassCard key={idx} hoverEffect={true} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">{t(card.labelKey)}</span>
                <div className={`p-2 rounded-xl ${card.bg} ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-extrabold text-white tracking-tight font-mono">{card.value}</div>
                <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                  <span>{t(card.changeKey)}</span>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dataset Upload Trend */}
        <GlassCard hoverEffect={false} className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Dataset Upload Trend (.nc / .csv / .json)
              </h3>
              <p className="text-[11px] text-slate-400">Daily file volume & storage consumption growth</p>
            </div>
            <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20">
              7-Day Activity
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={uploadTrendData}>
                <defs>
                  <linearGradient id="colorUploads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#38bdf8', borderRadius: '12px', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="uploads" stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#colorUploads)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Daily AI Requests */}
        <GlassCard hoverEffect={false} className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-ocean-400" />
                {t('dashboard.charts.dailyAiTitle')}
              </h3>
              <p className="text-[11px] text-slate-400">{t('dashboard.charts.dailyAiDesc')}</p>
            </div>
            <span className="text-xs font-mono text-ocean-400 bg-ocean-500/10 px-2.5 py-1 rounded-full border border-ocean-500/20">
              {t('dashboard.charts.realtimeThroughput')}
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aiRequestsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="hour" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#0284c7', borderRadius: '12px', fontSize: '12px' }}
                />
                <Bar dataKey="requests" fill="#0284c7" radius={[6, 6, 0, 0]} />
                <Bar dataKey="sqlGenerated" fill="#38bdf8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      {/* Ocean Geographic Explorer (Interactive Real-World Map & Telemetry Inspector) */}
      <OceanExplorer />

      {/* Recent Uploads & Database Verification Activity */}
      <div className="grid grid-cols-1 gap-6">
        <GlassCard hoverEffect={false} className="space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              {t('dashboard.recentUploads')}
            </h3>
            <a href="#/datasets" className="text-xs text-cyan-400 hover:underline">{t('dashboard.viewAllDatasets')}</a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {datasets.slice(0, 3).map((ds) => (
              <div key={ds.id} className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-200 truncate">{ds.filename}</p>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                    <span>{ds.fileSize}</span>
                    <span>•</span>
                    <span className="font-mono text-[10px] text-slate-500 truncate max-w-[100px]">{ds.sha256}</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  {ds.verificationStatus}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
