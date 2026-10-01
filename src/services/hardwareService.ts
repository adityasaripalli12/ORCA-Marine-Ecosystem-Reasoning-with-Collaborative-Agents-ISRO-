import { HardwareTelemetryData } from '../types/HardwareTelemetry';
import { getApiUrl } from '../utils/api';

// Fallback/Demo hardware data when offline or in demo mode
export const DEMO_HARDWARE_DATA: HardwareTelemetryData = {
  deviceId: 'DEVICE-001',
  deviceName: 'ORCA Marine IoT Pod #1',
  status: 'online',
  connectionState: 'demo',
  latitude: 15.123456,
  longitude: 72.654321,
  gpsAccuracy: 8,
  timestamp: new Date().toISOString(),
  waterTemperature: 24.8,
  surfaceTemperature: 26.2,
  depth: 42.6,
  pressure: 105.2,
  salinity: 35.7,
  dissolvedOxygen: 6.4,
  pH: 8.1,
  turbidity: 2.4,
  batteryLevel: 94,
  firmwareVersion: 'v2.1.0-marine',
  isDemo: true,
  history: [
    { latitude: 15.115000, longitude: 72.642000, timestamp: '2026-08-25T14:30:00Z' },
    { latitude: 15.118000, longitude: 72.648000, timestamp: '2026-08-25T15:00:00Z' },
    { latitude: 15.120500, longitude: 72.650200, timestamp: '2026-08-25T15:10:00Z' },
    { latitude: 15.123456, longitude: 72.654321, timestamp: new Date().toISOString() }
  ]
};

/**
 * Fetch latest telemetry from backend hardware API endpoint.
 * Returns demo hardware data if backend is unreachable or when demo mode is requested.
 */
export async function fetchHardwareTelemetry(isDemoMode: boolean = false): Promise<HardwareTelemetryData> {
  try {
    const baseUrl = getApiUrl();
    const res = await fetch(`${baseUrl}/geo/hardware-telemetry?demo=${isDemoMode}`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data: HardwareTelemetryData = await res.json();
    return data;
  } catch (err) {
    // If demo mode is active or fetch fails, return clear DEMO dataset
    return {
      ...DEMO_HARDWARE_DATA,
      timestamp: new Date().toISOString(),
      connectionState: isDemoMode ? 'demo' : 'offline',
      status: isDemoMode ? 'online' : 'offline',
      isDemo: isDemoMode
    };
  }
}
export interface SensorReading {
  timestamp: string;
  time_display: string;
  temperature: number;
  salinity: number;
  depth: number;
  pressure?: number;
  battery?: number;
  signal?: number;
  latitude?: number;
  longitude?: number;
  is_anomaly?: boolean;
}

export interface DeviceSensorHistoryResponse {
  device_id: string;
  device_name?: string;
  status?: string;
  range: string;
  count: number;
  readings: SensorReading[];
}

/**
 * Fetch real sensor telemetry history for a specific device from backend.
 */
export async function fetchDeviceSensorHistory(
  deviceId: string,
  limit: number = 20,
  range: string = '24h'
): Promise<DeviceSensorHistoryResponse> {
  try {
    const baseUrl = getApiUrl();
    const token = localStorage.getItem('floatchat_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${baseUrl}/devices/${encodeURIComponent(deviceId)}/history?limit=${limit}&range=${range}`, {
      headers
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.warn(`Failed to fetch sensor history for ${deviceId}:`, err);
    return {
      device_id: deviceId,
      range,
      count: 0,
      readings: []
    };
  }
}

