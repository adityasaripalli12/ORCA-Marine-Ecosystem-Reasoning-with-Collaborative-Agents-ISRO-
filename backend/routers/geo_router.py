from fastapi import APIRouter, HTTPException, Query, Depends
from backend.models.user import User
from backend.auth.dependencies import require_admin_or_gov
from typing import Optional, List, Dict, Any
from backend.services.geo_service import (
    get_complete_ocean_info,
    calculate_bathymetry,
    find_nearby_argo_floats,
    find_nearby_research_expeditions,
    find_nearby_seafloor_features,
    search_geographic_locations,
    is_coordinate_on_land
)
from backend.services.hardware_service import (
    get_hardware_telemetry,
    update_hardware_telemetry
)

router = APIRouter(prefix="/geo", tags=["Ocean Geographic Explorer"])

@router.get("/ocean-info")
def get_ocean_info(
    lat: float = Query(..., description="Latitude (-90.0 to +90.0)"),
    lon: float = Query(..., description="Longitude (-180.0 to +180.0)")
):
    """
    Get consolidated scientific oceanographic data for a clicked geographic point.
    Returns ocean/sea classification, GEBCO bathymetry, water column profile,
    nearby Argo floats, research expeditions, and seafloor features.
    """
    try:
        data = get_complete_ocean_info(lat, lon)
        return data
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving oceanographic data: {str(e)}")


@router.get("/bathymetry")
def get_bathymetry(
    lat: float = Query(..., description="Latitude (-90.0 to +90.0)"),
    lon: float = Query(..., description="Longitude (-180.0 to +180.0)")
):
    """Retrieve seafloor depth, elevation, and terrain classification from GEBCO/NOAA ETOPO."""
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
        raise HTTPException(status_code=400, detail="Invalid coordinates.")
    on_land = is_coordinate_on_land(lat, lon)
    return calculate_bathymetry(lat, lon, on_land)


from backend.auth.dependencies import require_admin_or_gov
from backend.models.user import User

@router.get("/argo")
def get_argo_floats(
    lat: float = Query(..., description="Latitude (-90.0 to +90.0)"),
    lon: float = Query(..., description="Longitude (-180.0 to +180.0)"),
    radius_km: float = Query(3500.0, description="Search radius in kilometers"),
    current_user: User = Depends(require_admin_or_gov)
):
    """
    Find active Argo profiling floats near coordinate with CTD sensors and telemetry data.
    RESTRICTED: Administrator and Government roles only.
    """
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
        raise HTTPException(status_code=400, detail="Invalid coordinates.")
    return {
        "count": len(find_nearby_argo_floats(lat, lon, radius_km)),
        "floats": find_nearby_argo_floats(lat, lon, radius_km)
    }


@router.get("/research")
def get_research_expeditions(
    lat: float = Query(..., description="Latitude (-90.0 to +90.0)"),
    lon: float = Query(..., description="Longitude (-180.0 to +180.0)"),
    radius_km: float = Query(4500.0, description="Search radius in kilometers")
):
    """Find oceanographic research expeditions, vessel cruises, and ROV dive operations."""
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
        raise HTTPException(status_code=400, detail="Invalid coordinates.")
    return {
        "count": len(find_nearby_research_expeditions(lat, lon, radius_km)),
        "expeditions": find_nearby_research_expeditions(lat, lon, radius_km)
    }


@router.get("/features")
def get_seafloor_features(
    lat: float = Query(..., description="Latitude (-90.0 to +90.0)"),
    lon: float = Query(..., description="Longitude (-180.0 to +180.0)"),
    radius_km: float = Query(2500.0, description="Search radius in kilometers")
):
    """Find named undersea geological features from the GEBCO Gazetteer."""
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
        raise HTTPException(status_code=400, detail="Invalid coordinates.")
    return {
        "count": len(find_nearby_seafloor_features(lat, lon, radius_km)),
        "features": find_nearby_seafloor_features(lat, lon, radius_km)
    }


@router.get("/search")
def search_locations(
    q: str = Query(..., min_length=1, description="Search term for ocean, sea, trench, or coordinate")
):
    """Search for ocean regions, marginal seas, undersea features, or coordinate strings."""
    results = search_geographic_locations(q)
    return {"query": q, "results": results}


@router.get("/hardware-telemetry")
def read_hardware_telemetry(demo: bool = Query(True, description="Whether to return demo hardware data if offline")):
    """Get latest connected hardware/IoT device telemetry and location."""
    return get_hardware_telemetry(demo=demo)


@router.post("/hardware-telemetry/update")
def post_hardware_telemetry(payload: Dict[str, Any]):
    """Update hardware telemetry data from external IoT device (Arduino, ESP32, Raspberry Pi, REST/MQTT gateway)."""
    return update_hardware_telemetry(payload)

