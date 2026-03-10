import os
import asyncio
import logging
from pathlib import Path

from fastapi import Body, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from database import init_db
from routers import (
    admin, announcements, auth, direct_messages, favorites,
    item_types, listings, messages, ratings, reports, votes, uex_import,
    item_reports, missing_items, notifications, deals, orgs, templates,
    public_api, moderation, share_card, image_upload,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s")
logger = logging.getLogger("serpents_hold")

# ---------- App ----------

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app = FastAPI(title="SERPENT'S HOLD — Underground Market", docs_url="/api/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOADS_DIR = Path(__file__).parent / "uploads"

# ---------- 429 handler (for rate limiter) ----------

@app.exception_handler(429)
async def rate_limit_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=429,
        content={"detail": exc.detail},
        headers=exc.headers or {},
    )

# ---------- Startup ----------

@app.on_event("startup")
async def startup():
    init_db()
    UPLOADS_DIR.mkdir(exist_ok=True)
    asyncio.create_task(expiry_warning_loop())
    logger.info("SERPENT'S HOLD started — DB initialised, background jobs running")


# ── Expiry Warning Background Job ─────────────────────────────────────────────

EXPIRY_WARNING_DAYS   = 3
EXPIRY_CHECK_INTERVAL = 3600  # once per hour

async def expiry_warning_loop():
    await asyncio.sleep(30)   # let DB settle on first boot
    while True:
        try:
            _run_expiry_check()
        except Exception:
            logger.exception("[expiry-job] unhandled error")
        await asyncio.sleep(EXPIRY_CHECK_INTERVAL)


def _run_expiry_check():
    from database import get_conn
    from routers.notifications import create_notification, TYPE_EXPIRING
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT l.id, l.title, l.seller_id, l.expires_at,
                   CAST((julianday(l.expires_at) - julianday('now')) AS INTEGER) AS days_left
            FROM listings l
            WHERE l.status = 'active'
              AND l.expires_at IS NOT NULL
              AND julianday(l.expires_at) - julianday('now') <= ?
              AND julianday(l.expires_at) - julianday('now') >= 0
              AND l.expiry_warned = 0
        """, (EXPIRY_WARNING_DAYS,)).fetchall()

        for row in rows:
            days = max(0, row["days_left"])
            when = "today" if days == 0 else f"in {days} day{'s' if days != 1 else ''}"
            create_notification(
                conn,
                user_id    = row["seller_id"],
                notif_type = TYPE_EXPIRING,
                title      = f"Listing expiring {when}",
                body       = f'"{row["title"]}" will expire {when}. Renew it to keep it visible.',
                link       = f"/listing/{row['id']}",
            )
            conn.execute("UPDATE listings SET expiry_warned = 1 WHERE id = ?", (row["id"],))


# ---------- Routers ----------

app.include_router(auth.router)
app.include_router(listings.router)
app.include_router(messages.router)
app.include_router(admin.router)
app.include_router(reports.router)
app.include_router(item_types.router)
app.include_router(favorites.router)
app.include_router(ratings.router)
app.include_router(announcements.router)
app.include_router(direct_messages.router)
app.include_router(votes.router)
app.include_router(uex_import.router)
app.include_router(item_reports.router)
app.include_router(missing_items.router)
app.include_router(notifications.router)
app.include_router(deals.router)
app.include_router(orgs.router)
app.include_router(templates.router)
app.include_router(public_api.router)
app.include_router(moderation.router)
app.include_router(share_card.router)
app.include_router(image_upload.router)


# ---------- One-time admin setup ----------
# Auto-disables once any admin exists

@app.post("/api/setup-admin")
def setup_admin(username: str = Body(...), secret: str = Body(...)):
    expected = os.getenv("SETUP_SECRET", "setup-secret-change-me")
    if secret != expected:
        raise HTTPException(403, "Wrong secret")
    from database import get_conn
    with get_conn() as conn:
        # Disable after first admin to reduce attack surface
        existing_admin = conn.execute(
            "SELECT id FROM users WHERE role = 'admin'"
        ).fetchone()
        if existing_admin:
            raise HTTPException(409, "An admin already exists. Use the mod panel to manage roles.")
        updated = conn.execute(
            "UPDATE users SET role = 'admin' WHERE username = ?", (username,)
        ).rowcount
    if not updated:
        raise HTTPException(404, f"User '{username}' not found")
    logger.info("setup-admin: '%s' promoted to admin", username)
    return {"success": True, "message": f"{username} is now admin"}


# ---------- Static files ----------

app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
