import numpy as np
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc
from backend.models.dataset import Dataset
from backend.models.ocean_observation import OceanObservation
from backend.services.embedding_service import EmbeddingService
from backend.utils.logger import sec_logger

try:
    import faiss
    HAS_FAISS = True
except ImportError:
    HAS_FAISS = False

class FAISSService:
    """
    Enterprise FAISS Vector Indexing & Semantic Retrieval Service for FloatChat.
    Uses dense 384-dimensional embeddings (SentenceTransformers) for true semantic RAG.
    Indexes:
    1. Active, verified datasets (.nc, .csv)
    2. Real in-situ ocean observations & ARGO float profiles (WMO, depth, temp, salinity, QC flags)
    """

    def __init__(self, dimension: int = EmbeddingService.DIMENSION):
        self.dimension = dimension
        if HAS_FAISS:
            self.index = faiss.IndexFlatIP(dimension) # Inner Product on normalized vectors = Cosine Similarity
        else:
            self.index = None
        self.documents: List[Dict[str, Any]] = []

    def clear(self):
        """Clears in-memory index and documents."""
        if HAS_FAISS:
            self.index = faiss.IndexFlatIP(self.dimension)
        self.documents = []

    def sync_active_datasets(self, db: Session):
        """
        Synchronizes FAISS vector index with database ACTIVE datasets and REAL ARGO observations.
        """
        self.clear()

        # 1. Index active verified datasets
        active_datasets = db.query(Dataset).filter(
            Dataset.status.in_(["Active", "ACTIVE"]),
            Dataset.duplicate_status.in_(["Unique", "UNIQUE", "Verified"])
        ).all()

        for ds in active_datasets:
            meta = ds.meta_data or {}
            cols = " ".join(meta.get("columns") or meta.get("variables") or [])
            doc_text = (
                f"Dataset: {ds.dataset_name} ({ds.dataset_type}). "
                f"Variables: {cols}. "
                f"Latitude range: {meta.get('latitude_min', '')} to {meta.get('latitude_max', '')}. "
                f"Longitude range: {meta.get('longitude_min', '')} to {meta.get('longitude_max', '')}. "
                f"Average Temperature: {meta.get('temperature_avg', 'N/A')} °C. "
                f"Average Salinity: {meta.get('salinity_avg', 'N/A')} PSU."
            )
            vec = EmbeddingService.embed_text(doc_text)
            doc_metadata = {
                "id": ds.id,
                "title": ds.dataset_name,
                "dataset_name": ds.dataset_name,
                "format": ds.dataset_type,
                "size": ds.file_size,
                "uploaded_by": ds.uploaded_by,
                "status": ds.status,
                "duplicate_status": ds.duplicate_status,
                "trust_level": 4,
                "source_type": "ORGANIZATIONAL_DATASET",
                "summary": doc_text,
                "meta_data": meta
            }
            self.add_document_vector(vec, doc_metadata)

        # 2. Index real physical observations by float WMO
        try:
            # Group distinct WMOs from ocean_observations
            distinct_wmos = [r[0] for r in db.query(OceanObservation.wmo_id).distinct().all()]
            for wmo in distinct_wmos:
                obs_list = db.query(OceanObservation).filter(
                    OceanObservation.wmo_id == wmo
                ).order_by(desc(OceanObservation.observation_timestamp), OceanObservation.depth).limit(30).all()

                if obs_list:
                    latest = obs_list[0]
                    temps = [o.temperature for o in obs_list if o.temperature is not None]
                    salts = [o.salinity for o in obs_list if o.salinity is not None]
                    depths = [o.depth for o in obs_list if o.depth is not None]

                    min_t, max_t = (min(temps), max(temps)) if temps else (0, 0)
                    min_s, max_s = (min(salts), max(salts)) if salts else (0, 0)
                    max_d = max(depths) if depths else 0

                    summary_text = (
                        f"ARGO Float WMO {wmo} profile in {latest.source}. "
                        f"Position: {latest.latitude:.2f}°N, {latest.longitude:.2f}°E. "
                        f"Observed on {latest.observation_timestamp.strftime('%Y-%m-%d %H:%M UTC')}. "
                        f"Cycle Number: {latest.cycle_number or 1}. "
                        f"Depth range: 0 to {max_d:.1f} m. "
                        f"Temperature range: {min_t:.1f}°C to {max_t:.1f}°C. "
                        f"Salinity range: {min_s:.1f} to {max_s:.1f} PSU. "
                        f"Quality Flag: {latest.quality_flag}."
                    )
                    vec = EmbeddingService.embed_text(summary_text)
                    meta_doc = {
                        "id": f"wmo_{wmo}",
                        "title": f"ARGO Float WMO {wmo}",
                        "dataset_name": latest.dataset,
                        "wmo_id": wmo,
                        "observation_timestamp": latest.observation_timestamp.isoformat(),
                        "latitude": latest.latitude,
                        "longitude": latest.longitude,
                        "quality_flag": latest.quality_flag,
                        "source": latest.source,
                        "trust_level": 5, # Highest authoritative physical ocean data
                        "source_type": "ARGO_OBSERVATION_PROFILE",
                        "summary": summary_text,
                        "meta_data": {
                            "wmo_id": wmo,
                            "latest_cycle": latest.cycle_number,
                            "max_depth": max_d,
                            "temp_range": [min_t, max_t],
                            "salinity_range": [min_s, max_s],
                            "latitude": latest.latitude,
                            "longitude": latest.longitude,
                            "observation_timestamp": latest.observation_timestamp.isoformat(),
                            "quality_flag": latest.quality_flag
                        }
                    }
                    self.add_document_vector(vec, meta_doc)
        except Exception as e:
            sec_logger.warning(f"Error indexing observations in FAISS: {e}")

        sec_logger.info(f"FAISS RAG Knowledge Base synced: {len(self.documents)} knowledge nodes indexed.")

    def add_document_vector(self, vector: np.ndarray, doc_metadata: Dict[str, Any]):
        """Adds normalized vector and metadata entry to index."""
        if doc_metadata.get("duplicate_status") not in [None, "Unique", "UNIQUE", "Verified"]:
            return

        norm = np.linalg.norm(vector)
        if norm > 0:
            vector = vector / norm

        if HAS_FAISS and self.index is not None:
            self.index.add(vector.reshape(1, -1).astype(np.float32))
        self.documents.append(doc_metadata)

    def search_knowledge(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Semantic search matching query against indexed documents & observations.
        Returns top_k matching nodes with cosine similarity relevance score.
        """
        if not self.documents:
            return []

        q_vec = EmbeddingService.embed_text(query)
        norm = np.linalg.norm(q_vec)
        if norm > 0:
            q_vec = q_vec / norm

        if HAS_FAISS and self.index is not None and self.index.ntotal > 0:
            k = min(top_k, len(self.documents))
            scores, indices = self.index.search(q_vec.reshape(1, -1).astype(np.float32), k)
            results = []
            seen_ids = set()

            for rank, idx in enumerate(indices[0]):
                if idx < len(self.documents) and idx != -1:
                    doc = dict(self.documents[idx])
                    doc_id = doc.get("id")
                    if doc_id in seen_ids:
                        continue
                    seen_ids.add(doc_id)

                    similarity = float(scores[0][rank])
                    # Cosine similarity mapped to 0-100%
                    relevance_pct = max(0.0, min(100.0, round(((similarity + 1.0) / 2.0) * 100.0, 1)))
                    doc["relevance_score"] = relevance_pct
                    doc["relevance"] = f"{relevance_pct}%"
                    results.append(doc)
            return results

        # Fallback keyword ranking
        q_lower = query.lower()
        scored = []
        for doc in self.documents:
            title = doc.get("title", "").lower()
            summary = doc.get("summary", "").lower()
            score = 50.0
            if any(w in title for w in q_lower.split()): score += 30.0
            if any(w in summary for w in q_lower.split()): score += 15.0
            d = dict(doc)
            d["relevance_score"] = min(100.0, score)
            d["relevance"] = f"{d['relevance_score']}%"
            scored.append(d)
        scored.sort(key=lambda x: x["relevance_score"], reverse=True)
        return scored[:top_k]

faiss_service = FAISSService()
