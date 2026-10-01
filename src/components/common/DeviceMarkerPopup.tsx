import React, { useState } from 'react';
import { useDevices } from '../../context/DeviceContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiFetch } from '../../utils/api';
import { ConfirmDialog } from '../devices/ConfirmDialog';
import {
  X, MapPin, Thermometer, BatteryFull, BatteryMedium, BatteryLow,
  Wifi, Activity, Cpu, MemoryStick, Globe, AlertTriangle, CheckCircle2,
  ExternalLink, Bot, Clock, Gauge, Droplets, FlaskConical, Zap, Database,
  Power, PowerOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface AILocation {
  name: string;
  deviceId?: string;
  latitude: number;
  longitude: number;
  depth?: number;
  temp?: number;
  battery?: number;
  signal?: number;
  salinity?: number;
  pressure?: number;
  ph?: number;
  do?: number;
  status?: string;
  last_updated?: string;
  anomalies?: string[];
  details?: string;
}

interface DeviceMarkerPopupProps {
  location: AILocation;
  onClose: () => void;
  onAIAnalyze?: (deviceId: string, deviceName: string) => void;
}

const StatusDot: React.FC<{ status?: string }> = ({ status }) => {
  const s = (status || '').toLowerCase();
  if (s.includes('critical')) return <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-pulse inline-block" />;
  if (s.includes('warning') || s.includes('offline')) return <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />;
  if (s.includes('online')) return <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse inline-block" />;
  return <span className="w-2.5 h-2.5 rounded-full bg-slate-500 inline-block" />;
};

const StatusBadge: React.FC<{ status?: string }> = ({ status }) => {
  const s = (status || 'Unknown').toLowerCase();
  let cls = 'bg-slate-500/10 text-slate-400 border-slate-500/30';
  if (s.includes('critical')) cls = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
  else if (s.includes('warning')) cls = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  else if (s.includes('online')) cls = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  return (
    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${cls}`}>
      <StatusDot status={status} />
      {status || 'Unknown'}
    </span>
  );
};

const MetricRow: React.FC<{ icon: React.ReactNode; label: string; value: string; unit?: string; highlight?: boolean }> = ({
  icon, label, value, unit, highlight
}) => (
  <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60 last:border-0">
    <div className="flex items-center gap-2 text-slate-400 text-[11px]">
      {icon}
      <span>{label}</span>
    </div>
    <span className={`text-[11px] font-mono font-bold ${highlight ? 'text-rose-400' : 'text-white'}`}>
      {value}{unit && <span className="text-slate-400 font-normal ml-0.5">{unit}</span>}
    </span>
  </div>
);

export const DeviceMarkerPopup: React.FC<DeviceMarkerPopupProps> = ({ location, onClose, onAIAnalyze }) => {
  const { devices, getDeviceAnomalies, enableDevice, disableDevice } = useDevices();
  const { user } = useAuth();
  const { addToast } = useToast();
  const isAdmin = user?.role === 'Admin';

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    action: 'ON' | 'OFF';
    title: string;
    message: string;
    confirmLabel: string;
  }>({
    isOpen: false,
    action: 'OFF',
    title: '',
    message: '',
    confirmLabel: ''
  });

  const [isControlling, setIsControlling] = useState(false);
  const [localStatus, setLocalStatus] = useState<string | null>(null);

  // Match live device from context if deviceId is provided
  const liveDevice = location.deviceId
    ? devices.find(d => d.id === location.deviceId)
    : undefined;

  const deviceAnomalies = liveDevice ? getDeviceAnomalies(liveDevice.id) : [];
  const activeAnomalies = deviceAnomalies.filter(a => a.status !== 'resolved' && a.status !== 'ignored');
  const payloadAnomalies = location.anomalies || [];

  const temp = liveDevice?.temperature ?? location.temp;
  const battery = liveDevice?.batteryLevel ?? location.battery;
  const signal = liveDevice?.signalStrength ?? location.signal;
  const depth = location.depth;
  const salinity = location.salinity;
  const pressure = location.pressure;
  const ph = location.ph;
  const dox = location.do;
  const lastUpdated = liveDevice
    ? new Date(liveDevice.lastSeen).toLocaleString()
    : location.last_updated ?? 'N/A';
  const firmware = liveDevice?.firmwareVersion;

  const deviceName = liveDevice?.name ?? location.name;
  const deviceId = location.deviceId ?? 'N/A';
  const currentStatus = localStatus || (liveDevice
    ? liveDevice.status.charAt(0).toUpperCase() + liveDevice.status.slice(1)
    : location.status ?? 'Unknown');

  const hasAnomaly = activeAnomalies.length > 0 || payloadAnomalies.length > 0;

  const handlePowerCommand = async (action: 'ON' | 'OFF') => {
    if (!location.deviceId) return;
    setIsControlling(true);
    try {
      const res = await apiFetch(`/devices/${location.deviceId}/power`, {
        method: 'POST',
        body: JSON.stringify({ action })
      });

      if (res.ok) {
        const data = await res.json();
        setLocalStatus(data.new_status);
        if (action === 'ON') {
          enableDevice(location.deviceId);
        } else {
          disableDevice(location.deviceId);
        }
        addToast('success', `Device Powered ${action}`, `Device ${location.deviceId} is now ${data.new_status}.`);
      } else {
        const err = await res.json();
        addToast('error', 'Operation Denied', err.detail || 'Failed to execute power operation.');
      }
    } catch (e: any) {
      addToast('error', 'Communication Error', e.message || 'Network error.');
    } finally {
      setIsControlling(false);
      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    }
  };

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.97 }}
          transition={{ duration: 0.2 }}
          className="relative z-20 w-full max-w-sm ml-auto bg-slate-950 border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-500/10 overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className={`px-4 py-3 flex items-start justify-between gap-3 border-b border-slate-800 ${hasAnomaly ? 'bg-rose-950/20' : 'bg-slate-900/60'}`}>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs font-bold text-cyan-400">{deviceId}</span>
                {liveDevice?.type && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    {liveDevice.type}
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-white truncate">{deviceName}</p>
              <div className="mt-1.5">
                <StatusBadge status={currentStatus} />
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-4 max-h-[380px] overflow-y-auto">
            {/* Administrator Power Controls */}
            {isAdmin && location.deviceId && (
              <div className="p-3 rounded-xl bg-slate-900 border border-cyan-500/30 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" /> Device Power Controls (Admin)
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase font-mono">
                    Admin Only
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setConfirmDialog({
                        isOpen: true,
                        action: 'ON',
                        title: `Turn on ${deviceId}?`,
                        message: `Initiate remote power sequence for ${deviceName} (${deviceId}) and resume real-time telemetry streaming.`,
                        confirmLabel: 'Confirm ON'
                      });
                    }}
                    disabled={isControlling || currentStatus.toLowerCase() === 'online'}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 disabled:opacity-40 transition-all shadow-sm"
                  >
                    <Power className="w-3.5 h-3.5" /> ON
                  </button>
                  <button
                    onClick={() => {
                      setConfirmDialog({
                        isOpen: true,
                        action: 'OFF',
                        title: `Turn off ${deviceId}?`,
                        message: `Turning off this device may stop telemetry collection and sensor recording.`,
                        confirmLabel: 'Confirm OFF'
                      });
                    }}
                    disabled={isControlling || currentStatus.toLowerCase() === 'offline'}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 disabled:opacity-40 transition-all shadow-sm"
                  >
                    <PowerOff className="w-3.5 h-3.5" /> OFF
                  </button>
                </div>
              </div>
            )}

            {/* Position & Coordinates */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-cyan-400" /> Geographic Position
              </p>
              <div className="space-y-0 bg-slate-900/40 p-2 rounded-xl border border-slate-800/60">
                <MetricRow
                  icon={<MapPin className="w-3 h-3 text-cyan-400" />}
                  label="Latitude"
                  value={location.latitude != null ? `${location.latitude.toFixed(4)}°N` : "Not available"}
                />
                <MetricRow
                  icon={<MapPin className="w-3 h-3 text-cyan-400" />}
                  label="Longitude"
                  value={location.longitude != null ? `${location.longitude.toFixed(4)}°E` : "Not available"}
                />
              </div>
            </div>

            {/* Telemetry */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 mb-2 flex items-center gap-1.5 border-t border-slate-800/80 pt-3">
                <Database className="w-3 h-3" /> Data Collected
              </p>
              <div className="space-y-0 bg-slate-900/40 p-2 rounded-xl border border-slate-800/60">
                <MetricRow
                  icon={<Thermometer className="w-3 h-3 text-cyan-400" />}
                  label="Temperature"
                  value={temp != null ? String(temp) : "Not available"}
                  unit={temp != null ? "°C" : undefined}
                  highlight={temp != null && temp > 50}
                />
                <MetricRow
                  icon={<Droplets className="w-3 h-3 text-cyan-400" />}
                  label="Salinity"
                  value={salinity != null ? String(salinity) : "Not available"}
                  unit={salinity != null ? "PSU" : undefined}
                />
                <MetricRow
                  icon={<Gauge className="w-3 h-3 text-cyan-400" />}
                  label="Pressure"
                  value={pressure != null ? String(pressure) : "Not available"}
                  unit={pressure != null ? "dbar" : undefined}
                />
                <MetricRow
                  icon={<Gauge className="w-3 h-3 text-cyan-400" />}
                  label="Depth"
                  value={depth != null ? String(depth) : "Not available"}
                  unit={depth != null ? "m" : undefined}
                />
                {battery != null && (
                  <MetricRow
                    icon={<Zap className="w-3 h-3 text-cyan-400" />}
                    label="Battery"
                    value={`${battery}%`}
                  />
                )}
                {signal != null && (
                  <MetricRow
                    icon={<Wifi className="w-3 h-3 text-cyan-400" />}
                    label="Signal Strength"
                    value={`${signal}%`}
                  />
                )}
              </div>
            </div>

            {/* Active Anomalies */}
            {activeAnomalies.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3" /> Active Anomalies
                </p>
                <div className="space-y-1.5">
                  {activeAnomalies.slice(0, 3).map(a => (
                    <div key={a.id} className="p-2.5 rounded-xl bg-rose-500/8 border border-rose-500/20">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] font-bold text-rose-300">{a.anomalyType}</span>
                        <span className="text-[10px] font-mono text-rose-400">{a.currentValue}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">{a.explanation.slice(0, 80)}…</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> Metadata
              </p>
              <div className="space-y-0">
                <MetricRow icon={<Clock className="w-3 h-3" />} label="Last Updated" value={lastUpdated} />
                {firmware && (
                  <MetricRow icon={<Activity className="w-3 h-3" />} label="Firmware" value={firmware} />
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-3 border-t border-slate-800 space-y-1.5">
            {location.deviceId && onAIAnalyze && (
              <button
                onClick={() => onAIAnalyze(deviceId, deviceName)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-[11px] font-bold bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border border-violet-500/30 transition-colors"
              >
                <Bot className="w-3.5 h-3.5" /> AI Analyze Device
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Confirmation Dialog for Administrator Power Operations */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.action === 'OFF' ? 'danger' : 'warning'}
        onConfirm={() => handlePowerCommand(confirmDialog.action)}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </>
  );
};
