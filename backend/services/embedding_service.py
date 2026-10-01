import hashlib
import numpy as np
from typing import List, Optional
from backend.utils.logger import sec_logger

class EmbeddingService:
    """
    Enterprise Semantic Embedding Service.
    Uses sentence-transformers (all-MiniLM-L6-v2, 384-dim) for dense neural semantic vectors.
    Includes deterministic fallback normalization in case of model download delays.
    """
    _model = None
    DIMENSION = 384
    MODEL_NAME = "all-MiniLM-L6-v2"

    @classmethod
    def get_model(cls):
        if cls._model is None:
            try:
                from sentence_transformers import SentenceTransformer
                cls._model = SentenceTransformer(cls.MODEL_NAME)
                sec_logger.info(f"Loaded embedding model: {cls.MODEL_NAME}")
            except Exception as e:
                sec_logger.warning(f"Could not load SentenceTransformer ('{e}'). Using dense vectorizer fallback.")
                cls._model = False
        return cls._model

    @classmethod
    def chunk_text(cls, text: str, max_words: int = 100, overlap: int = 20) -> List[str]:
        words = text.split()
        if len(words) <= max_words:
            return [text]
        chunks = []
        i = 0
        while i < len(words):
            chunk = " ".join(words[i:i + max_words])
            chunks.append(chunk)
            i += (max_words - overlap)
        return chunks

    @classmethod
    def embed_text(cls, text: str) -> np.ndarray:
        model = cls.get_model()
        if model:
            try:
                emb = model.encode(text, normalize_embeddings=True)
                return np.array(emb, dtype=np.float32)
            except Exception as e:
                sec_logger.warning(f"Embedding encoding error: {e}")

        # Deterministic 384-dimensional dense projection fallback
        vec = np.zeros(cls.DIMENSION, dtype=np.float32)
        words = text.lower().split()
        if not words:
            return vec
        for i, w in enumerate(words):
            h1 = int(hashlib.sha256(w.encode("utf-8")).hexdigest()[:8], 16) % cls.DIMENSION
            h2 = int(hashlib.md5(w.encode("utf-8")).hexdigest()[:8], 16) % cls.DIMENSION
            weight = 1.0 / (1.0 + (i * 0.03))
            vec[h1] += weight
            vec[h2] += (weight * 0.5)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec /= norm
        return vec

    @classmethod
    def embed_batch(cls, texts: List[str]) -> np.ndarray:
        if not texts:
            return np.empty((0, cls.DIMENSION), dtype=np.float32)
        model = cls.get_model()
        if model:
            try:
                embs = model.encode(texts, normalize_embeddings=True)
                return np.array(embs, dtype=np.float32)
            except Exception:
                pass
        return np.array([cls.embed_text(t) for t in texts], dtype=np.float32)
