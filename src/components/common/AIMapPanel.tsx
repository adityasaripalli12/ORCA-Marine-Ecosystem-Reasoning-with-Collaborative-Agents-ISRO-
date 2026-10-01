/**
 * AIMapPanel — Interactive AI-controlled Leaflet map panel for ORCA.
 *
 * Renders locations from the AI response as interactive, status-coded
 * Leaflet markers on real tile layers. Auto-centers map, auto-opens
 * DeviceMarkerPopup, and handles marker click events for detailed device telemetry.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Globe, Layers, AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DeviceMarkerPopup, AILocation } from './DeviceMarkerPopup';

interface AIMapPanelProps {
  locations: AILocation[];
  intent?: string;
  onAIAnalyze?: (deviceId: string, deviceName: string) => void;
}

/* ── Custom SVG Leaflet Markers ──────────────────────────────────────────────── */

const createLeafletMarkerIcon = (status?: string, isSelected?: boolean) => {
  const s = (status || '').toLowerCase();
  let color = '#22d3ee'; // cyan default
  let shadowColor = 'rgba(34, 211, 238, 0.6)';

  if (s.includes('critical')) {
    color = '#f87171'; // rose
    shadowColor = 'rgba(248, 113, 113, 0.7)';
  } else if (s.includes('warning') || s.includes('anomaly')) {
    color = '#fbbf24'; // amber
    shadowColor = 'rgba(251, 191, 36, 0.7)';
  } else if (s.includes('offline')) {
    color = '#94a3b8'; // slate
    shadowColor = 'rgba(148, 163, 184, 0.4)';
  } else if (s.includes('online')) {
    color = '#34d399'; // emerald
    shadowColor = 'rgba(52, 211, 153, 0.7)';
  }

  const size = isSelected ? 36 : 28;
  const strokeWidth = isSelected ? '2.5' : '1.5';

  const svgContent = `
    <div style="
      background-color: #030712;
      border: ${strokeWidth}px solid ${color};
      border-radius: 50%;
      width: ${size}px;
      height: ${size}px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 ${isSelected ? 16 : 8}px ${shadowColor};
      transition: all 0.2s ease;
    ">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size - 12}" height="${size - 12}" fill="${color}" stroke="#030712" stroke-width="1.5">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        <circle cx="12" cy="9" r="2.5" fill="#ffffff"/>
      </svg>
    </div>
  `;

  return L.divIcon({
    html: svgContent,
    className: 'custom-ai-map-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size]
  });
};

/* ── Map Recenter Component ─────────────────────────────────────────────────── */

const MapRecenter: React.FC<{ lat: number; lon: number; zoom?: number }> = ({ lat, lon, zoom = 9 }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lon], zoom, { duration: 1.2 });
  }, [lat, lon, zoom, map]);
  return null;
};

/* ── Main Component ─────────────────────────────────────────────────────────── */

