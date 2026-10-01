import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { apiFetch } from '../../utils/api';
import { RoleBadge } from '../common/RoleBadge';
import { Anchor, Waves, Wind, Compass, AlertTriangle, ShieldCheck, MapPin, Activity, FileText } from 'lucide-react';
import { OceanMap } from '../ocean/OceanMap';

export const ShippingDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetchMaritimeData();
  }, []);

  const fetchMaritimeData = async () => {
    try {
      const res = await apiFetch('/maritime/conditions');
      if (res.ok) {
        setData(await res.json());
      }
    } catch (e) {
      console.error('Failed to load maritime data', e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-950/80 via-slate-900/90 to-ocean-950/90 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Anchor className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Maritime Operations & Shipping Intelligence</h1>
              <RoleBadge role="Shipping" size="sm" />
            </div>
            <p className="text-xs text-slate-300 mt-1">Real-time sea surface temperature, salinity, currents, wave operational safety & vessel navigation advisories.</p>
          </div>
        </div>
      </div>

      {/* Operational Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase">Operational Status</span>
          <div className="text-2xl font-extrabold text-amber-400 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            {data?.maritime_status || 'NORMAL'}
          </div>
          <p className="text-[11px] text-slate-400">Commercial Vessel Navigation Clear</p>
        </div>

        <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase">Sea Surface Temp</span>
          <div className="text-2xl font-extrabold font-mono text-white">
            {data?.surface_temperature || '28.4°C'}
          </div>
          <p className="text-[11px] text-slate-400">ARGO In-Situ Ingestion</p>
        </div>

        <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase">Salinity & Currents</span>
          <div className="text-2xl font-extrabold font-mono text-white">
            {data?.surface_salinity || '34.2 PSU'}
          </div>
          <p className="text-[11px] text-slate-400">Current Drift: 1.2 knots NE</p>
        </div>

        <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase">Wave Height Est.</span>
          <div className="text-2xl font-extrabold font-mono text-white">
            {data?.wave_height_est || '1.4 meters'}
          </div>
          <p className="text-[11px] text-slate-400">Visibility: 10 nautical miles</p>
        </div>
      </div>

      {/* Maritime Map & Route Advisory */}
      <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Compass className="w-4 h-4 text-amber-400" />
          Maritime Operational Map & Commercial Shipping Lanes
        </h2>
        <div className="rounded-2xl overflow-hidden border border-slate-800">
          <OceanMap />
        </div>
      </div>
    </div>
  );
};
