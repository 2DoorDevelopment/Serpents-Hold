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
                if old_vote == 1:
                    conn.execute(
                        "UPDATE listings SET upvotes = MAX(0, upvotes - 1) WHERE id = ?",
                        (listing_id,),
                    )
                else:
                    conn.execute(
                        "UPDATE listings SET downvotes = MAX(0, downvotes - 1) WHERE id = ?",
                        (listing_id,),
                    )
                action = "removed"
            else:
                # Switching vote direction
                conn.execute(
                    "UPDATE listing_votes SET vote = ? WHERE user_id = ? AND listing_id = ?",
                    (body.vote, current_user["id"], listing_id),
                )
                if old_vote == 1:
                    conn.execute(
                        "UPDATE listings SET upvotes = MAX(0, upvotes - 1), downvotes = downvotes + 1 WHERE id = ?",
                        (listing_id,),
                    )
                else:
                    conn.execute(
                        "UPDATE listings SET downvotes = MAX(0, downvotes - 1), upvotes = upvotes + 1 WHERE id = ?",
                        (listing_id,),
                    )
                action = "switched"
        else:
            # New vote
            conn.execute(
                "INSERT INTO listing_votes (user_id, listing_id, vote) VALUES (?, ?, ?)",
                (current_user["id"], listing_id, body.vote),
            )
            if body.vote == 1:
                conn.execute(
                    "UPDATE listings SET upvotes = upvotes + 1 WHERE id = ?",
                    (listing_id,),
                )
            else:
                conn.execute(
                    "UPDATE listings SET downvotes = downvotes + 1 WHERE id = ?",
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
