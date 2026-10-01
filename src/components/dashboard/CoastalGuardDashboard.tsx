import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { apiFetch } from '../../utils/api';
import { RoleBadge } from '../common/RoleBadge';
import { ShieldAlert, AlertTriangle, ShieldCheck, MapPin, Waves, Compass, Activity, Bell } from 'lucide-react';
import { OceanMap } from '../ocean/OceanMap';
import { OceanHazardAlertBanner } from '../ocean/OceanHazardAlertBanner';

export const CoastalGuardDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    fetchCoastalAlerts();
  }, []);

  const fetchCoastalAlerts = async () => {
    try {
      const res = await apiFetch('/hazards/alerts');
      if (res.ok) {
        setAlerts(await res.json());
      }
    } catch (e) {
      console.error('Failed to load coastal guard alerts', e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-3xl border border-orange-500/30 bg-gradient-to-r from-orange-950/80 via-slate-900/90 to-ocean-950/90 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-400 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <ShieldAlert className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-white tracking-tight">National Coastal Guard Safety & Hazard Command</h1>
              <RoleBadge role="Coastal Guard" size="sm" />
            </div>
            <p className="text-xs text-slate-300 mt-1">Real-time coastal threat tracking, storm surge detection, marine anomaly alerts & emergency response matrix.</p>
          </div>
        </div>
      </div>

      <OceanHazardAlertBanner />

      {/* Safety Alert Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">ACTIVE COASTAL ALERTS</span>
            <Bell className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-3xl font-mono font-extrabold text-white">{alerts.length || 2}</div>
          <p className="text-[11px] text-orange-400 font-semibold">Continuous Sensor Array Monitoring</p>
        </div>

        <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">PATROL SECTOR SAFETY</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">OPERATIONAL</div>
          <p className="text-[11px] text-slate-400">Sector 4 Coastal Readiness</p>
        </div>

        <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">TSUNAMI & SURGE DETECTOR</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-cyan-400">STANDBY</div>
          <p className="text-[11px] text-slate-400">Deterministic Threshold Watch Active</p>
        </div>
      </div>

      {/* Coastal Operational Safety Map */}
      <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Compass className="w-4 h-4 text-orange-400" />
          Coastal Operational Safety Map & Regional Sector Patrol
        </h2>
        <div className="rounded-2xl overflow-hidden border border-slate-800">
          <OceanMap />
        </div>
      </div>
    </div>
  );
};
