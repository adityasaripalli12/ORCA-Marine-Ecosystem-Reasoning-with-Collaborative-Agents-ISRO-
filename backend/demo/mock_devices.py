from typing import Dict, Any

# ===========================================================================
# DEMO FIXTURES ONLY — NEVER PRESENT AS REAL LIVE GDAC SENSORS
# ===========================================================================

MOCK_DEVICES_DB: Dict[str, Dict[str, Any]] = {
    "DEV-001": {
        "id": "DEV-001", "name": "Alpha Sensor Node", "status": "Online", "battery": 84, "signal": 92,
        "depth": 31.0, "temp": 28.4, "salinity": 34.5, "pressure": 3.1, "ph": 8.1, "do": 7.2,
        "latitude": 17.6868, "longitude": 83.2185, "anomalies": [], "last_updated": "2m ago",
        "is_demo": True, "data_tier": "DEMO DATA / SIMULATION",
        "history": [
            {"time": "1h ago", "temp": 28.2, "depth": 30.0, "latitude": 17.6865, "longitude": 83.2180},
            {"time": "30m ago", "temp": 28.3, "depth": 30.5, "latitude": 17.6867, "longitude": 83.2183},
            {"time": "Just now", "temp": 28.4, "depth": 31.0, "latitude": 17.6868, "longitude": 83.2185}
        ]
    },
    "DEV-002": {
        "id": "DEV-002", "name": "Beta Gateway Hub", "status": "Online", "battery": 97, "signal": 98,
        "depth": 15.0, "temp": 28.0, "salinity": 34.8, "pressure": 1.5, "ph": 8.15, "do": 7.5,
        "latitude": 17.6870, "longitude": 83.2190, "anomalies": [], "last_updated": "1m ago",
        "is_demo": True, "data_tier": "DEMO DATA / SIMULATION",
        "history": [
            {"time": "1h ago", "temp": 27.9, "depth": 14.5, "latitude": 17.6868, "longitude": 83.2188},
            {"time": "Just now", "temp": 28.0, "depth": 15.0, "latitude": 17.6870, "longitude": 83.2190}
        ]
    },
    "DEV-003": {
        "id": "DEV-003", "name": "Gamma Profiling Buoy", "status": "Offline", "battery": 12, "signal": 0,
        "depth": 120.0, "temp": 16.2, "salinity": 35.1, "pressure": 12.0, "ph": 7.9, "do": 6.1,
        "latitude": 17.6850, "longitude": 83.2160, "anomalies": ["Signal Connection Lost", "Critical Battery Level (<15%)"], "last_updated": "3h ago",
        "is_demo": True, "data_tier": "DEMO DATA / SIMULATION",
        "history": [
            {"time": "3h ago", "temp": 16.2, "depth": 120.0, "latitude": 17.6850, "longitude": 83.2160}
        ]
    },
    "DEV-004": {
        "id": "DEV-004", "name": "Thermal Monitor X4", "status": "Critical Alert", "battery": 62, "signal": 85,
        "depth": 45.0, "temp": 58.0, "salinity": 36.2, "pressure": 4.5, "ph": 7.6, "do": 4.8,
        "latitude": 17.6865, "longitude": 83.2178, "anomalies": ["Critical Thermal Spike: 58.0°C (Expected: 24°C–32°C)"], "last_updated": "Just now",
        "is_demo": True, "data_tier": "DEMO DATA / SIMULATION",
        "history": [
            {"time": "2h ago", "temp": 28.1, "depth": 44.0, "latitude": 17.6860, "longitude": 83.2170},
            {"time": "1h ago", "temp": 42.5, "depth": 44.8, "latitude": 17.6862, "longitude": 83.2175},
            {"time": "Just now", "temp": 58.0, "depth": 45.0, "latitude": 17.6865, "longitude": 83.2178}
        ]
    },
    "DEV-007": {
        "id": "DEV-007", "name": "Deep Ocean Profiler", "status": "Online", "battery": 91, "signal": 88,
        "depth": 1250.0, "temp": 4.2, "salinity": 34.9, "pressure": 126.0, "ph": 8.0, "do": 6.8,
        "latitude": 17.6890, "longitude": 83.2210, "anomalies": [], "last_updated": "5m ago",
        "is_demo": True, "data_tier": "DEMO DATA / SIMULATION",
        "history": [
            {"time": "4h ago", "temp": 4.1, "depth": 1240.0, "latitude": 17.6885, "longitude": 83.2205},
            {"time": "Just now", "temp": 4.2, "depth": 1250.0, "latitude": 17.6890, "longitude": 83.2210}
        ]
    }
}

MOCK_HARDWARE_STATE: Dict[str, Any] = {
    "deviceId": "DEVICE-001",
    "deviceName": "FloatChat Marine Sensor Pod #1 (Simulated)",
    "status": "online",
    "connectionState": "demo",
    "latitude": 15.123456,
    "longitude": 72.654321,
    "gpsAccuracy": 8.0,
    "waterTemperature": 24.8,
    "surfaceTemperature": 26.2,
    "depth": 42.6,
    "pressure": 105.2,
    "salinity": 35.7,
    "dissolvedOxygen": 6.4,
    "pH": 8.1,
    "turbidity": 2.4,
    "batteryLevel": 92,
    "firmwareVersion": "v2.1.0-demo",
    "isDemo": True,
    "data_tier": "DEMO DATA / SIMULATION"
}
