import React, { useState, useMemo } from 'react';
import {
  Search, Filter, ArrowUpDown, Download, MapPin, Clock,
  Wifi, WifiOff, PowerOff, Thermometer, BatteryLow, BatteryWarning,
  Signal, AlertTriangle, Download as DownloadIcon, Settings, RotateCcw,
  Ban, CheckCircle2, Globe, Activity, Bell, Calendar,
} from 'lucide-react';
import { DeviceEvent, EventCategory, SeverityLevel, SEVERITY_CONFIG, EVENT_TYPE_CONFIG, EventType } from '../../types/devices';

/* ── Icon lookup by event type ── */
const ICON_MAP: Record<string, React.ElementType> = {
  Wifi, WifiOff, PowerOff, MapPin, Thermometer, BatteryLow, BatteryWarning,
  Signal, AlertTriangle, Download: DownloadIcon, Settings, RotateCcw,
  Ban, CheckCircle2, Globe, Activity, Bell,
};

const getIcon = (eventType: EventType): React.ElementType => {
  const cfg = EVENT_TYPE_CONFIG[eventType];
  return ICON_MAP[cfg?.icon] || Activity;
};

/* ── Filter tabs ── */
const FILTER_TABS: { key: EventCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'system', label: 'System' },
  { key: 'location', label: 'Location' },
  { key: 'battery', label: 'Battery' },
  { key: 'temperature', label: 'Temperature' },
  { key: 'network', label: 'Network' },
  { key: 'alerts', label: 'Alerts' },
  { key: 'anomalies', label: 'Anomalies' },
];

interface Props {
  events: DeviceEvent[];
  showDeviceId?: boolean;
  onViewOnMap?: (lat: number, lng: number) => void;
}

export const DeviceTimeline: React.FC<Props> = ({ events, showDeviceId = false, onViewOnMap }) => {
  const [activeFilter, setActiveFilter] = useState<EventCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest'>('latest');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filtered = useMemo(() => {
    let result = [...events];

    // Category filter
    if (activeFilter !== 'all') {
      result = result.filter(e => e.category === activeFilter);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.deviceId.toLowerCase().includes(q) ||
        (e.value && e.value.toLowerCase().includes(q))
      );
    }

    // Date filter
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      result = result.filter(e => new Date(e.timestamp).getTime() >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86400000; // include full day
      result = result.filter(e => new Date(e.timestamp).getTime() <= to);
    }

    // Sort
    result.sort((a, b) => {
      const diff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      return sortOrder === 'latest' ? diff : -diff;
    });

    return result;
  }, [events, activeFilter, searchQuery, sortOrder, dateFrom, dateTo]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleExport = () => {
    const csv = [
      'Timestamp,Event Type,Title,Device ID,Value,Severity,Description,Source',
      ...filtered.map(e =>
        `"${e.timestamp}","${e.eventType}","${e.title}","${e.deviceId}","${e.value || ''}","${e.severity}","${e.description}","${e.source}"`
      )
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `device-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Group events by date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, DeviceEvent[]> = {};
    filtered.forEach(e => {
      const dateKey = formatDate(e.timestamp);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(e);
    });
    return groups;
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text" value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search events..."
            className="w-full pl-9 pr-3 py-2 rounded-xl text-xs glass-input placeholder-slate-500"
          />
        </div>

        {/* Date filters */}
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg text-[11px] glass-input" />
          <span className="text-[10px] text-slate-500">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg text-[11px] glass-input" />
        </div>

        {/* Sort + Export */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setSortOrder(s => s === 'latest' ? 'oldest' : 'latest')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold text-slate-300 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700 transition-colors"
          >
            <ArrowUpDown className="w-3 h-3" />
            {sortOrder === 'latest' ? 'Latest' : 'Oldest'}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 transition-colors"
          >
            <Download className="w-3 h-3" /> Export
          </button>
        </div>
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex flex-wrap gap-1.5">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all ${
              activeFilter === tab.key
                ? 'bg-gradient-to-r from-ocean-600 to-cyan-600 text-white shadow-lg shadow-cyan-500/20'
                : 'text-slate-400 bg-slate-800/40 hover:bg-slate-700/60 border border-slate-700/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Timeline ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Clock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-400">No events found</p>
          <p className="text-xs text-slate-500 mt-1">Try adjusting your filters or date range.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByDate).map(([date, dateEvents]) => (
            <div key={date}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{date}</span>
                <div className="flex-1 h-px bg-slate-800/80" />
                <span className="text-[10px] font-mono text-slate-500">{dateEvents.length} event{dateEvents.length > 1 ? 's' : ''}</span>
              </div>

              {/* Events */}
              <div className="relative pl-6 border-l-2 border-slate-800/80 space-y-3 ml-2">
                {dateEvents.map((event) => {
                  const Icon = getIcon(event.eventType);
                  const sevCfg = SEVERITY_CONFIG[event.severity];

                  return (
                    <div key={event.id} className="relative group">
                      {/* Timeline dot */}
                      <div className={`absolute -left-[33px] top-3 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${sevCfg.dotColor} z-10`} />

                      {/* Event card */}
                      <div className="glass-panel rounded-xl p-4 border border-slate-800/60 hover:border-slate-700/80 transition-colors">
                        <div className="flex items-start gap-3">
                          {/* Icon */}
                          <div className={`p-2 rounded-lg shrink-0 ${sevCfg.bgClass}`}>
                            <Icon className={`w-4 h-4 ${sevCfg.textClass}`} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-white">{event.title}</span>
                              {showDeviceId && (
                                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
                                  {event.deviceId}
                                </span>
                              )}
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sevCfg.bgClass} ${sevCfg.textClass} border ${sevCfg.borderClass}`}>
                                {sevCfg.label.toUpperCase()}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{event.description}</p>

                            {event.value && (
                              <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/60 border border-slate-800">
                                <span className="text-[10px] text-slate-500">Value:</span>
                                <span className="text-[11px] font-bold font-mono text-white">{event.value}</span>
                              </div>
                            )}

                            <div className="flex items-center gap-3 mt-2.5 text-[10px] text-slate-500">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {formatTime(event.timestamp)}
                              </span>
                              <span>Source: {event.source}</span>
                              {event.latitude && event.longitude && onViewOnMap && (
                                <button
                                  onClick={() => onViewOnMap(event.latitude!, event.longitude!)}
                                  className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors font-semibold"
                                >
                                  <MapPin className="w-3 h-3" /> View on Map
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
