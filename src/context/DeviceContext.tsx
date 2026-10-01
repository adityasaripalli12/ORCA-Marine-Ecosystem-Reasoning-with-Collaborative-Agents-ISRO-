import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import {
  HardwareDevice, DeviceGroup, DeviceEvent, Anomaly, AnomalyAlert,
  DeviceStatus, DeviceType, EventType, SeverityLevel, AnomalyType,
  AnomalyStatus, EVENT_CATEGORY_MAP,
} from '../types/devices';

/* ════════════════════════════════════════════════════════════════════════════
   Context Interface
   ════════════════════════════════════════════════════════════════════════════ */

interface DeviceContextType {
  // Data
  devices: HardwareDevice[];
  deviceGroups: DeviceGroup[];
  deviceEvents: DeviceEvent[];
  anomalies: Anomaly[];
  alerts: AnomalyAlert[];

  // Device CRUD
  addDevice: (device: Omit<HardwareDevice, 'id' | 'createdAt' | 'lastSeen'>) => void;
  updateDevice: (id: string, updates: Partial<HardwareDevice>) => void;
  deleteDevice: (id: string) => void;
  disableDevice: (id: string) => void;
  enableDevice: (id: string) => void;
  restartDevice: (id: string) => void;
  assignUserToDevice: (deviceId: string, userEmail: string) => void;
  assignGroupToDevice: (deviceId: string, groupId: string) => void;

  // Events
  addDeviceEvent: (event: Omit<DeviceEvent, 'id'>) => void;
  getDeviceEvents: (deviceId: string) => DeviceEvent[];

  // Anomalies
  getDeviceAnomalies: (deviceId: string) => Anomaly[];
  resolveAnomaly: (id: string, resolvedBy: string) => void;
  ignoreAnomaly: (id: string) => void;
  investigateAnomaly: (id: string) => void;
  markAlertRead: (id: string) => void;

  // Analysis
  runAnomalyDetection: () => void;
}

/* ════════════════════════════════════════════════════════════════════════════
   Helper — unique ID generator
   ════════════════════════════════════════════════════════════════════════════ */

const uid = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

/* ════════════════════════════════════════════════════════════════════════════
   Mock Data — Device Groups
   ════════════════════════════════════════════════════════════════════════════ */

const initialGroups: DeviceGroup[] = [
  { id: 'grp-dev',  name: 'Development',  description: 'Development and testing devices',    color: 'cyan',    deviceCount: 2 },
  { id: 'grp-sec',  name: 'Security',     description: 'Security monitoring devices',        color: 'rose',    deviceCount: 2 },
  { id: 'grp-iot',  name: 'IoT Lab',      description: 'IoT research laboratory devices',    color: 'violet',  deviceCount: 2 },
  { id: 'grp-fld',  name: 'Field Devices', description: 'Deployed field monitoring devices', color: 'amber',   deviceCount: 2 },
];

/* ════════════════════════════════════════════════════════════════════════════
   Mock Data — Devices
   ════════════════════════════════════════════════════════════════════════════ */

const now = new Date();
const mins = (m: number) => new Date(now.getTime() - m * 60000).toISOString();

