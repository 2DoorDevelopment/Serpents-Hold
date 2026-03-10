from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import get_current_user, get_optional_user
from database import get_conn

router = APIRouter(prefix="/api/ratings", tags=["ratings"])


class RatingBody(BaseModel):
    seller_id:  int
    score:      int = Field(..., ge=1, le=5)
    comment:    str = ""
    listing_id: Optional[int] = None


@router.post("")
def leave_rating(body: RatingBody, current_user: dict = Depends(get_current_user)):
    if body.seller_id == current_user["id"]:
        raise HTTPException(400, "Cannot rate yourself")

    with get_conn() as conn:
        seller = conn.execute("SELECT id FROM users WHERE id = ?", (body.seller_id,)).fetchone()
        if not seller:
            raise HTTPException(404, "Seller not found")

        try:
            conn.execute("""
                INSERT INTO ratings (reviewer_id, seller_id, listing_id, score, comment)
                VALUES (?, ?, ?, ?, ?)
            """, (current_user["id"], body.seller_id, body.listing_id, body.score, body.comment))
        except Exception:
            raise HTTPException(409, "You have already rated this transaction")

    return {"success": True}


# Fixed-path routes MUST come before parameterized routes to avoid shadowing
@router.get("/my-reviews")
def my_reviews(current_user: dict = Depends(get_current_user)):
    """Reviews the current user has left."""
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT r.*, u.username AS seller_name
            FROM ratings r
            JOIN users u ON r.seller_id = u.id
            WHERE r.reviewer_id = ?
            ORDER BY r.created_at DESC
        """, (current_user["id"],)).fetchall()
    return [dict(r) for r in rows]


@router.get("/seller/{seller_id}")
def get_seller_ratings(seller_id: int, _=Depends(get_optional_user)):
    """Return all ratings for a seller with reviewer info and summary stats."""
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT r.*, u.username AS reviewer_name
            FROM ratings r
            JOIN users u ON r.reviewer_id = u.id
            WHERE r.seller_id = ?
            ORDER BY r.created_at DESC
        """, (seller_id,)).fetchall()

        stats = conn.execute("""
            SELECT COUNT(*) AS total,
                   ROUND(AVG(score), 2) AS average,
                   SUM(CASE WHEN score = 5 THEN 1 ELSE 0 END) AS five_star,
                   SUM(CASE WHEN score = 4 THEN 1 ELSE 0 END) AS four_star,
                   SUM(CASE WHEN score = 3 THEN 1 ELSE 0 END) AS three_star,
                   SUM(CASE WHEN score = 2 THEN 1 ELSE 0 END) AS two_star,
                   SUM(CASE WHEN score = 1 THEN 1 ELSE 0 END) AS one_star
            FROM ratings WHERE seller_id = ?
        """, (seller_id,)).fetchone()

    return {
        "stats":   dict(stats) if stats else {},
        "ratings": [dict(r) for r in rows],
    }


@router.delete("/{rating_id}")
def delete_rating(rating_id: int, current_user: dict = Depends(get_current_user)):
    """Reviewer can delete their own rating; admins can delete any."""
    with get_conn() as conn:
        rating = conn.execute("SELECT * FROM ratings WHERE id = ?", (rating_id,)).fetchone()
        if not rating:
            raise HTTPException(404, "Rating not found")
        if rating["reviewer_id"] != current_user["id"] and current_user["role"] != "admin":
            raise HTTPException(403, "Not your rating")
        conn.execute("DELETE FROM ratings WHERE id = ?", (rating_id,))
    return {"success": True}
