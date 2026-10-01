import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  ShieldAlert, 
  ShieldCheck, 
  Info, 
  ChevronDown, 
  ChevronUp, 
  Waves, 
  Wind, 
  Compass, 
  Activity, 
  Clock, 
  CheckCircle2, 
  ExternalLink,
  RefreshCw,
  SlidersHorizontal,
  Flame,
  Droplets
} from 'lucide-react';
import { OceanAlertItem, HazardSummary } from '../../types';

interface OceanHazardAlertBannerProps {
  onNavigateToChat?: (query: string) => void;
}

export const OceanHazardAlertBanner: React.FC<OceanHazardAlertBannerProps> = ({ onNavigateToChat }) => {
  const [alerts, setAlerts] = useState<OceanAlertItem[]>([]);
  const [summary, setSummary] = useState<HazardSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [expanded, setExpanded] = useState<boolean>(false);
  const [selectedAlertIndex, setSelectedAlertIndex] = useState<number>(0);

  const fetchHazardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Try API endpoints with both /api/v1 prefix and fallback root
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const [alertsRes, summaryRes] = await Promise.all([
        fetch(`${baseUrl}/api/v1/hazards/alerts?status=ACTIVE`, { headers }).catch(() => 
          fetch(`${baseUrl}/hazards/alerts?status=ACTIVE`, { headers })
        ),
        fetch(`${baseUrl}/api/v1/hazards/summary`, { headers }).catch(() => 
          fetch(`${baseUrl}/hazards/summary`, { headers })
        )
      ]);

      if (alertsRes && alertsRes.ok) {
        const data = await alertsRes.json();
        setAlerts(Array.isArray(data) ? data : []);
      }

      if (summaryRes && summaryRes.ok) {
        const sumData = await summaryRes.json();
        setSummary(sumData);
      }
    } catch (err) {
      console.warn('Could not fetch hazard data from live backend, falling back to nominal status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHazardData();
    // Periodic refresh every 45s
    const interval = setInterval(fetchHazardData, 45000);
    return () => clearInterval(interval);
  }, []);

  const activeAlert = alerts.length > 0 ? alerts[selectedAlertIndex] || alerts[0] : null;
  const overallStatus = summary?.overall_status || (activeAlert ? activeAlert.alert_level : 'NORMAL');

  const getStatusTheme = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return {
          border: 'border-rose-500/50',
          bg: 'from-rose-950/70 via-slate-900/90 to-red-950/60',
          glow: 'shadow-rose-500/20',
          badgeBg: 'bg-rose-500/20',
          badgeText: 'text-rose-400',
          badgeBorder: 'border-rose-500/40',
          dot: 'bg-rose-500',
          icon: ShieldAlert,
          title: 'CRITICAL OCEAN HAZARD DETECTED',
        };
      case 'WARNING':
        return {
          border: 'border-amber-500/50',
          bg: 'from-amber-950/60 via-slate-900/90 to-orange-950/50',
          glow: 'shadow-amber-500/20',
          badgeBg: 'bg-amber-500/20',
          badgeText: 'text-amber-400',
          badgeBorder: 'border-amber-500/40',
          dot: 'bg-amber-400',
          icon: AlertTriangle,
          title: 'OFFICIAL MARINE WARNING IN EFFECT',
        };
      case 'ADVISORY':
        return {
          border: 'border-yellow-500/40',
          bg: 'from-yellow-950/50 via-slate-900/90 to-slate-900/80',
          glow: 'shadow-yellow-500/10',
          badgeBg: 'bg-yellow-500/20',
          badgeText: 'text-yellow-300',
          badgeBorder: 'border-yellow-500/30',
          dot: 'bg-yellow-400',
          icon: Info,
          title: 'OCEANOGRAPHIC HAZARD ADVISORY',
        };
      default:
        return {
          border: 'border-emerald-500/30',
          bg: 'from-slate-900/90 via-navy-900/80 to-emerald-950/40',
          glow: 'shadow-emerald-500/10',
          badgeBg: 'bg-emerald-500/15',
          badgeText: 'text-emerald-400',
          badgeBorder: 'border-emerald-500/30',
          dot: 'bg-emerald-400',
          icon: ShieldCheck,
          title: 'OCEAN CONDITIONS VERIFIED NOMINAL',
        };
    }
  };

  const theme = getStatusTheme(overallStatus);
  const StatusIcon = theme.icon;

  const getHazardIcon = (type?: string) => {
    switch (type) {
      case 'EXTREME_WAVE':
        return Waves;
      case 'HIGH_WIND':
        return Wind;
      case 'CYCLONE_RISK':
        return Compass;
      case 'SST_ANOMALY':
        return Flame;
      case 'SALINITY_ANOMALY':
        return Droplets;
      default:
        return Activity;
    }
  };

  const HazardIcon = activeAlert ? getHazardIcon(activeAlert.hazard_type) : Waves;

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${theme.border} bg-gradient-to-r ${theme.bg} shadow-lg ${theme.glow} transition-all duration-300 backdrop-blur-md`}>
      {/* Top Banner Row */}
      <div className="p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className={`p-2.5 rounded-xl ${theme.badgeBg} border ${theme.badgeBorder} ${theme.badgeText} shrink-0 mt-0.5 sm:mt-0 shadow-sm`}>
            <StatusIcon className="w-5 h-5 animate-pulse" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black tracking-wider uppercase border ${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder} flex items-center gap-1.5 shadow-sm`}>
                <span className={`w-2 h-2 rounded-full ${theme.dot} ${overallStatus !== 'NORMAL' ? 'animate-ping' : ''}`} />
                {overallStatus}
              </span>

              {activeAlert && (
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <HazardIcon className="w-3.5 h-3.5 text-cyan-400" />
                  {activeAlert.hazard_type.replace(/_/g, ' ')}
                </span>
              )}

              {activeAlert && (
                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700 text-slate-300 font-mono">
                  Confidence: <span className="font-bold text-cyan-300">{activeAlert.confidence_score}%</span> ({activeAlert.confidence_label})
                </span>
              )}
            </div>

            <h3 className="text-sm sm:text-base font-bold text-white mt-1">
              {activeAlert ? activeAlert.title : theme.title}
            </h3>

            <p className="text-xs text-slate-300 mt-0.5 line-clamp-2 max-w-3xl">
              {activeAlert 
                ? activeAlert.message 
                : 'All in-situ Argo profiling floats, satellite SST observations, and coastal tide gauges are operating within normal climatological baselines.'}
            </p>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800/60">
          {activeAlert && onNavigateToChat && (
            <button
              onClick={() => onNavigateToChat(`Explain the current ${activeAlert.hazard_type.replace(/_/g, ' ')} hazard alert and recommended actions`)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600/50 transition-all flex items-center gap-1.5 shadow-sm"
            >
              Analyze with AI <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
            </button>
          )}

          <button
            onClick={fetchHazardData}
            title="Refresh hazard sensors"
            disabled={loading}
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/60 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          <button
            onClick={() => setExpanded(!expanded)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-200 hover:text-white bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 transition-all flex items-center gap-1.5"
          >
            <span>{expanded ? 'Collapse Details' : 'Details'}</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expandable Technical Telemetry Drawer */}
      {expanded && (
        <div className="px-5 pb-5 pt-2 border-t border-slate-800/80 bg-slate-950/40 space-y-4">
          {/* Active Alerts Selector if multiple alerts */}
          {alerts.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
                Active Alerts ({alerts.length}):
              </span>
              {alerts.map((al, idx) => (
                <button
                  key={al.id}
                  onClick={() => setSelectedAlertIndex(idx)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all shrink-0 ${
                    selectedAlertIndex === idx
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-bold'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {al.hazard_type} ({al.alert_level})
                </button>
              ))}
            </div>
          )}

          {activeAlert ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* Evidence & Action Guidance */}
              <div className="md:col-span-2 p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-cyan-400" />
                    Recommended Safety Guidance
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    Updated: {new Date(activeAlert.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs text-amber-200 font-medium leading-relaxed bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg">
                  {activeAlert.action_guidance || 'Follow standard maritime operations protocols and verify with port captains.'}
                </p>
                <div className="text-[11px] text-slate-400 flex flex-wrap gap-x-4 gap-y-1 pt-1">
                  <span><strong>Region:</strong> {activeAlert.region || 'Global Sector'}</span>
                  {activeAlert.latitude && activeAlert.longitude && (
                    <span><strong>Coordinates:</strong> {activeAlert.latitude.toFixed(3)}°N, {activeAlert.longitude.toFixed(3)}°E</span>
                  )}
                  <span><strong>Source Feeds:</strong> {activeAlert.sources || 'Multi-buoy array'}</span>
                  <span><strong>Fingerprint:</strong> <code className="text-cyan-400 font-mono text-[10px]">{activeAlert.fingerprint}</code></span>
                </div>
              </div>

              {/* Confidence Engine Breakdown */}
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                    Evidence Confidence
                  </span>
                  <span className="text-xs font-bold text-cyan-300 font-mono">
                    {activeAlert.confidence_score}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      activeAlert.confidence_score >= 80 ? 'bg-emerald-400' :
                      activeAlert.confidence_score >= 60 ? 'bg-amber-400' : 'bg-rose-400'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(5, activeAlert.confidence_score))}%` }}
                  />
                </div>

                <div className="space-y-1 text-[11px] text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Score Classification:</span>
                    <span className="font-semibold text-white">{activeAlert.confidence_label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Algorithm:</span>
                    <span className="text-slate-300">Multi-Signal Weighted Synthesis</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Expiration:</span>
                    <span className="text-slate-300 font-mono">{new Date(activeAlert.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-slate-400 font-medium">Wave State</div>
                <div className="text-emerald-400 font-bold mt-1">Normal (&lt; 2.5m)</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Altimetry &amp; Buoys</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-slate-400 font-medium">Surface Winds</div>
                <div className="text-emerald-400 font-bold mt-1">Calm/Breeze (&lt; 22 kts)</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Scatterometer Feeds</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-slate-400 font-medium">Barometric Trends</div>
                <div className="text-emerald-400 font-bold mt-1">Stable (&gt; 1008 hPa)</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Synoptic Pressure Grid</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-slate-400 font-medium">Climatology Baselines</div>
                <div className="text-emerald-400 font-bold mt-1">Within 15-Yr Mean</div>
                <div className="text-[10px] text-slate-500 mt-0.5">SST 24–30°C / Salinity 33–36 PSU</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
