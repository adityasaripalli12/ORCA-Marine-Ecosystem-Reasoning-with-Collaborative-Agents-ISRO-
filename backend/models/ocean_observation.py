import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, Index
from backend.database.connection import Base

class OceanObservation(Base):
    """
    Relational Ocean Observation Model for FloatChat.
    Stores discrete, physical in-situ oceanographic measurements from official ARGO floats,
    drifters, and uploaded NetCDF-4 files.
    """
    __tablename__ = "ocean_observations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    source = Column(String, nullable=False, default="ARGO_GDAC_IFREMER") # e.g. ARGO_GDAC_IFREMER, UPLOADED_NETCDF
    dataset = Column(String, nullable=False) # e.g. ArgoFloats_6903240.nc
    wmo_id = Column(String, nullable=False, index=True)
    platform_id = Column(String, nullable=True)
    observation_timestamp = Column(DateTime, nullable=False, index=True)
    ingested_timestamp = Column(DateTime, default=datetime.utcnow)
    latitude = Column(Float, nullable=False, index=True)
    longitude = Column(Float, nullable=False, index=True)
    depth = Column(Float, nullable=False) # Depth in meters
    pressure = Column(Float, nullable=False) # Pressure in decibars
    temperature = Column(Float, nullable=False) # Water temperature in °C
    salinity = Column(Float, nullable=True) # Practical salinity in PSU
    oxygen = Column(Float, nullable=True) # Dissolved oxygen in µmol/kg
    chlorophyll = Column(Float, nullable=True) # Chlorophyll-A in mg/m³
    quality_flag = Column(String, default="1") # ARGO QC: 1=Good, 2=Probably Good, 3=Bad, 4=Corrupt
    cycle_number = Column(Integer, nullable=True)
    source_reference = Column(String, nullable=True)

    __table_args__ = (
        Index("ix_obs_wmo_time", "wmo_id", "observation_timestamp"),
        Index("ix_obs_lat_lon", "latitude", "longitude"),
        Index("ix_obs_depth_temp", "depth", "temperature"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "source": self.source,
            "dataset": self.dataset,
            "wmo_id": self.wmo_id,
            "platform_id": self.platform_id,
            "observation_timestamp": self.observation_timestamp.isoformat() if self.observation_timestamp else None,
            "ingested_timestamp": self.ingested_timestamp.isoformat() if self.ingested_timestamp else None,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "depth": self.depth,
            "pressure": self.pressure,
            "temperature": self.temperature,
            "salinity": self.salinity,
            "oxygen": self.oxygen,
            "chlorophyll": self.chlorophyll,
            "quality_flag": self.quality_flag,
            "cycle_number": self.cycle_number,
            "source_reference": self.source_reference
        }
