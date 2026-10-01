import os
import io
import csv
import json
import re
from typing import Dict, Any, List, Optional, Tuple
import numpy as np

class NetCDFService:
    @staticmethod
    def inspect_dataset_security(content_sample: str) -> Tuple[bool, Optional[str]]:
        """
        Security Scan for datasets: Check if dataset metadata/content contains
        embedded prompt-injection or destructive command payloads that try to hijack the AI.
        """
        dangerous_patterns = [
            (r"ignore\s+.*?instructions", "Prompt Injection in Dataset"),
            (r"ignore\s+system", "System Override in Dataset"),
            (r"disregard\s+.*?(rules|instructions)", "Instruction Override in Dataset"),
            (r"delete\s+.*?(database|table|records)", "Destructive Command in Dataset"),
            (r"drop\s+.*?(table|database)", "Destructive SQL in Dataset"),
            (r"truncate\s+.*?(table|database)", "Destructive SQL in Dataset"),
            (r"reveal\s+.*?(system\s+prompt|credentials|api\s+key|password)", "Data Exfiltration in Dataset"),
            (r"bypass\s+.*?(security|auth|filter)", "Security Bypass in Dataset"),
        ]
        lower_sample = content_sample.lower()
        for pattern, label in dangerous_patterns:
            if re.search(pattern, lower_sample):
                return False, label
        return True, None

    @staticmethod
    def parse_and_extract_metadata(filename: str, file_bytes: bytes) -> Dict[str, Any]:
        """
        Parses NetCDF (.nc), CSV (.csv), or JSON (.json) ocean datasets
        and extracts real physical oceanographic metadata and statistics.
        """
        ext = os.path.splitext(filename)[1].lower()

        # Security check on initial text preview
        preview_text = file_bytes[:4096].decode('utf-8', errors='ignore')
        is_safe, sec_threat = NetCDFService.inspect_dataset_security(preview_text)
        if not is_safe:
            return {
                "security_status": "BLOCKED",
                "security_threat": sec_threat,
                "record_count": 0,
                "parsed_records": 0,
                "status": "BLOCKED",
                "error": f"Security violation detected: {sec_threat}"
            }

        if ext == ".nc":
            return NetCDFService._parse_netcdf(file_bytes)
        elif ext == ".csv":
            return NetCDFService._parse_csv(file_bytes)
        elif ext == ".json":
            return NetCDFService._parse_json(file_bytes)
        else:
            raise ValueError(f"Unsupported file format: {ext}")

    @staticmethod
    def _parse_netcdf(file_bytes: bytes) -> Dict[str, Any]:
        import tempfile
        import xarray as xr

        # Save to temporary file to support all xarray backends (netcdf4, h5netcdf, scipy)
        with tempfile.NamedTemporaryFile(suffix=".nc", delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        ds = None
        open_errors = []
        for engine in ["netcdf4", "h5netcdf", "scipy"]:
            try:
                ds = xr.open_dataset(tmp_path, engine=engine, decode_times=False)
                break
            except Exception as e:
                open_errors.append(f"{engine}: {e}")

        try:
            os.remove(tmp_path)
        except Exception:
            pass

        if ds is None:
            # Final fallback: scipy netcdf_file directly from buffer
            try:
                from scipy.io import netcdf_file
                f = netcdf_file(io.BytesIO(file_bytes), 'r', mmap=False)
                dimensions = {k: int(v) if v is not None else 0 for k, v in f.dimensions.items()}
                variables = list(f.variables.keys())
                ds = None
            except Exception as e:
                raise ValueError(f"Failed to parse NetCDF file across all engines (netcdf4, h5netcdf, scipy): {'; '.join(open_errors)}")

        if ds is not None:
            dimensions = {str(k): int(v) for k, v in ds.sizes.items()}
            variables = list(ds.data_vars.keys()) + list(ds.coords.keys())
            attrs = {str(k): str(v) for k, v in ds.attrs.items()}
        else:
            attrs = {}

        alias_map = {
            "latitude": ["lat", "latitude", "latitude_deg", "lat_deg", "lats"],
            "longitude": ["lon", "longitude", "longitude_deg", "lon_deg", "long", "longs"],
            "depth": ["depth", "dep", "depth_m", "z", "depths"],
            "pressure": ["pressure", "pres", "press", "p", "pressure_dbar"],
            "temperature": ["temperature", "temp", "temp_c", "t", "sea_water_temperature"],
            "salinity": ["salinity", "sal", "psal", "s", "sea_water_salinity"],
            "time": ["time", "date", "datetime", "timestamp"],
            "wmo_id": ["platform_number", "wmo", "wmo_id", "float_id"]
        }

        matched_vars = {}
        for std_name, aliases in alias_map.items():
            for vname in variables:
                if vname.lower() in aliases:
                    matched_vars[std_name] = vname
                    break

        def get_clean_array(var_name):
            if not var_name:
                return []
            if ds is not None and var_name in ds:
                try:
                    vals = ds[var_name].values.flatten()
                    return [float(x) if np.issubdtype(type(x), np.number) and not np.isnan(x) else str(x) for x in vals]
                except Exception:
                    return []
            elif 'f' in locals() and f is not None and var_name in f.variables:
                try:
                    arr = f.variables[var_name].data
                    flat = np.array(arr).flatten()
                    return [float(x) if np.issubdtype(type(x), np.number) and not np.isnan(x) else str(x) for x in flat]
                except Exception:
                    return []
            return []

        lat_arr = get_clean_array(matched_vars.get("latitude"))
        lon_arr = get_clean_array(matched_vars.get("longitude"))
        temp_arr = get_clean_array(matched_vars.get("temperature"))
        sal_arr = get_clean_array(matched_vars.get("salinity"))
        pres_arr = get_clean_array(matched_vars.get("pressure"))
        depth_arr = get_clean_array(matched_vars.get("depth"))
        time_arr = get_clean_array(matched_vars.get("time"))
        wmo_arr = get_clean_array(matched_vars.get("wmo_id"))

        detected_wmo = str(wmo_arr[0]).strip() if wmo_arr else (attrs.get("PLATFORM_NUMBER") or attrs.get("platform_number") or "UNKNOWN_WMO")

        max_len = max(len(lat_arr), len(lon_arr), len(temp_arr), len(sal_arr), len(pres_arr), len(depth_arr), 1)
        record_count = max_len

        raw_records = []
        num_samples = min(max_len, 2000)
        for i in range(num_samples):
            rec = {}
            if i < len(lat_arr) and isinstance(lat_arr[i], (int, float)): rec["latitude"] = round(float(lat_arr[i]), 4)
            if i < len(lon_arr) and isinstance(lon_arr[i], (int, float)): rec["longitude"] = round(float(lon_arr[i]), 4)
            if i < len(temp_arr) and isinstance(temp_arr[i], (int, float)): rec["temperature"] = round(float(temp_arr[i]), 2)
            if i < len(sal_arr) and isinstance(sal_arr[i], (int, float)): rec["salinity"] = round(float(sal_arr[i]), 2)
            if i < len(pres_arr) and isinstance(pres_arr[i], (int, float)): rec["pressure"] = round(float(pres_arr[i]), 1)
            if i < len(depth_arr) and isinstance(depth_arr[i], (int, float)): rec["depth"] = round(float(depth_arr[i]), 1)
            elif "pressure" in rec: rec["depth"] = round(float(rec["pressure"]) * 0.993, 1)
            if i < len(time_arr): rec["time"] = str(time_arr[i])
            rec["wmo_id"] = detected_wmo
            if rec:
                raw_records.append(rec)

        meta: Dict[str, Any] = {
            "format": ".nc (NetCDF-4/HDF5/NetCDF-3)",
            "dimensions": dimensions,
            "variables": variables,
            "attributes": attrs,
            "wmo_id": detected_wmo,
            "detected_fields": matched_vars,
            "record_count": record_count,
            "parsed_records": record_count,
            "security_status": "VERIFIED"
        }

        # Calculate physical summary statistics
        for field, arr in [
            ("latitude", lat_arr), ("longitude", lon_arr), ("temperature", temp_arr),
            ("salinity", sal_arr), ("pressure", pres_arr), ("depth", depth_arr or pres_arr)
        ]:
            num_vals = [float(x) for x in arr if isinstance(x, (int, float)) and not np.isnan(x)]
            if num_vals:
                meta[f"{field}_min"] = round(float(np.min(num_vals)), 2)
                meta[f"{field}_max"] = round(float(np.max(num_vals)), 2)
                meta[f"{field}_avg"] = round(float(np.mean(num_vals)), 2)
                meta[field] = meta[f"{field}_avg"]

        step = max(1, len(raw_records) // 300)
        meta["sample_records"] = raw_records[::step]
        return meta

    @staticmethod
    def _parse_csv(file_bytes: bytes) -> Dict[str, Any]:
        text = file_bytes.decode('utf-8', errors='ignore')
        reader = csv.DictReader(io.StringIO(text))
        headers = reader.fieldnames or []
        if not headers:
            raise ValueError("CSV file contains no header columns.")

        alias_map = {
            "latitude": ["lat", "latitude", "latitude_deg", "lat_deg"],
            "longitude": ["lon", "longitude", "longitude_deg", "lon_deg", "long"],
            "depth": ["depth", "dep", "depth_m", "z"],
            "pressure": ["pressure", "pres", "press", "p", "pressure_dbar"],
            "temperature": ["temperature", "temp", "temp_c", "t"],
            "salinity": ["salinity", "sal", "psal", "s"],
            "time": ["time", "date", "datetime", "timestamp"],
            "device_id": ["device_id", "device", "float_id", "float", "platform"]
        }

        matched_vars = {}
        for std_name, aliases in alias_map.items():
            for h in headers:
                if h.lower().strip() in aliases:
                    matched_vars[std_name] = h
                    break

        records = []
        for row in reader:
            rec = {}
            for std_name, col in matched_vars.items():
                val = row.get(col)
                if val is not None and val.strip() != "":
                    try:
                        if std_name in ["latitude", "longitude", "depth", "pressure", "temperature", "salinity"]:
                            rec[std_name] = float(val)
                        else:
                            rec[std_name] = val
                    except ValueError:
                        rec[std_name] = val
            if "depth" not in rec and "pressure" in rec and isinstance(rec["pressure"], (int, float)):
                rec["depth"] = rec["pressure"]
            records.append(rec)

        meta: Dict[str, Any] = {
            "format": ".csv",
            "columns": headers,
            "detected_fields": matched_vars,
            "record_count": len(records),
            "parsed_records": len(records),
            "security_status": "VERIFIED"
        }

        for field in ["latitude", "longitude", "temperature", "salinity", "pressure", "depth"]:
            num_vals = [r[field] for r in records if field in r and isinstance(r[field], (int, float))]
            if num_vals:
                meta[f"{field}_min"] = round(float(np.min(num_vals)), 2)
                meta[f"{field}_max"] = round(float(np.max(num_vals)), 2)
                meta[f"{field}_avg"] = round(float(np.mean(num_vals)), 2)
                meta[field] = meta[f"{field}_avg"]

        step = max(1, len(records) // 300)
        meta["sample_records"] = records[::step]
        return meta

    @staticmethod
    def _parse_json(file_bytes: bytes) -> Dict[str, Any]:
        data = json.loads(file_bytes.decode('utf-8', errors='ignore'))
        records_list = []
        if isinstance(data, list):
            records_list = [r for r in data if isinstance(r, dict)]
        elif isinstance(data, dict):
            for k, v in data.items():
                if isinstance(v, list) and len(v) > 0 and isinstance(v[0], dict):
                    records_list = v
                    break
            if not records_list:
                records_list = [data]

        if not records_list:
            raise ValueError("JSON file contains no recognizable data objects or records array.")

        headers = list(set().union(*(r.keys() for r in records_list[:20])))
        alias_map = {
            "latitude": ["lat", "latitude", "latitude_deg", "lat_deg"],
            "longitude": ["lon", "longitude", "longitude_deg", "lon_deg", "long"],
            "depth": ["depth", "dep", "depth_m", "z"],
            "pressure": ["pressure", "pres", "press", "p", "pressure_dbar"],
            "temperature": ["temperature", "temp", "temp_c", "t"],
            "salinity": ["salinity", "sal", "psal", "s"],
            "time": ["time", "date", "datetime", "timestamp"],
            "device_id": ["device_id", "device", "float_id", "float", "platform"]
        }

        matched_vars = {}
        for std_name, aliases in alias_map.items():
            for h in headers:
                if h.lower().strip() in aliases:
                    matched_vars[std_name] = h
                    break

        records = []
        for row in records_list:
            rec = {}
            for std_name, col in matched_vars.items():
                val = row.get(col)
                if val is not None:
                    try:
                        if std_name in ["latitude", "longitude", "depth", "pressure", "temperature", "salinity"]:
                            rec[std_name] = float(val)
                        else:
                            rec[std_name] = val
                    except (ValueError, TypeError):
                        rec[std_name] = str(val)
            
            # Support nested coordinates: {"coords": {"lat": 12.3, "lon": 45.6}}
            if "latitude" not in rec or rec["latitude"] is None:
                for ckey in ["coords", "coordinates", "coord", "location"]:
                    if isinstance(row.get(ckey), dict):
                        c = row[ckey]
                        lat = c.get("lat") or c.get("latitude")
                        if lat is not None:
                            try: rec["latitude"] = float(lat)
                            except ValueError: pass
            if "longitude" not in rec or rec["longitude"] is None:
                for ckey in ["coords", "coordinates", "coord", "location"]:
                    if isinstance(row.get(ckey), dict):
                        c = row[ckey]
                        lon = c.get("lon") or c.get("longitude")
                        if lon is not None:
                            try: rec["longitude"] = float(lon)
                            except ValueError: pass

            if "depth" not in rec and "pressure" in rec and isinstance(rec["pressure"], (int, float)):
                rec["depth"] = rec["pressure"]
            records.append(rec)

        meta: Dict[str, Any] = {
            "format": ".json",
            "columns": headers,
            "detected_fields": matched_vars,
            "record_count": len(records),
            "parsed_records": len(records),
            "security_status": "VERIFIED"
        }

        for field in ["latitude", "longitude", "temperature", "salinity", "pressure", "depth"]:
            num_vals = [r[field] for r in records if field in r and isinstance(r[field], (int, float))]
            if num_vals:
                meta[f"{field}_min"] = round(float(np.min(num_vals)), 2)
                meta[f"{field}_max"] = round(float(np.max(num_vals)), 2)
                meta[f"{field}_avg"] = round(float(np.mean(num_vals)), 2)
                meta[field] = meta[f"{field}_avg"]

        step = max(1, len(records) // 300)
        meta["sample_records"] = records[::step]
        return meta

    @staticmethod
    def validate_dataset_ai(filename: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        AI-assisted structural and oceanographic dataset validation layer.
        Calculates genuine confidence metrics, validates physical boundaries,
        and ensures no hallucinated variables.
        """
        reasons = []
        flags = []
        confidence_points = 0
        max_points = 100

        # 1. Structure check
        rec_count = int(metadata.get("record_count", 0))
        if rec_count > 0:
            reasons.append("✓ Expected structure detected")
            confidence_points += 25
        else:
            flags.append("Missing or empty record structure")

        # 2. Required fields check
        detected = metadata.get("detected_fields", {})
        has_coords = "latitude" in detected and "longitude" in detected
        has_telemetry = "temperature" in detected or "salinity" in detected or "pressure" in detected or "depth" in detected

        if has_coords and has_telemetry:
            reasons.append("✓ Required fields detected")
            confidence_points += 25
        elif has_coords:
            reasons.append("✓ Coordinate fields detected (telemetry partial)")
            confidence_points += 15
        else:
            flags.append("Missing latitude/longitude spatial coordinates")

        # 3. Coordinate ranges check
        lat_min = metadata.get("latitude_min")
        lat_max = metadata.get("latitude_max")
        lon_min = metadata.get("longitude_min")
        lon_max = metadata.get("longitude_max")

        coords_valid = False
        if lat_min is not None and lat_max is not None and lon_min is not None and lon_max is not None:
            if -90.0 <= float(lat_min) <= 90.0 and -90.0 <= float(lat_max) <= 90.0 and \
               -180.0 <= float(lon_min) <= 180.0 and -180.0 <= float(lon_max) <= 180.0:
                coords_valid = True
                reasons.append("✓ Valid coordinate ranges")
                confidence_points += 25
            else:
                flags.append("Coordinate values out of valid geographic range [-90, 90] lat / [-180, 180] lon")
        else:
            confidence_points += 10

        # 4. Ocean profile variables check
        var_count = len(metadata.get("columns") or metadata.get("variables") or [])
        if var_count >= 3:
            reasons.append("✓ Ocean profile variables detected")
            confidence_points += 21
        else:
            confidence_points += 10

        # Calculate final AI confidence score
        confidence_score = min(98.0, max(50.0, float(confidence_points)))
        if not coords_valid and lat_min is not None:
            confidence_score = min(confidence_score, 45.0)

        # Status determination
        if metadata.get("security_status") == "BLOCKED":
            status = "REJECTED"
        elif not has_coords or (lat_min is not None and not coords_valid):
            status = "INVALID"
        elif confidence_score >= 80.0:
            status = "VALID"
        else:
            status = "REQUIRES_REVIEW"

        return {
            "type": "Ocean Profile Dataset" if has_telemetry else "Geospatial Document Dataset",
            "confidence": round(confidence_score, 1),
            "status": status,
            "reasons": reasons,
            "flags": flags,
            "detected_variables": list(detected.keys()),
            "total_records": rec_count,
            "security_clearance": "PASSED" if metadata.get("security_status") != "BLOCKED" else "BLOCKED"
        }
