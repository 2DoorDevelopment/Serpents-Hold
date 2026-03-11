import os
import uuid

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr

from auth import (
    create_token,
    get_current_user,
    hash_password,
    sanitize_user,
    verify_password,
)
from database import get_conn
from ratelimit import login_limiter, register_limiter
from trust import compute_trust_score

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Input length caps
MAX_USERNAME_LEN = 32
MAX_PASSWORD_LEN = 128
MAX_EMAIL_LEN    = 254
MAX_BIO_LEN      = 500
MAX_URL_LEN      = 500

# ---------- Discord OAuth2 config ----------

DISCORD_CLIENT_ID     = os.getenv("DISCORD_CLIENT_ID", "")
DISCORD_CLIENT_SECRET = os.getenv("DISCORD_CLIENT_SECRET", "")
DISCORD_REDIRECT_URI  = os.getenv("DISCORD_REDIRECT_URI", "http://localhost:3000/api/auth/discord/callback")
DISCORD_SCOPES        = "identify email"

DISCORD_OAUTH_URL  = "https://discord.com/api/oauth2/authorize"
DISCORD_TOKEN_URL  = "https://discord.com/api/oauth2/token"
DISCORD_USER_URL   = "https://discord.com/api/users/@me"


# ---------- Schemas ----------

class RegisterBody(BaseModel):
    username: str
    email: EmailStr
    password: str

class LoginBody(BaseModel):
    username: str   # accepts username or email
    password: str

class ProfileBody(BaseModel):
    bio:        str = ""
    avatar_url: str = ""

class RsiHandleBody(BaseModel):
    rsi_handle: str


# ---------- Routes ----------

@router.post("/register")
def register(body: RegisterBody, request: Request):
    register_limiter.check(request)

    if len(body.username) < 3 or len(body.username) > MAX_USERNAME_LEN:
        raise HTTPException(400, f"Username must be 3–{MAX_USERNAME_LEN} characters")
    if len(body.password) < 8 or len(body.password) > MAX_PASSWORD_LEN:
        raise HTTPException(400, f"Password must be 8–{MAX_PASSWORD_LEN} characters")
    if len(body.email) > MAX_EMAIL_LEN:
        raise HTTPException(400, "Email too long")

    hashed = hash_password(body.password)
    try:
        with get_conn() as conn:
            cur = conn.execute(
                "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
                (body.username.strip(), body.email, hashed),
            )
            user = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
    except Exception as e:
        if "UNIQUE" in str(e):
            raise HTTPException(409, "Username or email already taken")
        raise HTTPException(500, "Server error")

    token = create_token(user["id"], user["username"], user["role"])
    return {"token": token, "user": sanitize_user(user)}


@router.post("/login")
def login(body: LoginBody, request: Request):
    login_limiter.check(request)

    with get_conn() as conn:
        user = conn.execute(
            "SELECT * FROM users WHERE username = ? OR email = ?",
            (body.username, body.username),
        ).fetchone()

    try:
        pw_ok = bool(user) and verify_password(body.password, user["password_hash"])
    except Exception:
        pw_ok = False
    if not pw_ok:
        raise HTTPException(401, "Invalid credentials")
    if user["banned"]:
        raise HTTPException(403, "Account banned")

    # On success reset the limiter so legit users don't get locked out
    login_limiter.reset(request)
    token = create_token(user["id"], user["username"], user["role"])
    return {"token": token, "user": sanitize_user(user)}


@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        user = conn.execute("SELECT * FROM users WHERE id = ?", (current_user["id"],)).fetchone()
    if not user:
        raise HTTPException(404, "User not found")
    return sanitize_user(user)


@router.put("/profile")
def update_profile(body: ProfileBody, current_user: dict = Depends(get_current_user)):
    bio        = body.bio[:MAX_BIO_LEN]
    avatar_url = body.avatar_url[:MAX_URL_LEN]
    with get_conn() as conn:
        conn.execute(
            "UPDATE users SET bio = ?, avatar_url = ? WHERE id = ?",
            (bio, avatar_url, current_user["id"]),
        )
        user = conn.execute("SELECT * FROM users WHERE id = ?", (current_user["id"],)).fetchone()
    return sanitize_user(user)


@router.post("/rsi/generate-code")
def generate_rsi_code(body: RsiHandleBody, current_user: dict = Depends(get_current_user)):
    if not body.rsi_handle.strip():
        raise HTTPException(400, "RSI handle required")

    code = "SC-VERIFY-" + uuid.uuid4().hex[:8].upper()
    with get_conn() as conn:
        conn.execute(
            "UPDATE users SET rsi_handle = ?, rsi_verify_code = ?, rsi_verified = 0 WHERE id = ?",
            (body.rsi_handle.strip(), code, current_user["id"]),
        )
    return {
        "code": code,
        "instructions": (
            f'Add "{code}" anywhere in your RSI bio at '
            f"https://robertsspaceindustries.com/citizens/{body.rsi_handle.strip()} then click Verify."
        ),
    }


