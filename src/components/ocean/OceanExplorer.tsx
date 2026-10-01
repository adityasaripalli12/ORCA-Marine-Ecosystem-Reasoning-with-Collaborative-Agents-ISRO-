import React, { useState, useEffect, useCallback } from 'react';
import { GlassCard } from '../common/GlassCard';
import { OceanMap } from './OceanMap';
import { OceanDetailsPanel, OceanDataPayload } from './OceanDetailsPanel';
import { getApiUrl, apiFetch } from '../../utils/api';
import { 
  Compass, Search, Layers, Radio, Ship, Mountain, 
  MapPin, RefreshCw, Sparkles, Navigation, Globe, Eye
} from 'lucide-react';

const PRESET_LOCATIONS = [
  { name: 'Mariana Trench', lat: 11.35, lon: 142.20, category: 'Trench' },
  { name: 'Mid-Atlantic Ridge', lat: 23.40, lon: -45.10, category: 'Ridge' },
  { name: 'Bay of Bengal (Argo)', lat: 14.85, lon: 88.42, category: 'Argo Float' },
  { name: 'Arabian Sea (OMZ)', lat: 16.40, lon: 65.80, category: 'Oxygen Minimum' },
  { name: 'Hawaiian Seamounts', lat: 25.00, lon: -168.00, category: 'Seamounts' },
  { name: 'Puerto Rico Trench', lat: 19.83, lon: -66.50, category: 'Deep Trench' },
];

export const OceanExplorer: React.FC = () => {
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lon: number }>({
    lat: 12.3456,
    lon: 145.6789
  });
  const [oceanData, setOceanData] = useState<OceanDataPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Layer Toggles
  const [showArgo, setShowArgo] = useState(true);
  const [showExpeditions, setShowExpeditions] = useState(true);
  const [showFeatures, setShowFeatures] = useState(true);

  // Fetch oceanographic data for coordinate
  const fetchOceanData = useCallback(async (lat: number, lon: number) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await apiFetch(`/geo/ocean-info?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to fetch oceanographic data.`);
      }
      const json: OceanDataPayload = await res.json();
      setOceanData(json);
    } catch (err: any) {
      setErrorMessage(err.message || 'Oceanographic data unavailable for this location.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchOceanData(selectedCoords.lat, selectedCoords.lon);
  }, [fetchOceanData, selectedCoords.lat, selectedCoords.lon]);

  const handleMapClick = (lat: number, lon: number) => {
    setSelectedCoords({ lat, lon });
    fetchOceanData(lat, lon);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await apiFetch(`/geo/search?q=${encodeURIComponent(searchQuery.trim())}`);
      if (res.ok) {
        const json = await res.json();
        setSearchResults(json.results || []);
        setShowSearchResults(true);
        if (json.results && json.results.length > 0) {
          const first = json.results[0];
          setSelectedCoords({ lat: first.latitude, lon: first.longitude });
          fetchOceanData(first.latitude, first.longitude);
        }
      }
    } catch {
      // ignore search error
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (lat: number, lon: number) => {
    setSelectedCoords({ lat, lon });
    fetchOceanData(lat, lon);
    setShowSearchResults(false);
    setSearchQuery('');
  };

  return (
    <GlassCard hoverEffect={false} className="p-5 space-y-4 border border-cyan-500/25 bg-slate-950/80 shadow-2xl">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-3 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
              <Compass className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
                Ocean Geographic Explorer
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  GEBCO • WOA • Argo
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Interactive real-world bathymetric mapping & water column telemetry
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar & Layer Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto relative">
          <form onSubmit={handleSearch} className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ocean, trench, or lat,lon..."
              className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 font-mono transition-all"
            />
            {searchQuery && (
              <button
                type="submit"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-cyan-400 hover:text-cyan-300"
              >
                Go
              </button>
            )}
          </form>

          {/* Search Dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute right-0 top-12 z-[500] w-80 max-h-64 overflow-y-auto rounded-2xl bg-slate-900 border border-cyan-500/30 shadow-2xl p-2 space-y-1">
              <div className="flex items-center justify-between px-2 py-1 text-[10px] text-slate-400 font-bold uppercase">
                <span>Matching Locations</span>
                <button onClick={() => setShowSearchResults(false)} className="hover:text-white">Close</button>
              </div>
              {searchResults.map((r, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectSearchResult(r.latitude, r.longitude)}
                  className="w-full text-left p-2 rounded-xl hover:bg-slate-800/80 text-xs transition-colors flex items-start gap-2"
                >
                  <MapPin className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{r.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{r.latitude.toFixed(2)}°, {r.longitude.toFixed(2)}° • {r.category || r.type}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Quick Presets */}
          <div className="hidden sm:flex items-center gap-1.5">
            {PRESET_LOCATIONS.slice(0, 3).map((p, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setSelectedCoords({ lat: p.lat, lon: p.lon });
                  fetchOceanData(p.lat, p.lon);
                }}
                className="px-2.5 py-1.5 rounded-xl text-[11px] font-medium bg-slate-900/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span>{p.name}</span>
              </button>
            ))}
          </div>

          {/* Layer Toggles Popover */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/80 border border-slate-800">
            <button
              onClick={() => setShowArgo(!showArgo)}
              title="Toggle Argo Floats Layer"
              className={`p-1.5 rounded-lg text-xs transition-all ${
                showArgo ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowExpeditions(!showExpeditions)}
              title="Toggle Research Expeditions Layer"
              className={`p-1.5 rounded-lg text-xs transition-all ${
                showExpeditions ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Ship className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowFeatures(!showFeatures)}
              title="Toggle Seafloor Features Layer"
              className={`p-1.5 rounded-lg text-xs transition-all ${
                showFeatures ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Mountain className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: 70% Map, 30% Details Panel on Desktop; Stacked on Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-5 min-h-[580px] lg:h-[620px]">
        {/* MAP CONTAINER (70% - 7 of 10 cols) */}
        <div className="lg:col-span-7 h-[420px] lg:h-full relative rounded-3xl overflow-hidden">
          <OceanMap
            selectedLocation={selectedCoords}
            data={oceanData}
            onMapClick={handleMapClick}
            showArgoLayer={showArgo}
            showExpeditionsLayer={showExpeditions}
            showFeaturesLayer={showFeatures}
          />
        </div>

        {/* DETAILS PANEL (30% - 3 of 10 cols) */}
        <div className="lg:col-span-3 h-[480px] lg:h-full">
          <OceanDetailsPanel
            data={oceanData}
            isLoading={isLoading}
            onSelectLocation={(lat, lon) => {
              setSelectedCoords({ lat, lon });
              fetchOceanData(lat, lon);
            }}
          />
        </div>
      </div>
    </GlassCard>
  );
};
