from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_current_user, get_optional_user
from database import get_conn

router = APIRouter(prefix="/api/votes", tags=["votes"])


class VoteBody(BaseModel):
    vote: int  # 1 = upvote, -1 = downvote


@router.post("/{listing_id}")
def cast_vote(listing_id: int, body: VoteBody, current_user: dict = Depends(get_current_user)):
    if body.vote not in (1, -1):
        raise HTTPException(400, "Vote must be 1 or -1")

    with get_conn() as conn:
        listing = conn.execute(
            "SELECT seller_id FROM listings WHERE id = ?", (listing_id,)
        ).fetchone()
        if not listing:
            raise HTTPException(404, "Listing not found")
        if listing["seller_id"] == current_user["id"]:
            raise HTTPException(400, "Cannot vote on your own listing")

        existing = conn.execute(
            "SELECT vote FROM listing_votes WHERE user_id = ? AND listing_id = ?",
            (current_user["id"], listing_id),
        ).fetchone()

        if existing:
            old_vote = existing["vote"]
            if old_vote == body.vote:
                # Same vote again = remove it (toggle off)
                conn.execute(
                    "DELETE FROM listing_votes WHERE user_id = ? AND listing_id = ?",
                    (current_user["id"], listing_id),
                )
                # Undo the old vote from the counter
                col = "upvotes" if old_vote == 1 else "downvotes"
                conn.execute(
                    f"UPDATE listings SET {col} = MAX(0, {col} - 1) WHERE id = ?",
                    (listing_id,),
                )
                action = "removed"
            else:
                # Switching vote direction
                conn.execute(
                    "UPDATE listing_votes SET vote = ? WHERE user_id = ? AND listing_id = ?",
                    (body.vote, current_user["id"], listing_id),
                )
                old_col = "upvotes" if old_vote == 1 else "downvotes"
                new_col = "upvotes" if body.vote == 1 else "downvotes"
                conn.execute(
                    f"UPDATE listings SET {old_col} = MAX(0, {old_col} - 1), {new_col} = {new_col} + 1 WHERE id = ?",
                    (listing_id,),
                )
                action = "switched"
        else:
            # New vote
            conn.execute(
                "INSERT INTO listing_votes (user_id, listing_id, vote) VALUES (?, ?, ?)",
                (current_user["id"], listing_id, body.vote),
            )
            col = "upvotes" if body.vote == 1 else "downvotes"
            conn.execute(
                f"UPDATE listings SET {col} = {col} + 1 WHERE id = ?",
                (listing_id,),
            )
            action = "cast"

        row = conn.execute(
            "SELECT upvotes, downvotes FROM listings WHERE id = ?", (listing_id,)
        ).fetchone()

    return {
        "action":    action,
        "upvotes":   row["upvotes"],
        "downvotes": row["downvotes"],
        "net":       row["upvotes"] - row["downvotes"],
    }


@router.get("/{listing_id}/my-vote")
def get_my_vote(listing_id: int, current_user: dict = Depends(get_current_user)):
    """Return the current user's vote on a listing (0 if none)."""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT vote FROM listing_votes WHERE user_id = ? AND listing_id = ?",
            (current_user["id"], listing_id),
        ).fetchone()
    return {"vote": row["vote"] if row else 0}