const initialDevices: HardwareDevice[] = [
  {
    id: 'DEV-001', name: 'Alpha Sensor Node',  type: 'IoT Sensor',
    status: 'online', batteryLevel: 84, signalStrength: 92, temperature: 31,
    cpuUsage: 22, ramUsage: 38, networkTraffic: 14.2,
    latitude: 17.6868, longitude: 83.2185, locationEnabled: true,
    firmwareVersion: 'v3.2.1', assignedUser: 'research@gmail.com', groupId: 'grp-dev',
    description: 'Primary environmental sensor node deployed in coastal lab.',
    lastSeen: mins(0.2), createdAt: '2026-07-15T08:00:00Z',
  },
  {
    id: 'DEV-002', name: 'Beta Gateway Hub', type: 'Gateway',
    status: 'online', batteryLevel: 97, signalStrength: 98, temperature: 28,
    cpuUsage: 45, ramUsage: 62, networkTraffic: 128.5,
    latitude: 17.6870, longitude: 83.2190, locationEnabled: true,
    firmwareVersion: 'v4.0.0', assignedUser: 'admin@gmail.com', groupId: 'grp-dev',
    description: 'Central gateway aggregating telemetry from field sensors.',
    lastSeen: mins(0.5), createdAt: '2026-06-20T10:00:00Z',
  },
  {
    id: 'DEV-003', name: 'Perimeter Cam-01', type: 'Security Camera',
    status: 'online', batteryLevel: 72, signalStrength: 85, temperature: 34,
    cpuUsage: 55, ramUsage: 71, networkTraffic: 340.0,
    latitude: 17.6865, longitude: 83.2178, locationEnabled: true,
    firmwareVersion: 'v2.8.4', assignedUser: 'admin@gmail.com', groupId: 'grp-sec',
    description: 'HD security camera monitoring north perimeter.',
    lastSeen: mins(1), createdAt: '2026-05-10T14:00:00Z',
  },
  {
    id: 'DEV-004', name: 'Thermal Monitor X4', type: 'Environmental Monitor',
    status: 'critical', batteryLevel: 18, signalStrength: 45, temperature: 58,
    cpuUsage: 89, ramUsage: 92, networkTraffic: 2.1,
    latitude: 17.6850, longitude: 83.2200, locationEnabled: true,
    firmwareVersion: 'v3.1.0', assignedUser: 'research@gmail.com', groupId: 'grp-iot',
    description: 'High-precision thermal monitor showing abnormal readings.',
    lastSeen: mins(6), createdAt: '2026-07-01T09:00:00Z',
  },
  {
    id: 'DEV-005', name: 'Marine Buoy S-7', type: 'Marine Buoy',
    status: 'online', batteryLevel: 66, signalStrength: 58, temperature: 24,
    cpuUsage: 12, ramUsage: 24, networkTraffic: 4.8,
    latitude: 17.7200, longitude: 83.3100, locationEnabled: true,
    firmwareVersion: 'v2.5.0', assignedUser: 'govp@gmail.com', groupId: 'grp-fld',
    description: 'Offshore marine buoy for ocean surface monitoring.',
    lastSeen: mins(3), createdAt: '2026-04-22T06:00:00Z',
  },
  {
    id: 'DEV-006', name: 'Weather Station W2', type: 'Weather Station',
    status: 'warning', batteryLevel: 32, signalStrength: 74, temperature: 36,
    cpuUsage: 34, ramUsage: 48, networkTraffic: 8.4,
    latitude: 17.6900, longitude: 83.2250, locationEnabled: true,
    firmwareVersion: 'v3.0.2', assignedUser: 'research@gmail.com', groupId: 'grp-fld',
    description: 'Automated weather station with low battery warning.',
    lastSeen: mins(2), createdAt: '2026-03-18T12:00:00Z',
  },
  {
    id: 'DEV-007', name: 'Edge Compute Node E1', type: 'Edge Node',
    status: 'offline', batteryLevel: 0, signalStrength: 0, temperature: 22,
    cpuUsage: 0, ramUsage: 0, networkTraffic: 0,
    latitude: 17.6860, longitude: 83.2170, locationEnabled: false,
    firmwareVersion: 'v1.9.8', assignedUser: 'student@gmail.com', groupId: 'grp-iot',
    description: 'Edge compute node — currently offline for maintenance.',
    lastSeen: '2026-08-25T18:30:00Z', createdAt: '2026-02-10T16:00:00Z',
  },
  {
    id: 'DEV-008', name: 'Intrusion Detector ID-3', type: 'Security Camera',
    status: 'online', batteryLevel: 91, signalStrength: 88, temperature: 29,
    cpuUsage: 30, ramUsage: 45, networkTraffic: 56.2,
    latitude: 17.6875, longitude: 83.2195, locationEnabled: true,
    firmwareVersion: 'v2.8.4', assignedUser: 'admin@gmail.com', groupId: 'grp-sec',
    description: 'Motion-activated intrusion detection camera — south entrance.',
    lastSeen: mins(0.8), createdAt: '2026-06-05T11:00:00Z',
  },
];

/* ════════════════════════════════════════════════════════════════════════════
   Mock Data — Device Events
   ════════════════════════════════════════════════════════════════════════════ */

