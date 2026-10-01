import React, { useState } from 'react';
import { 
  Compass, Waves, Mountain, Droplets, Thermometer, 
  Wind, Radio, Ship, Anchor, AlertCircle, Copy, 
  Check, Layers, FileText, ChevronRight, Activity,
  Globe, Shield, Sparkles, MapPin
} from 'lucide-react';
import { DepthProfileChart } from './DepthProfileChart';

export interface OceanDataPayload {
  location: {
    latitude: number;
    longitude: number;
    dms: string;
    is_land: boolean;
    type: string;
    ocean: string;
    sea: string | null;
    region: string;
    status_message: string;
  };
  bathymetry: {
    depth_m: number;
    elevation_m: number;
    source: string;
    data_type: string;
    terrain: string;
    feature_detected?: string | null;
    is_ocean: boolean;
  };
  water: {
    temperature_c: number | null;
    salinity_psu: number | null;
    oxygen_umol_kg: number | null;
    nitrate_umol_kg: number | null;
    phosphate_umol_kg: number | null;
    silicate_umol_kg: number | null;
    ph: number | null;
  };
  depth_profile: Array<{
    depth_m: number;
    temperature_c: number | null;
    salinity_psu: number | null;
    oxygen_umol_kg: number | null;
    nitrate_umol_kg?: number | null;
    phosphate_umol_kg?: number | null;
    silicate_umol_kg?: number | null;
    ph?: number | null;
  }>;
  profile_metadata: {
    source: string;
    data_type: string;
    last_updated: string;
  };
  argo_floats: Array<{
    wmo_id: string;
    platform_type: string;
    latitude: number;
    longitude: number;
    ocean: string;
    status: string;
    launch_date: string;
    last_observation: string;
    cycle_number: number;
    max_depth_m: number;
    sensors: string[];
    temp_surface: number;
    temp_2000m: number;
    salinity_surface: number;
    salinity_2000m: number;
    oxygen_surface: number;
    oxygen_2000m: number;
    institution: string;
    distance_km: number;
  }>;
  research_expeditions: Array<{
    expedition_name: string;
    vessel: string;
    institution: string;
    year: number;
    latitude: number;
    longitude: number;
    ocean: string;
    focus: string;
    max_depth_m: number;
    data_doi: string;
    data_source: string;
    distance_km: number;
  }>;
  seafloor_features: Array<{
    name: string;
    type: string;
    latitude: number;
    longitude: number;
    depth_m: number;
    ocean: string;
    description: string;
    radius_km: number;
    distance_km: number;
  }>;
}

interface OceanDetailsPanelProps {
  data: OceanDataPayload | null;
  isLoading: boolean;
  onSelectFloat?: (wmoId: string) => void;
  onSelectLocation?: (lat: number, lon: number) => void;
}

type TabType = 'overview' | 'water_column' | 'argo' | 'research' | 'seafloor';

