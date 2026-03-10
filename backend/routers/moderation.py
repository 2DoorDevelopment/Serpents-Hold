"""
Moderation Router
─────────────────────────────────────────────────────────────────────────────
Moderators can hide/unhide listings, warn users, and view a mod log.
They cannot: change user roles, delete users, access site settings,
or do anything only admins can do.

Role hierarchy:  admin > moderator > user

Endpoints:
  GET  /api/mod/queue               — listings flagged by users (reports), paginated
  PUT  /api/mod/listings/{id}/hide  — hide listing from marketplace
  PUT  /api/mod/listings/{id}/show  — unhide listing
  POST /api/mod/users/{id}/warn     — send a formal warning notification to user
  PUT  /api/mod/users/{id}/ban      — ban user (admin only)
  PUT  /api/mod/users/{id}/unban    — unban user (admin only)
  GET  /api/mod/log                 — mod action log (mod+)
  GET  /api/mod/stats               — quick counts for mod dashboard
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from database import get_conn
from auth import get_current_user, get_mod_user, get_admin_user
from routers.notifications import create_notification, TYPE_SYSTEM

router = APIRouter(prefix="/api/mod", tags=["moderation"])


# ── Models ────────────────────────────────────────────────────────────────────

class HideBody(BaseModel):
    reason: str = Field("", max_length=300)

class WarnBody(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)

class BanBody(BaseModel):
    reason: str = Field("", max_length=500)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _log_action(conn, mod_id: int, action: str, target_type: str,
                target_id: int, notes: str = ""):
    conn.execute("""
        INSERT INTO mod_log (mod_id, action, target_type, target_id, notes)
        VALUES (?, ?, ?, ?, ?)
    """, (mod_id, action, target_type, target_id, notes))


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/stats")
def mod_stats(mod=Depends(get_mod_user)):
    with get_conn() as conn:
        return {
            "open_reports":    conn.execute("SELECT COUNT(*) FROM reports WHERE status='open'").fetchone()[0],
            "hidden_listings": conn.execute("SELECT COUNT(*) FROM listings WHERE status='hidden'").fetchone()[0],
            "warned_users":    conn.execute("SELECT COUNT(DISTINCT target_id) FROM mod_log WHERE action='warn'").fetchone()[0],
            "banned_users":    conn.execute("SELECT COUNT(*) FROM users WHERE banned=1").fetchone()[0],
        }


@router.get("/queue")
def mod_queue(
    page:  int = 1,
    limit: int = 20,
    mod=Depends(get_mod_user)
):
    """Reported listings that still need review, newest first."""
    with get_conn() as conn:
        total = conn.execute(
            "SELECT COUNT(DISTINCT listing_id) FROM reports WHERE status='open'"
        ).fetchone()[0]

        rows = conn.execute("""
            SELECT l.id, l.title, l.status, l.category, l.created_at,
                   u.username AS seller_name,
                   COUNT(r.id) AS report_count,
                   GROUP_CONCAT(DISTINCT r.reason) AS reasons
            FROM reports r
            JOIN listings l ON l.id = r.listing_id
            JOIN users    u ON u.id = l.seller_id
            WHERE r.status = 'open'
            GROUP BY l.id
            ORDER BY report_count DESC, r.created_at DESC
            LIMIT ? OFFSET ?
        """, (limit, (page - 1) * limit)).fetchall()

    return {"items": [dict(r) for r in rows], "total": total, "page": page}


@router.put("/listings/{listing_id}/hide")
def hide_listing(listing_id: int, body: HideBody, mod=Depends(get_mod_user)):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM listings WHERE id=?", (listing_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Listing not found")
        if row["status"] == "hidden":
            raise HTTPException(400, "Already hidden")

        conn.execute(
            "UPDATE listings SET status='hidden', updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (listing_id,)
        )
        # Notify seller
        create_notification(
            conn, row["seller_id"], TYPE_SYSTEM,
            "Your listing has been hidden",
            f'"{row["title"]}" was hidden by a moderator.{(" Reason: " + body.reason) if body.reason else ""}',
            f"/listing/{listing_id}"
        )
        # Close open reports for this listing
        conn.execute(
            "UPDATE reports SET status='resolved' WHERE listing_id=? AND status='open'",
            (listing_id,)
        )
        _log_action(conn, mod["id"], "hide_listing", "listing", listing_id, body.reason)

    return {"ok": True}


@router.put("/listings/{listing_id}/show")
def show_listing(listing_id: int, mod=Depends(get_mod_user)):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM listings WHERE id=?", (listing_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Listing not found")
        conn.execute(
            "UPDATE listings SET status='active', updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (listing_id,)
        )
        _log_action(conn, mod["id"], "show_listing", "listing", listing_id)
    return {"ok": True}


@router.post("/users/{user_id}/warn")
def warn_user(user_id: int, body: WarnBody, mod=Depends(get_mod_user)):
    with get_conn() as conn:
        user = conn.execute("SELECT id, username FROM users WHERE id=?", (user_id,)).fetchone()
        if not user:
            raise HTTPException(404, "User not found")
        create_notification(
            conn, user_id, TYPE_SYSTEM,
            "⚠ Moderator Warning",
            f"You have received a formal warning from the moderation team. Reason: {body.reason}",
            "/profile"
        )
        _log_action(conn, mod["id"], "warn", "user", user_id, body.reason)
    return {"ok": True}


@router.put("/users/{user_id}/ban")
def ban_user(user_id: int, body: BanBody, admin=Depends(get_admin_user)):
    with get_conn() as conn:
        if not conn.execute("SELECT id FROM users WHERE id=?", (user_id,)).fetchone():
            raise HTTPException(404, "User not found")
        if user_id == admin["id"]:
            raise HTTPException(400, "Cannot ban yourself")
        conn.execute("UPDATE users SET banned=1 WHERE id=?", (user_id,))
        _log_action(conn, admin["id"], "ban", "user", user_id, body.reason)
    return {"ok": True}


@router.put("/users/{user_id}/unban")
def unban_user(user_id: int, admin=Depends(get_admin_user)):
    with get_conn() as conn:
        if not conn.execute("SELECT id FROM users WHERE id=?", (user_id,)).fetchone():
            raise HTTPException(404, "User not found")
        conn.execute("UPDATE users SET banned=0 WHERE id=?", (user_id,))
        _log_action(conn, admin["id"], "unban", "user", user_id)
    return {"ok": True}


@router.get("/log")
def mod_log(
    page:  int = 1,
    limit: int = 40,
    mod=Depends(get_mod_user)
):
    with get_conn() as conn:
        total = conn.execute("SELECT COUNT(*) FROM mod_log").fetchone()[0]
        rows  = conn.execute("""
            SELECT ml.*, u.username AS mod_name
            FROM mod_log ml
            JOIN users u ON u.id = ml.mod_id
            ORDER BY ml.created_at DESC
            LIMIT ? OFFSET ?
        """, (limit, (page - 1) * limit)).fetchall()
    return {"log": [dict(r) for r in rows], "total": total, "page": page}


@router.put("/users/{user_id}/set-role")
def set_user_role(user_id: int, role: str, admin=Depends(get_admin_user)):
    """Admin only — promote/demote between user/moderator/admin."""
    VALID = {"user", "moderator", "admin"}
    if role not in VALID:
        raise HTTPException(400, f"Role must be one of: {', '.join(VALID)}")
    if user_id == admin["id"]:
        raise HTTPException(400, "Cannot change your own role")
    with get_conn() as conn:
        if not conn.execute("SELECT id FROM users WHERE id=?", (user_id,)).fetchone():
            raise HTTPException(404, "User not found")
        conn.execute("UPDATE users SET role=? WHERE id=?", (role, user_id))
        _log_action(conn, admin["id"], f"set_role:{role}", "user", user_id)
    return {"ok": True}