const initialEvents: DeviceEvent[] = [
  // DEV-001 events
  { id: 'evt-001', deviceId: 'DEV-001', timestamp: mins(120), eventType: 'DEVICE_CONNECTED', category: 'system', title: 'Device Connected', severity: 'info', description: 'Device DEV-001 connected successfully.', source: 'System' },
  { id: 'evt-002', deviceId: 'DEV-001', timestamp: mins(90), eventType: 'LOCATION_UPDATED', category: 'location', title: 'Location Updated', value: '17.6868, 83.2185', severity: 'info', description: 'GPS coordinates updated. Latitude: 17.6868, Longitude: 83.2185', source: 'GPS Module', latitude: 17.6868, longitude: 83.2185 },
  { id: 'evt-003', deviceId: 'DEV-001', timestamp: mins(60), eventType: 'TEMPERATURE_CHANGE', category: 'temperature', title: 'Temperature Change', value: '31°C', severity: 'low', description: 'Temperature stabilized at 31°C within normal operating range.', source: 'Telemetry Engine' },
  { id: 'evt-004', deviceId: 'DEV-001', timestamp: mins(30), eventType: 'FIRMWARE_UPDATE', category: 'system', title: 'Firmware Updated', value: 'v3.2.1', severity: 'info', description: 'Firmware successfully updated to v3.2.1.', source: 'OTA Service' },

  // DEV-002 events
  { id: 'evt-005', deviceId: 'DEV-002', timestamp: mins(180), eventType: 'DEVICE_CONNECTED', category: 'system', title: 'Device Connected', severity: 'info', description: 'Gateway DEV-002 connected to network.', source: 'System' },
  { id: 'evt-006', deviceId: 'DEV-002', timestamp: mins(60), eventType: 'NETWORK_CHANGE', category: 'network', title: 'Network Throughput Spike', value: '128.5 KB/s', severity: 'low', description: 'Network traffic increased to 128.5 KB/s — aggregating field sensor data.', source: 'Network Monitor' },

  // DEV-003 events
  { id: 'evt-007', deviceId: 'DEV-003', timestamp: mins(240), eventType: 'DEVICE_CONNECTED', category: 'system', title: 'Device Connected', severity: 'info', description: 'Camera DEV-003 online and streaming.', source: 'System' },
  { id: 'evt-008', deviceId: 'DEV-003', timestamp: mins(45), eventType: 'SENSOR_READING', category: 'temperature', title: 'Motion Detected', value: 'Zone A', severity: 'low', description: 'Motion activity detected in perimeter Zone A.', source: 'Motion Sensor' },

  // DEV-004 events — the problematic device
  { id: 'evt-009', deviceId: 'DEV-004', timestamp: mins(180), eventType: 'DEVICE_CONNECTED', category: 'system', title: 'Device Connected', severity: 'info', description: 'Device DEV-004 connected successfully.', source: 'System' },
  { id: 'evt-010', deviceId: 'DEV-004', timestamp: mins(150), eventType: 'LOCATION_UPDATED', category: 'location', title: 'Location Updated', value: '17.6850, 83.2200', severity: 'info', description: 'Latitude: 17.6850, Longitude: 83.2200', source: 'GPS Module', latitude: 17.6850, longitude: 83.2200 },
  { id: 'evt-011', deviceId: 'DEV-004', timestamp: mins(90), eventType: 'TEMPERATURE_CHANGE', category: 'temperature', title: 'Temperature Increase', value: '41°C', severity: 'medium', description: 'Temperature increased from 32°C to 41°C.', source: 'Telemetry Engine' },
  { id: 'evt-012', deviceId: 'DEV-004', timestamp: mins(60), eventType: 'BATTERY_WARNING', category: 'battery', title: 'Battery Warning', value: '18%', severity: 'medium', description: 'Battery dropped to 18%. Recommend charging or replacement.', source: 'Power Monitor' },
  { id: 'evt-013', deviceId: 'DEV-004', timestamp: mins(45), eventType: 'TEMPERATURE_CHANGE', category: 'temperature', title: 'Temperature Spike', value: '58°C', severity: 'high', description: 'Temperature spiked to 58°C — well above normal range (28–38°C).', source: 'Telemetry Engine' },
  { id: 'evt-014', deviceId: 'DEV-004', timestamp: mins(40), eventType: 'ANOMALY_DETECTED', category: 'anomalies', title: 'Anomaly Detected — Temperature Spike', value: '58°C (expected 28–38°C)', severity: 'critical', description: 'AI anomaly detection identified abnormal temperature increase. Confidence: 94%. Severity: CRITICAL. Inspect device immediately.', source: 'Anomaly Detection Engine', relatedAnomalyId: 'anom-001' },
  { id: 'evt-015', deviceId: 'DEV-004', timestamp: mins(35), eventType: 'SYSTEM_ALERT', category: 'alerts', title: 'Critical Alert Generated', severity: 'critical', description: 'Critical alert dispatched for DEV-004 temperature anomaly. All assigned users notified.', source: 'Alert Service' },

  // DEV-005 events
  { id: 'evt-016', deviceId: 'DEV-005', timestamp: mins(300), eventType: 'DEVICE_CONNECTED', category: 'system', title: 'Device Connected', severity: 'info', description: 'Marine buoy DEV-005 connected via satellite link.', source: 'System' },
  { id: 'evt-017', deviceId: 'DEV-005', timestamp: mins(60), eventType: 'LOCATION_UPDATED', category: 'location', title: 'Location Updated', value: '17.7200, 83.3100', severity: 'info', description: 'Buoy drifted to 17.7200, 83.3100 — within expected range.', source: 'GPS Module', latitude: 17.7200, longitude: 83.3100 },

  // DEV-006 events
  { id: 'evt-018', deviceId: 'DEV-006', timestamp: mins(200), eventType: 'DEVICE_CONNECTED', category: 'system', title: 'Device Connected', severity: 'info', description: 'Weather station DEV-006 online.', source: 'System' },
  { id: 'evt-019', deviceId: 'DEV-006', timestamp: mins(75), eventType: 'BATTERY_WARNING', category: 'battery', title: 'Battery Warning', value: '32%', severity: 'medium', description: 'Battery level at 32%. Solar recharge cycle expected at dawn.', source: 'Power Monitor' },
  { id: 'evt-020', deviceId: 'DEV-006', timestamp: mins(30), eventType: 'ANOMALY_DETECTED', category: 'anomalies', title: 'Anomaly Detected — Battery Drain', value: '32% (expected >50%)', severity: 'high', description: 'Battery draining faster than expected. Rate: -4%/hr vs normal -1%/hr.', source: 'Anomaly Detection Engine', relatedAnomalyId: 'anom-003' },

  // DEV-007 events
  { id: 'evt-021', deviceId: 'DEV-007', timestamp: '2026-08-25T18:30:00Z', eventType: 'DEVICE_OFFLINE', category: 'system', title: 'Device Offline', severity: 'high', description: 'Edge node DEV-007 stopped sending telemetry. Last known state: maintenance mode.', source: 'System' },

  // DEV-008 events
  { id: 'evt-022', deviceId: 'DEV-008', timestamp: mins(160), eventType: 'DEVICE_CONNECTED', category: 'system', title: 'Device Connected', severity: 'info', description: 'Intrusion detector DEV-008 online.', source: 'System' },
  { id: 'evt-023', deviceId: 'DEV-008', timestamp: mins(20), eventType: 'SENSOR_READING', category: 'temperature', title: 'All Clear', value: 'No motion', severity: 'info', description: 'No motion detected in monitored zone — routine check.', source: 'Motion Sensor' },
];