export const OceanDetailsPanel: React.FC<OceanDetailsPanelProps> = ({
  data,
  isLoading,
  onSelectLocation
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [copied, setCopied] = useState(false);

  const handleCopyCoordinates = () => {
    if (!data) return;
    const text = `${data.location.latitude.toFixed(6)}, ${data.location.longitude.toFixed(6)} (${data.location.dms})`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportReport = () => {
    if (!data) return;
    const report = {
      title: 'ORCA Oceanographic Location Report',
      timestamp: new Date().toISOString(),
      location: data.location,
      bathymetry: data.bathymetry,
      water_column_surface: data.water,
      profile_depth_records_count: data.depth_profile.length,
      nearby_argo_floats: data.argo_floats.slice(0, 3),
      research_expeditions: data.research_expeditions.slice(0, 3),
      seafloor_features: data.seafloor_features
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ocean_report_${data.location.latitude.toFixed(2)}_${data.location.longitude.toFixed(2)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="h-full p-6 flex flex-col items-center justify-center space-y-4 bg-slate-900/60 rounded-3xl border border-cyan-500/20 text-center">
        <div className="relative">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 animate-spin">
            <Compass className="w-6 h-6" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
          </span>
        </div>
        <div>
          <h4 className="text-sm font-bold text-white tracking-tight">Querying Oceanographic Matrix</h4>
          <p className="text-xs text-slate-400 mt-1">Retrieving GEBCO bathymetry, CTD profiles & Argo float telemetry…</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full p-6 flex flex-col items-center justify-center space-y-3 bg-slate-900/40 rounded-3xl border border-slate-800 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400">
          <Globe className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-bold text-white">Select Any Global Coordinate</h4>
        <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
          Click any ocean or sea on the interactive map to inspect bathymetry, water column profiles, nearby Argo floats, and research cruises.
        </p>
      </div>
    );
  }

  const { location, bathymetry, water, depth_profile, profile_metadata, argo_floats, research_expeditions, seafloor_features } = data;

  return (
    <div className="h-full flex flex-col rounded-3xl bg-slate-900/85 border border-cyan-500/20 backdrop-blur-xl shadow-2xl overflow-hidden">
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${location.is_land ? 'bg-amber-400' : 'bg-cyan-400 animate-pulse'}`} />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-cyan-400 truncate">
              {location.is_land ? 'Terrestrial Landmass' : (location.sea || location.ocean)}
            </h3>
          </div>
          <p className="text-sm font-bold text-white truncate mt-0.5">{location.region}</p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleCopyCoordinates}
            title="Copy Latitude & Longitude"
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors text-xs flex items-center gap-1"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={handleExportReport}
            title="Export Location Scientific Report"
            className="p-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-colors text-xs flex items-center gap-1"
          >
            <FileText className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Coordinate Pill Bar */}
      <div className="px-4 py-2.5 bg-slate-900/40 border-b border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="text-slate-300 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>{location.latitude >= 0 ? `${location.latitude.toFixed(4)}°N` : `${Math.abs(location.latitude).toFixed(4)}°S`}</span>
          <span className="text-slate-600">•</span>
          <span>{location.longitude >= 0 ? `${location.longitude.toFixed(4)}°E` : `${Math.abs(location.longitude).toFixed(4)}°W`}</span>
        </div>
        <span className="text-[11px] text-slate-500 truncate">{location.dms}</span>
      </div>

      {/* Terrestrial Land Alert Banner */}
      {location.is_land && (
        <div className="p-3 m-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
          <div>
            <p className="font-semibold text-amber-200">Selected location is on land.</p>
            <p className="text-[11px] text-amber-300/80 mt-0.5">
              Oceanographic water column metrics and Argo float profiles are not applicable. Showing continental elevation data.
            </p>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-800 bg-slate-950/40 px-2 pt-2 gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-2 rounded-t-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
            activeTab === 'overview'
              ? 'bg-slate-900 text-cyan-400 border-t-2 border-cyan-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> Overview
        </button>

        {!location.is_land && (
          <>
            <button
              onClick={() => setActiveTab('water_column')}
              className={`px-3 py-2 rounded-t-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                activeTab === 'water_column'
                  ? 'bg-slate-900 text-cyan-400 border-t-2 border-cyan-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Droplets className="w-3.5 h-3.5" /> Water Profile
            </button>

            <button
              onClick={() => setActiveTab('argo')}
              className={`px-3 py-2 rounded-t-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                activeTab === 'argo'
                  ? 'bg-slate-900 text-cyan-400 border-t-2 border-cyan-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5" /> Argo Floats ({argo_floats.length})
            </button>

            <button
              onClick={() => setActiveTab('research')}
              className={`px-3 py-2 rounded-t-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                activeTab === 'research'
                  ? 'bg-slate-900 text-cyan-400 border-t-2 border-cyan-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Ship className="w-3.5 h-3.5" /> Research ({research_expeditions.length})
            </button>
          </>
        )}

        <button
          onClick={() => setActiveTab('seafloor')}
          className={`px-3 py-2 rounded-t-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
            activeTab === 'seafloor'
              ? 'bg-slate-900 text-cyan-400 border-t-2 border-cyan-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Mountain className="w-3.5 h-3.5" /> Seafloor
        </button>
      </div>

      {/* Tab Content Body */}
      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* KPI Metric Cards */}
            <div className="grid grid-cols-2 gap-3">
              {/* Bathymetry Depth */}
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[11px] font-semibold">{location.is_land ? 'Elevation' : 'Seafloor Depth'}</span>
                  <Mountain className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="text-xl font-extrabold text-white font-mono">
                  {location.is_land
                    ? `+${bathymetry.elevation_m.toLocaleString()} m`
                    : `${bathymetry.depth_m.toLocaleString()} m`}
                </div>
                <p className="text-[10px] text-slate-500 truncate">Source: {bathymetry.source.split(' ')[0]}</p>
              </div>

              {/* Surface Temperature */}
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[11px] font-semibold">Surface Temp</span>
                  <Thermometer className="w-3.5 h-3.5 text-sky-400" />
                </div>
                <div className="text-xl font-extrabold text-white font-mono">
                  {water.temperature_c !== null ? `${water.temperature_c} °C` : 'N/A'}
                </div>
                <p className="text-[10px] text-slate-500">Depth: 0 m</p>
              </div>

              {/* Salinity */}
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[11px] font-semibold">Salinity</span>
                  <Droplets className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-xl font-extrabold text-white font-mono">
                  {water.salinity_psu !== null ? `${water.salinity_psu} PSU` : 'N/A'}
                </div>
                <p className="text-[10px] text-slate-500">Depth: 0 m</p>
              </div>

              {/* Dissolved Oxygen */}
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[11px] font-semibold">Dissolved O₂</span>
                  <Wind className="w-3.5 h-3.5 text-rose-400" />
                </div>
                <div className="text-xl font-extrabold text-white font-mono">
                  {water.oxygen_umol_kg !== null ? `${water.oxygen_umol_kg}` : 'N/A'}
                  <span className="text-[10px] text-slate-400 font-normal ml-1">µmol/kg</span>
                </div>
                <p className="text-[10px] text-slate-500">Surface Soluble</p>
              </div>
            </div>

            {/* Geological Terrain / Feature Banner */}
            {bathymetry.terrain && (
              <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Morphological Terrain</span>
                  <p className="font-bold text-slate-200 mt-0.5">{bathymetry.terrain}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono text-cyan-300 bg-cyan-950/50 border border-cyan-800/40 shrink-0">
                  {bathymetry.data_type.includes('gridded') ? 'Gridded 15-arcsec' : 'Observed'}
                </span>
              </div>
            )}

            {/* Nearest Argo Float Teaser */}
            {!location.is_land && argo_floats.length > 0 && (
              <div className="p-3 rounded-2xl bg-gradient-to-r from-slate-950 to-blue-950/40 border border-blue-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 animate-pulse" /> Nearest Argo Float
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">{argo_floats[0].distance_km} km away</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-white">WMO #{argo_floats[0].wmo_id} ({argo_floats[0].platform_type})</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Cycle #{argo_floats[0].cycle_number} • {argo_floats[0].institution}</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('argo')}
                    className="px-2.5 py-1 rounded-xl text-[11px] font-semibold text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 transition-colors"
                  >
                    View Float
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: WATER COLUMN */}
        {activeTab === 'water_column' && (
          <div className="space-y-4">
            <DepthProfileChart
              data={depth_profile}
              seafloorDepthM={bathymetry.depth_m}
              sourceLabel={profile_metadata.source}
              dataTypeLabel={profile_metadata.data_type}
            />

            {/* Nutrients & Chemical Hydrography Table */}
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5">
              <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Biogeochemical Parameters
              </h5>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400">Nitrate (NO₃)</span>
                  <p className="font-bold text-white font-mono">{water.nitrate_umol_kg !== null ? `${water.nitrate_umol_kg} µmol/kg` : 'Data unavailable'}</p>
                </div>
                <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400">Phosphate (PO₄)</span>
                  <p className="font-bold text-white font-mono">{water.phosphate_umol_kg !== null ? `${water.phosphate_umol_kg} µmol/kg` : 'Data unavailable'}</p>
                </div>
                <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400">Silicate (SiO₄)</span>
                  <p className="font-bold text-white font-mono">{water.silicate_umol_kg !== null ? `${water.silicate_umol_kg} µmol/kg` : 'Data unavailable'}</p>
                </div>
                <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400">pH Level</span>
                  <p className="font-bold text-white font-mono">{water.ph !== null ? `${water.ph}` : 'Data unavailable'}</p>
                </div>
              </div>

              <p className="text-[10px] text-slate-500 leading-tight">
                Source: NOAA World Ocean Atlas (WOA 2023) Climatological Standard Hydrographic Grid.
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: ARGO FLOATS */}
        {activeTab === 'argo' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{argo_floats.length} Profiling Floats within radius</span>
              <span className="text-[11px] text-cyan-400">Sync: Global Argo GDAC</span>
            </div>

            {argo_floats.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 rounded-2xl bg-slate-950/40 border border-slate-800">
                No active Argo profiling floats located within search radius.
              </div>
            ) : (
              argo_floats.map((fl) => (
                <div
                  key={fl.wmo_id}
                  className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-cyan-500/40 transition-all space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                        <Radio className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h6 className="text-xs font-bold text-white">WMO #{fl.wmo_id}</h6>
                        <p className="text-[10px] text-slate-400">{fl.platform_type} • {fl.institution}</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                      {fl.distance_km} km
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Cycle / Depth</span>
                      <span className="font-mono">#{fl.cycle_number} ({fl.max_depth_m}m max)</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Last Observation</span>
                      <span className="font-mono">{fl.last_observation}</span>
                    </div>
                  </div>

                  {/* Sensors tags */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {fl.sensors.map((s, idx) => (
                      <span key={idx} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400">
                        {s}
                      </span>
                    ))}
                  </div>

                  {onSelectLocation && (
                    <button
                      onClick={() => onSelectLocation(fl.latitude, fl.longitude)}
                      className="w-full py-1.5 rounded-xl text-xs font-semibold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 transition-colors flex items-center justify-center gap-1"
                    >
                      Focus Float Location <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 4: RESEARCH EXPEDITIONS */}
        {activeTab === 'research' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{research_expeditions.length} Research Cruises near coordinate</span>
              <span className="text-[11px] text-emerald-400">R2R / NCEI Archive</span>
            </div>

            {research_expeditions.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 rounded-2xl bg-slate-950/40 border border-slate-800">
                No indexed oceanographic research cruises in this immediate sector.
              </div>
            ) : (
              research_expeditions.map((exp, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <Ship className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h6 className="font-bold text-white">{exp.vessel} ({exp.year})</h6>
                        <p className="text-[10px] text-slate-400">{exp.institution}</p>
                      </div>
                    </div>
                    <span className="font-mono text-[11px] text-emerald-400">{exp.distance_km} km</span>
                  </div>

                  <p className="text-slate-300 text-[11px] leading-relaxed bg-slate-900/60 p-2 rounded-xl border border-slate-800/80">
                    {exp.focus}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                    <span>DOI: {exp.data_doi}</span>
                    <span className="truncate max-w-[150px]">{exp.data_source}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 5: SEAFLOOR FEATURES */}
        {activeTab === 'seafloor' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>GEBCO Gazetteer Features</span>
              <span className="text-[11px] text-amber-400">IHO-IOC GEBCO UFN</span>
            </div>

            {seafloor_features.length === 0 ? (
              <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800 text-xs text-slate-400 text-center">
                No identified named undersea features within immediate gazetteer radius.
              </div>
            ) : (
              seafloor_features.map((f, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h6 className="font-bold text-white">{f.name}</h6>
                      <p className="text-[10px] text-amber-400">{f.type} • {f.ocean}</p>
                    </div>
                    <span className="font-mono text-[11px] text-slate-400">{f.distance_km} km</span>
                  </div>

                  <p className="text-slate-300 text-[11px] leading-relaxed bg-slate-900/60 p-2 rounded-xl border border-slate-800/80">
                    {f.description}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>Feature Depth: {f.depth_m.toLocaleString()} m</span>
                    {onSelectLocation && (
                      <button
                        onClick={() => onSelectLocation(f.latitude, f.longitude)}
                        className="text-cyan-400 hover:underline flex items-center gap-0.5"
                      >
                        Inspect Feature <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
