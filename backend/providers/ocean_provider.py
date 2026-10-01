from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional

class OceanProvider(ABC):
    """
    Abstract contract for official oceanographic data providers.
    Standardizes ingestion, float discovery, vertical profile retrieval,
    and metadata extraction across providers (ARGO, NOAA, INCOIS, CMEMS).
    """

    @abstractmethod
    def discover_floats(
        self,
        limit: int = 50,
        bbox: Optional[Dict[str, float]] = None,
        ocean_basin: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Discover deployed ocean profiling floats with location and metadata.
        bbox format: {'lat_min': float, 'lat_max': float, 'lon_min': float, 'lon_max': float}
        """
        pass

    @abstractmethod
    def get_float_metadata(self, wmo_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve static and operational metadata for a specific WMO platform.
        """
        pass

    @abstractmethod
    def get_float_profiles(
        self,
        wmo_id: str,
        cycle_number: Optional[int] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Retrieve vertical profile measurements (depth, pressure, temp, salinity, oxygen, QC flags).
        """
        pass

    @abstractmethod
    def get_latest_observations(self, wmo_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Retrieve most recent physical observation readings for a float.
        """
        pass
