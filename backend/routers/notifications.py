"""
Notifications Router
In-app notification system. Other routers call create_notification() to insert.
Users poll /unread-count every 60s for badge updates.

Endpoints:
  GET  /api/notifications                 — list (paginated, optional unread_only)
  GET  /api/notifications/unread-count    — lightweight count for badge
  PUT  /api/notifications/read-all        — mark all read
  PUT  /api/notifications/{id}/read       — mark one read
  DELETE /api/notifications/{id}          — delete one
"""

from fastapi import APIRouter, Depends
from database import get_conn
from auth import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

TYPE_MESSAGE          = "message"
TYPE_EXPIRING         = "expiring"
TYPE_ITEM_ADDED       = "item_added"
TYPE_REPORT_RESOLVED  = "report_resolved"
TYPE_DEAL             = "deal"
TYPE_SYSTEM           = "system"


def create_notification(conn, user_id: int, notif_type: str, title: str, body: str, link: str = ""):
    """Call from other routers within an open connection to insert a notification."""
    conn.execute(
        "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
        (user_id, notif_type, title, body, link)
    )


@router.get("/unread-count")
def unread_count(user=Depends(get_current_user)):
    with get_conn() as conn:
        count = conn.execute(
            "SELECT COUNT(*) FROM notifications WHERE user_id=? AND read=0",
            (user["id"],)
        ).fetchone()[0]
    return {"count": count}


@router.get("")
def list_notifications(
    page: int = 1,
    limit: int = 20,
    unread_only: bool = False,
    user=Depends(get_current_user)
):
    with get_conn() as conn:
        where  = "user_id=?"
        params = [user["id"]]
        if unread_only:
            where += " AND read=0"

        total  = conn.execute(f"SELECT COUNT(*) FROM notifications WHERE {where}", params).fetchone()[0]
        unread = conn.execute("SELECT COUNT(*) FROM notifications WHERE user_id=? AND read=0", (user["id"],)).fetchone()[0]
        rows   = conn.execute(
            f"SELECT * FROM notifications WHERE {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
            params + [limit, (page-1)*limit]
        ).fetchall()

    return {"notifications": [dict(r) for r in rows], "total": total, "unread": unread, "page": page}


@router.put("/read-all")
def mark_all_read(user=Depends(get_current_user)):
    with get_conn() as conn:
        conn.execute("UPDATE notifications SET read=1 WHERE user_id=?", (user["id"],))
    return {"ok": True}


@router.put("/{notif_id}/read")
def mark_read(notif_id: int, user=Depends(get_current_user)):
    with get_conn() as conn:
        conn.execute("UPDATE notifications SET read=1 WHERE id=? AND user_id=?", (notif_id, user["id"]))
    return {"ok": True}


@router.delete("/{notif_id}")
def delete_notification(notif_id: int, user=Depends(get_current_user)):
    with get_conn() as conn:
        conn.execute("DELETE FROM notifications WHERE id=? AND user_id=?", (notif_id, user["id"]))
    return {"ok": True}
