from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_admin_user, get_optional_user
from database import get_conn

router = APIRouter(prefix="/api/item-types", tags=["item-types"])


class ItemTypeBody(BaseModel):
    name:        str
    category:    str
    subcategory: str = ""
    description: str = ""
    image_url:   str = ""
    active:      bool = True


VALID_CATEGORIES = {"commodities", "ships", "fps-gear"}


@router.get("")
def list_item_types(
    category:     Optional[str] = None,
    search:       Optional[str] = None,
    active_only:  bool = True,
    _=Depends(get_optional_user),
):
    query  = "SELECT * FROM item_types WHERE 1=1"
    params: list = []

    if active_only:
        query += " AND active = 1"
    if category and category in VALID_CATEGORIES:
        query += " AND category = ?"
        params.append(category)
    if search:
        query += " AND (name LIKE ? OR description LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])

    query += " ORDER BY category, name ASC"

    with get_conn() as conn:
        rows = conn.execute(query, params).fetchall()
    return [dict(r) for r in rows]


@router.get("/{item_type_id}")
def get_item_type(item_type_id: int):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM item_types WHERE id = ?", (item_type_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Item type not found")
    return dict(row)


@router.post("")
def create_item_type(body: ItemTypeBody, _=Depends(get_admin_user)):
    if body.category not in VALID_CATEGORIES:
        raise HTTPException(400, "Invalid category")

    with get_conn() as conn:
        cur = conn.execute("""
            INSERT INTO item_types (name, category, subcategory, description, image_url, active)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (body.name, body.category, body.subcategory,
              body.description, body.image_url, 1 if body.active else 0))
        row = conn.execute("SELECT * FROM item_types WHERE id = ?", (cur.lastrowid,)).fetchone()
    return dict(row)


@router.put("/{item_type_id}")
def update_item_type(item_type_id: int, body: ItemTypeBody, _=Depends(get_admin_user)):
    with get_conn() as conn:
        existing = conn.execute("SELECT * FROM item_types WHERE id = ?", (item_type_id,)).fetchone()
        if not existing:
            raise HTTPException(404, "Item type not found")
        if body.category not in VALID_CATEGORIES:
            raise HTTPException(400, "Invalid category")

        conn.execute("""
            UPDATE item_types
            SET name = ?, category = ?, subcategory = ?, description = ?, image_url = ?, active = ?
            WHERE id = ?
        """, (body.name, body.category, body.subcategory,
              body.description, body.image_url, 1 if body.active else 0, item_type_id))

        row = conn.execute("SELECT * FROM item_types WHERE id = ?", (item_type_id,)).fetchone()
    return dict(row)


@router.delete("/{item_type_id}")
def delete_item_type(item_type_id: int, _=Depends(get_admin_user)):
    with get_conn() as conn:
        existing = conn.execute("SELECT * FROM item_types WHERE id = ?", (item_type_id,)).fetchone()
        if not existing:
            raise HTTPException(404, "Item type not found")
        conn.execute("DELETE FROM item_types WHERE id = ?", (item_type_id,))
    return {"success": True}


@router.patch("/{item_type_id}/toggle")
def toggle_item_type(item_type_id: int, _=Depends(get_admin_user)):
    """Flip active/inactive without full update."""
    with get_conn() as conn:
        existing = conn.execute("SELECT * FROM item_types WHERE id = ?", (item_type_id,)).fetchone()
        if not existing:
            raise HTTPException(404, "Item type not found")
        conn.execute(
            "UPDATE item_types SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END WHERE id = ?",
            (item_type_id,),
        )
        row = conn.execute("SELECT * FROM item_types WHERE id = ?", (item_type_id,)).fetchone()
    return dict(row)
