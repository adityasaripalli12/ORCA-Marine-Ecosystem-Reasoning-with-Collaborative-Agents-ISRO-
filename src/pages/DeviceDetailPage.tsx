import React, { useState, useMemo } from 'react';
import { useDevices } from '../context/DeviceContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../utils/api';
import { GlassCard } from '../components/common/GlassCard';
import { DeviceStatusBadge } from '../components/devices/DeviceStatusBadge';
import { DeviceTimeline } from '../components/devices/DeviceTimeline';
import { AnomalyCard } from '../components/devices/AnomalyCard';
import { ConfirmDialog } from '../components/devices/ConfirmDialog';
import { SEVERITY_CONFIG } from '../types/devices';
import {
  ArrowLeft, Battery, Signal, Thermometer, Cpu, HardDrive,
  Globe, Wifi, MapPin, Clock, Activity, History, Settings,
  AlertTriangle, Eye, Gauge, RotateCcw, Ban, CheckCircle2,
  Server, Zap,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

/* ── Tabs ── */
type TabKey = 'overview' | 'telemetry' | 'history' | 'location' | 'anomalies' | 'settings';
const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Overview', icon: Eye },
  { key: 'telemetry', label: 'Telemetry', icon: Activity },
  { key: 'history', label: 'History', icon: History },
  { key: 'location', label: 'Location', icon: MapPin },
  { key: 'anomalies', label: 'Anomalies', icon: AlertTriangle },
  { key: 'settings', label: 'Settings', icon: Settings },
];

interface Props {
  deviceId: string;
}

