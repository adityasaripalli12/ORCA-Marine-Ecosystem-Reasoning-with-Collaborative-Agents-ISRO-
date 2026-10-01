import time
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone

from backend.demo.mock_devices import MOCK_HARDWARE_STATE
_hardware_device_state: Dict[str, Any] = dict(MOCK_HARDWARE_STATE)


def get_hardware_telemetry(demo: bool = True) -> Dict[str, Any]:
    """Retrieve current hardware telemetry state."""
    global _hardware_device_state
    
    # Update timestamp
    _hardware_device_state["timestamp"] = datetime.now(timezone.utc).isoformat()
    _hardware_device_state["isDemo"] = demo
    
    if demo:
        _hardware_device_state["connectionState"] = "demo"
        _hardware_device_state["status"] = "online"
    
    return _hardware_device_state

def update_hardware_telemetry(data: Dict[str, Any]) -> Dict[str, Any]:
    """Update hardware telemetry data from connected hardware/sensor."""
    global _hardware_device_state
    
    current_lat = data.get("latitude", _hardware_device_state["latitude"])
    current_lon = data.get("longitude", _hardware_device_state["longitude"])
    
    _hardware_device_state.update({
        "deviceId": data.get("deviceId", _hardware_device_state["deviceId"]),
        "status": data.get("status", "online"),
        "connectionState": "connected",
        "latitude": current_lat,
        "longitude": current_lon,
        "gpsAccuracy": data.get("gpsAccuracy", _hardware_device_state["gpsAccuracy"]),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "waterTemperature": data.get("waterTemperature"),
        "surfaceTemperature": data.get("surfaceTemperature"),
        "depth": data.get("depth"),
        "pressure": data.get("pressure"),
        "salinity": data.get("salinity"),
        "dissolvedOxygen": data.get("dissolvedOxygen"),
        "pH": data.get("pH"),
        "turbidity": data.get("turbidity"),
        "isDemo": False
    })
    
    # Append to history path
    history = _hardware_device_state.get("history", [])
    history.append({
        "latitude": current_lat,
        "longitude": current_lon,
        "timestamp": _hardware_device_state["timestamp"]
    })
    _hardware_device_state["history"] = history[-20:] # Keep last 20 coordinates
    
    return _hardware_device_state
