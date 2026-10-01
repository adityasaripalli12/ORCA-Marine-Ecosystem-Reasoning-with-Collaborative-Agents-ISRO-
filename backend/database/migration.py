from sqlalchemy import text
from backend.database.connection import engine, Base
import backend.models.ocean_observation # register OceanObservation model

def run_migrations():
    """
    Ensures all new columns and tables exist in the database.
    """
    # Create any missing tables defined in models (including ocean_observations)
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        pass

    with engine.connect() as conn:
        # Check users table columns
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN phone_number VARCHAR DEFAULT '+918125768347'"))
            conn.commit()
        except Exception:
            pass

        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN mfa_enabled BOOLEAN DEFAULT 0"))
            conn.commit()
        except Exception:
            pass

        # Check datasets table columns
        for col_def in [
            ("duplicate_status", "VARCHAR DEFAULT 'Unique'"),
            ("content_fingerprint", "VARCHAR"),
            ("similarity_score", "FLOAT DEFAULT 0.0"),
            ("duplicate_of_id", "VARCHAR"),
            ("ai_analysis", "JSON"),
            ("validation_details", "JSON"),
        ]:
            try:
                conn.execute(text(f"ALTER TABLE datasets ADD COLUMN {col_def[0]} {col_def[1]}"))
                conn.commit()
            except Exception:
                pass

        # Check security_events table columns
        for sec_col in [
            ("risk_score", "INTEGER DEFAULT 50"),
            ("risk_level", "VARCHAR DEFAULT 'HIGH'"),
            ("action_taken", "VARCHAR DEFAULT 'BLOCK'"),
            ("source", "VARCHAR DEFAULT 'FlowChat AI'"),
            ("status", "VARCHAR DEFAULT 'BLOCKED'"),
            ("device_id", "VARCHAR"),
            ("latitude", "FLOAT"),
            ("longitude", "FLOAT"),
            ("user_role", "VARCHAR"),
        ]:
            try:
                conn.execute(text(f"ALTER TABLE security_events ADD COLUMN {sec_col[0]} {sec_col[1]}"))
                conn.commit()
            except Exception:
                pass

