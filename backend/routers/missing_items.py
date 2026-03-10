"""
Missing Items Router
Users request items that aren't in the catalog yet. Others upvote to raise priority.
Admins resolve by linking to a newly added item_type, or close/reject.

  POST   /api/missing-items              — submit a request (auth)
  GET    /api/missing-items              — list (public, sorted by votes desc)
  GET    /api/missing-items/{id}         — single request (public)
  POST   /api/missing-items/{id}/vote    — upvote (auth, one per user)
  DELETE /api/missing-items/{id}/vote    — remove upvote (auth)
  PUT    /api/missing-items/{id}/resolve — admin: mark resolved + optional item_type link
  PUT    /api/missing-items/{id}/close   — admin: close/reject
  DELETE /api/missing-items/{id}         — admin: delete
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from auth import get_current_user, get_admin_user
from database import get_conn

router = APIRouter(prefix="/api/missing-items", tags=["missing-items"])


class RequestCreate(BaseModel):
    name: str
    category: str
    subcategory: str = ""
    description: str = ""


class ResolveBody(BaseModel):
    resolved_item_id: Optional[int] = None


@router.post("", status_code=201)
def create_request(body: RequestCreate, user=Depends(get_current_user)):
    name = body.name.strip()
    if not name or not body.category:
        raise HTTPException(400, "name and category are required")
    valid_cats = ("ships", "fps-gear", "commodities")
    if body.category not in valid_cats:
        raise HTTPException(400, f"category must be one of: {', '.join(valid_cats)}")
    with get_conn() as conn:
        # Prevent near-duplicate open requests from same user
        dupe = conn.execute(
            "SELECT id FROM missing_item_requests WHERE requester_id=? AND name=? AND status='open'",
            (user["id"], name)
        ).fetchone()
        if dupe:
            raise HTTPException(409, "You already have an open request for this item name")
        cursor = conn.execute(
            """INSERT INTO missing_item_requests (requester_id, name, category, subcategory, description, votes)
               VALUES (?,?,?,?,?,1)""",
            (user["id"], name, body.category, body.subcategory, body.description)
        )
        req_id = cursor.lastrowid
        # Auto-vote by requester
        conn.execute(
            "INSERT OR IGNORE INTO missing_item_votes (user_id, request_id) VALUES(?,?)",
            (user["id"], req_id)
        )
    return {"id": req_id, "message": "Request submitted"}


@router.get("")
def list_requests(status: str = "open", category: str = None):
    with get_conn() as conn:
        q = """
            SELECT mir.*, u.username AS requester
            FROM missing_item_requests mir
            JOIN users u ON u.id = mir.requester_id
            WHERE mir.status = ?
        """
        params = [status]
        if category:
            q += " AND mir.category = ?"
            params.append(category)
        q += " ORDER BY mir.votes DESC, mir.created_at DESC"
        rows = conn.execute(q, params).fetchall()
    return [dict(r) for r in rows]


@router.get("/{req_id}")
def get_request(req_id: int):
    with get_conn() as conn:
        row = conn.execute("""
            SELECT mir.*, u.username AS requester
            FROM missing_item_requests mir
            JOIN users u ON u.id = mir.requester_id
            WHERE mir.id = ?
        """, (req_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Request not found")
    return dict(row)


@router.post("/{req_id}/vote")
def vote(req_id: int, user=Depends(get_current_user)):
    with get_conn() as conn:
        req = conn.execute("SELECT id, votes FROM missing_item_requests WHERE id=? AND status='open'", (req_id,)).fetchone()
        if not req:
            raise HTTPException(404, "Request not found or not open")
        existing = conn.execute(
            "SELECT 1 FROM missing_item_votes WHERE user_id=? AND request_id=?",
            (user["id"], req_id)
        ).fetchone()
        if existing:
            raise HTTPException(409, "Already voted")
        conn.execute("INSERT INTO missing_item_votes (user_id, request_id) VALUES(?,?)", (user["id"], req_id))
        conn.execute("UPDATE missing_item_requests SET votes = votes + 1 WHERE id=?", (req_id,))
    return {"message": "Vote recorded"}


@router.delete("/{req_id}/vote")
def unvote(req_id: int, user=Depends(get_current_user)):
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT 1 FROM missing_item_votes WHERE user_id=? AND request_id=?",
            (user["id"], req_id)
        ).fetchone()
        if not existing:
            raise HTTPException(404, "No vote to remove")
        conn.execute("DELETE FROM missing_item_votes WHERE user_id=? AND request_id=?", (user["id"], req_id))
        conn.execute("UPDATE missing_item_requests SET votes = MAX(0, votes - 1) WHERE id=?", (req_id,))
    return {"message": "Vote removed"}


@router.put("/{req_id}/resolve")
def resolve_request(req_id: int, body: ResolveBody, _=Depends(get_admin_user)):
    with get_conn() as conn:
        if not conn.execute("SELECT id FROM missing_item_requests WHERE id=?", (req_id,)).fetchone():
            raise HTTPException(404, "Request not found")
        conn.execute(
            "UPDATE missing_item_requests SET status='resolved', resolved_item_id=? WHERE id=?",
            (body.resolved_item_id, req_id)
        )
    return {"message": "Resolved"}


@router.put("/{req_id}/close")
def close_request(req_id: int, _=Depends(get_admin_user)):
    with get_conn() as conn:
        if not conn.execute("SELECT id FROM missing_item_requests WHERE id=?", (req_id,)).fetchone():
            raise HTTPException(404, "Request not found")
        conn.execute("UPDATE missing_item_requests SET status='closed' WHERE id=?", (req_id,))
    return {"message": "Closed"}


@router.delete("/{req_id}")
def delete_request(req_id: int, _=Depends(get_admin_user)):
    with get_conn() as conn:
        conn.execute("DELETE FROM missing_item_votes WHERE request_id=?", (req_id,))
        conn.execute("DELETE FROM missing_item_requests WHERE id=?", (req_id,))
    return {"message": "Deleted"}
