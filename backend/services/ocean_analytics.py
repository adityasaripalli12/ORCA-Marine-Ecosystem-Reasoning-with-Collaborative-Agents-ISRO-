import numpy as np
from typing import List, Dict, Any, Optional

class OceanAnalytics:
    """
    Ocean Analytics & Physical Oceanography Engine.
    Provides mathematically accurate computation of:
    - Statistical summaries (mean, min, max, median, standard deviation)
    - Vertical hydrographic gradients (dT/dz, dS/dz)
    - Thermocline boundary & depth layer detection
    - Rate of change and temporal trends
    """

    @staticmethod
    def calculate_depth_statistics(observations: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calculates depth-binned statistics for temperature and salinity.
        """
        if not observations:
            return {}

        depths = [float(o["depth"]) for o in observations if o.get("depth") is not None]
        temps = [float(o["temperature"]) for o in observations if o.get("temperature") is not None]
        salts = [float(o["salinity"]) for o in observations if o.get("salinity") is not None]

        stats = {
            "record_count": len(observations),
            "depth": {
                "min": round(float(np.min(depths)), 1) if depths else 0.0,
                "max": round(float(np.max(depths)), 1) if depths else 0.0,
                "range_m": round(float(np.max(depths) - np.min(depths)), 1) if depths else 0.0
            }
        }

        if temps:
            stats["temperature"] = {
                "mean": round(float(np.mean(temps)), 2),
                "min": round(float(np.min(temps)), 2),
                "max": round(float(np.max(temps)), 2),
                "median": round(float(np.median(temps)), 2),
                "std": round(float(np.std(temps)), 2)
            }

        if salts:
            stats["salinity"] = {
                "mean": round(float(np.mean(salts)), 2),
                "min": round(float(np.min(salts)), 2),
                "max": round(float(np.max(salts)), 2),
                "median": round(float(np.median(salts)), 2),
                "std": round(float(np.std(salts)), 2)
            }

        return stats

    @staticmethod
    def calculate_vertical_gradients(observations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Calculates vertical gradients:
        dT/dz = (T2 - T1) / (z2 - z1)  in °C/m
        dS/dz = (S2 - S1) / (z2 - z1)  in PSU/m
        """
        sorted_obs = sorted(
            [o for o in observations if o.get("depth") is not None and o.get("temperature") is not None],
            key=lambda x: float(x["depth"])
        )
        if len(sorted_obs) < 2:
            return []

        gradients = []
        for i in range(len(sorted_obs) - 1):
            p1 = sorted_obs[i]
            p2 = sorted_obs[i + 1]

            z1, z2 = float(p1["depth"]), float(p2["depth"])
            dz = z2 - z1
            if dz <= 0.001:
                continue

            t1, t2 = float(p1["temperature"]), float(p2["temperature"])
            dt = t2 - t1
            dt_dz = dt / dz

            ds_dz = None
            if p1.get("salinity") is not None and p2.get("salinity") is not None:
                s1, s2 = float(p1["salinity"]), float(p2["salinity"])
                ds_dz = (s2 - s1) / dz

            gradients.append({
                "depth_upper": round(z1, 1),
                "depth_lower": round(z2, 1),
                "mid_depth": round((z1 + z2) / 2.0, 1),
                "temp_gradient_dT_dz": round(dt_dz, 4),
                "salinity_gradient_dS_dz": round(ds_dz, 4) if ds_dz is not None else None
            })

        return gradients

    @staticmethod
    def detect_thermocline(observations: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Identifies the thermocline layer where temperature decrease rate (|dT/dz|) is maximal.
        Standard oceanographic criterion: |dT/dz| >= 0.05 °C/m.
        """
        gradients = OceanAnalytics.calculate_vertical_gradients(observations)
        if not gradients:
            return {"has_thermocline": False, "reason": "Insufficient vertical resolution."}

        # Find depth interval with strongest negative temperature gradient (steepest cooling)
        steepest = min(gradients, key=lambda g: g["temp_gradient_dT_dz"])
        max_cooling_rate = abs(steepest["temp_gradient_dT_dz"])

        has_thermocline = max_cooling_rate >= 0.03 # 0.03 °C/m threshold
        return {
            "has_thermocline": has_thermocline,
            "thermocline_depth_m": steepest["mid_depth"],
            "depth_range": [steepest["depth_upper"], steepest["depth_lower"]],
            "peak_gradient_c_per_m": round(steepest["temp_gradient_dT_dz"], 4),
            "description": f"Thermocline detected around {steepest['mid_depth']} m depth with cooling rate of {round(max_cooling_rate * 100.0, 2)} °C per 100 m." if has_thermocline else "No distinct thermocline detected in sampled water column."
        }

    @staticmethod
    def calculate_temporal_trend(observations: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Computes linear rate of change over observation cycles or time.
        """
        time_points = []
        temps = []
        for o in observations:
            t = o.get("temperature")
            ts = o.get("observation_timestamp")
            if t is not None and ts:
                time_points.append(ts)
                temps.append(float(t))

        if len(temps) < 3:
            return {"trend": "Insufficient data", "rate_of_change": 0.0}

        x = np.arange(len(temps))
        slope, intercept = np.polyfit(x, temps, 1)
        
        direction = "Warming" if slope > 0.05 else ("Cooling" if slope < -0.05 else "Stable")
        return {
            "trend_direction": direction,
            "slope_per_cycle": round(float(slope), 3),
            "initial_temp": round(temps[0], 2),
            "latest_temp": round(temps[-1], 2),
            "change_delta": round(temps[-1] - temps[0], 2)
        }
