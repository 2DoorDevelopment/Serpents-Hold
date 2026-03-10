from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_admin_user, sanitize_user
from database import get_conn

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ---------- Schemas ----------

class UpdateUserBody(BaseModel):
    role:   Optional[str]  = None
    banned: Optional[bool] = None

class UpdateListingBody(BaseModel):
    status:      Optional[str]   = None
    title:       Optional[str]   = None
    description: Optional[str]   = None
    price:       Optional[float] = None


# ---------- Stats ----------

@router.get("/stats")
def stats(_=Depends(get_admin_user)):
    with get_conn() as conn:
        def count(query):
            return conn.execute(query).fetchone()[0]

        return {
            "total_users":      count("SELECT COUNT(*) FROM users"),
            "total_listings":   count("SELECT COUNT(*) FROM listings"),
            "active_listings":  count("SELECT COUNT(*) FROM listings WHERE status = 'active'"),
            "sold_listings":    count("SELECT COUNT(*) FROM listings WHERE status = 'sold'"),
            "expired_listings": count("SELECT COUNT(*) FROM listings WHERE status = 'expired'"),
            "total_messages":   count("SELECT COUNT(*) FROM messages") + count("SELECT COUNT(*) FROM direct_messages"),
            "banned_users":     count("SELECT COUNT(*) FROM users WHERE banned = 1"),
            "pending_reports":  count("SELECT COUNT(*) FROM reports WHERE status='open'"),
            "total_item_types": count("SELECT COUNT(*) FROM item_types"),
            "active_item_types":count("SELECT COUNT(*) FROM item_types WHERE active = 1"),
            "total_ratings":    count("SELECT COUNT(*) FROM ratings"),
        }


# ---------- Users ----------

@router.get("/users")
def list_users(search: Optional[str] = None, page: int = 1, limit: int = 50, _=Depends(get_admin_user)):
    query = "SELECT id, username, email, role, rsi_handle, rsi_verified, banned, created_at FROM users"
    params: list = []
    if search:
        query += " WHERE username LIKE ? OR email LIKE ?"
        params.extend([f"%{search}%", f"%{search}%"])
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, (page - 1) * limit])

    with get_conn() as conn:
        rows = conn.execute(query, params).fetchall()
    return [dict(r) for r in rows]


@router.put("/users/{user_id}")
def update_user(user_id: int, body: UpdateUserBody, _=Depends(get_admin_user)):
    with get_conn() as conn:
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            raise HTTPException(404, "User not found")

        updates, params = [], []
        if body.role is not None:
            updates.append("role = ?")
            params.append(body.role)
        if body.banned is not None:
            updates.append("banned = ?")
            params.append(1 if body.banned else 0)
        if not updates:
            raise HTTPException(400, "Nothing to update")

        params.append(user_id)
        conn.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = ?", params)
        row = conn.execute(
            "SELECT id, username, email, role, banned FROM users WHERE id = ?", (user_id,)
        ).fetchone()
    return dict(row)


@router.delete("/users/{user_id}")
def delete_user(user_id: int, _=Depends(get_admin_user)):
    with get_conn() as conn:
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    return {"success": True}


# ---------- Listings ----------

@router.get("/listings")
def list_all_listings(status: Optional[str] = None, page: int = 1, limit: int = 50, _=Depends(get_admin_user)):
    query = """
        SELECT l.*, u.username AS seller_name
        FROM listings l JOIN users u ON l.seller_id = u.id
    """
    params: list = []
    if status:
        query += " WHERE l.status = ?"
        params.append(status)
    query += " ORDER BY l.created_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, (page - 1) * limit])

    with get_conn() as conn:
        rows = conn.execute(query, params).fetchall()
    return [dict(r) for r in rows]


@router.put("/listings/{listing_id}")
def update_listing(listing_id: int, body: UpdateListingBody, _=Depends(get_admin_user)):
    with get_conn() as conn:
        existing = conn.execute("SELECT * FROM listings WHERE id = ?", (listing_id,)).fetchone()
        if not existing:
            raise HTTPException(404, "Listing not found")

        conn.execute("""
            UPDATE listings
            SET status      = COALESCE(?, status),
                title       = COALESCE(?, title),
                description = COALESCE(?, description),
                price       = COALESCE(?, price),
                updated_at  = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (body.status, body.title, body.description, body.price, listing_id))

        row = conn.execute("SELECT * FROM listings WHERE id = ?", (listing_id,)).fetchone()
    return dict(row)


@router.delete("/listings/{listing_id}")
def delete_listing(listing_id: int, _=Depends(get_admin_user)):
    with get_conn() as conn:
        conn.execute("DELETE FROM listings WHERE id = ?", (listing_id,))
    return {"success": True}


# ---------- Reports ----------

@router.get("/reports")
def list_reports(_=Depends(get_admin_user)):
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM reports ORDER BY created_at DESC").fetchall()
    return [dict(r) for r in rows]


@router.put("/reports/{report_id}/resolve")
def resolve_report(report_id: int, _=Depends(get_admin_user)):
    with get_conn() as conn:
        conn.execute(
            "UPDATE reports SET resolved=1, status='resolved' WHERE id=?",
            (report_id,)
        )
    return {"success": True}