/* ════════════════════════════════════════════════════════════════════════════
   Mock Data — Anomalies
   ════════════════════════════════════════════════════════════════════════════ */

const initialAnomalies: Anomaly[] = [
  {
    id: 'anom-001', deviceId: 'DEV-004', detectedAt: mins(40),
    anomalyType: 'Temperature Spike', currentValue: '58°C', expectedRange: '28°C – 38°C',
    severity: 'critical', confidence: 94,
    explanation: 'Temperature increased rapidly from 31°C to 58°C within 45 minutes. This exceeds the normal operating range by 20°C and indicates potential hardware overheating.',
    possibleCauses: ['Hardware overheating', 'Cooling system failure', 'Abnormal processing workload', 'Direct sunlight exposure'],
    recommendedAction: 'Inspect the device immediately. Check cooling fans and ambient temperature. Consider shutting down to prevent permanent damage.',
    status: 'new',
  },
  {
    id: 'anom-002', deviceId: 'DEV-004', detectedAt: mins(60),
    anomalyType: 'Battery Drain', currentValue: '18%', expectedRange: '40% – 100%',
    severity: 'high', confidence: 88,
    explanation: 'Battery dropped from 65% to 18% in approximately 2 hours. Normal discharge rate is ~2%/hr, observed rate is ~23%/hr.',
    possibleCauses: ['High CPU workload draining power', 'Battery cell degradation', 'Faulty charge controller', 'Power-hungry sensor in continuous mode'],
    recommendedAction: 'Connect external power supply. Schedule battery replacement if drain persists after workload reduction.',
    status: 'investigating',
  },
  {
    id: 'anom-003', deviceId: 'DEV-006', detectedAt: mins(30),
    anomalyType: 'Battery Drain', currentValue: '32%', expectedRange: '50% – 100%',
    severity: 'high', confidence: 82,
    explanation: 'Battery draining at 4%/hr instead of normal 1%/hr. Solar panel recharge not compensating for consumption rate.',
    possibleCauses: ['Solar panel obstruction', 'Increased sensor polling rate', 'Firmware bug causing wake-lock', 'Cold temperature reducing capacity'],
    recommendedAction: 'Inspect solar panel for obstruction or damage. Check firmware for excessive wake cycles.',
    status: 'new',
  },
  {
    id: 'anom-004', deviceId: 'DEV-004', detectedAt: mins(38),
    anomalyType: 'CPU Overload', currentValue: '89%', expectedRange: '10% – 50%',
    severity: 'high', confidence: 91,
    explanation: 'CPU usage sustained at 89% for over 30 minutes. Normal idle is 15-25%. Correlated with temperature spike.',
    possibleCauses: ['Runaway process', 'Malware or unauthorized computation', 'Sensor data processing backlog', 'Firmware bug in data aggregation loop'],
    recommendedAction: 'Remote shell into device and identify the process. Force-kill runaway tasks. Restart device if needed.',
    status: 'new',
  },
  {
    id: 'anom-005', deviceId: 'DEV-007', detectedAt: '2026-08-25T18:25:00Z',
    anomalyType: 'Connectivity Loss', currentValue: '0% signal', expectedRange: '60% – 100%',
    severity: 'medium', confidence: 96,
    explanation: 'Device completely lost connectivity. No telemetry data received since 2026-08-25 18:30 UTC.',
    possibleCauses: ['Network adapter failure', 'Power loss', 'Antenna disconnection', 'Maintenance shutdown'],
    recommendedAction: 'Physical inspection required. Check power supply and network connections.',
    status: 'resolved', resolvedAt: '2026-08-25T22:00:00Z', resolvedBy: 'admin@gmail.com',
  },
  {
    id: 'anom-006', deviceId: 'DEV-003', detectedAt: mins(200),
    anomalyType: 'Network Anomaly', currentValue: '340 KB/s', expectedRange: '50 – 150 KB/s',
    severity: 'medium', confidence: 76,
    explanation: 'Network traffic is 2.3x higher than normal baseline. Camera may be streaming at higher resolution or experiencing duplicate frame transmissions.',
    possibleCauses: ['Resolution auto-upgrade triggered', 'Duplicate frame buffer', 'Network loop', 'Unusual amount of motion in view'],
    recommendedAction: 'Monitor for next 30 minutes. If persists, check camera streaming settings and network routes.',
    status: 'ignored',
  },
];

