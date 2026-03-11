"""
Listing Templates Router
─────────────────────────────────────────────────────────────────────────────
Users can save a listing form as a named template and repost from it in two
clicks. Templates store all form fields as JSON. They are private to the owner.

Endpoints:
  GET    /api/templates              — list my templates
  POST   /api/templates              — save current form as template
  GET    /api/templates/{id}         — load one template (returns full field set)
  DELETE /api/templates/{id}         — delete template
  PUT    /api/templates/{id}         — update template name/fields
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
import json
from database import get_conn
from auth import get_current_user

router = APIRouter(prefix="/api/templates", tags=["templates"])

MAX_TEMPLATES = 20   # per user


class TemplateCreate(BaseModel):
    name:         str   = Field(..., min_length=1, max_length=80)
    title:        str   = Field("", max_length=200)
    category:     str   = Field("", max_length=50)
    subcategory:  str   = Field("", max_length=80)
    description:  str   = Field("", max_length=2000)
    price:        float = Field(0, ge=0)
    currency:     str   = Field("aUEC", max_length=20)
    quantity:     int   = Field(1, ge=1)
    location:     str   = Field("", max_length=200)
    listing_type: str   = Field("WTS", max_length=4)
    system_name:  str   = Field("", max_length=40)
    availability: str   = Field("Immediate", max_length=60)
    source:       str   = Field("", max_length=60)
    language:     str   = Field("English", max_length=30)
    game_version: str   = Field("", max_length=20)
    image_url:    str   = Field("", max_length=500)
    item_type_id: Optional[int] = None
    org_id:       Optional[int] = None

class TemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=80)
    # Allow any field update via extra dict
    class Config:
        extra = "allow"


@router.get("")
def list_templates(user=Depends(get_current_user)):
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT id, name,
                   json_extract(fields, '$.category')     AS category,
                   json_extract(fields, '$.listing_type') AS listing_type,
                   json_extract(fields, '$.price')        AS price,
                   json_extract(fields, '$.currency')     AS currency,
                   created_at, updated_at
            FROM listing_templates
            WHERE user_id = ?
            ORDER BY updated_at DESC
        """, (user["id"],)).fetchall()
    return [dict(r) for r in rows]


@router.post("", status_code=201)
def create_template(body: TemplateCreate, user=Depends(get_current_user)):
    with get_conn() as conn:
        count = conn.execute(
            "SELECT COUNT(*) FROM listing_templates WHERE user_id=?", (user["id"],)
        ).fetchone()[0]
        if count >= MAX_TEMPLATES:
            raise HTTPException(400, f"Maximum {MAX_TEMPLATES} templates reached. Delete some first.")

        fields = body.model_dump()
        name   = fields.pop("name")

        cur = conn.execute("""
            INSERT INTO listing_templates (user_id, name, fields)
            VALUES (?, ?, ?)
        """, (user["id"], name, json.dumps(fields)))
    return {"id": cur.lastrowid, "name": name}


@router.get("/{tmpl_id}")
def get_template(tmpl_id: int, user=Depends(get_current_user)):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM listing_templates WHERE id=? AND user_id=?", (tmpl_id, user["id"])
        ).fetchone()
        if not row:
            raise HTTPException(404, "Template not found")
        t = dict(row)
        t["fields"] = json.loads(t["fields"])
    return t


@router.put("/{tmpl_id}")
def update_template(tmpl_id: int, body: TemplateUpdate, user=Depends(get_current_user)):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM listing_templates WHERE id=? AND user_id=?", (tmpl_id, user["id"])
        ).fetchone()
        if not row:
            raise HTTPException(404, "Template not found")

        t = dict(row)
        fields = json.loads(t["fields"])

        data = body.model_dump(exclude_unset=True)
        if "name" in data:
            new_name = data.pop("name")
        else:
            new_name = t["name"]

        fields.update(data)

        conn.execute("""
            UPDATE listing_templates SET name=?, fields=?, updated_at=CURRENT_TIMESTAMP
            WHERE id=?
        """, (new_name, json.dumps(fields), tmpl_id))
    return {"ok": True}


@router.delete("/{tmpl_id}")
def delete_template(tmpl_id: int, user=Depends(get_current_user)):
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id FROM listing_templates WHERE id=? AND user_id=?", (tmpl_id, user["id"])
        ).fetchone()
        if not existing:
            raise HTTPException(404, "Template not found")
        conn.execute("DELETE FROM listing_templates WHERE id=?", (tmpl_id,))
    return {"ok": True}
