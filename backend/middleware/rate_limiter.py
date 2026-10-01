import time
from typing import Tuple
from collections import defaultdict
from fastapi import Request, HTTPException, status
from backend.models.security import SecurityEvent
from backend.database.connection import SessionLocal

class SlidingWindowRateLimiter:
    """
    Sliding window in-memory rate limiter.
    Protects sensitive endpoints against credential stuffing, brute force, and flood attacks.
    """
    def __init__(self):
        # Maps (ip, endpoint_category) -> list of timestamp floats
        self._history = defaultdict(list)

    def is_rate_limited(self, ip: str, category: str, limit: int, window_seconds: int = 60) -> Tuple[bool, int]:

        now = time.time()
        key = f"{ip}:{category}"
        timestamps = self._history[key]

        # Purge older than window
        cutoff = now - window_seconds
        valid_ts = [t for t in timestamps if t > cutoff]
        self._history[key] = valid_ts

        if len(valid_ts) >= limit:
            return True, int(window_seconds - (now - valid_ts[0]))

        self._history[key].append(now)
        return False, 0

    def check_and_enforce(self, request: Request, category: str, limit: int = 30, window_seconds: int = 60):
        client_ip = request.client.host if request.client else "127.0.0.1"
        limited, retry_after = self.is_rate_limited(client_ip, category, limit, window_seconds)
        if limited:
            # Log RATE_LIMIT security event
            db = SessionLocal()
            try:
                sec_evt = SecurityEvent(
                    event_type="RATE_LIMIT",
                    severity="Medium",
                    risk_score=35,
                    risk_level="MEDIUM",
                    action_taken="RATE_LIMIT",
                    source=f"RateLimiter:{category}",
                    status="BLOCKED",
                    username=f"ip_{client_ip}",
                    ip=client_ip,
                    details=f"Rate limit exceeded on '{category}' ({limit} req / {window_seconds}s)"
                )
                db.add(sec_evt)
                db.commit()
            except Exception:
                pass
            finally:
                db.close()

            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many requests. Rate limit of {limit} requests per minute exceeded. Please retry in {retry_after}s.",
                headers={"Retry-After": str(max(1, retry_after))}
            )

rate_limiter = SlidingWindowRateLimiter()
Tuple_bool = tuple[bool, int]
