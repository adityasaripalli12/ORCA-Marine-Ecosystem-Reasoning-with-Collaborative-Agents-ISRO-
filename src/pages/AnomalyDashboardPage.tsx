import React, { useState, useMemo } from 'react';
import { useDevices } from '../context/DeviceContext';
import { useAuth } from '../context/AuthContext';
import { GlassCard } from '../components/common/GlassCard';
import { AnomalyCard } from '../components/devices/AnomalyCard';
import { Anomaly, SeverityLevel, AnomalyType, AnomalyStatus, SEVERITY_CONFIG } from '../types/devices';
import {
  AlertTriangle, ShieldAlert, CheckCircle2, Search,
  Filter, Eye, ArrowRight, Activity, X, HelpCircle,
  Lightbulb, RefreshCw, Layers, Bell, CheckCircle
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';

const SEVERITY_FILTERS: { key: SeverityLevel | 'all'; label: string }[] = [
  { key: 'all', label: 'All Severities' },
  { key: 'critical', label: 'Critical' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: 'low', label: 'Low' },
];

const STATUS_FILTERS: { key: AnomalyStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All Statuses' },
  { key: 'new', label: 'New' },
  { key: 'investigating', label: 'Investigating' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'ignored', label: 'Ignored' },
];

export const AnomalyDashboardPage: React.FC = () => {
  const {
    anomalies, devices, resolveAnomaly, ignoreAnomaly,
    investigateAnomaly, runAnomalyDetection
  } = useDevices();
  const { user } = useAuth();

  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AnomalyStatus | 'all'>('all');
  const [deviceFilter, setDeviceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);

  // Summary Metrics
  const stats = useMemo(() => {
    return {
      total: anomalies.length,
      critical: anomalies.filter(a => a.severity === 'critical' && a.status !== 'resolved').length,
      high: anomalies.filter(a => a.severity === 'high' && a.status !== 'resolved').length,
      medium: anomalies.filter(a => a.severity === 'medium' && a.status !== 'resolved').length,
      resolved: anomalies.filter(a => a.status === 'resolved').length,
    };
  }, [anomalies]);

  // Filtered List
  const filteredAnomalies = useMemo(() => {
    let list = [...anomalies];
    if (severityFilter !== 'all') {
      list = list.filter(a => a.severity === severityFilter);
    }
    if (statusFilter !== 'all') {
      list = list.filter(a => a.status === statusFilter);
    }
    if (deviceFilter !== 'all') {
      list = list.filter(a => a.deviceId === deviceFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a =>
        a.deviceId.toLowerCase().includes(q) ||
        a.anomalyType.toLowerCase().includes(q) ||
        a.explanation.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
  }, [anomalies, severityFilter, statusFilter, deviceFilter, searchQuery]);

  // Repeated Anomaly Devices
  const deviceAnomalyCounts = useMemo(() => {
    const counts: Record<string, { count: number; critical: number }> = {};
    anomalies.forEach(a => {
      if (!counts[a.deviceId]) counts[a.deviceId] = { count: 0, critical: 0 };
      counts[a.deviceId].count++;
      if (a.severity === 'critical' || a.severity === 'high') {
        counts[a.deviceId].critical++;
      }
    });
    return Object.entries(counts)
      .map(([deviceId, data]) => ({ deviceId, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [anomalies]);

  // Common Anomaly Types Data for Chart
  const anomalyTypeData = useMemo(() => {
    const counts: Record<string, number> = {};
    anomalies.forEach(a => {
      counts[a.anomalyType] = (counts[a.anomalyType] || 0) + 1;
    });
    return Object.entries(counts).map(([type, count]) => ({
      type: type.replace(' ', '\n'),
      count
    }));
  }, [anomalies]);

  // Trend data mock
  const trendData = [
    { time: '04:00', critical: 0, high: 1, medium: 1 },
    { time: '08:00', critical: 1, high: 2, medium: 1 },
    { time: '12:00', critical: 1, high: 3, medium: 2 },
    { time: '16:00', critical: 2, high: 2, medium: 1 },
    { time: '20:00', critical: 1, high: 1, medium: 2 },
    { time: '24:00', critical: 1, high: 2, medium: 1 },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-slate-900/90 via-navy-900/80 to-ocean-950/90 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <ShieldAlert className="w-7 h-7 text-cyan-400" />
            AI Anomaly Detection Hub
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Real-time heuristic & behavioral analysis engine monitoring telemetry streams across all fleet hardware.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => runAnomalyDetection()}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" /> Scan Fleet
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Anomalies', value: stats.total, color: 'text-cyan-400', bg: 'bg-cyan-500/10', icon: Layers },
          { label: 'Critical Risk', value: stats.critical, color: 'text-rose-400', bg: 'bg-rose-500/10', icon: AlertTriangle },
          { label: 'High Risk', value: stats.high, color: 'text-orange-400', bg: 'bg-orange-500/10', icon: ShieldAlert },
          { label: 'Medium Risk', value: stats.medium, color: 'text-amber-400', bg: 'bg-amber-500/10', icon: Activity },
          { label: 'Resolved', value: stats.resolved, color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <GlassCard key={idx} hoverEffect={false} className="!p-3.5 flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${item.bg}`}>
                <Icon className={`w-4 h-4 ${item.color}`} />
              </div>
              <div>
                <div className={`text-xl font-extrabold font-mono ${item.color}`}>{item.value}</div>
                <div className="text-[10px] text-slate-400 font-semibold">{item.label}</div>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Anomaly Trends Area Chart */}
        <GlassCard hoverEffect={false} className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Detection Frequency Trend (24h)
              </h3>
              <p className="text-[11px] text-slate-400">Hourly volume of flagged anomalies by severity</p>
            </div>
            <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20">
              Live Stream
            </span>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorCrit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorHigh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#38bdf8', borderRadius: '12px', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="critical" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorCrit)" name="Critical" />
                <Area type="monotone" dataKey="high" stroke="#f97316" strokeWidth={2} fillOpacity={1} fill="url(#colorHigh)" name="High" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Most Common Anomaly Types Bar Chart */}
        <GlassCard hoverEffect={false} className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Distribution by Anomaly Type
              </h3>
              <p className="text-[11px] text-slate-400">Total occurrences detected across the fleet</p>
            </div>
            <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
              Pattern Breakdown
            </span>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={anomalyTypeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="type" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#f59e0b', borderRadius: '12px', fontSize: '12px' }}
                />
                <Bar dataKey="count" fill="#0284c7" radius={[6, 6, 0, 0]} name="Incidents" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      {/* Repeated Anomalies & Risk List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard hoverEffect={false} className="lg:col-span-1 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            Devices With Repeated Anomalies
          </h3>
          <div className="space-y-2.5">
            {deviceAnomalyCounts.map(item => {
              const dev = devices.find(d => d.id === item.deviceId);
              return (
                <div
                  key={item.deviceId}
                  onClick={() => { window.location.hash = `#/devices/${item.deviceId}?tab=anomalies`; }}
                  className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 cursor-pointer transition-colors flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-cyan-400">{item.deviceId}</span>
                      <span className="text-[11px] text-slate-300 truncate max-w-[120px]">{dev?.name || 'Device'}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {dev?.type || 'IoT Node'} • {dev?.assignedUser}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      {item.count} flag{item.count > 1 ? 's' : ''}
                    </span>
                    {item.critical > 0 && (
                      <div className="text-[9px] text-rose-400 font-semibold mt-1">
                        {item.critical} high/crit
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>

        {/* Live Detected Anomalies List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 w-full sm:max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search anomaly, device, cause..."
                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs glass-input placeholder-slate-500"
              />
            </div>

            {/* Device Filter */}
            <select
              value={deviceFilter}
              onChange={e => setDeviceFilter(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs glass-input"
            >
              <option value="all">All Devices</option>
              {devices.map(d => (
                <option key={d.id} value={d.id}>{d.id} - {d.name}</option>
              ))}
            </select>
          </div>

          {/* Severity & Status Filter Pills */}
          <div className="flex flex-wrap gap-1.5">
            {SEVERITY_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setSeverityFilter(f.key)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all ${
                  severityFilter === f.key
                    ? 'bg-gradient-to-r from-ocean-600 to-cyan-600 text-white shadow-lg shadow-cyan-500/20'
                    : 'text-slate-400 bg-slate-800/40 hover:bg-slate-700/60 border border-slate-700/50'
                }`}
              >
                {f.label}
              </button>
            ))}
            <div className="h-6 w-px bg-slate-800 mx-1 self-center" />
            {STATUS_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all ${
                  statusFilter === f.key
                    ? 'bg-gradient-to-r from-slate-700 to-slate-600 text-white shadow-md'
                    : 'text-slate-400 bg-slate-800/40 hover:bg-slate-700/60 border border-slate-700/50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Anomaly Cards Feed */}
          {filteredAnomalies.length === 0 ? (
            <div className="text-center py-16 glass-panel rounded-2xl border border-slate-800">
              <CheckCircle2 className="w-10 h-10 text-emerald-500/50 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-400">No anomalies match criteria</p>
              <p className="text-xs text-slate-500 mt-1">All telemetry is healthy for the selected filters.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAnomalies.map(anomaly => (
                <AnomalyCard
                  key={anomaly.id}
                  anomaly={anomaly}
                  onClick={() => setSelectedAnomaly(anomaly)}
                  onDeviceClick={id => { window.location.hash = `#/devices/${id}`; }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Complete Anomaly Details Modal */}
      {selectedAnomaly && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          onClick={() => setSelectedAnomaly(null)}
        >
          <div
            className="glass-panel rounded-2xl p-6 max-w-xl w-full border border-cyan-500/30 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${SEVERITY_CONFIG[selectedAnomaly.severity].bgClass} ${SEVERITY_CONFIG[selectedAnomaly.severity].textClass} border ${SEVERITY_CONFIG[selectedAnomaly.severity].borderClass}`}>
                    {selectedAnomaly.severity}
                  </span>
                  <span className="text-xs font-mono text-cyan-400">{selectedAnomaly.deviceId}</span>
                </div>
                <h3 className="text-base font-bold text-white mt-1">{selectedAnomaly.anomalyType}</h3>
              </div>
              <button
                onClick={() => setSelectedAnomaly(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Value comparison */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Observed Value</span>
                <span className={`text-base font-extrabold font-mono ${SEVERITY_CONFIG[selectedAnomaly.severity].textClass}`}>
                  {selectedAnomaly.currentValue}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Expected Baseline</span>
                <span className="text-base font-extrabold font-mono text-emerald-400">
                  {selectedAnomaly.expectedRange}
                </span>
              </div>
            </div>

            {/* Confidence + Detected Time */}
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>Detection Confidence: <strong className="text-white font-mono">{selectedAnomaly.confidence}%</strong></span>
              <span>Time: <strong className="text-white font-mono">{new Date(selectedAnomaly.detectedAt).toLocaleString()}</strong></span>
            </div>

            {/* Explanation */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-cyan-400" /> Technical Explanation
              </span>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/40 p-3 rounded-xl border border-slate-800">
                {selectedAnomaly.explanation}
              </p>
            </div>

            {/* Possible Causes */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Possible Root Causes
              </span>
              <ul className="space-y-1 bg-slate-900/40 p-3 rounded-xl border border-slate-800 text-xs text-slate-300">
                {selectedAnomaly.possibleCauses.map((cause, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>{cause}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommended Action */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-emerald-400" /> Recommended Action
              </span>
              <p className="text-xs text-emerald-300 leading-relaxed bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                {selectedAnomaly.recommendedAction}
              </p>
            </div>

            {/* Actions & Links */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedAnomaly(null);
                    window.location.hash = `#/devices/${selectedAnomaly.deviceId}?tab=telemetry`;
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" /> View Telemetry
                </button>
                <button
                  onClick={() => {
                    setSelectedAnomaly(null);
                    window.location.hash = `#/devices/${selectedAnomaly.deviceId}?tab=history`;
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <Activity className="w-3.5 h-3.5" /> View Timeline
                </button>
              </div>

              <div className="flex items-center gap-2">
                {selectedAnomaly.status !== 'resolved' && (
                  <button
                    onClick={() => {
                      resolveAnomaly(selectedAnomaly.id, user?.email || 'admin@gmail.com');
                      setSelectedAnomaly(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md transition-colors"
                  >
                    Mark Resolved
                  </button>
                )}
                {selectedAnomaly.status === 'new' && (
                  <button
                    onClick={() => {
                      investigateAnomaly(selectedAnomaly.id);
                      setSelectedAnomaly(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
                  >
                    Investigate
                  </button>
                )}
                {selectedAnomaly.status !== 'ignored' && selectedAnomaly.status !== 'resolved' && (
                  <button
                    onClick={() => {
                      ignoreAnomaly(selectedAnomaly.id);
                      setSelectedAnomaly(null);
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 transition-colors"
                  >
                    Ignore
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
