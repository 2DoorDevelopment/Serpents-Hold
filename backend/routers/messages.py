from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from auth import get_current_user
from database import get_conn
from routers.notifications import create_notification

router = APIRouter(prefix="/api/messages", tags=["messages"])


class MessageBody(BaseModel):
    listing_id: int
    body: str
    type: Optional[str] = "inquiry"

class ReplyBody(BaseModel):
    body: str


VALID_TYPES = {"inquiry", "buy", "barter"}


@router.post("")
def send_message(body: MessageBody, current_user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        listing = conn.execute("SELECT * FROM listings WHERE id = ?", (body.listing_id,)).fetchone()
        if not listing:
            raise HTTPException(404, "Listing not found")
        if listing["seller_id"] == current_user["id"]:
            raise HTTPException(400, "Cannot message yourself")

        msg_type = body.type if body.type in VALID_TYPES else "inquiry"

        cur = conn.execute("""
            INSERT INTO messages (listing_id, sender_id, recipient_id, body, type)
            VALUES (?, ?, ?, ?, ?)
        """, (body.listing_id, current_user["id"], listing["seller_id"], body.body, msg_type))

        msg = conn.execute("SELECT * FROM messages WHERE id = ?", (cur.lastrowid,)).fetchone()

        # Notify the seller
        create_notification(
            conn,
            user_id=listing["seller_id"],
            notif_type="message",
            title=f'New {msg_type} on "{listing["title"]}"',
            body=f"{current_user['username']}: {body.body[:80]}{'...' if len(body.body)>80 else ''}",
            link=f"/listing/{body.listing_id}"
        )

    return dict(msg)


@router.get("/inbox")
def get_inbox(current_user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT m.*, u.username AS sender_name,
                         l.title    AS listing_title,
                         l.image_url AS listing_image
            FROM messages m
            JOIN users    u ON m.sender_id   = u.id
            JOIN listings l ON m.listing_id  = l.id
            WHERE m.recipient_id = ?
            ORDER BY m.created_at DESC
        """, (current_user["id"],)).fetchall()
    return [dict(r) for r in rows]


@router.get("/sent")
def get_sent(current_user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT m.*, u.username  AS recipient_name,
                         l.title    AS listing_title,
                         l.image_url AS listing_image
            FROM messages m
            JOIN users    u ON m.recipient_id = u.id
            JOIN listings l ON m.listing_id   = l.id
            WHERE m.sender_id = ?
            ORDER BY m.created_at DESC
        """, (current_user["id"],)).fetchall()
    return [dict(r) for r in rows]


@router.get("/unread-count")
def unread_count(current_user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        count = conn.execute(
            "SELECT COUNT(*) FROM messages WHERE recipient_id = ? AND read = 0",
            (current_user["id"],),
        ).fetchone()[0]
    return {"count": count}


@router.put("/{message_id}/read")
def mark_read(message_id: int, current_user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        msg = conn.execute("SELECT * FROM messages WHERE id = ?", (message_id,)).fetchone()
        if not msg:
            raise HTTPException(404, "Message not found")
        if msg["recipient_id"] != current_user["id"]:
            raise HTTPException(403, "Not your message")
        conn.execute("UPDATE messages SET read = 1 WHERE id = ?", (message_id,))
    return {"success": True}


@router.post("/{message_id}/reply")
def reply_message(message_id: int, body: ReplyBody, current_user: dict = Depends(get_current_user)):
    if not body.body.strip():
        raise HTTPException(400, "Body required")

    with get_conn() as conn:
        original = conn.execute("SELECT * FROM messages WHERE id = ?", (message_id,)).fetchone()
        if not original:
            raise HTTPException(404, "Message not found")
        if original["recipient_id"] != current_user["id"]:
            raise HTTPException(403, "Not your message")

        cur = conn.execute("""
            INSERT INTO messages (listing_id, sender_id, recipient_id, body, type)
            VALUES (?, ?, ?, ?, 'reply')
        """, (original["listing_id"], current_user["id"], original["sender_id"], body.body))

        msg = conn.execute("SELECT * FROM messages WHERE id = ?", (cur.lastrowid,)).fetchone()

    return dict(msg)
