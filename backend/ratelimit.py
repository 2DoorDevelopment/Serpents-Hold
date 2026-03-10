"""
Simple in-memory rate limiter.

Usage:
    limiter = RateLimiter(max_calls=5, window_seconds=60)

    @router.post("/login")
    def login(request: Request, ...):
        limiter.check(request)   # raises HTTP 429 if limit exceeded
        ...

This is intentionally simple — no Redis, no persistence across restarts.
Good enough for a small self-hosted deployment. For production scale,
swap out the store for Redis with a sliding window.
"""

import time
import threading
from collections import defaultdict, deque
from fastapi import HTTPException, Request


class RateLimiter:
    def __init__(self, max_calls: int, window_seconds: int):
        self.max_calls = max_calls
        self.window    = window_seconds
        self._store: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def _get_ip(self, request: Request) -> str:
        # Respect X-Forwarded-For for reverse-proxy deployments
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def check(self, request: Request, key_suffix: str = "") -> None:
        ip  = self._get_ip(request)
        key = f"{ip}:{key_suffix}" if key_suffix else ip
        now = time.monotonic()

        with self._lock:
            q = self._store[key]
            # Evict timestamps outside the window
            while q and now - q[0] > self.window:
                q.popleft()
            if len(q) >= self.max_calls:
                retry_after = int(self.window - (now - q[0])) + 1
                raise HTTPException(
                    status_code=429,
                    detail=f"Too many requests. Try again in {retry_after}s.",
                    headers={"Retry-After": str(retry_after)},
                )
            q.append(now)

    def reset(self, request: Request, key_suffix: str = "") -> None:
        """Call after a successful auth to clear the counter (prevents lockout on legit use)."""
        ip  = self._get_ip(request)
        key = f"{ip}:{key_suffix}" if key_suffix else ip
        with self._lock:
            self._store.pop(key, None)


# Shared limiter instances
login_limiter    = RateLimiter(max_calls=10,  window_seconds=60)   # 10 attempts / min
register_limiter = RateLimiter(max_calls=5,   window_seconds=300)  # 5 new accounts / 5 min
upload_limiter   = RateLimiter(max_calls=20,  window_seconds=3600) # 20 uploads / hour
api_limiter      = RateLimiter(max_calls=120, window_seconds=60)   # public API: 120 req/min
