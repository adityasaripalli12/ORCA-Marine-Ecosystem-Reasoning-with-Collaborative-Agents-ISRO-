// ─── Device Module Type Definitions ───────────────────────────────────────────

/* ── Enums ── */

export type DeviceStatus = 'online' | 'offline' | 'warning' | 'critical';

export type DeviceType =
  | 'IoT Sensor'
  | 'Environmental Monitor'
  | 'Security Camera'
  | 'Field Device'
  | 'Gateway'
  | 'Edge Node'
  | 'Weather Station'
  | 'Marine Buoy';

export type EventType =
  | 'DEVICE_CONNECTED'
  | 'DEVICE_DISCONNECTED'
  | 'DEVICE_OFFLINE'
  | 'LOCATION_UPDATED'
  | 'TEMPERATURE_CHANGE'
  | 'BATTERY_WARNING'
  | 'BATTERY_CRITICAL'
  | 'SIGNAL_CHANGE'
  | 'ANOMALY_DETECTED'
  | 'FIRMWARE_UPDATE'
  | 'CONFIG_CHANGE'
  | 'DEVICE_RESTARTED'
  | 'DEVICE_DISABLED'
  | 'DEVICE_ENABLED'
  | 'NETWORK_CHANGE'
  | 'SENSOR_READING'
  | 'SYSTEM_ALERT';

export type EventCategory =
  | 'system'
  | 'location'
  | 'battery'
  | 'temperature'
  | 'network'
  | 'alerts'
  | 'anomalies';

export type SeverityLevel = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type AnomalyType =
  | 'Temperature Spike'
  | 'Temperature Drop'
  | 'Battery Drain'
  | 'Signal Loss'
  | 'CPU Overload'
  | 'RAM Exhaustion'
  | 'Network Anomaly'
  | 'Location Drift'
  | 'Connectivity Loss'
  | 'Sensor Malfunction';

export type AnomalyStatus = 'new' | 'investigating' | 'resolved' | 'ignored';

/* ── Device Group ── */

export interface DeviceGroup {
  id: string;
  name: string;
  description: string;
  color: string;        // tailwind-friendly color key e.g. 'cyan', 'amber'
  deviceCount: number;
}

/* ── Hardware Device ── */

export interface HardwareDevice {
  id: string;           // DEV-001
  name: string;
  type: DeviceType;
  status: DeviceStatus;

  // Telemetry
  batteryLevel: number;         // 0-100 %
  signalStrength: number;       // 0-100 %
  temperature: number;          // °C
  cpuUsage: number;             // 0-100 %
  ramUsage: number;             // 0-100 %
  networkTraffic: number;       // KB/s

  // Location
  latitude: number;
  longitude: number;
  locationEnabled: boolean;

  // Metadata
  firmwareVersion: string;
  assignedUser: string;         // user email
  groupId: string;              // references DeviceGroup.id
  description: string;
  lastSeen: string;             // ISO timestamp
  createdAt: string;            // ISO timestamp

  // Computed helpers
  isDisabled?: boolean;
}

/* ── Device Event (Timeline entry) ── */

export interface DeviceEvent {
  id: string;
  deviceId: string;
  timestamp: string;            // ISO timestamp
  eventType: EventType;
  category: EventCategory;
  title: string;
  value?: string;               // e.g. "41°C", "18%", "17.6868, 83.2185"
  severity: SeverityLevel;
  description: string;
  source: string;               // e.g. "Telemetry Engine", "Anomaly Detection", "User Action"
  latitude?: number;
  longitude?: number;
  relatedAnomalyId?: string;    // links to an anomaly record
}

/* ── Anomaly ── */

export interface Anomaly {
  id: string;
  deviceId: string;
  detectedAt: string;           // ISO timestamp
  anomalyType: AnomalyType;
  currentValue: string;         // e.g. "58°C"
  expectedRange: string;        // e.g. "28°C – 38°C"
  severity: SeverityLevel;
  confidence: number;           // 0-100
  explanation: string;
  possibleCauses: string[];
  recommendedAction: string;
  status: AnomalyStatus;
  resolvedAt?: string;
  resolvedBy?: string;
}

/* ── Anomaly Alert ── */

export interface AnomalyAlert {
  id: string;
  anomalyId: string;
  deviceId: string;
  title: string;
  message: string;
  severity: SeverityLevel;
  createdAt: string;
  isRead: boolean;
}

/* ── Severity styling helper ── */