@router.post("/rsi/verify")
async def verify_rsi(current_user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        user = conn.execute("SELECT * FROM users WHERE id = ?", (current_user["id"],)).fetchone()

    if not user["rsi_handle"] or not user["rsi_verify_code"]:
        raise HTTPException(400, "Generate a verification code first")

    url = f"https://robertsspaceindustries.com/citizens/{user['rsi_handle']}"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
                follow_redirects=True,
            )
        soup = BeautifulSoup(resp.text, "html.parser")
        page_text = soup.get_text()

        if user["rsi_verify_code"] in page_text:
            with get_conn() as conn:
                conn.execute("UPDATE users SET rsi_verified = 1 WHERE id = ?", (user["id"],))
            return {"verified": True, "message": "RSI account verified successfully!"}
        else:
            return {
                "verified": False,
                "message": f'Code "{user["rsi_verify_code"]}" not found in your RSI bio. Make sure it is saved and public.',
            }
    except httpx.RequestError:
        raise HTTPException(502, "Could not reach RSI website. Try again shortly.")


# ---------- Discord OAuth2 ----------

@router.get("/discord/redirect")
def discord_redirect():
    """Step 1: redirect the browser to Discord's consent screen."""
    if not DISCORD_CLIENT_ID:
        raise HTTPException(503, "Discord OAuth is not configured on this server.")

    import urllib.parse
    params = urllib.parse.urlencode({
        "client_id":     DISCORD_CLIENT_ID,
        "redirect_uri":  DISCORD_REDIRECT_URI,
        "response_type": "code",
        "scope":         DISCORD_SCOPES,
        "prompt":        "consent",
    })
    return RedirectResponse(f"{DISCORD_OAUTH_URL}?{params}")


