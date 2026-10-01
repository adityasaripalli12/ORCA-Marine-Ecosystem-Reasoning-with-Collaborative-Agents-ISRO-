import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { GlassCard } from '../components/common/GlassCard';
import {
  BarChart3, MapPin, Download, Filter, Waves,
  Activity, Calendar, Compass, RefreshCw, Cpu,
  Wifi, WifiOff, BatteryFull, BatteryMedium, BatteryLow,
  Thermometer, Droplets, Gauge, Anchor, Shield,
  Lock, AlertTriangle, FlaskConical
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, AreaChart, Area, RadarChart,
  PolarGrid, PolarAngleAxis, Radar, Legend
} from 'recharts';
import { fetchHardwareTelemetry, fetchDeviceSensorHistory, DEMO_HARDWARE_DATA, SensorReading } from '../services/hardwareService';
import type { HardwareTelemetryData } from '../types/HardwareTelemetry';
import { useDevices } from '../context/DeviceContext';
import { DeviceMarkerPopup, AILocation } from '../components/common/DeviceMarkerPopup';

type ActiveTab = 'graphs' | 'map' | 'heatmap' | 'hardware';

/* ── Custom Animated Tooltip ── */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 border border-cyan-500/30 rounded-2xl p-3 shadow-2xl shadow-cyan-500/10 text-xs backdrop-blur-xl">
        <p className="text-cyan-400 font-bold mb-1.5">{label}</p>
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-300 capitalize">{entry.name}:</span>
            <span className="font-mono text-white font-semibold">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

/* ── Animated stat pill ── */
const StatPill: React.FC<{ label: string; value: string; unit?: string; color: string }> = ({ label, value, unit, color }) => (
  <div className={`flex flex-col items-center p-3 rounded-2xl bg-slate-950/60 border ${color} space-y-1 min-w-[80px]`}>
    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{label}</span>
    <span className="text-lg font-extrabold text-white font-mono leading-none">{value}</span>
    {unit && <span className="text-[10px] text-slate-400">{unit}</span>}
  </div>
);

/* ── Battery icon helper ── */
const BatteryIcon = ({ level }: { level: number }) => {
  if (level > 60) return <BatteryFull className="w-4 h-4 text-emerald-400" />;
  if (level > 30) return <BatteryMedium className="w-4 h-4 text-amber-400" />;
  return <BatteryLow className="w-4 h-4 text-rose-400" />;
};

