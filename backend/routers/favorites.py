from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from database import get_conn

router = APIRouter(prefix="/api/favorites", tags=["favorites"])


@router.get("")
def get_favorites(current_user: dict = Depends(get_current_user)):
    """Return all favorited listings for the current user."""
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT l.*, u.username AS seller_name, u.rsi_verified AS seller_verified,
                   f.created_at AS favorited_at
            FROM favorites f
            JOIN listings l ON f.listing_id = l.id
            JOIN users    u ON l.seller_id   = u.id
            WHERE f.user_id = ?
            ORDER BY f.created_at DESC
        """, (current_user["id"],)).fetchall()
    return [dict(r) for r in rows]


@router.post("/{listing_id}")
def add_favorite(listing_id: int, current_user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        listing = conn.execute("SELECT id FROM listings WHERE id = ?", (listing_id,)).fetchone()
        if not listing:
            raise HTTPException(404, "Listing not found")
        try:
            conn.execute(
                "INSERT INTO favorites (user_id, listing_id) VALUES (?, ?)",
                (current_user["id"], listing_id),
            )
        except Exception:
            raise HTTPException(409, "Already favorited")
    return {"success": True, "listing_id": listing_id}


@router.delete("/{listing_id}")
def remove_favorite(listing_id: int, current_user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        conn.execute(
            "DELETE FROM favorites WHERE user_id = ? AND listing_id = ?",
            (current_user["id"], listing_id),
        )
    return {"success": True}


@router.get("/check/{listing_id}")
def check_favorite(listing_id: int, current_user: dict = Depends(get_current_user)):
    """Check if a single listing is favorited by the current user."""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id FROM favorites WHERE user_id = ? AND listing_id = ?",
            (current_user["id"], listing_id),
        ).fetchone()
    return {"favorited": row is not None}