@router.get("/discord/callback")
async def discord_callback(code: str = None, error: str = None):
    """
    Step 2: Discord redirects back here with ?code=...
    Exchange the code for a token, fetch the Discord user, then
    create-or-find a local account and return a JWT via redirect to /#discord-token=...
    """
    if error or not code:
        return RedirectResponse("/#discord-error=access_denied")

    if not DISCORD_CLIENT_ID or not DISCORD_CLIENT_SECRET:
        return RedirectResponse("/#discord-error=not_configured")

    async with httpx.AsyncClient(timeout=15) as client:
        # Exchange authorization code for access token
        token_resp = await client.post(
            DISCORD_TOKEN_URL,
            data={
                "client_id":     DISCORD_CLIENT_ID,
                "client_secret": DISCORD_CLIENT_SECRET,
                "grant_type":    "authorization_code",
                "code":          code,
                "redirect_uri":  DISCORD_REDIRECT_URI,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if token_resp.status_code != 200:
            return RedirectResponse("/#discord-error=token_exchange_failed")

        token_data    = token_resp.json()
        access_token  = token_data.get("access_token")
        if not access_token:
            return RedirectResponse("/#discord-error=no_access_token")

        # Fetch Discord user profile
        user_resp = await client.get(
            DISCORD_USER_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if user_resp.status_code != 200:
            return RedirectResponse("/#discord-error=user_fetch_failed")

        discord_user = user_resp.json()

    discord_id  = discord_user["id"]
    discord_tag = discord_user.get("username", "")          # e.g. "NoahX"
    discord_email = discord_user.get("email")               # may be None if scope missing
    avatar_hash = discord_user.get("avatar")
    avatar_url  = (
        f"https://cdn.discordapp.com/avatars/{discord_id}/{avatar_hash}.png"
        if avatar_hash else ""
    )

    with get_conn() as conn:
        # Try to find existing account linked to this Discord ID
        user = conn.execute(
            "SELECT * FROM users WHERE discord_id = ?", (discord_id,)
        ).fetchone()

        if not user and discord_email:
            # Try to match by email so existing accounts get linked automatically
            user = conn.execute(
                "SELECT * FROM users WHERE email = ?", (discord_email,)
            ).fetchone()
            if user:
                # Link Discord to the matched account
                conn.execute(
                    "UPDATE users SET discord_id = ?, discord_tag = ? WHERE id = ?",
                    (discord_id, discord_tag, user["id"]),
                )
                user = conn.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()

        if not user:
            # Brand-new user — create account from Discord data
            base_username = discord_tag or f"user_{discord_id[-6:]}"
            username = base_username
            # Ensure username uniqueness
            suffix = 1
            while conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone():
                username = f"{base_username}_{suffix}"
                suffix += 1

            try:
                cur = conn.execute("""
                    INSERT INTO users
                      (username, email, password_hash, avatar_url, discord_id, discord_tag)
                    VALUES (?, ?, '', ?, ?, ?)
                """, (username, discord_email, avatar_url, discord_id, discord_tag))
                user = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
            except Exception:
                return RedirectResponse("/#discord-error=account_creation_failed")

        if user["banned"]:
            return RedirectResponse("/#discord-error=banned")

    jwt = create_token(user["id"], user["username"], user["role"])
    # Pass JWT back to the SPA via hash fragment — never touches server logs
    return RedirectResponse(f"/#discord-token={jwt}")


@router.get("/public/{username}")
def public_profile(username: str):
    """Public seller profile — no auth required."""
    with get_conn() as conn:
        user = conn.execute("""
            SELECT id, username, bio, avatar_url, rsi_handle, rsi_verified,
                   role, created_at, last_active_at
            FROM users WHERE username = ? AND banned = 0
        """, (username,)).fetchone()
        if not user:
            raise HTTPException(404, "User not found")
        user = dict(user)

        # Rating stats
        stats = conn.execute("""
            SELECT COUNT(*) AS count, AVG(score) AS avg
            FROM ratings WHERE seller_id = ?
        """, (user["id"],)).fetchone()
        user["rating_count"] = stats["count"]
        user["rating_avg"]   = round(stats["avg"], 1) if stats["avg"] else None

        # Recent reviews
        reviews = conn.execute("""
            SELECT r.score, r.comment, r.created_at,
                   u.username AS reviewer_name, u.avatar_url AS reviewer_avatar,
                   l.title AS listing_title
            FROM ratings r
            JOIN users u    ON u.id = r.reviewer_id
            JOIN listings l ON l.id = r.listing_id
            WHERE r.seller_id = ?
            ORDER BY r.created_at DESC LIMIT 10
        """, (user["id"],)).fetchall()
        user["reviews"] = [dict(r) for r in reviews]

        # Deal stats
        deal_stats = conn.execute("""
            SELECT
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_deals,
                SUM(CASE WHEN status = 'disputed'  THEN 1 ELSE 0 END) AS disputed_deals
            FROM deals WHERE seller_id = ?
        """, (user["id"],)).fetchone()
        user["completed_deals"] = deal_stats["completed_deals"]
        user["disputed_deals"]  = deal_stats["disputed_deals"]

        # Active listing count
        listing_count = conn.execute(
            "SELECT COUNT(*) FROM listings WHERE seller_id = ? AND status = 'active'",
            (user["id"],)
        ).fetchone()[0]
        user["active_listings"] = listing_count

        # Trust score
        user["trust"] = compute_trust_score(
            rsi_verified    = bool(user["rsi_verified"]),
            completed_deals = user["completed_deals"],
            disputed_deals  = user["disputed_deals"],
            rating_avg      = user["rating_avg"],
            rating_count    = user["rating_count"],
            created_at      = user["created_at"],
        )

    return user

@router.get("/search/users")
def search_users(
    q:     str = Query(..., min_length=1, max_length=100),
    page:  int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=40),
):
    """
    Search users by username prefix (case-insensitive).
    Returns compact user cards — no sensitive data.
    """
    with get_conn() as conn:
        like  = f"{q}%"
        total = conn.execute(
            "SELECT COUNT(*) FROM users WHERE username LIKE ? AND banned=0", (like,)
        ).fetchone()[0]
        rows  = conn.execute("""
            SELECT u.id, u.username, u.avatar_url, u.rsi_verified, u.bio,
                   u.created_at, u.last_active_at,
                   (SELECT COUNT(*) FROM listings l
                    WHERE l.seller_id=u.id AND l.status='active') AS active_listings,
                   (SELECT COUNT(*) FROM deals d
                    WHERE d.seller_id=u.id AND d.status='completed') AS completed_deals,
                   (SELECT ROUND(AVG(r.score),1) FROM ratings r
                    WHERE r.seller_id=u.id) AS rating_avg,
                   (SELECT COUNT(*) FROM ratings r
                    WHERE r.seller_id=u.id) AS rating_count
            FROM users u
            WHERE u.username LIKE ? AND u.banned=0
            ORDER BY u.username ASC
            LIMIT ? OFFSET ?
        """, (like, limit, (page - 1) * limit)).fetchall()

    return {"users": [dict(r) for r in rows], "total": total, "page": page, "q": q}
