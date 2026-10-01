export type HardwareConnectionState = 'connected' | 'connecting' | 'offline' | 'demo';

export interface HardwareHistoryPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface HardwareTelemetryData {
  deviceId: string;
  deviceName?: string;
  status: 'online' | 'offline' | 'locating' | 'demo';
  connectionState: HardwareConnectionState;
  latitude: number;
  longitude: number;
  gpsAccuracy?: number | null; // meters
  timestamp: string;
  
  // Ocean & Environmental Sensor Metrics (optional/nullable per requirements)
  waterTemperature?: number | null; // °C
  surfaceTemperature?: number | null; // °C
  depth?: number | null; // meters
  pressure?: number | null; // dbar or kPa
  salinity?: number | null; // PSU
  dissolvedOxygen?: number | null; // µmol/kg or mg/L
  pH?: number | null;
  turbidity?: number | null; // NTU
  
  batteryLevel?: number | null; // %
  firmwareVersion?: string | null;
  isDemo?: boolean;
  
  history?: HardwareHistoryPoint[];
}
