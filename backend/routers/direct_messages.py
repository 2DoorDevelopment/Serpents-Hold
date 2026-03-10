from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_current_user
from database import get_conn

router = APIRouter(prefix="/api/dm", tags=["direct-messages"])


class DMBody(BaseModel):
    recipient_id: int
    body: str


@router.post("")
def send_dm(body: DMBody, current_user: dict = Depends(get_current_user)):
    if not body.body.strip():
        raise HTTPException(400, "Message cannot be empty")
    if body.recipient_id == current_user["id"]:
        raise HTTPException(400, "Cannot message yourself")

    with get_conn() as conn:
        recipient = conn.execute(
            "SELECT id FROM users WHERE id = ?", (body.recipient_id,)
        ).fetchone()
        if not recipient:
            raise HTTPException(404, "User not found")

        cur = conn.execute("""
            INSERT INTO direct_messages (sender_id, recipient_id, body)
            VALUES (?, ?, ?)
        """, (current_user["id"], body.recipient_id, body.body))
        msg = conn.execute(
            "SELECT * FROM direct_messages WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
    return dict(msg)


# All fixed-path GET routes declared before parameterized GET routes
@router.get("/inbox")
def dm_inbox(current_user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT dm.*, u.username AS sender_name
            FROM direct_messages dm
            JOIN users u ON dm.sender_id = u.id
            WHERE dm.recipient_id = ?
            ORDER BY dm.created_at DESC
        """, (current_user["id"],)).fetchall()
    return [dict(r) for r in rows]


@router.get("/sent")
def dm_sent(current_user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT dm.*, u.username AS recipient_name
            FROM direct_messages dm
            JOIN users u ON dm.recipient_id = u.id
            WHERE dm.sender_id = ?
            ORDER BY dm.created_at DESC
        """, (current_user["id"],)).fetchall()
    return [dict(r) for r in rows]


@router.get("/unread-count")
def dm_unread_count(current_user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        count = conn.execute(
            "SELECT COUNT(*) FROM direct_messages WHERE recipient_id = ? AND read = 0",
            (current_user["id"],),
        ).fetchone()[0]
    return {"count": count}


@router.get("/conversations")
def dm_conversations(current_user: dict = Depends(get_current_user)):
    """Return one entry per conversation partner with the latest message."""
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT
                other_id,
                u.username AS other_username,
                last_body,
                last_at,
                unread_count
            FROM (
                SELECT
                    CASE WHEN sender_id = :me THEN recipient_id ELSE sender_id END AS other_id,
                    body       AS last_body,
                    created_at AS last_at,
                    SUM(CASE WHEN recipient_id = :me AND read = 0 THEN 1 ELSE 0 END)
                        OVER (PARTITION BY CASE WHEN sender_id = :me THEN recipient_id ELSE sender_id END)
                        AS unread_count,
                    ROW_NUMBER() OVER (
                        PARTITION BY CASE WHEN sender_id = :me THEN recipient_id ELSE sender_id END
                        ORDER BY created_at DESC
                    ) AS rn
                FROM direct_messages
                WHERE sender_id = :me OR recipient_id = :me
            ) sub
            JOIN users u ON u.id = other_id
            WHERE rn = 1
            ORDER BY last_at DESC
        """, {"me": current_user["id"]}).fetchall()
    return [dict(r) for r in rows]


# Parameterized routes come last
@router.get("/thread/{other_user_id}")
def dm_thread(other_user_id: int, current_user: dict = Depends(get_current_user)):
    """Full conversation between two users, chronological."""
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT dm.*,
                   s.username AS sender_name,
                   r.username AS recipient_name
            FROM direct_messages dm
            JOIN users s ON dm.sender_id    = s.id
            JOIN users r ON dm.recipient_id = r.id
            WHERE (dm.sender_id = ? AND dm.recipient_id = ?)
               OR (dm.sender_id = ? AND dm.recipient_id = ?)
            ORDER BY dm.created_at ASC
        """, (current_user["id"], other_user_id,
              other_user_id, current_user["id"])).fetchall()

        # Mark incoming messages as read
        conn.execute("""
            UPDATE direct_messages SET read = 1
            WHERE sender_id = ? AND recipient_id = ? AND read = 0
        """, (other_user_id, current_user["id"]))

    return [dict(r) for r in rows]


@router.put("/{dm_id}/read")
def mark_dm_read(dm_id: int, current_user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        msg = conn.execute("SELECT * FROM direct_messages WHERE id = ?", (dm_id,)).fetchone()
        if not msg:
            raise HTTPException(404, "Message not found")
        if msg["recipient_id"] != current_user["id"]:
            raise HTTPException(403, "Not your message")
        conn.execute("UPDATE direct_messages SET read = 1 WHERE id = ?", (dm_id,))
    return {"success": True}
