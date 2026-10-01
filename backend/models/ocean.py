from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ARRAY, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from .base import Base  # Assuming a Base declarative class exists

class ArgoFloat(Base):
    __tablename__ = "argo_float"
    wmo_id = Column(String, primary_key=True, index=True)
    platform_type = Column(String, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    ocean = Column(String, nullable=True)
    status = Column(String, nullable=True)
    launch_date = Column(Date, nullable=True)
    last_observation = Column(DateTime, nullable=True)
    cycle_number = Column(Integer, nullable=True)
    max_depth_m = Column(Float, nullable=True)
    sensors = Column(ARRAY(String), nullable=True)
    distance_km = Column(Float, nullable=True)
    geom = Column(Geometry(geometry_type="POINT", srid=4326), nullable=False)

class NetCDFDataset(Base):
    __tablename__ = "netcdf_dataset"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    uploaded_at = Column(DateTime, server_default="now()")
    source = Column(String, nullable=True)
    description = Column(String, nullable=True)
    observations = relationship("Observation", back_populates="dataset", cascade="all, delete-orphan")

class Observation(Base):
    __tablename__ = "observation"
    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("netcdf_dataset.id"), nullable=False)
    variable = Column(String, nullable=False)
    value = Column(Float, nullable=True)
    depth_m = Column(Float, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    timestamp = Column(DateTime, nullable=True)
    geom = Column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
    dataset = relationship("NetCDFDataset", back_populates="observations")
