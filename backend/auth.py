import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from database import get_conn

SECRET_KEY = os.getenv("JWT_SECRET", "sc-underground-secret-change-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)


# ---------- Passwords ----------

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ---------- Tokens ----------

def create_token(user_id: int, username: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "username": username, "role": role, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


# ---------- Dependencies ----------

def _get_user_from_token(credentials: Optional[HTTPAuthorizationCredentials]) -> Optional[dict]:
    if not credentials:
        return None
    try:
        payload = decode_token(credentials.credentials)
        return {
            "id": int(payload["sub"]),
            "username": payload["username"],
            "role": payload["role"],
        }
    except JWTError:
        return None


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    user = _get_user_from_token(credentials)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    with get_conn() as conn:
        # Re-fetch banned status AND role on every request.
        # This ensures bans and role changes (e.g. moderator promotion) take
        # effect immediately without waiting for token expiry.
        row = conn.execute(
            "SELECT banned, role FROM users WHERE id = ?", (user["id"],)
        ).fetchone()
        if not row or row["banned"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account banned or not found")
        # Sync role from DB in case it changed since token was issued
        user["role"] = row["role"]
        try:
            conn.execute(
                "UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?",
                (user["id"],),
            )
        except Exception:
            pass

    return user


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Optional[dict]:
    return _get_user_from_token(credentials)


def get_admin_user(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


def get_mod_user(user: dict = Depends(get_current_user)) -> dict:
    """Accepts admin or moderator roles."""
    if user["role"] not in ("admin", "moderator"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Moderator access required")
    return user


# ---------- Helpers ----------

def sanitize_user(row) -> dict:
    d = dict(row)
    d.pop("password_hash", None)
    return d