export const DeviceDetailPage: React.FC<Props> = ({ deviceId }) => {
  const { devices, getDeviceEvents, getDeviceAnomalies, deviceGroups, updateDevice, resolveAnomaly, ignoreAnomaly, investigateAnomaly, restartDevice, disableDevice, enableDevice } = useDevices();
  const { user } = useAuth();
  const { addToast } = useToast();
  const isAdmin = user?.role === 'Admin';

  // Parse tab from URL query string
  const hash = window.location.hash;
  const tabFromUrl = hash.includes('?tab=') ? hash.split('?tab=')[1] as TabKey : 'overview';
  const [activeTab, setActiveTab] = useState<TabKey>(tabFromUrl);

  // Edit settings state
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editFw, setEditFw] = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Power control confirm dialog state
  const [confirmPowerAction, setConfirmPowerAction] = useState<{
    isOpen: boolean;
    action: 'ON' | 'OFF';
  }>({ isOpen: false, action: 'OFF' });
  const [isPowerLoading, setIsPowerLoading] = useState(false);

  const device = devices.find(d => d.id === deviceId);
  const events = useMemo(() => device ? getDeviceEvents(deviceId) : [], [device, deviceId, getDeviceEvents]);
  const deviceAnomalies = useMemo(() => device ? getDeviceAnomalies(deviceId) : [], [device, deviceId, getDeviceAnomalies]);
  const groupName = deviceGroups.find(g => g.id === device?.groupId)?.name || 'Unassigned';

  const executePowerControl = async (action: 'ON' | 'OFF') => {
    setIsPowerLoading(true);
    try {
      const res = await apiFetch(`/devices/${deviceId}/power`, {
        method: 'POST',
        body: JSON.stringify({ action })
      });
      if (res.ok) {
        const data = await res.json();
        updateDevice(deviceId, {
          status: action === 'ON' ? 'online' : 'offline',
          isDisabled: action === 'OFF'
        });
        addToast('success', `Device Powered ${action}`, data.message);
      } else {
        const err = await res.json();
        addToast('error', 'Power Control Failed', err.detail || 'Access Denied');
      }
    } catch {
      addToast('error', 'Network Error', 'Failed to reach device control gateway.');
    } finally {
      setIsPowerLoading(false);
      setConfirmPowerAction({ isOpen: false, action: 'OFF' });
    }
  };

  // Init settings form when device loads
  React.useEffect(() => {
    if (device) {
      setEditName(device.name);
      setEditDesc(device.description);
      setEditFw(device.firmwareVersion);
    }
  }, [device?.id]);

  if (!device) {
    return (
      <div className="text-center py-20">
        <Server className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-400">Device not found</p>
        <button onClick={() => { window.location.hash = '#/devices'; }} className="mt-4 text-xs text-cyan-400 hover:underline">← Back to Devices</button>
      </div>
    );
  }

  // Mock telemetry chart data
  const telemetryData = Array.from({ length: 12 }, (_, i) => ({
    time: `${String((i * 2) % 24).padStart(2, '0')}:00`,
    temperature: device.temperature + Math.round((Math.random() - 0.5) * 8),
    battery: Math.max(0, device.batteryLevel - i * (Math.random() * 2)),
    cpu: device.cpuUsage + Math.round((Math.random() - 0.5) * 20),
    signal: device.signalStrength + Math.round((Math.random() - 0.5) * 12),
  }));

  const timeSince = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return `${Math.round(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
    return `${Math.round(diff / 86400000)}d ago`;
  };

  const handleSaveSettings = () => {
    updateDevice(deviceId, { name: editName, description: editDesc, firmwareVersion: editFw });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* ── Back + Header ── */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => { window.location.hash = '#/devices'; }}
          className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700 text-slate-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-extrabold text-white truncate">{device.name}</h2>
            <DeviceStatusBadge status={device.status} size="md" />
            <span className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">{device.id}</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{device.type} • {groupName} • {device.assignedUser}</p>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(tab => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.key;
          // Hide settings tab for non-admins
          if (tab.key === 'settings' && !isAdmin) return null;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-gradient-to-r from-ocean-600 to-cyan-600 text-white shadow-lg shadow-cyan-500/20'
                  : 'text-slate-400 bg-slate-800/40 hover:bg-slate-700/60 border border-slate-700/50'
              }`}
            >
              <TabIcon className="w-3.5 h-3.5" /> {tab.label}
              {tab.key === 'anomalies' && deviceAnomalies.filter(a => a.status === 'new').length > 0 && (
                <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {deviceAnomalies.filter(a => a.status === 'new').length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}

      {/* ━━ OVERVIEW ━━ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Health cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Battery', value: `${device.batteryLevel}%`, icon: Battery, color: device.batteryLevel < 20 ? 'text-rose-400' : device.batteryLevel < 40 ? 'text-amber-400' : 'text-emerald-400', bg: device.batteryLevel < 20 ? 'bg-rose-500/10' : device.batteryLevel < 40 ? 'bg-amber-500/10' : 'bg-emerald-500/10' },
              { label: 'Signal', value: `${device.signalStrength}%`, icon: Signal, color: device.signalStrength < 30 ? 'text-rose-400' : 'text-cyan-400', bg: device.signalStrength < 30 ? 'bg-rose-500/10' : 'bg-cyan-500/10' },
              { label: 'Temperature', value: `${device.temperature}°C`, icon: Thermometer, color: device.temperature > 50 ? 'text-rose-400' : device.temperature > 38 ? 'text-amber-400' : 'text-cyan-400', bg: device.temperature > 50 ? 'bg-rose-500/10' : device.temperature > 38 ? 'bg-amber-500/10' : 'bg-cyan-500/10' },
              { label: 'CPU', value: `${device.cpuUsage}%`, icon: Cpu, color: device.cpuUsage > 80 ? 'text-rose-400' : 'text-cyan-400', bg: device.cpuUsage > 80 ? 'bg-rose-500/10' : 'bg-cyan-500/10' },
              { label: 'RAM', value: `${device.ramUsage}%`, icon: HardDrive, color: device.ramUsage > 85 ? 'text-rose-400' : 'text-cyan-400', bg: device.ramUsage > 85 ? 'bg-rose-500/10' : 'bg-cyan-500/10' },
              { label: 'Network', value: `${device.networkTraffic} KB/s`, icon: Globe, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
            ].map((m, i) => {
              const MIcon = m.icon;
              return (
                <GlassCard key={i} hoverEffect={false} className="!p-3 text-center">
                  <div className={`p-2 rounded-xl ${m.bg} mx-auto w-fit`}>
                    <MIcon className={`w-4 h-4 ${m.color}`} />
                  </div>
                  <div className={`text-lg font-extrabold font-mono mt-2 ${m.color}`}>{m.value}</div>
                  <div className="text-[10px] text-slate-500 font-semibold mt-0.5">{m.label}</div>
                </GlassCard>
              );
            })}
          </div>

          {/* Device info */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <GlassCard hoverEffect={false} className="space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-cyan-400" /> Device Information
              </h3>
              <div className="grid grid-cols-2 gap-y-2.5 text-xs">
                {[
                  ['Device ID', device.id],
                  ['Type', device.type],
                  ['Group', groupName],
                  ['Firmware', device.firmwareVersion],
                  ['Assigned To', device.assignedUser],
                  ['Last Seen', timeSince(device.lastSeen)],
                  ['Created', new Date(device.createdAt).toLocaleDateString()],
                  ['Location', device.locationEnabled ? `${device.latitude.toFixed(4)}, ${device.longitude.toFixed(4)}` : 'Disabled'],
                ].map(([label, val], i) => (
                  <React.Fragment key={i}>
                    <span className="text-slate-500 font-semibold">{label}</span>
                    <span className="text-white font-mono">{val}</span>
                  </React.Fragment>
                ))}
              </div>
            </GlassCard>

            <GlassCard hoverEffect={false} className="space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" /> Recent Activity
              </h3>
              <div className="space-y-2">
                {events.slice(0, 5).map(e => (
                  <div key={e.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-900/40 border border-slate-800/60">
                    <div className={`w-2 h-2 rounded-full ${SEVERITY_CONFIG[e.severity].dotColor}`} />
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] text-white font-semibold truncate block">{e.title}</span>
                      <span className="text-[10px] text-slate-500">{new Date(e.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
                {events.length === 0 && <p className="text-xs text-slate-500">No events yet.</p>}
              </div>
            </GlassCard>
          </div>

          {/* Description */}
          {device.description && (
            <GlassCard hoverEffect={false}>
              <p className="text-xs text-slate-300 leading-relaxed">{device.description}</p>
            </GlassCard>
          )}
        </div>
      )}

      {/* ━━ TELEMETRY ━━ */}
      {activeTab === 'telemetry' && (
        <div className="space-y-6">
          {/* Current Values */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Temperature', value: `${device.temperature}°C`, color: 'text-cyan-400' },
              { label: 'Battery', value: `${device.batteryLevel}%`, color: 'text-emerald-400' },
              { label: 'CPU Usage', value: `${device.cpuUsage}%`, color: 'text-amber-400' },
              { label: 'Signal', value: `${device.signalStrength}%`, color: 'text-sky-400' },
            ].map((v, i) => (
              <GlassCard key={i} hoverEffect={false} className="text-center !p-4">
                <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{v.label}</div>
                <div className={`text-2xl font-extrabold font-mono mt-1 ${v.color}`}>{v.value}</div>
              </GlassCard>
            ))}
          </div>

          {/* Temperature Chart */}
          <GlassCard hoverEffect={false} className="space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-cyan-400" /> Temperature Trend (24h)
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={telemetryData}>
                  <defs>
                    <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#38bdf8', borderRadius: '12px', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="temperature" stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#tempGrad)" name="Temperature (°C)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* CPU Chart */}
          <GlassCard hoverEffect={false} className="space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-amber-400" /> CPU Usage Trend (24h)
            </h3>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={telemetryData}>
                  <defs>
                    <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#f59e0b', borderRadius: '12px', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="cpu" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#cpuGrad)" name="CPU (%)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ━━ HISTORY ━━ */}
      {activeTab === 'history' && (
        <DeviceTimeline events={events} />
      )}

      {/* ━━ LOCATION ━━ */}
      {activeTab === 'location' && (
        <div className="space-y-4">
          <GlassCard hoverEffect={false} className="!p-0 overflow-hidden">
            <div className="h-[500px] rounded-2xl overflow-hidden">
              {device.locationEnabled ? (
                <MapContainer
                  center={[device.latitude, device.longitude]}
                  zoom={14}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    attribution=""
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  />
                  <Marker position={[device.latitude, device.longitude]}>
                    <Popup>
                      <div className="text-xs">
                        <strong>{device.name}</strong><br />
                        {device.id}<br />
                        Lat: {device.latitude.toFixed(4)}<br />
                        Lng: {device.longitude.toFixed(4)}
                      </div>
                    </Popup>
                  </Marker>
                </MapContainer>
              ) : (
                <div className="h-full flex items-center justify-center bg-slate-900/60">
                  <div className="text-center">
                    <MapPin className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-400 font-semibold">Location Disabled</p>
                    <p className="text-xs text-slate-500 mt-1">GPS tracking is not enabled for this device.</p>
                  </div>
                </div>
              )}
            </div>
          </GlassCard>
          <GlassCard hoverEffect={false} className="!p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div><span className="text-slate-500">Latitude</span><div className="font-mono text-white font-bold">{device.latitude.toFixed(6)}</div></div>
              <div><span className="text-slate-500">Longitude</span><div className="font-mono text-white font-bold">{device.longitude.toFixed(6)}</div></div>
              <div><span className="text-slate-500">GPS Status</span><div className={`font-bold ${device.locationEnabled ? 'text-emerald-400' : 'text-slate-500'}`}>{device.locationEnabled ? 'Active' : 'Disabled'}</div></div>
              <div><span className="text-slate-500">Last Update</span><div className="font-mono text-white font-bold">{timeSince(device.lastSeen)}</div></div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ━━ ANOMALIES ━━ */}
      {activeTab === 'anomalies' && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total', count: deviceAnomalies.length, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
              { label: 'New', count: deviceAnomalies.filter(a => a.status === 'new').length, color: 'text-amber-400', bg: 'bg-amber-500/10' },
              { label: 'Investigating', count: deviceAnomalies.filter(a => a.status === 'investigating').length, color: 'text-sky-400', bg: 'bg-sky-500/10' },
              { label: 'Resolved', count: deviceAnomalies.filter(a => a.status === 'resolved').length, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            ].map((s, i) => (
              <GlassCard key={i} hoverEffect={false} className="!p-3 text-center">
                <div className={`text-xl font-extrabold font-mono ${s.color}`}>{s.count}</div>
                <div className="text-[10px] text-slate-500 font-semibold">{s.label}</div>
              </GlassCard>
            ))}
          </div>

          {/* Anomaly list */}
          {deviceAnomalies.length === 0 ? (
            <div className="text-center py-16">
              <CheckCircle2 className="w-10 h-10 text-emerald-500/50 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-400">No anomalies detected</p>
              <p className="text-xs text-slate-500 mt-1">This device is operating within normal parameters.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {deviceAnomalies.map(a => (
                <div key={a.id}>
                  <AnomalyCard anomaly={a} showDeviceLink={false} />
                  {/* Action buttons */}
                  {a.status !== 'resolved' && a.status !== 'ignored' && (
                    <div className="flex items-center gap-2 mt-2 pl-14">
                      {a.status === 'new' && (
                        <button onClick={() => investigateAnomaly(a.id)} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 transition-colors">
                          Investigate
                        </button>
                      )}
                      <button onClick={() => resolveAnomaly(a.id, user?.email || 'admin@gmail.com')} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors">
                        Resolve
                      </button>
                      <button onClick={() => ignoreAnomaly(a.id)} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-400 bg-slate-500/10 hover:bg-slate-500/20 border border-slate-500/20 transition-colors">
                        Ignore
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ━━ SETTINGS ━━ */}
      {activeTab === 'settings' && isAdmin && (
        <div className="max-w-xl space-y-6">
          <GlassCard hoverEffect={false} className="space-y-5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-cyan-400" /> Device Configuration
            </h3>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Device Name</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs glass-input" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Description</label>
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs glass-input resize-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Firmware Version</label>
                <input type="text" value={editFw} onChange={e => setEditFw(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs glass-input" />
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-slate-800/80">
                <button onClick={handleSaveSettings}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-ocean-500 to-cyan-500 hover:from-ocean-400 hover:to-cyan-400 shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Save Changes
                </button>
                {settingsSaved && <span className="text-xs text-emerald-400 font-semibold">✓ Saved</span>}
              </div>
            </div>
          </GlassCard>

          {/* Quick actions & Power Control (Admin Only) */}
          <GlassCard hoverEffect={false} className="space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" /> Administrative Power & Lifecycle Controls
            </h3>
            <div className="flex flex-wrap gap-2.5">
              {device.status.toLowerCase() === 'online' ? (
                <button
                  onClick={() => setConfirmPowerAction({ isOpen: true, action: 'OFF' })}
                  disabled={isPowerLoading}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all flex items-center gap-1.5 shadow-md shadow-rose-500/10 disabled:opacity-50"
                >
                  <Ban className="w-3.5 h-3.5" /> Turn Device OFF
                </button>
              ) : (
                <button
                  onClick={() => setConfirmPowerAction({ isOpen: true, action: 'ON' })}
                  disabled={isPowerLoading}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/10 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Turn Device ON
                </button>
              )}

              <button
                onClick={() => restartDevice(deviceId)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Restart
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Confirmation Dialog for Power Control */}
      <ConfirmDialog
        isOpen={confirmPowerAction.isOpen}
        title={confirmPowerAction.action === 'OFF' ? `Turn off ${device.name} (${device.id})?` : `Turn on ${device.name} (${device.id})?`}
        message={
          confirmPowerAction.action === 'OFF'
            ? `Turning off this device will stop real-time telemetry streaming and sensor logging until re-activated by an administrator.`
            : `Turning on this device will resume real-time telemetry streaming and marine sensor monitoring.`
        }
        variant={confirmPowerAction.action === 'OFF' ? 'danger' : 'warning'}
        confirmLabel={confirmPowerAction.action === 'OFF' ? 'Confirm Turn OFF' : 'Confirm Turn ON'}
        onConfirm={() => executePowerControl(confirmPowerAction.action)}
        onCancel={() => setConfirmPowerAction({ isOpen: false, action: 'OFF' })}
      />
    </div>
  );
};
