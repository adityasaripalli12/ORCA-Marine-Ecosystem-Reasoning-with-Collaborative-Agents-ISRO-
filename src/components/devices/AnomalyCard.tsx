import React from 'react';
import { AlertTriangle, ArrowRight, Cpu, Thermometer, BatteryWarning, Signal, Globe, Zap } from 'lucide-react';
import { Anomaly, SEVERITY_CONFIG, AnomalyType } from '../../types/devices';

const ANOMALY_ICONS: Partial<Record<AnomalyType, React.ElementType>> = {
  'Temperature Spike': Thermometer,
  'Temperature Drop': Thermometer,
  'Battery Drain': BatteryWarning,
  'Signal Loss': Signal,
  'CPU Overload': Cpu,
  'RAM Exhaustion': Zap,
  'Network Anomaly': Globe,
  'Connectivity Loss': Globe,
  'Location Drift': Globe,
  'Sensor Malfunction': AlertTriangle,
};

interface Props {
  anomaly: Anomaly;
  onClick?: () => void;
  showDeviceLink?: boolean;
  onDeviceClick?: (deviceId: string) => void;
}

export const AnomalyCard: React.FC<Props> = ({ anomaly, onClick, showDeviceLink = true, onDeviceClick }) => {
  const sevCfg = SEVERITY_CONFIG[anomaly.severity];
  const Icon = ANOMALY_ICONS[anomaly.anomalyType] || AlertTriangle;

  const statusColors: Record<string, string> = {
    new: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    investigating: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    resolved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    ignored: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  };

  return (
    <div
      onClick={onClick}
      className={`glass-panel rounded-xl p-4 border ${sevCfg.borderClass} hover:border-opacity-60 transition-all ${onClick ? 'cursor-pointer glass-panel-hover' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2.5 rounded-xl shrink-0 ${sevCfg.bgClass}`}>
          <Icon className={`w-5 h-5 ${sevCfg.textClass}`} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-white">{anomaly.anomalyType}</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${sevCfg.bgClass} ${sevCfg.textClass} border ${sevCfg.borderClass} uppercase`}>
              {anomaly.severity}
            </span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${statusColors[anomaly.status]}`}>
              {anomaly.status}
            </span>
          </div>

          {/* Device + Confidence */}
          <div className="flex items-center gap-3 mt-1.5 text-[11px]">
            {showDeviceLink ? (
              <button
                onClick={(e) => { e.stopPropagation(); onDeviceClick?.(anomaly.deviceId); }}
                className="font-mono text-cyan-400 hover:text-cyan-300 font-bold transition-colors"
              >
                {anomaly.deviceId}
              </button>
            ) : (
              <span className="font-mono text-cyan-400 font-bold">{anomaly.deviceId}</span>
            )}
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">Confidence: <span className="font-bold text-white">{anomaly.confidence}%</span></span>
          </div>

          {/* Values */}
          <div className="flex items-center gap-4 mt-2.5">
            <div className="px-2.5 py-1 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Current</span>
              <span className={`text-xs font-bold font-mono ${sevCfg.textClass}`}>{anomaly.currentValue}</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <div className="px-2.5 py-1 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Expected</span>
              <span className="text-xs font-bold font-mono text-emerald-400">{anomaly.expectedRange}</span>
            </div>
          </div>

          {/* Explanation */}
          <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed line-clamp-2">{anomaly.explanation}</p>

          {/* Timestamp */}
          <div className="text-[10px] text-slate-500 mt-2">
            Detected: {new Date(anomaly.detectedAt).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};