export const AIMapPanel: React.FC<AIMapPanelProps> = ({ locations, intent, onAIAnalyze }) => {
  const [selectedLocation, setSelectedLocation] = useState<AILocation | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mapStyle, setMapStyle] = useState<'satellite' | 'dark' | 'ocean'>('dark');

  // Auto-select first location on mount if available
  useEffect(() => {
    if (locations && locations.length > 0 && !selectedLocation) {
      setSelectedLocation(locations[0]);
    }
  }, [locations]);

  if (!locations || locations.length === 0) return null;

  // Filter valid locations (-90 <= lat <= 90 and -180 <= lon <= 180)
  const validLocations = locations.filter(
    l => l.latitude != null && l.longitude != null &&
         l.latitude >= -90 && l.latitude <= 90 &&
         l.longitude >= -180 && l.longitude <= 180
  );

  if (validLocations.length === 0) return null;

  const activeLoc = selectedLocation || validLocations[0];
  const centerLat = activeLoc.latitude;
  const centerLon = activeLoc.longitude;

  const hasDevices    = validLocations.some(l => l.deviceId);
  const hasAnomalies  = validLocations.some(l => l.anomalies && l.anomalies.length > 0);
  const criticalCount = validLocations.filter(l => (l.status || '').toLowerCase().includes('critical')).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-3 rounded-2xl bg-slate-950 border border-cyan-500/30 overflow-hidden shadow-2xl"
    >
      {/* Panel Header */}
      <div
        className="px-4 py-3 border-b border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-900/60 transition-colors"
        onClick={() => setIsCollapsed(p => !p)}
      >
        <div className="flex items-center gap-2.5 text-xs">
          <div className="w-7 h-7 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
            <Globe className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
          </div>
          <div>
            <p className="font-bold text-white flex items-center gap-2">
              Geographic Intelligence Map
              {criticalCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/25">
                  <AlertTriangle className="w-2.5 h-2.5" /> {criticalCount} Critical
                </span>
              )}
            </p>
            <p className="text-[11px] text-slate-400">
              {validLocations.length} location{validLocations.length !== 1 ? 's' : ''} • {intent === 'ANOMALY_DETECTION' ? 'Anomaly Location Map' : hasDevices ? 'Device Telemetry Map' : 'Oceanographic Map'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Map style toggle buttons */}
          <div className="hidden sm:flex items-center gap-1 p-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[10px]">
            <button
              onClick={(e) => { e.stopPropagation(); setMapStyle('dark'); }}
              className={`px-2 py-0.5 rounded ${mapStyle === 'dark' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              Cyber Dark
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setMapStyle('satellite'); }}
              className={`px-2 py-0.5 rounded ${mapStyle === 'satellite' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              Satellite
            </button>
          </div>

          <a
            href="#/visualization"
            onClick={e => e.stopPropagation()}
            className="text-[10px] font-bold px-2 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 flex items-center gap-1 transition-colors"
          >
            Full Map <ExternalLink className="w-2.5 h-2.5" />
          </a>
          {isCollapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col md:flex-row gap-0 min-h-[320px]">

              {/* ── LEAFLET MAP CONTAINER ─────────────────────────────────── */}
              <div className="relative flex-1 h-80 md:h-auto bg-[#040e1a] overflow-hidden">
                <MapContainer
                  center={[centerLat, centerLon]}
                  zoom={validLocations.length === 1 ? 9 : 4}
                  scrollWheelZoom={true}
                  attributionControl={false}
                  className="w-full h-full z-10"
                >
                  {mapStyle === 'satellite' ? (
                    <TileLayer
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                      maxZoom={18}
                    />
                  ) : mapStyle === 'ocean' ? (
                    <TileLayer
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}"
                      maxZoom={13}
                    />
                  ) : (
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                      maxZoom={19}
                    />
                  )}

                  <MapRecenter lat={centerLat} lon={centerLon} zoom={validLocations.length === 1 ? 9 : 5} />

                  {validLocations.map((loc, idx) => {
                    const isSelected = selectedLocation?.name === loc.name && selectedLocation?.latitude === loc.latitude;
                    const markerIcon = createLeafletMarkerIcon(loc.status, isSelected);

                    return (
                      <Marker
                        key={`${loc.deviceId ?? idx}-${idx}`}
                        position={[loc.latitude, loc.longitude]}
                        icon={markerIcon}
                        eventHandlers={{
                          click: () => setSelectedLocation(loc)
                        }}
                      >
                        <Popup className="ocean-map-popup">
                          <div className="p-1 space-y-1 text-xs">
                            <div className="font-bold text-cyan-400 flex items-center justify-between">
                              <span>{loc.deviceId ?? loc.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{loc.status}</span>
                            </div>
                            <p className="text-[10px] font-mono text-slate-300">
                              {loc.latitude.toFixed(4)}°N, {loc.longitude.toFixed(4)}°E
                            </p>
                            {loc.temp != null && (
                              <p className="text-[10px] text-slate-400">
                                Temp: <strong className="text-white">{loc.temp}°C</strong>
                                {loc.depth != null && ` · Depth: ${loc.depth}m`}
                              </p>
                            )}
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              </div>

              {/* ── SIDE PANEL: DeviceMarkerPopup or Location List ─────────── */}
              <div className="w-full md:w-80 shrink-0 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col bg-slate-950">
                {selectedLocation ? (
                  <DeviceMarkerPopup
                    location={selectedLocation}
                    onClose={() => setSelectedLocation(null)}
                    onAIAnalyze={onAIAnalyze}
                  />
                ) : (
                  <div className="p-4 flex flex-col gap-3 h-full">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 mb-2">
                        Map Locations ({validLocations.length})
                      </p>
                      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                        {validLocations.map((loc, idx) => (
                          <button
                            key={`${loc.deviceId ?? idx}-${idx}`}
                            onClick={() => setSelectedLocation(loc)}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/40 text-left transition-all group"
                          >
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold text-white truncate">
                                {loc.deviceId ? `${loc.deviceId} (${loc.name.split('(')[1]?.replace(')', '') || loc.name})` : loc.name}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono">
                                {loc.latitude.toFixed(4)}°N, {loc.longitude.toFixed(4)}°E
                              </p>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 font-bold border border-cyan-500/20 shrink-0">
                              Select
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Footer stats */}
            <div className="px-4 py-2 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-500 bg-slate-950">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Map Centered on {centerLat.toFixed(4)}°N, {centerLon.toFixed(4)}°E</span>
              </span>
              <span>{validLocations.length} active marker{validLocations.length !== 1 ? 's' : ''}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
