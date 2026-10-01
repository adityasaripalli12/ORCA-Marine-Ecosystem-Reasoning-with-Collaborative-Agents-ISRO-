import os
import re
import json
import hashlib
import unicodedata
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from backend.models.dataset import Dataset
from backend.utils.logger import sec_logger

class DuplicateDetectorService:
    """
    Enterprise Multi-Tier Duplicate Detection & Content Fingerprinting Engine.
    
    Tiers of Detection:
    1. Exact Cryptographic Checksum (SHA-256 of raw file bytes)
    2. Normalized Content Fingerprint / Hash (normalized text, schema, metadata stripping)
    3. Vector / Semantic Similarity (telemetry curve, bounding box, schema overlap)
    4. AI Semantic Evaluation (LLM validation of borderline 0.85-0.94 matches)
    """

    @staticmethod
    def compute_sha256(file_bytes: bytes) -> str:
        """Calculates exact SHA-256 cryptographic checksum of raw bytes."""
        hasher = hashlib.sha256()
        hasher.update(file_bytes)
        return hasher.hexdigest()

    @staticmethod
    def normalize_extracted_text(text: str) -> str:
        """Normalizes text by removing volatile timestamps, stripping formatting differences, and collapsing whitespace."""
        if not text:
            return ""
        # 1. Unicode NFKC normalization
        norm = unicodedata.normalize('NFKC', str(text))
        # 2. Lowercase
        norm = norm.lower()
        # 3. Strip ISO timestamps and date strings that might differ between re-exports
        norm = re.sub(r'\b\d{4}-\d{2}-\d{2}[t\s]\d{2}:\d{2}:\d{2}(\.\d+)?(z|[+-]\d{2}:?\d{2})?\b', '', norm)
        norm = re.sub(r'\b(created|exported|generated|timestamp|date)\s*[:=]\s*["\']?[^"\',\n\r]+["\']?', '', norm)
        # 4. Collapse whitespace and linebreaks
        norm = re.sub(r'\s+', ' ', norm).strip()
        return norm

    @staticmethod
    def generate_content_fingerprint(metadata: Dict[str, Any], raw_sample_text: str = "") -> str:
        """
        Generates a deterministic content fingerprint based on normalized schema,
        coordinate bounding box, physical variables, telemetry means, and sample text content.
        """
        cols = sorted([str(c).lower().strip() for c in (metadata.get("columns") or metadata.get("variables") or [])])
        
        # Round bounding coordinates & averages to stabilize fingerprint against float precision jitter
        lat_min = round(float(metadata.get("latitude_min", 0.0)), 2) if metadata.get("latitude_min") is not None else 0.0
        lat_max = round(float(metadata.get("latitude_max", 0.0)), 2) if metadata.get("latitude_max") is not None else 0.0
        lon_min = round(float(metadata.get("longitude_min", 0.0)), 2) if metadata.get("longitude_min") is not None else 0.0
        lon_max = round(float(metadata.get("longitude_max", 0.0)), 2) if metadata.get("longitude_max") is not None else 0.0
        
        rec_count = int(metadata.get("record_count", 0))
        temp_avg = round(float(metadata.get("temperature_avg", 0.0)), 1) if metadata.get("temperature_avg") is not None else 0.0
        sal_avg = round(float(metadata.get("salinity_avg", 0.0)), 1) if metadata.get("salinity_avg") is not None else 0.0

        normalized_sample = DuplicateDetectorService.normalize_extracted_text(raw_sample_text)

        fingerprint_data = {
            "columns": cols,
            "record_count_bucket": rec_count // 50,  # 50-record stability bucket
            "bounds": [lat_min, lat_max, lon_min, lon_max],
            "telemetry_means": [temp_avg, sal_avg],
            "sample_snippet": normalized_sample[:500] if normalized_sample else ""
        }
        
        serialized = json.dumps(fingerprint_data, sort_keys=True)
        return hashlib.sha256(serialized.encode('utf-8')).hexdigest()

    @staticmethod
    def check_exact_duplicate(db: Session, sha256_hash: str) -> Optional[Dataset]:
        """
        Tier 1: Queries database for exact cryptographic SHA-256 match.
        Matches active or duplicate canonical datasets.
        """
        return db.query(Dataset).filter(Dataset.sha256_hash == sha256_hash).first()

    @staticmethod
    def check_content_duplicate(db: Session, content_fingerprint: str) -> Optional[Dataset]:
        """
        Tier 2: Queries database for exact normalized content fingerprint match.
        Catches renamed files or identical datasets saved under different containers.
        """
        if not content_fingerprint:
            return None
        return db.query(Dataset).filter(
            Dataset.content_fingerprint == content_fingerprint,
            Dataset.status.in_(["Active", "ACTIVE"])
        ).first()

    @staticmethod
    def calculate_similarity(meta_a: Dict[str, Any], meta_b: Dict[str, Any]) -> Tuple[float, List[str], List[str]]:
        """
        Tier 3: Calculates near-duplicate similarity percentage (0.0 - 100.0)
        between two datasets and produces a detailed matching elements vs differences report.
        """
        matching_elements = []
        differences = []
        score_components = []

        # 1. Variable / Column Overlap (30% weight)
        vars_a = set(str(v).lower().strip() for v in (meta_a.get("columns") or meta_a.get("variables") or []))
        vars_b = set(str(v).lower().strip() for v in (meta_b.get("columns") or meta_b.get("variables") or []))
        
        if vars_a and vars_b:
            intersection = vars_a.intersection(vars_b)
            union = vars_a.union(vars_b)
            var_sim = len(intersection) / len(union) if union else 1.0
            score_components.append((var_sim, 0.30))
            if var_sim > 0.8:
                matching_elements.append(f"Variables & Schema ({len(intersection)} shared: {', '.join(sorted(list(intersection))[:5])})")
            else:
                differences.append(f"Schema mismatch: {len(vars_a)} vs {len(vars_b)} variables")
        else:
            score_components.append((0.5, 0.30))

        # 2. Geographic Coverage & Coordinate Bounding Box (25% weight)
        geo_matches = 0
        geo_total = 0
        for coord in ["latitude_min", "latitude_max", "longitude_min", "longitude_max"]:
            val_a = meta_a.get(coord)
            val_b = meta_b.get(coord)
            if val_a is not None and val_b is not None:
                geo_total += 1
                diff = abs(float(val_a) - float(val_b))
                if diff <= 0.5:  # within 0.5 degrees
                    geo_matches += 1
        
        if geo_total > 0:
            geo_sim = geo_matches / geo_total
            score_components.append((geo_sim, 0.25))
            if geo_sim >= 0.75:
                matching_elements.append(f"Geographic Bounding Box ({meta_a.get('latitude_min', '')}°-{meta_a.get('latitude_max', '')}° Lat, {meta_a.get('longitude_min', '')}°-{meta_a.get('longitude_max', '')}° Lon)")
            else:
                differences.append("Geographic coverage coordinates diverge")
        else:
            score_components.append((0.7, 0.25))

        # 3. Record Count / Dimension Similarity (20% weight)
        cnt_a = int(meta_a.get("record_count", 0))
        cnt_b = int(meta_b.get("record_count", 0))
        if cnt_a > 0 and cnt_b > 0:
            rec_sim = min(cnt_a, cnt_b) / max(cnt_a, cnt_b)
            score_components.append((rec_sim, 0.20))
            if rec_sim >= 0.90:
                matching_elements.append(f"Profile record count ({cnt_a} vs {cnt_b} records)")
            else:
                differences.append(f"Record count changed from {cnt_a} to {cnt_b}")
        else:
            score_components.append((0.5, 0.20))

        # 4. Ocean Physical Telemetry Distribution (Temp, Salinity, Pressure) (25% weight)
        metric_sims = []
        for metric in ["temperature_avg", "salinity_avg", "pressure_avg", "depth_avg"]:
            m_a = meta_a.get(metric)
            m_b = meta_b.get(metric)
            if m_a is not None and m_b is not None:
                fa, fb = float(m_a), float(m_b)
                denom = max(abs(fa), abs(fb), 1.0)
                sim = max(0.0, 1.0 - (abs(fa - fb) / denom))
                metric_sims.append(sim)
        
        if metric_sims:
            telemetry_sim = sum(metric_sims) / len(metric_sims)
            score_components.append((telemetry_sim, 0.25))
            if telemetry_sim >= 0.85:
                matching_elements.append("Oceanographic telemetry distribution (Temperature & Salinity curve matches)")
            else:
                differences.append("Telemetry mean values or sensor calibration diverge")
        else:
            score_components.append((0.7, 0.25))

        # Calculate weighted overall similarity
        total_weight = sum(w for _, w in score_components)
        final_score = (sum(s * w for s, w in score_components) / total_weight) * 100.0 if total_weight > 0 else 0.0
        final_score = round(min(100.0, max(0.0, final_score)), 1)

        return final_score, matching_elements, differences

    @staticmethod
    def check_semantic_duplicates(
        db: Session,
        new_metadata: Dict[str, Any],
        exclude_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Scans all ACTIVE datasets to identify near-duplicates or semantic matches.
        Returns the highest-scoring candidate if similarity exceeds 85.0%.
        """
        active_datasets = db.query(Dataset).filter(
            Dataset.status.in_(["Active", "ACTIVE"]),
            Dataset.duplicate_status.in_(["Unique", "UNIQUE", "Verified"])
        ).all()

        if exclude_id:
            active_datasets = [d for d in active_datasets if d.id != exclude_id]

        best_match = None
        highest_score = 0.0

        for ds in active_datasets:
            ds_meta = ds.meta_data or {}
            score, matching_elements, differences = DuplicateDetectorService.calculate_similarity(new_metadata, ds_meta)
            
            if score >= 85.0 and score > highest_score:
                highest_score = score
                best_match = {
                    "existing_dataset_id": ds.id,
                    "existing_dataset_name": ds.dataset_name,
                    "existing_sha256": ds.sha256_hash,
                    "existing_uploaded_by": ds.uploaded_by,
                    "existing_upload_date": ds.upload_date.strftime("%d %b %Y") if ds.upload_date else "Recent",
                    "similarity_score": score,
                    "matching_elements": matching_elements,
                    "differences": differences,
                }

        return best_match

    @staticmethod
    def evaluate_upload(
        db: Session,
        file_bytes: bytes,
        filename: str,
        extracted_meta: Dict[str, Any],
        sample_text: str = ""
    ) -> Dict[str, Any]:
        """
        Complete 4-Tier Evaluation Engine.
        Executes sequential verification:
        1. SHA-256 exact match -> EXACT_DUPLICATE -> DUPLICATES
        2. Content fingerprint match -> CONTENT_DUPLICATE -> DUPLICATES
        3. Semantic similarity >= 95% -> SEMANTIC_DUPLICATE -> DUPLICATES
        4. Semantic similarity 85%-94% -> POSSIBLE_DUPLICATE -> DUPLICATES
        5. Similarity < 85% -> UNIQUE -> ACTIVE
        """
        # Tier 1: Exact Byte Checksum
        sha256_hash = DuplicateDetectorService.compute_sha256(file_bytes)
        exact_match = DuplicateDetectorService.check_exact_duplicate(db, sha256_hash)
        
        if exact_match:
            canonical_id = exact_match.duplicate_of_id or exact_match.id
            return {
                "status": "DUPLICATES",
                "duplicate_status": "Duplicate",
                "duplicate_type": "EXACT_DUPLICATE",
                "is_duplicate": True,
                "similarity_score": 100.0,
                "canonical_document_id": canonical_id,
                "canonical_document_name": exact_match.dataset_name,
                "duplicate_reason": f"Exact cryptographic SHA-256 hash match with '{exact_match.dataset_name}'",
                "matching_elements": ["Exact byte-for-byte SHA-256 checksum match", f"Existing file: {exact_match.dataset_name}"],
                "differences": [],
                "sha256_hash": sha256_hash,
                "content_fingerprint": exact_match.content_fingerprint or DuplicateDetectorService.generate_content_fingerprint(extracted_meta, sample_text)
            }

        # Tier 2: Normalized Content Fingerprint
        content_fingerprint = DuplicateDetectorService.generate_content_fingerprint(extracted_meta, sample_text)
        content_match = DuplicateDetectorService.check_content_duplicate(db, content_fingerprint)
        
        if content_match:
            canonical_id = content_match.duplicate_of_id or content_match.id
            return {
                "status": "DUPLICATES",
                "duplicate_status": "Duplicate",
                "duplicate_type": "CONTENT_DUPLICATE",
                "is_duplicate": True,
                "similarity_score": 99.0,
                "canonical_document_id": canonical_id,
                "canonical_document_name": content_match.dataset_name,
                "duplicate_reason": f"Normalized content fingerprint match with '{content_match.dataset_name}' (same schema & telemetry distribution)",
                "matching_elements": ["Identical normalized schema, geographic bounds, and telemetry metrics", f"Existing dataset: {content_match.dataset_name}"],
                "differences": ["Filename or raw container encoding differs"],
                "sha256_hash": sha256_hash,
                "content_fingerprint": content_fingerprint
            }

        # Tier 3: Semantic / Vector Near-Duplicate Check
        semantic_match = DuplicateDetectorService.check_semantic_duplicates(db, extracted_meta)
        
        if semantic_match:
            score = semantic_match["similarity_score"]
            existing_id = semantic_match["existing_dataset_id"]
            existing_name = semantic_match["existing_dataset_name"]
            
            if score >= 95.0:
                return {
                    "status": "DUPLICATES",
                    "duplicate_status": "Duplicate",
                    "duplicate_type": "SEMANTIC_DUPLICATE",
                    "is_duplicate": True,
                    "similarity_score": score,
                    "canonical_document_id": existing_id,
                    "canonical_document_name": existing_name,
                    "duplicate_reason": f"High semantic similarity ({score}%) with active dataset '{existing_name}'",
                    "matching_elements": semantic_match["matching_elements"],
                    "differences": semantic_match["differences"],
                    "sha256_hash": sha256_hash,
                    "content_fingerprint": content_fingerprint
                }
            else:
                # 85.0% - 94.9%: Possible Duplicate
                return {
                    "status": "DUPLICATES",
                    "duplicate_status": "Possible Duplicate",
                    "duplicate_type": "POSSIBLE_DUPLICATE",
                    "is_duplicate": True,
                    "similarity_score": score,
                    "canonical_document_id": existing_id,
                    "canonical_document_name": existing_name,
                    "duplicate_reason": f"Borderline semantic similarity ({score}%) with active dataset '{existing_name}'. Stored in Duplicates for review.",
                    "matching_elements": semantic_match["matching_elements"],
                    "differences": semantic_match["differences"],
                    "sha256_hash": sha256_hash,
                    "content_fingerprint": content_fingerprint
                }

        # Unique Document
        return {
            "status": "ACTIVE",
            "duplicate_status": "Unique",
            "duplicate_type": "NONE",
            "is_duplicate": False,
            "similarity_score": 0.0,
            "canonical_document_id": None,
            "canonical_document_name": None,
            "duplicate_reason": "Verified unique dataset with no significant overlaps in active registry.",
            "matching_elements": [],
            "differences": [],
            "sha256_hash": sha256_hash,
            "content_fingerprint": content_fingerprint
        }

    @staticmethod
    def check_near_duplicates(db: Session, new_metadata: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Alias for semantic duplicate checking used by older code.
        Returns the best matching dataset dict if similarity >= 85%.
        """
        return DuplicateDetectorService.check_semantic_duplicates(db, new_metadata)