/* ════════════════════════════════════════════════════════════════════════════
   Mock Data — Alerts
   ════════════════════════════════════════════════════════════════════════════ */

const initialAlerts: AnomalyAlert[] = [
  { id: 'alrt-001', anomalyId: 'anom-001', deviceId: 'DEV-004', title: 'CRITICAL: Temperature Spike on DEV-004', message: 'Temperature reached 58°C — immediate inspection required.', severity: 'critical', createdAt: mins(40), isRead: false },
  { id: 'alrt-002', anomalyId: 'anom-002', deviceId: 'DEV-004', title: 'HIGH: Battery Drain on DEV-004', message: 'Battery at 18% with abnormal discharge rate.', severity: 'high', createdAt: mins(60), isRead: false },
  { id: 'alrt-003', anomalyId: 'anom-003', deviceId: 'DEV-006', title: 'HIGH: Battery Drain on DEV-006', message: 'Weather station battery draining at 4x normal rate.', severity: 'high', createdAt: mins(30), isRead: false },
  { id: 'alrt-004', anomalyId: 'anom-004', deviceId: 'DEV-004', title: 'HIGH: CPU Overload on DEV-004', message: 'CPU usage at 89% — sustained for 30+ minutes.', severity: 'high', createdAt: mins(38), isRead: true },
  { id: 'alrt-005', anomalyId: 'anom-005', deviceId: 'DEV-007', title: 'MEDIUM: Connectivity Loss on DEV-007', message: 'Device offline — no telemetry since maintenance.', severity: 'medium', createdAt: '2026-08-25T18:25:00Z', isRead: true },
];