export const SEVERITY_CONFIG: Record<SeverityLevel, {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  dotColor: string;
}> = {
  info: {
    label: 'Info',
    bgClass: 'bg-slate-500/10',
    textClass: 'text-slate-400',
    borderClass: 'border-slate-500/30',
    dotColor: 'bg-slate-400',
  },
  low: {
    label: 'Low',
    bgClass: 'bg-cyan-500/10',
    textClass: 'text-cyan-400',
    borderClass: 'border-cyan-500/30',
    dotColor: 'bg-cyan-400',
  },
  medium: {
    label: 'Medium',
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500/30',
    dotColor: 'bg-amber-400',
  },
  high: {
    label: 'High',
    bgClass: 'bg-orange-500/10',
    textClass: 'text-orange-400',
    borderClass: 'border-orange-500/30',
    dotColor: 'bg-orange-400',
  },
  critical: {
    label: 'Critical',
    bgClass: 'bg-rose-500/10',
    textClass: 'text-rose-400',
    borderClass: 'border-rose-500/30',
    dotColor: 'bg-rose-400',
  },
};

/* ── Device Status styling helper ── */

export const DEVICE_STATUS_CONFIG: Record<DeviceStatus, {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  dotColor: string;
  pulse: boolean;
}> = {
  online: {
    label: 'Online',
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/30',
    dotColor: 'bg-emerald-400',
    pulse: true,
  },
  offline: {
    label: 'Offline',
    bgClass: 'bg-slate-500/10',
    textClass: 'text-slate-400',
    borderClass: 'border-slate-500/30',
    dotColor: 'bg-slate-500',
    pulse: false,
  },
  warning: {
    label: 'Warning',
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500/30',
    dotColor: 'bg-amber-400',
    pulse: true,
  },
  critical: {
    label: 'Critical',
    bgClass: 'bg-rose-500/10',
    textClass: 'text-rose-400',
    borderClass: 'border-rose-500/30',
    dotColor: 'bg-rose-400',
    pulse: true,
  },
};

/* ── Event Type → Category mapping ── */

export const EVENT_CATEGORY_MAP: Record<EventType, EventCategory> = {
  DEVICE_CONNECTED: 'system',
  DEVICE_DISCONNECTED: 'system',
  DEVICE_OFFLINE: 'system',
  DEVICE_RESTARTED: 'system',
  DEVICE_DISABLED: 'system',
  DEVICE_ENABLED: 'system',
  CONFIG_CHANGE: 'system',
  FIRMWARE_UPDATE: 'system',
  LOCATION_UPDATED: 'location',
  TEMPERATURE_CHANGE: 'temperature',
  BATTERY_WARNING: 'battery',
  BATTERY_CRITICAL: 'battery',
  SIGNAL_CHANGE: 'network',
  NETWORK_CHANGE: 'network',
  ANOMALY_DETECTED: 'anomalies',
  SENSOR_READING: 'temperature',
  SYSTEM_ALERT: 'alerts',
};

/* ── Event Type display config ── */

export const EVENT_TYPE_CONFIG: Record<EventType, {
  label: string;
  icon: string; // lucide icon name (used with a lookup)
  defaultSeverity: SeverityLevel;
}> = {
  DEVICE_CONNECTED:    { label: 'Device Connected',    icon: 'Wifi',          defaultSeverity: 'info' },
  DEVICE_DISCONNECTED: { label: 'Device Disconnected', icon: 'WifiOff',       defaultSeverity: 'medium' },
  DEVICE_OFFLINE:      { label: 'Device Offline',      icon: 'PowerOff',      defaultSeverity: 'high' },
  LOCATION_UPDATED:    { label: 'Location Updated',    icon: 'MapPin',        defaultSeverity: 'info' },
  TEMPERATURE_CHANGE:  { label: 'Temperature Change',  icon: 'Thermometer',   defaultSeverity: 'low' },
  BATTERY_WARNING:     { label: 'Battery Warning',     icon: 'BatteryLow',    defaultSeverity: 'medium' },
  BATTERY_CRITICAL:    { label: 'Battery Critical',    icon: 'BatteryWarning',defaultSeverity: 'high' },
  SIGNAL_CHANGE:       { label: 'Signal Change',       icon: 'Signal',        defaultSeverity: 'low' },
  ANOMALY_DETECTED:    { label: 'Anomaly Detected',    icon: 'AlertTriangle', defaultSeverity: 'high' },
  FIRMWARE_UPDATE:     { label: 'Firmware Update',     icon: 'Download',      defaultSeverity: 'info' },
  CONFIG_CHANGE:       { label: 'Config Change',       icon: 'Settings',      defaultSeverity: 'low' },
  DEVICE_RESTARTED:    { label: 'Device Restarted',    icon: 'RotateCcw',     defaultSeverity: 'medium' },
  DEVICE_DISABLED:     { label: 'Device Disabled',     icon: 'Ban',           defaultSeverity: 'medium' },
  DEVICE_ENABLED:      { label: 'Device Enabled',      icon: 'CheckCircle2',  defaultSeverity: 'info' },
  NETWORK_CHANGE:      { label: 'Network Change',      icon: 'Globe',         defaultSeverity: 'low' },
  SENSOR_READING:      { label: 'Sensor Reading',      icon: 'Activity',      defaultSeverity: 'info' },
  SYSTEM_ALERT:        { label: 'System Alert',        icon: 'Bell',          defaultSeverity: 'medium' },
};
