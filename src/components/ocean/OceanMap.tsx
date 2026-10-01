import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { OceanDataPayload } from './OceanDetailsPanel';
import { Radio, Ship, Mountain, MapPin, Layers, Eye, Globe, Moon } from 'lucide-react';

// Custom SVG Icons for Map Markers
const createCustomIcon = (color: string, iconType: 'pin' | 'argo' | 'ship' | 'feature') => {
  let svgContent = '';

  if (iconType === 'pin') {
    svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="34" height="34" fill="${color}" stroke="#0f172a" stroke-width="1.5">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        <circle cx="12" cy="9" r="2.5" fill="#ffffff"/>
      </svg>
    `;
  } else if (iconType === 'argo') {
    svgContent = `
      <div style="background-color: #0284c7; border: 2px solid #38bdf8; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(56, 189, 248, 0.6);">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#ffffff" stroke-width="2.5">
          <path d="M2 12h20M2 12a10 10 0 0 1 20 0M2 12a10 10 0 0 0 20 0"/>
        </svg>
      </div>
    `;
  } else if (iconType === 'ship') {
    svgContent = `
      <div style="background-color: #059669; border: 2px solid #34d399; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(52, 211, 153, 0.6);">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#ffffff" stroke-width="2.5">
          <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
          <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/>
          <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/>
          <path d="M12 1v4"/>
        </svg>
      </div>
    `;
  } else {
    svgContent = `
      <div style="background-color: #d97706; border: 2px solid #fbbf24; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(251, 191, 36, 0.6);">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#ffffff" stroke-width="2.5">
          <path d="m8 3 4 8 5-5 5 15H2L8 3z"/>
        </svg>
      </div>
    `;
  }

  return L.divIcon({
    html: svgContent,
    className: 'custom-leaflet-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28]
  });
};

const selectedPinIcon = createCustomIcon('#38bdf8', 'pin');
const argoIcon = createCustomIcon('#0284c7', 'argo');
const shipIcon = createCustomIcon('#059669', 'ship');
const featureIcon = createCustomIcon('#d97706', 'feature');

export type MapStyleOption = 'satellite' | 'dark' | 'ocean' | 'light';

interface MapProps {
  selectedLocation?: { lat: number; lon: number } | null;
  data?: OceanDataPayload | null;
  onMapClick?: (lat: number, lon: number) => void;
  onSelectLocation?: (loc: any) => void;
  showArgoLayer?: boolean;
  showExpeditionsLayer?: boolean;
  showFeaturesLayer?: boolean;
}

// Sub-component to handle map click events
const MapEventsHandler: React.FC<{ onMapClick: (lat: number, lon: number) => void }> = ({ onMapClick }) => {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

// Sub-component to fly to selected location when changed
const MapRecenter: React.FC<{ lat: number; lon: number }> = ({ lat, lon }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lon], Math.max(map.getZoom(), 4), { duration: 1.2 });
  }, [lat, lon, map]);
  return null;
};

export const OceanMap: React.FC<MapProps> = ({
  selectedLocation = null,
  data = null,
  onMapClick = () => {},
  onSelectLocation,
  showArgoLayer = true,
  showExpeditionsLayer = true,
  showFeaturesLayer = true
}) => {
  const defaultCenter: [number, number] = [12.3456, 145.6789];
  const [mapStyle, setMapStyle] = useState<MapStyleOption>('satellite');

  return (
    <div className="w-full h-full relative rounded-3xl overflow-hidden border border-cyan-500/20 shadow-2xl bg-[#080d1a]">
      {/* Floating Map Style Switcher (Satellite, Oceanic) */}
      <div className="absolute top-4 right-4 z-[400] flex flex-col items-end gap-2">
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-950/85 border border-cyan-500/30 backdrop-blur-md shadow-2xl text-[11px]">
          <button
            onClick={() => setMapStyle('satellite')}
            title="Satellite Imagery View"
            className={`px-2.5 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all ${
              mapStyle === 'satellite'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/25'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Satellite</span>
          </button>

          <button
            onClick={() => setMapStyle('ocean')}
            title="Oceanic Bathymetry View"
            className={`px-2.5 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all ${
              mapStyle === 'ocean'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/25'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Oceanic</span>
          </button>

        </div>
      </div>

      <MapContainer
        center={selectedLocation ? [selectedLocation.lat, selectedLocation.lon] : defaultCenter}
        zoom={3}
        minZoom={2}
        maxZoom={12}
        scrollWheelZoom={true}
        attributionControl={false}
        className="w-full h-full"
      >
        {/* Dynamic Basemap Tile Layer */}
        {mapStyle === 'satellite' && (
          <>
            <TileLayer
              key="satellite-base"
              attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
            <TileLayer
              key="satellite-labels"
              attribution="Labels &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          </>
        )}

        {mapStyle === 'dark' && (
          <TileLayer
            key="dark-base"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
        )}

        {mapStyle === 'ocean' && (
          <TileLayer
            key="ocean-base"
            attribution="Tiles &copy; Esri &mdash; Sources: GEBCO, NOAA, CHS, SECNAV, USGS, NASA, METI, NRCAN, GEBCO, NOAA, NGDC"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}"
            maxZoom={13}
          />
        )}

        {mapStyle === 'light' && (
          <TileLayer
            key="light-base"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
        )}

        <MapEventsHandler onMapClick={(lat, lon) => {
          if (onMapClick) onMapClick(lat, lon);
          if (onSelectLocation) {
            onSelectLocation({
              latitude: Number(lat.toFixed(4)),
              longitude: Number(lon.toFixed(4)),
              temp: 28.4,
              salinity: 34.2,
              depth: 18.5,
              name: `Marine Sector (${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E)`
            });
          }
        }} />

        {selectedLocation && (
          <MapRecenter lat={selectedLocation.lat} lon={selectedLocation.lon} />
        )}

        {/* 1. Clicked Target Marker */}
        {selectedLocation && (
          <Marker position={[selectedLocation.lat, selectedLocation.lon]} icon={selectedPinIcon}>
            <Popup className="ocean-map-popup">
              <div className="p-1 space-y-1 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-cyan-400">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Selected Coordinate</span>
                </div>
                <p className="font-mono text-slate-300">
                  {selectedLocation.lat.toFixed(4)}°, {selectedLocation.lon.toFixed(4)}°
                </p>
                {data && (
                  <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-700">
                    <p className="text-white font-semibold">{data.location.region}</p>
                    <p>Depth: <strong className="text-cyan-300">{data.bathymetry.depth_m.toLocaleString()} m</strong></p>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {/* 2. Argo Floats Layer */}
        {showArgoLayer && data?.argo_floats?.map((fl) => (
          <Marker
            key={`argo-${fl.wmo_id}`}
            position={[fl.latitude, fl.longitude]}
            icon={argoIcon}
            eventHandlers={{
              click: () => onMapClick(fl.latitude, fl.longitude)
            }}
          >
            <Popup className="ocean-map-popup">
              <div className="p-1 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-sky-400 font-bold">
                  <span className="flex items-center gap-1"><Radio className="w-3 h-3" /> Argo Float</span>
                  <span className="font-mono text-[10px]">#{fl.wmo_id}</span>
                </div>
                <div className="text-[11px] text-slate-300 space-y-0.5">
                  <p>Type: <strong>{fl.platform_type}</strong></p>
                  <p>Cycle: <strong>#{fl.cycle_number}</strong> ({fl.max_depth_m}m)</p>
                  <p>Distance: <strong>{fl.distance_km} km</strong></p>
                  <p className="text-[10px] text-slate-400">Obs: {fl.last_observation}</p>
                </div>
                <button
                  onClick={() => onMapClick(fl.latitude, fl.longitude)}
                  className="w-full mt-1 py-1 rounded bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 text-[10px] font-bold"
                >
                  Inspect Water Profile →
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* 3. Research Expeditions Layer */}
        {showExpeditionsLayer && data?.research_expeditions?.map((exp, idx) => (
          <Marker
            key={`exp-${idx}`}
            position={[exp.latitude, exp.longitude]}
            icon={shipIcon}
            eventHandlers={{
              click: () => onMapClick(exp.latitude, exp.longitude)
            }}
          >
            <Popup className="ocean-map-popup">
              <div className="p-1 space-y-1.5 text-xs">
                <div className="flex items-center gap-1 font-bold text-emerald-400">
                  <Ship className="w-3 h-3" />
                  <span>{exp.vessel}</span>
                </div>
                <p className="text-[11px] text-slate-300">{exp.expedition_name}</p>
                <div className="text-[10px] text-slate-400 space-y-0.5">
                  <p>Year: {exp.year} • {exp.institution}</p>
                  <p>Distance: {exp.distance_km} km</p>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* 4. Seafloor Features Layer */}
        {showFeaturesLayer && data?.seafloor_features?.map((feat, idx) => (
          <Marker
            key={`feat-${idx}`}
            position={[feat.latitude, feat.longitude]}
            icon={featureIcon}
            eventHandlers={{
              click: () => onMapClick(feat.latitude, feat.longitude)
            }}
          >
            <Popup className="ocean-map-popup">
              <div className="p-1 space-y-1.5 text-xs">
                <div className="flex items-center gap-1 font-bold text-amber-400">
                  <Mountain className="w-3 h-3" />
                  <span>{feat.name}</span>
                </div>
                <p className="text-[11px] text-slate-300">{feat.type} ({feat.depth_m.toLocaleString()} m depth)</p>
                <p className="text-[10px] text-slate-400">{feat.description}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Floating Map Legend */}
      <div className="absolute bottom-4 left-4 z-[400] p-2.5 rounded-2xl bg-slate-950/85 border border-slate-800/90 backdrop-blur-md shadow-xl text-[11px] flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
          <span className="text-slate-300">Selected Point</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
          <span className="text-slate-300">Argo Float</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span className="text-slate-300">Research Cruise</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          <span className="text-slate-300">Seafloor Feature</span>
        </div>
      </div>
    </div>
  );
};