/* ════════════════════════════════════════════════════════════════════════════
   Context Provider
   ════════════════════════════════════════════════════════════════════════════ */

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const DeviceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [devices, setDevices] = useState<HardwareDevice[]>(initialDevices);
  const [deviceGroups] = useState<DeviceGroup[]>(initialGroups);
  const [deviceEvents, setDeviceEvents] = useState<DeviceEvent[]>(initialEvents);
  const [anomalies, setAnomalies] = useState<Anomaly[]>(initialAnomalies);
  const [alerts, setAlerts] = useState<AnomalyAlert[]>(initialAlerts);

  /* ── Device CRUD ── */

  const addDevice = useCallback((device: Omit<HardwareDevice, 'id' | 'createdAt' | 'lastSeen'>) => {
    const id = `DEV-${String(devices.length + 1).padStart(3, '0')}`;
    const nowISO = new Date().toISOString();
    const newDevice: HardwareDevice = { ...device, id, createdAt: nowISO, lastSeen: nowISO };
    setDevices(prev => [newDevice, ...prev]);

    // Auto-create a "device connected" event
    addDeviceEvent({
      deviceId: id, timestamp: nowISO, eventType: 'DEVICE_CONNECTED', category: 'system',
      title: 'Device Connected', severity: 'info',
      description: `Device ${id} (${device.name}) registered and connected.`,
      source: 'System',
    });
  }, [devices.length]);

  const updateDevice = useCallback((id: string, updates: Partial<HardwareDevice>) => {
    setDevices(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
  }, []);

  const deleteDevice = useCallback((id: string) => {
    setDevices(prev => prev.filter(d => d.id !== id));
    // Add event before removal
    addDeviceEvent({
      deviceId: id, timestamp: new Date().toISOString(), eventType: 'DEVICE_DISABLED', category: 'system',
      title: 'Device Deleted', severity: 'medium',
      description: `Device ${id} was permanently deleted from the system.`,
      source: 'User Action',
    });
  }, []);

  const disableDevice = useCallback((id: string) => {
    setDevices(prev => prev.map(d => d.id === id ? { ...d, isDisabled: true, status: 'offline' as DeviceStatus } : d));
    addDeviceEvent({
      deviceId: id, timestamp: new Date().toISOString(), eventType: 'DEVICE_DISABLED', category: 'system',
      title: 'Device Disabled', severity: 'medium',
      description: `Device ${id} was disabled by an administrator.`,
      source: 'User Action',
    });
  }, []);

  const enableDevice = useCallback((id: string) => {
    setDevices(prev => prev.map(d => d.id === id ? { ...d, isDisabled: false, status: 'online' as DeviceStatus } : d));
    addDeviceEvent({
      deviceId: id, timestamp: new Date().toISOString(), eventType: 'DEVICE_ENABLED', category: 'system',
      title: 'Device Enabled', severity: 'info',
      description: `Device ${id} was re-enabled by an administrator.`,
      source: 'User Action',
    });
  }, []);

  const restartDevice = useCallback((id: string) => {
    // Simulate restart — briefly set to offline, then online after timeout
    setDevices(prev => prev.map(d => d.id === id ? { ...d, status: 'offline' as DeviceStatus } : d));
    addDeviceEvent({
      deviceId: id, timestamp: new Date().toISOString(), eventType: 'DEVICE_RESTARTED', category: 'system',
      title: 'Device Restarting', severity: 'medium',
      description: `Device ${id} is restarting...`,
      source: 'User Action',
    });
    setTimeout(() => {
      setDevices(prev => prev.map(d => d.id === id ? { ...d, status: 'online' as DeviceStatus, lastSeen: new Date().toISOString() } : d));
      addDeviceEvent({
        deviceId: id, timestamp: new Date().toISOString(), eventType: 'DEVICE_CONNECTED', category: 'system',
        title: 'Device Back Online', severity: 'info',
        description: `Device ${id} restarted and reconnected successfully.`,
        source: 'System',
      });
    }, 3000);
  }, []);

  const assignUserToDevice = useCallback((deviceId: string, userEmail: string) => {
    setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, assignedUser: userEmail } : d));
  }, []);

  const assignGroupToDevice = useCallback((deviceId: string, groupId: string) => {
    setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, groupId } : d));
  }, []);

  /* ── Events ── */

  const addDeviceEvent = useCallback((event: Omit<DeviceEvent, 'id'>) => {
    const newEvent: DeviceEvent = { ...event, id: uid('evt') };
    setDeviceEvents(prev => [newEvent, ...prev]);
  }, []);

  const getDeviceEvents = useCallback((deviceId: string) => {
    return deviceEvents.filter(e => e.deviceId === deviceId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [deviceEvents]);

  /* ── Anomalies ── */

  const getDeviceAnomalies = useCallback((deviceId: string) => {
    return anomalies.filter(a => a.deviceId === deviceId).sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
  }, [anomalies]);

  const resolveAnomaly = useCallback((id: string, resolvedBy: string) => {
    setAnomalies(prev => prev.map(a => a.id === id ? { ...a, status: 'resolved' as AnomalyStatus, resolvedAt: new Date().toISOString(), resolvedBy } : a));
    const anomaly = anomalies.find(a => a.id === id);
    if (anomaly) {
      addDeviceEvent({
        deviceId: anomaly.deviceId, timestamp: new Date().toISOString(), eventType: 'SYSTEM_ALERT', category: 'alerts',
        title: 'Anomaly Resolved', value: anomaly.anomalyType, severity: 'info',
        description: `Anomaly "${anomaly.anomalyType}" has been marked as resolved by ${resolvedBy}.`,
        source: 'User Action', relatedAnomalyId: id,
      });
    }
  }, [anomalies]);

  const ignoreAnomaly = useCallback((id: string) => {
    setAnomalies(prev => prev.map(a => a.id === id ? { ...a, status: 'ignored' as AnomalyStatus } : a));
  }, []);

  const investigateAnomaly = useCallback((id: string) => {
    setAnomalies(prev => prev.map(a => a.id === id ? { ...a, status: 'investigating' as AnomalyStatus } : a));
  }, []);

  const markAlertRead = useCallback((id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));
  }, []);

  /* ── Anomaly Detection Engine ── */

  const detectionRanRef = useRef(false);

  const runAnomalyDetection = useCallback(() => {
    // Prevent double-run in StrictMode
    if (detectionRanRef.current) return;
    detectionRanRef.current = true;

    const nowISO = new Date().toISOString();
    const newAnomalies: Anomaly[] = [];
    const newAlerts: AnomalyAlert[] = [];
    const newEvents: DeviceEvent[] = [];

    devices.forEach(device => {
      if (device.isDisabled || device.status === 'offline') return;

      // 1. Temperature threshold check
      if (device.temperature > 50) {
        const existing = anomalies.find(a => a.deviceId === device.id && a.anomalyType === 'Temperature Spike' && a.status !== 'resolved');
        if (!existing) {
          const anomId = uid('anom');
          newAnomalies.push({
            id: anomId, deviceId: device.id, detectedAt: nowISO,
            anomalyType: 'Temperature Spike', currentValue: `${device.temperature}°C`, expectedRange: '28°C – 38°C',
            severity: device.temperature > 55 ? 'critical' : 'high',
            confidence: Math.min(99, 70 + Math.round((device.temperature - 50) * 3)),
            explanation: `Temperature at ${device.temperature}°C exceeds safe operating range.`,
            possibleCauses: ['Hardware overheating', 'Cooling failure', 'Abnormal workload'],
            recommendedAction: 'Inspect device immediately.', status: 'new',
          });
          newAlerts.push({ id: uid('alrt'), anomalyId: anomId, deviceId: device.id, title: `Temperature Spike on ${device.id}`, message: `Temperature at ${device.temperature}°C`, severity: device.temperature > 55 ? 'critical' : 'high', createdAt: nowISO, isRead: false });
          newEvents.push({ id: uid('evt'), deviceId: device.id, timestamp: nowISO, eventType: 'ANOMALY_DETECTED', category: 'anomalies', title: 'Anomaly — Temperature Spike', value: `${device.temperature}°C`, severity: device.temperature > 55 ? 'critical' : 'high', description: `AI detected temperature spike to ${device.temperature}°C.`, source: 'Anomaly Detection Engine', relatedAnomalyId: anomId });
        }
      }

      // 2. Battery threshold check
      if (device.batteryLevel > 0 && device.batteryLevel < 20) {
        const existing = anomalies.find(a => a.deviceId === device.id && a.anomalyType === 'Battery Drain' && a.status !== 'resolved');
        if (!existing) {
          const anomId = uid('anom');
          newAnomalies.push({
            id: anomId, deviceId: device.id, detectedAt: nowISO,
            anomalyType: 'Battery Drain', currentValue: `${device.batteryLevel}%`, expectedRange: '40% – 100%',
            severity: device.batteryLevel < 10 ? 'critical' : 'high',
            confidence: Math.min(99, 80 + Math.round((20 - device.batteryLevel) * 2)),
            explanation: `Battery at ${device.batteryLevel}% — significantly below safe threshold.`,
            possibleCauses: ['High power consumption', 'Battery degradation', 'Faulty charge controller'],
            recommendedAction: 'Connect external power or replace battery.', status: 'new',
          });
          newAlerts.push({ id: uid('alrt'), anomalyId: anomId, deviceId: device.id, title: `Battery Drain on ${device.id}`, message: `Battery at ${device.batteryLevel}%`, severity: device.batteryLevel < 10 ? 'critical' : 'high', createdAt: nowISO, isRead: false });
          newEvents.push({ id: uid('evt'), deviceId: device.id, timestamp: nowISO, eventType: 'ANOMALY_DETECTED', category: 'anomalies', title: 'Anomaly — Battery Drain', value: `${device.batteryLevel}%`, severity: device.batteryLevel < 10 ? 'critical' : 'high', description: `Battery critically low at ${device.batteryLevel}%.`, source: 'Anomaly Detection Engine', relatedAnomalyId: anomId });
        }
      }

      // 3. CPU overload check
      if (device.cpuUsage > 80) {
        const existing = anomalies.find(a => a.deviceId === device.id && a.anomalyType === 'CPU Overload' && a.status !== 'resolved');
        if (!existing) {
          const anomId = uid('anom');
          newAnomalies.push({
            id: anomId, deviceId: device.id, detectedAt: nowISO,
            anomalyType: 'CPU Overload', currentValue: `${device.cpuUsage}%`, expectedRange: '10% – 50%',
            severity: device.cpuUsage > 90 ? 'critical' : 'high',
            confidence: Math.min(99, 75 + Math.round((device.cpuUsage - 80) * 2)),
            explanation: `CPU utilization at ${device.cpuUsage}% for sustained period.`,
            possibleCauses: ['Runaway process', 'Data processing backlog', 'Firmware bug'],
            recommendedAction: 'Identify and kill runaway processes.', status: 'new',
          });
          newAlerts.push({ id: uid('alrt'), anomalyId: anomId, deviceId: device.id, title: `CPU Overload on ${device.id}`, message: `CPU at ${device.cpuUsage}%`, severity: device.cpuUsage > 90 ? 'critical' : 'high', createdAt: nowISO, isRead: false });
          newEvents.push({ id: uid('evt'), deviceId: device.id, timestamp: nowISO, eventType: 'ANOMALY_DETECTED', category: 'anomalies', title: 'Anomaly — CPU Overload', value: `${device.cpuUsage}%`, severity: device.cpuUsage > 90 ? 'critical' : 'high', description: `CPU usage abnormally high at ${device.cpuUsage}%.`, source: 'Anomaly Detection Engine', relatedAnomalyId: anomId });
        }
      }

      // 4. Signal loss check
      if (device.signalStrength > 0 && device.signalStrength < 30) {
        const existing = anomalies.find(a => a.deviceId === device.id && a.anomalyType === 'Signal Loss' && a.status !== 'resolved');
        if (!existing) {
          const anomId = uid('anom');
          newAnomalies.push({
            id: anomId, deviceId: device.id, detectedAt: nowISO,
            anomalyType: 'Signal Loss', currentValue: `${device.signalStrength}%`, expectedRange: '60% – 100%',
            severity: 'medium', confidence: 78,
            explanation: `Signal strength degraded to ${device.signalStrength}%.`,
            possibleCauses: ['Antenna obstruction', 'Interference', 'Distance from gateway'],
            recommendedAction: 'Check antenna and reposition if needed.', status: 'new',
          });
          newAlerts.push({ id: uid('alrt'), anomalyId: anomId, deviceId: device.id, title: `Signal Loss on ${device.id}`, message: `Signal at ${device.signalStrength}%`, severity: 'medium', createdAt: nowISO, isRead: false });
          newEvents.push({ id: uid('evt'), deviceId: device.id, timestamp: nowISO, eventType: 'ANOMALY_DETECTED', category: 'anomalies', title: 'Anomaly — Signal Loss', value: `${device.signalStrength}%`, severity: 'medium', description: `Signal degraded to ${device.signalStrength}%.`, source: 'Anomaly Detection Engine', relatedAnomalyId: anomId });
        }
      }

      // 5. RAM exhaustion check
      if (device.ramUsage > 85) {
        const existing = anomalies.find(a => a.deviceId === device.id && a.anomalyType === 'RAM Exhaustion' && a.status !== 'resolved');
        if (!existing) {
          const anomId = uid('anom');
          newAnomalies.push({
            id: anomId, deviceId: device.id, detectedAt: nowISO,
            anomalyType: 'RAM Exhaustion', currentValue: `${device.ramUsage}%`, expectedRange: '20% – 70%',
            severity: device.ramUsage > 90 ? 'high' : 'medium',
            confidence: Math.min(99, 70 + Math.round((device.ramUsage - 85) * 3)),
            explanation: `RAM usage at ${device.ramUsage}%, risk of OOM.`,
            possibleCauses: ['Memory leak', 'Too many concurrent tasks', 'Insufficient RAM'],
            recommendedAction: 'Restart device or kill memory-heavy processes.', status: 'new',
          });
          newAlerts.push({ id: uid('alrt'), anomalyId: anomId, deviceId: device.id, title: `RAM Exhaustion on ${device.id}`, message: `RAM at ${device.ramUsage}%`, severity: device.ramUsage > 90 ? 'high' : 'medium', createdAt: nowISO, isRead: false });
          newEvents.push({ id: uid('evt'), deviceId: device.id, timestamp: nowISO, eventType: 'ANOMALY_DETECTED', category: 'anomalies', title: 'Anomaly — RAM Exhaustion', value: `${device.ramUsage}%`, severity: device.ramUsage > 90 ? 'high' : 'medium', description: `RAM critically high at ${device.ramUsage}%.`, source: 'Anomaly Detection Engine', relatedAnomalyId: anomId });
        }
      }

      // 6. Update device status based on anomalies
      const activeAnomalies = [...anomalies, ...newAnomalies].filter(
        a => a.deviceId === device.id && a.status !== 'resolved' && a.status !== 'ignored'
      );
      if (activeAnomalies.some(a => a.severity === 'critical')) {
        setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'critical' as DeviceStatus } : d));
      } else if (activeAnomalies.some(a => a.severity === 'high')) {
        setDevices(prev => prev.map(d => d.id === device.id && d.status !== 'critical' ? { ...d, status: 'warning' as DeviceStatus } : d));
      }
    });

    if (newAnomalies.length > 0) {
      setAnomalies(prev => [...newAnomalies, ...prev]);
      setAlerts(prev => [...newAlerts, ...prev]);
      setDeviceEvents(prev => [...newEvents, ...prev]);
    }
  }, [devices, anomalies]);

  // Run anomaly detection on mount
  useEffect(() => {
    runAnomalyDetection();
  }, []);

  /* ── Provider ── */

  return (
    <DeviceContext.Provider value={{
      devices, deviceGroups, deviceEvents, anomalies, alerts,
      addDevice, updateDevice, deleteDevice, disableDevice, enableDevice, restartDevice,
      assignUserToDevice, assignGroupToDevice,
      addDeviceEvent, getDeviceEvents,
      getDeviceAnomalies, resolveAnomaly, ignoreAnomaly, investigateAnomaly, markAlertRead,
      runAnomalyDetection,
    }}>
      {children}
    </DeviceContext.Provider>
  );
};

export const useDevices = () => {
  const context = useContext(DeviceContext);
  if (!context) throw new Error('useDevices must be used within DeviceProvider');
  return context;
};
