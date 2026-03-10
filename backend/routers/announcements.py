from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_admin_user, get_optional_user
from database import get_conn

router = APIRouter(prefix="/api/announcements", tags=["announcements"])


class AnnouncementBody(BaseModel):
    title:  str
    body:   str
    pinned: bool = False
    active: bool = True


@router.get("")
def list_announcements(
    include_inactive: bool = False,
    _=Depends(get_optional_user),
):
    query = "SELECT a.*, u.username AS author_name FROM announcements a JOIN users u ON a.author_id = u.id"
    if not include_inactive:
        query += " WHERE a.active = 1"
    query += " ORDER BY a.pinned DESC, a.created_at DESC"

    with get_conn() as conn:
        rows = conn.execute(query).fetchall()
    return [dict(r) for r in rows]


@router.post("")
def create_announcement(body: AnnouncementBody, admin=Depends(get_admin_user)):
    with get_conn() as conn:
        cur = conn.execute("""
            INSERT INTO announcements (author_id, title, body, pinned, active)
            VALUES (?, ?, ?, ?, ?)
        """, (admin["id"], body.title, body.body,
              1 if body.pinned else 0, 1 if body.active else 0))
        row = conn.execute("SELECT * FROM announcements WHERE id = ?", (cur.lastrowid,)).fetchone()
    return dict(row)


@router.put("/{announcement_id}")
def update_announcement(
    announcement_id: int,
    body: AnnouncementBody,
    _=Depends(get_admin_user),
):
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT * FROM announcements WHERE id = ?", (announcement_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(404, "Announcement not found")

        conn.execute("""
            UPDATE announcements SET title = ?, body = ?, pinned = ?, active = ?
            WHERE id = ?
        """, (body.title, body.body,
              1 if body.pinned else 0, 1 if body.active else 0,
              announcement_id))

        row = conn.execute(
            "SELECT * FROM announcements WHERE id = ?", (announcement_id,)
        ).fetchone()
    return dict(row)


@router.delete("/{announcement_id}")
def delete_announcement(announcement_id: int, _=Depends(get_admin_user)):
    with get_conn() as conn:
        conn.execute("DELETE FROM announcements WHERE id = ?", (announcement_id,))
    return {"success": True}
