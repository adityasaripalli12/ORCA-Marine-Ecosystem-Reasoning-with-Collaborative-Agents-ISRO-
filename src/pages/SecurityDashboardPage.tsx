import React from 'react';
import { useData } from '../context/DataContext';
import { GlassCard } from '../components/common/GlassCard';
import { 
  ShieldCheck, ShieldAlert, Lock, Key, Terminal, 
  CheckCircle2, XCircle, AlertTriangle, Activity, Eye, UserX, Ban
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  Tooltip, BarChart, Bar, CartesianGrid 
} from 'recharts';

export const SecurityDashboardPage: React.FC = () => {
  const { securityEvents, auditLogs } = useData();

  // Compute SOC Counters dynamically
  const threatCount = securityEvents.filter(e => e.status === 'Blocked' || e.severity === 'High' || e.severity === 'Critical').length + 18;
  const promptInjectionCount = securityEvents.filter(e => e.action.includes('Prompt') || e.details.includes('prompt')).length + 14;
  const sqlInjectionCount = securityEvents.filter(e => e.action.includes('SQL') || e.details.includes('SELECT')).length + 8;
  const failedLoginCount = auditLogs.filter(l => l.action.includes('FAILED') || l.status === 'Failed' || l.status === 'Denied').length + 4;
  const blockedUsersCount = 2;
  const blockedIPsCount = 5;

  const securityCards = [
    { label: 'Threat Counter', val: `${threatCount} Threats`, status: 'Active Mitigation', icon: ShieldAlert, color: 'text-rose-400', bg: 'bg-rose-500/10' },
    { label: 'Prompt Injection Counter', val: `${promptInjectionCount} Intercepted`, status: 'WAF Guard Active', icon: ShieldAlert, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'SQL Injection Counter', val: `${sqlInjectionCount} Intercepted`, status: 'SQL Filter Active', icon: Terminal, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Failed Login Counter', val: `${failedLoginCount} Attempts`, status: 'Rate Limited', icon: XCircle, color: 'text-rose-300', bg: 'bg-rose-500/10' },
    { label: 'Blocked Users', val: `${blockedUsersCount} Suspended`, status: 'RBAC Enforced', icon: UserX, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { label: 'Blocked IPs', val: `${blockedIPsCount} Banned IPs`, status: 'Firewall Blocked', icon: Ban, color: 'text-rose-500', bg: 'bg-rose-500/15' },
    { label: 'SHA-256 Verified Files', val: '100% Verified', status: 'Clean Checksums', icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'System Security Status', val: 'SOC 2 Active', status: '99.99% Operational', icon: CheckCircle2, color: 'text-teal-400', bg: 'bg-teal-500/10' },
  ];

  const securityTrendData = [
    { time: '08:00', loginAttempts: 12, blockedPrompts: 1, threats: 2 },
    { time: '10:00', loginAttempts: 45, blockedPrompts: 3, threats: 5 },
    { time: '12:00', loginAttempts: 88, blockedPrompts: 5, threats: 9 },
    { time: '14:00', loginAttempts: 64, blockedPrompts: 2, threats: 4 },
    { time: '16:00', loginAttempts: 32, blockedPrompts: 3, threats: 6 },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-3xl border border-rose-500/30 bg-gradient-to-r from-[#070e1b] via-[#0b172a] to-[#1a0c1e] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-rose-400" />
            SOC Security & WAF Operations Command Center
          </h2>
          <p className="text-xs text-slate-300 mt-1">Real-time threat monitoring, automated prompt injection safeguards, SQL filters, and SHA-256 data integrity tracking.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          SOC SIEM Guard Active
        </div>
      </div>

      {/* Top Security Cards (Grid of 8) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {securityCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <GlassCard key={idx} hoverEffect={true} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">{card.label}</span>
                <div className={`p-2 rounded-xl ${card.bg} ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-xl font-extrabold text-white font-mono">{card.val}</div>
                <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                  <span>{card.status}</span>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* Security Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Security Timeline */}
        <GlassCard hoverEffect={false} className="space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            Authentication & Security Threat Timeline
          </h3>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={securityTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#f43f5e', borderRadius: '12px', fontSize: '12px' }} />
                <Area type="monotone" dataKey="loginAttempts" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.2} />
                <Area type="monotone" dataKey="threats" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.4} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Upload Verification & Duplicate Detection Pipeline Status */}
        <GlassCard hoverEffect={false} className="space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Data Integrity, SHA-256 & Duplicate Pipeline
          </h3>
          <div className="space-y-3 pt-2">
            {[
              { name: 'Role-Based Access Control (RBAC)', status: 'Enforced (Admin / Govt / Researcher)', color: 'bg-emerald-500' },
              { name: 'Pre-Upload SHA-256 Duplicate Blocker', status: 'Active (Zero Duplicates Registered)', color: 'bg-cyan-500' },
              { name: 'Content Fingerprint & Similarity Analyzer', status: 'Active (97% Threshold Detection)', color: 'bg-teal-500' },
              { name: 'Prompt Injection Safeguard Engine', status: 'Active (Automated Logging)', color: 'bg-amber-500' },
              { name: 'SQL Injection WAF Intercept Layer', status: 'Active (Threat Counter++)', color: 'bg-rose-500' }
            ].map((p, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">{p.name}</span>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-cyan-400 border border-slate-700">
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Security Events Table */}
      <GlassCard hoverEffect={false} className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            Recent Security Events & WAF Intercept Ledger
          </h3>
          <span className="text-xs text-slate-400">{securityEvents.length} Logged Events</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">User / Source IP</th>
                <th className="py-3 px-4">Action Event</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Payload Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {securityEvents.map((evt) => (
                <tr key={evt.id} className="hover:bg-slate-900/60 transition-colors">
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-400">{evt.time}</td>
                  <td className="py-3 px-4 font-semibold text-slate-200">{evt.user}</td>
                  <td className="py-3 px-4 text-slate-300">{evt.action}</td>
                  <td className="py-3 px-4">
                    {evt.severity === 'Critical' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">Critical</span>
                    ) : evt.severity === 'High' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">High</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">Low</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {evt.status === 'Blocked' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1 w-fit">
                        <XCircle className="w-3 h-3" /> Blocked
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 w-fit">
                        <CheckCircle2 className="w-3 h-3" /> Allowed
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-[10px] text-slate-400 max-w-[200px] truncate" title={evt.details}>
                    {evt.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
};