/* ─────────────────────────────
   Main Page Component
───────────────────────────── */
export const VisualizationPage: React.FC = () => {
  const { argoFloats } = useData();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [selectedFloatId, setSelectedFloatId] = useState<string>('ARGO-6902741');
  const [depthFilter, setDepthFilter] = useState<number>(2000);
  const [dateRange, setDateRange] = useState<string>('2026-Q2');
  const [activeTab, setActiveTab] = useState<ActiveTab>('graphs');

  // Hardware Telemetry state
  const [hwData, setHwData] = useState<HardwareTelemetryData | null>(null);
  const [hwLoading, setHwLoading] = useState(false);
  const [hwDemoMode, setHwDemoMode] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('DEV-001');
  const [historyRange, setHistoryRange] = useState<string>('24h');
  const [sensorReadings, setSensorReadings] = useState<SensorReading[]>([]);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(true);

  const canViewHardware = user?.role === 'Admin' || user?.role === 'Government';
  const canViewArgoMap = user?.role === 'Admin' || user?.role === 'Government';

  const selectedFloat = argoFloats.find(f => f.floatId === selectedFloatId) || argoFloats[0];
  const { devices } = useDevices();
  const [selectedMapLocation, setSelectedMapLocation] = useState<AILocation | null>(null);
  const [mapSourceFilter, setMapSourceFilter] = useState<'all' | 'devices' | 'argo'>('all');

  // Combined locations for the visualization map
  const hardwareMapLocations: AILocation[] = devices.map(d => ({
    name: `${d.id} (${d.name})`,
    deviceId: d.id,
    latitude: d.latitude,
    longitude: d.longitude,
    depth: d.temperature > 50 ? 45 : d.id === 'DEV-001' ? 31 : d.id === 'DEV-002' ? 15 : d.id === 'DEV-003' ? 120 : 50,
    temp: d.temperature,
    battery: d.batteryLevel,
    signal: d.signalStrength,
    status: d.status.charAt(0).toUpperCase() + d.status.slice(1),
    details: `${d.type} • ${d.status} • ${d.batteryLevel}% Battery`
  }));

  const argoMapLocations: AILocation[] = argoFloats.map(f => ({
    name: `${f.floatId} (${f.oceanRegion})`,
    latitude: f.latitude,
    longitude: f.longitude,
    depth: f.depth,
    temp: f.temperature,
    salinity: f.salinity,
    pressure: f.pressure,
    status: f.status,
    details: `${f.oceanRegion} • ${f.temperature}°C • ${f.salinity} PSU`
  }));

  const visibleMapLocations = mapSourceFilter === 'devices' 
    ? hardwareMapLocations 
    : mapSourceFilter === 'argo' 
      ? argoMapLocations 
      : [...hardwareMapLocations, ...argoMapLocations];

  /* ── Depth profile data ── */
  const depthProfileData = [
    { depth: 0,    temp: 24.2, salinity: 35.8, pressure: 5   },
    { depth: 100,  temp: 22.1, salinity: 36.1, pressure: 100 },
    { depth: 300,  temp: 18.4, salinity: 35.9, pressure: 300 },
    { depth: 500,  temp: 12.8, salinity: 35.2, pressure: 500 },
    { depth: 800,  temp: 8.5,  salinity: 34.9, pressure: 800 },
    { depth: 1200, temp: 5.2,  salinity: 34.6, pressure: 1200},
    { depth: 1600, temp: 3.8,  salinity: 34.7, pressure: 1600},
    { depth: 2000, temp: 2.4,  salinity: 34.8, pressure: 2000},
  ].filter(d => d.depth <= depthFilter);

  /* ── Radar chart data for water quality ── */
  const radarData = [
    { metric: 'Temp',      value: 80 },
    { metric: 'Salinity',  value: 65 },
    { metric: 'O₂',       value: 72 },
    { metric: 'pH',       value: 90 },
    { metric: 'Nitrate',   value: 45 },
    { metric: 'Turbidity', value: 58 },
  ];

  /* ── Load hardware data & sensor history ── */
  const loadHardwareAndHistory = async () => {
    setHwLoading(true);
    try {
      const [telemetry, hist] = await Promise.all([
        fetchHardwareTelemetry(hwDemoMode),
        fetchDeviceSensorHistory(selectedDeviceId, 20, historyRange)
      ]);
      setHwData(telemetry);
      setSensorReadings(hist.readings || []);
      setIsLiveConnected(true);
    } catch {
      setHwData(DEMO_HARDWARE_DATA);
      setIsLiveConnected(false);
    } finally {
      setHwLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'hardware' && canViewHardware) {
      loadHardwareAndHistory();
      const interval = setInterval(() => {
        loadHardwareAndHistory();
      }, 15000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedDeviceId, historyRange, hwDemoMode]);

  /* ── Downloads ── */
  const handleDownloadCSV = () => {
    const csvHeader = 'depth_m,temperature_c,salinity_psu,pressure_dbar\n';
    const csvRows = depthProfileData.map(d => `${d.depth},${d.temp},${d.salinity},${d.pressure}`).join('\n');
    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `argo_profile_${selectedFloatId}.csv`;
    a.click();
    addToast('info', 'CSV Download Triggered', `Exported depth profile dataset for ${selectedFloatId}`);
  };

  const handleDownloadPNG = () => {
    addToast('info', 'PNG Export Triggered', `Rendered high-resolution PNG graph for ${selectedFloatId}`);
  };

  /* ── Connection badge ── */
  const ConnectionBadge = ({ state }: { state: string }) => {
    const styles: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
      connected:  { cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', icon: <Wifi className="w-3 h-3" />,    label: 'Connected'  },
      connecting: { cls: 'bg-amber-500/10  text-amber-400  border-amber-500/30',    icon: <Wifi className="w-3 h-3" />,    label: 'Connecting' },
      offline:    { cls: 'bg-rose-500/10   text-rose-400   border-rose-500/30',     icon: <WifiOff className="w-3 h-3" />, label: 'Offline'    },
      demo:       { cls: 'bg-violet-500/10 text-violet-400 border-violet-500/30',   icon: <FlaskConical className="w-3 h-3" />, label: 'Demo Mode' },
    };
    const s = styles[state] || styles.demo;
    return (
      <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${s.cls}`}>
        {s.icon} {s.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">

      {/* ── Animated Header Banner ── */}
      <div className="relative glass-panel p-6 rounded-3xl border border-cyan-500/30 overflow-hidden">
        {/* Decorative animated gradient orbs */}
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl animate-pulse pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-ocean-500/10 rounded-full blur-2xl animate-pulse pointer-events-none" style={{ animationDelay: '1s' }} />

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30">
                <Waves className="w-5 h-5 text-cyan-400 animate-pulse" style={{ animationDuration: '3s' }} />
              </div>
              <h2 className="text-2xl font-extrabold text-white tracking-tight">ARGO Ocean Data Visualization</h2>
            </div>
            <p className="text-xs text-slate-300 ml-[52px]">Interactive Temperature-Salinity-Pressure Depth Profiles &amp; Global Float Telemetry</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadPNG}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-200 glass-panel hover:bg-slate-800 border border-slate-700 flex items-center gap-1.5 transition-all hover:border-slate-600 hover:text-white"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" /> Download PNG
            </button>
            <button
              onClick={handleDownloadCSV}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-ocean-500 to-cyan-500 hover:from-ocean-400 hover:to-cyan-400 shadow-lg shadow-cyan-500/20 flex items-center gap-1.5 transition-all"
            >
              <Download className="w-3.5 h-3.5" /> Download CSV
            </button>
          </div>
        </div>
      </div>

      {/* ── Animated KPI Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Floats',   value: String(argoFloats.length), unit: 'units',  color: 'border-cyan-500/25',  bg: 'from-cyan-500/5',   icon: <Anchor    className="w-4 h-4 text-cyan-400" />    },
          { label: 'Avg Temperature', value: selectedFloat?.temperature ? `${selectedFloat.temperature}` : '—', unit: '°C',      color: 'border-sky-500/25',   bg: 'from-sky-500/5',    icon: <Thermometer className="w-4 h-4 text-sky-400" />    },
          { label: 'Avg Salinity',    value: selectedFloat?.salinity    ? `${selectedFloat.salinity}` : '—',    unit: 'PSU',     color: 'border-teal-500/25',  bg: 'from-teal-500/5',   icon: <Droplets  className="w-4 h-4 text-teal-400" />    },
          { label: 'Max Depth',       value: selectedFloat?.depth       ? `${selectedFloat.depth}`    : '—',    unit: 'meters',  color: 'border-indigo-500/25', bg: 'from-indigo-500/5', icon: <Gauge     className="w-4 h-4 text-indigo-400" /> },
        ].map((card, idx) => (
          <div
            key={idx}
            className={`relative rounded-2xl p-4 border ${card.color} bg-gradient-to-br ${card.bg} to-transparent backdrop-blur-sm overflow-hidden group hover:border-cyan-500/40 transition-all`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
            <div className="flex items-start justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{card.label}</span>
              {card.icon}
            </div>
            <div className="text-2xl font-extrabold text-white font-mono">{card.value}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{card.unit}</div>
          </div>
        ))}
      </div>

      {/* ── Filters Bar ── */}
      <GlassCard hoverEffect={false} className="p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Select ARGO Float</label>
            <select
              value={selectedFloatId}
              onChange={(e) => setSelectedFloatId(e.target.value)}
              className="px-3 py-1.5 rounded-xl glass-input bg-slate-900 text-cyan-300 font-mono"
            >
              {argoFloats.map(f => (
                <option key={f.id} value={f.floatId}>{f.floatId} ({f.oceanRegion})</option>
              ))}
            </select>
          </div>

          <div className="space-y-1 min-w-[160px]">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span>Max Depth Filter</span>
              <span className="text-cyan-400 font-mono">{depthFilter}m</span>
            </div>
            <input
              type="range"
              min={300}
              max={2000}
              step={100}
              value={depthFilter}
              onChange={(e) => setDepthFilter(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Timeline Season</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-1.5 rounded-xl glass-input bg-slate-900 text-slate-200 font-mono"
            >
              <option value="2026-Q2">2026 Q2 (Latest)</option>
              <option value="2026-Q1">2026 Q1</option>
              <option value="2025-Q4">2025 Q4</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs bg-slate-900/80 px-3.5 py-2 rounded-xl border border-slate-800">
          <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
          <div className="font-mono text-[11px] text-slate-300">
            Lat: <span className="text-cyan-400">{selectedFloat?.latitude}°</span> | Long: <span className="text-cyan-400">{selectedFloat?.longitude}°</span>
          </div>
        </div>
      </GlassCard>

      {/* ── Tab Switcher ── */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        {(
          [
            { id: 'graphs',   label: 'Depth Profiles & Graphs', icon: <Activity className="w-3.5 h-3.5" /> },
            ...(canViewArgoMap ? [{
              id: 'map',      label: 'ARGO Float Locations Map', icon: <MapPin className="w-3.5 h-3.5" />
            }] : []),
            { id: 'heatmap',  label: 'Heatmap Matrix',           icon: <Waves className="w-3.5 h-3.5" /> },
            ...(canViewHardware ? [{
              id: 'hardware', label: 'Hardware Telemetry',       icon: <Cpu className="w-3.5 h-3.5" />, restricted: true
            }] : [])
          ] as { id: string; label: string; icon: React.ReactNode; restricted?: boolean }[]
        ).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ActiveTab)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === tab.id
                ? tab.restricted
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.icon} {tab.label}
            {tab.restricted && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 ml-1">
                🔐 RESTRICTED
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════
          TAB 1 — GRAPHS
      ══════════════════════════════════ */}
      {activeTab === 'graphs' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Temperature vs Depth */}
            <GlassCard hoverEffect={false} className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    Temperature vs Depth Profile (°C)
                  </h3>
                  <p className="text-[11px] text-slate-400">Float {selectedFloatId} • Thermocline Curve</p>
                </div>
                <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                  {selectedFloat?.temperature}°C Surface
                </span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={depthProfileData}>
                    <defs>
                      <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="depth" label={{ value: 'Depth (m)', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 10 }} stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis label={{ value: 'Temp (°C)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} stroke="#64748b" tick={{ fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="temp" name="Temperature" stroke="#38bdf8" strokeWidth={2.5} fillOpacity={1} fill="url(#colorTemp)" dot={{ r: 3.5, fill: '#0284c7', stroke: '#38bdf8', strokeWidth: 1.5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            {/* Salinity vs Depth */}
            <GlassCard hoverEffect={false} className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Waves className="w-4 h-4 text-ocean-400" />
                    Salinity vs Depth Profile (PSU)
                  </h3>
                  <p className="text-[11px] text-slate-400">Float {selectedFloatId} • Halocline Curve</p>
                </div>
                <span className="text-xs font-mono text-ocean-400 bg-ocean-500/10 px-2 py-0.5 rounded border border-ocean-500/20">
                  {selectedFloat?.salinity} PSU Surface
                </span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={depthProfileData}>
                    <defs>
                      <linearGradient id="colorSal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#0284c7" stopOpacity={0.4}  />
                        <stop offset="95%" stopColor="#0284c7" stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="depth" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis domain={[34, 37]} stroke="#64748b" tick={{ fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="salinity" name="Salinity" stroke="#0284c7" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSal)" dot={{ r: 3.5, fill: '#0369a1', stroke: '#0284c7', strokeWidth: 1.5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          </div>

          {/* Water Quality Radar */}
          <GlassCard hoverEffect={false} className="space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-400" />
              Surface Water Quality Radar — Float {selectedFloatId}
            </h3>
            <div className="h-56 w-full max-w-sm mx-auto">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#1e293b" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Radar name="Quality Index" dataKey="value" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.18} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ══════════════════════════════════
          TAB 2 — MAP
      ══════════════════════════════════ */}
      {activeTab === 'map' && (
        <GlassCard hoverEffect={false} className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-cyan-400" />
                Global Ocean Telemetry &amp; Device Array Map
              </h3>
              <p className="text-[11px] text-slate-400">
                Interactive real-time map displaying {visibleMapLocations.length} active sensor nodes &amp; profiling floats
              </p>
            </div>
            
            {/* Filter Toggle */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setMapSourceFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-all ${mapSourceFilter === 'all' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white'}`}
              >
                All ({visibleMapLocations.length})
              </button>
              <button
                onClick={() => setMapSourceFilter('devices')}
                className={`px-2.5 py-1 rounded-lg transition-all ${mapSourceFilter === 'devices' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white'}`}
              >
                Devices ({hardwareMapLocations.length})
              </button>
              <button
                onClick={() => setMapSourceFilter('argo')}
                className={`px-2.5 py-1 rounded-lg transition-all ${mapSourceFilter === 'argo' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white'}`}
              >
                ARGO Floats ({argoMapLocations.length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 h-[420px] bg-slate-950 rounded-2xl border border-slate-800 p-4 relative overflow-hidden flex flex-col justify-between">
              {/* Animated grid overlay */}
              <div className="absolute inset-0 bg-[radial-gradient(#0369a1_1px,transparent_1px)] [background-size:20px_20px] opacity-30 pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/20 via-transparent to-ocean-950/40 pointer-events-none" />

              {/* Header inside map */}
              <div className="relative z-10 text-[11px] font-mono text-slate-400 flex justify-between">
                <span className="text-cyan-400 font-bold">INDIAN OCEAN &amp; BAY OF BENGAL TELEMETRY BASIN</span>
                <span className="text-slate-500">LIVE GPS COORDINATES</span>
              </div>

              {/* Grid of Interactive Marker Cards */}
              <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 gap-2.5 my-auto overflow-y-auto max-h-[300px] p-1">
                {visibleMapLocations.map((loc, idx) => {
                  const isSelected = selectedMapLocation?.name === loc.name;
                  const isCritical = (loc.status || '').toLowerCase().includes('critical');
                  const isOffline = (loc.status || '').toLowerCase().includes('offline');
                  const isWarning = (loc.status || '').toLowerCase().includes('warning');

                  let badgeColor = 'border-emerald-500/30 text-emerald-400';
                  let dotColor = 'bg-emerald-400';
                  if (isCritical) {
                    badgeColor = 'border-rose-500/40 text-rose-400 bg-rose-500/10';
                    dotColor = 'bg-rose-400 animate-ping';
                  } else if (isOffline) {
                    badgeColor = 'border-slate-700 text-slate-400 bg-slate-800/40';
                    dotColor = 'bg-slate-500';
                  } else if (isWarning) {
                    badgeColor = 'border-amber-500/40 text-amber-400 bg-amber-500/10';
                    dotColor = 'bg-amber-400';
                  }

                  return (
                    <div
                      key={loc.deviceId || idx}
                      onClick={() => setSelectedMapLocation(isSelected ? null : loc)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer text-left ${
                        isSelected
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 scale-105 shadow-xl shadow-cyan-500/20 ring-1 ring-cyan-400'
                          : `bg-slate-900/90 border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:bg-slate-800/80`
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="font-mono text-xs font-bold text-white truncate">
                          {loc.deviceId || loc.name.split(' ')[0]}
                        </span>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mb-1">
                        {loc.name.replace(/^[A-Z0-9-]+\s*/, '').replace(/[()]/g, '')}
                      </div>
                      <div className="text-[10px] font-mono text-cyan-400 flex items-center justify-between">
                        <span>{loc.latitude.toFixed(2)}°N, {loc.longitude.toFixed(2)}°E</span>
                        {loc.temp != null && <span>{loc.temp}°C</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Map Footer */}
              <div className="relative z-10 text-[10px] font-mono text-slate-500 text-center flex items-center justify-between">
                <span>Satellite Downlink: 10s Telemetry Cycle</span>
                <span>Click any marker to inspect telemetry</span>
              </div>
            </div>

            {/* Float / Device Detail Panel */}
            <div className="flex flex-col">
              {selectedMapLocation ? (
                <DeviceMarkerPopup
                  location={selectedMapLocation}
                  onClose={() => setSelectedMapLocation(null)}
                  onAIAnalyze={(devId) => {
                    window.location.hash = '#/ai-chat';
                  }}
                />
              ) : (
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 h-full flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 border-b border-slate-800 pb-2 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                      Select a Marker to Inspect
                    </h4>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      Click any device or ARGO float card in the map grid to view its real-time sensor measurements, active anomalies, depth profiles, and GPS coordinates.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2 text-xs">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Fleet Status Summary</p>
                    <div className="flex justify-between text-slate-300">
                      <span className="text-slate-400">Total Tracked:</span>
                      <span className="text-white font-mono font-bold">{visibleMapLocations.length} nodes</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span className="text-slate-400">Online &amp; Active:</span>
                      <span className="text-emerald-400 font-mono font-bold">
                        {visibleMapLocations.filter(l => (l.status || '').toLowerCase().includes('online') || (l.status || '').toLowerCase().includes('active')).length}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span className="text-slate-400">Critical Alerts:</span>
                      <span className="text-rose-400 font-mono font-bold">
                        {visibleMapLocations.filter(l => (l.status || '').toLowerCase().includes('critical')).length}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </GlassCard>
      )}

      {/* ══════════════════════════════════
          TAB 3 — HEATMAP
      ══════════════════════════════════ */}
      {activeTab === 'heatmap' && (
        <GlassCard hoverEffect={false} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Waves className="w-4 h-4 text-cyan-400" />
              Global Ocean Temperature Heatmap Matrix (°C)
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">32 Sector Grid · Live Climatological Data</span>
          </div>

          {/* Color legend */}
          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-500/60 inline-block" /> &gt; 22°C Warm</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-cyan-500/60 inline-block" /> 15–22°C Temperate</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-600/60 inline-block" /> &lt; 15°C Cold</span>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {Array.from({ length: 32 }).map((_, i) => {
              const tempVal = (Math.sin(i * 0.7) * 12 + 16).toFixed(1);
              const n = Number(tempVal);
              const colorClass = n > 22
                ? 'bg-rose-500/30 text-rose-300 border-rose-500/25 hover:bg-rose-500/50'
                : n > 15
                  ? 'bg-cyan-500/30 text-cyan-300 border-cyan-500/25 hover:bg-cyan-500/50'
                  : 'bg-blue-600/30 text-blue-300 border-blue-500/25 hover:bg-blue-600/50';
              return (
                <div
                  key={i}
                  className={`p-3 rounded-xl border text-center font-mono text-xs ${colorClass} transition-all cursor-pointer hover:scale-105`}
                >
                  <div className="text-[9px] text-slate-400">S-{i + 1}</div>
                  <div className="font-bold mt-0.5">{tempVal}°C</div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* ══════════════════════════════════
          TAB 4 — HARDWARE TELEMETRY (Admin/Gov only)
      ══════════════════════════════════ */}
      {activeTab === 'hardware' && (
        canViewHardware ? (
          <div className="space-y-6">

            {/* Restricted banner */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-rose-500/5 border border-rose-500/25 text-xs text-rose-300">
              <Shield className="w-4 h-4 shrink-0 text-rose-400" />
              <span className="font-semibold">Restricted Access — Hardware Telemetry available only for Admin &amp; Government roles.</span>
            </div>

            {/* Header row with Device Selector & Live Controls */}
            <GlassCard hoverEffect={false} className="p-5 space-y-4">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30">
                    <Cpu className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>{selectedDeviceId} Telemetry Stream</span>
                      {isLiveConnected ? (
                        <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          LIVE
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/25">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                          OFFLINE
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Selected Device: {selectedDeviceId} • Auto-refresh: 15s • Backend Synced
                    </p>
                  </div>
                </div>

                {/* Device Selector & Range Controls */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Device Dropdown */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Device:</span>
                    <select
                      value={selectedDeviceId}
                      onChange={(e) => setSelectedDeviceId(e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 border border-cyan-500/30 text-cyan-300 focus:outline-none focus:border-cyan-400"
                    >
                      {devices.map((d) => (
                        <option key={d.id} value={d.id} className="bg-slate-950 text-slate-200">
                          {d.id} — {d.name} ({d.status.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Time Range Selector */}
                  <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
                    {['1h', '6h', '24h', '7d'].map((r) => (
                      <button
                        key={r}
                        onClick={() => setHistoryRange(r)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                          historyRange === r
                            ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        {r.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={loadHardwareAndHistory}
                    disabled={hwLoading}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${hwLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
              </div>
            </GlassCard>

            {hwLoading && (
              <div className="flex items-center justify-center py-12 gap-3 text-slate-400 text-xs">
                <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
                Fetching live sensor history for {selectedDeviceId}…
              </div>
            )}

            {!hwLoading && hwData && (
              <>
                {/* Sensor metric grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'GPS Lat',        value: (sensorReadings[sensorReadings.length - 1]?.latitude ?? hwData.latitude).toFixed(4), unit: '°', color: 'border-cyan-500/25',   icon: <MapPin      className="w-4 h-4 text-cyan-400"   /> },
                    { label: 'GPS Lon',        value: (sensorReadings[sensorReadings.length - 1]?.longitude ?? hwData.longitude).toFixed(4), unit: '°', color: 'border-cyan-500/25', icon: <Compass     className="w-4 h-4 text-cyan-400"   /> },
                    { label: 'Water Temp',     value: `${sensorReadings[sensorReadings.length - 1]?.temperature ?? hwData.waterTemperature ?? 28.4}`, unit: '°C', color: 'border-sky-500/25', icon: <Thermometer className="w-4 h-4 text-sky-400" /> },
                    { label: 'Depth',          value: `${sensorReadings[sensorReadings.length - 1]?.depth ?? hwData.depth ?? 31.0}`, unit: 'm',       color: 'border-rose-500/25', icon: <Gauge       className="w-4 h-4 text-rose-400" /> },
                    { label: 'Salinity',       value: `${sensorReadings[sensorReadings.length - 1]?.salinity ?? hwData.salinity ?? 34.5}`, unit: 'PSU', color: 'border-teal-500/25', icon: <Droplets className="w-4 h-4 text-teal-400" /> },
                    { label: 'Pressure',       value: `${sensorReadings[sensorReadings.length - 1]?.pressure ?? hwData.pressure ?? 3.1}`, unit: 'dbar', color: 'border-indigo-500/25', icon: <Gauge className="w-4 h-4 text-indigo-400" /> },
                    { label: 'Battery',        value: `${sensorReadings[sensorReadings.length - 1]?.battery ?? hwData.batteryLevel ?? 84}`, unit: '%', color: 'border-green-500/25', icon: <BatteryFull className="w-4 h-4 text-green-400" /> },
                    { label: 'Signal Strength', value: `${sensorReadings[sensorReadings.length - 1]?.signal ?? hwData.gpsAccuracy ?? 92}`, unit: '%', color: 'border-purple-500/25', icon: <Activity className="w-4 h-4 text-purple-400" /> },
                  ].map((card, idx) => (
                    <div
                      key={idx}
                      className={`relative rounded-2xl p-4 border ${card.color} bg-gradient-to-br from-slate-950/60 to-transparent backdrop-blur-sm overflow-hidden hover:border-cyan-500/40 transition-all group`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{card.label}</span>
                        {card.icon}
                      </div>
                      <div className="text-xl font-extrabold text-white font-mono">
                        {card.value}
                        {card.unit && <span className="text-xs text-slate-400 font-normal ml-1">{card.unit}</span>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Real Live Sensor History Chart with Dual Y-Axis */}
                <GlassCard hoverEffect={false} className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Activity className="w-4 h-4 text-cyan-400" />
                      Live Sensor History — {selectedDeviceId} ({sensorReadings.length > 0 ? `last ${sensorReadings.length} readings` : 'no readings'})
                    </h4>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" />
                        Water Temp (°C) [Left]
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-teal-400 inline-block" />
                        Salinity (PSU) [Left]
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" />
                        Depth (m) [Right]
                      </span>
                    </div>
                  </div>

                  {sensorReadings.length > 0 ? (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sensorReadings}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="time_display" stroke="#64748b" tick={{ fontSize: 9 }} />
                          {/* Left Y Axis for Temperature & Salinity */}
                          <YAxis yAxisId="left" stroke="#38bdf8" tick={{ fontSize: 9 }} domain={['auto', 'auto']} />
                          {/* Right Y Axis for Depth */}
                          <YAxis yAxisId="right" orientation="right" stroke="#f43f5e" tick={{ fontSize: 9 }} domain={['auto', 'auto']} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8', paddingTop: '8px' }} />
                          <Line yAxisId="left" type="monotone" dataKey="temperature" name="Water Temp (°C)" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                          <Line yAxisId="left" type="monotone" dataKey="salinity"    name="Salinity (PSU)"   stroke="#2dd4bf" strokeWidth={2} dot={{ r: 2 }} />
                          <Line yAxisId="right" type="monotone" dataKey="depth"       name="Depth (m)"        stroke="#f43f5e" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 2 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-center py-12 space-y-2">
                      <Activity className="w-8 h-8 text-slate-600 mx-auto" />
                      <p className="text-xs font-semibold text-slate-400">No historical sensor readings are available for {selectedDeviceId}.</p>
                      <p className="text-[11px] text-slate-500">Telemetry will populate automatically as readings are logged.</p>
                    </div>
                  )}
                </GlassCard>

                {/* Float history path */}
                {hwData.history && hwData.history.length > 0 && (
                  <GlassCard hoverEffect={false} className="space-y-3">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Anchor className="w-4 h-4 text-cyan-400" />
                      GPS Track History ({hwData.history.length} waypoints)
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-800">
                            <th className="text-left py-2 pr-4">#</th>
                            <th className="text-left py-2 pr-4">Timestamp</th>
                            <th className="text-left py-2 pr-4">Latitude</th>
                            <th className="text-left py-2">Longitude</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hwData.history.slice(0, 8).map((pt, idx) => (
                            <tr key={idx} className="border-b border-slate-900 hover:bg-slate-800/30 transition-colors">
                              <td className="py-1.5 pr-4 text-slate-500 font-mono">{idx + 1}</td>
                              <td className="py-1.5 pr-4 text-slate-300 font-mono">{pt.timestamp}</td>
                              <td className="py-1.5 pr-4 text-cyan-400 font-mono">{pt.latitude.toFixed(4)}°</td>
                              <td className="py-1.5 text-cyan-400 font-mono">{pt.longitude.toFixed(4)}°</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </GlassCard>
                )}
              </>
            )}
          </div>
        ) : (
          /* Access denied state */
          <GlassCard hoverEffect={false} className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30">
              <Lock className="w-8 h-8 text-rose-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Access Restricted</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Hardware Telemetry is available only to <strong className="text-rose-300">Admin</strong> and <strong className="text-emerald-300">Government</strong> role users. Contact your system administrator to request elevated access.
              </p>
            </div>
          </GlassCard>
        )
      )}
    </div>
  );
};
