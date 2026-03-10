"""
Orgs Router
─────────────────────────────────────────────────────────────────────────────
Orgs let groups of players have a shared identity on the marketplace.

Data model:
  orgs          — id, tag, name, description, avatar_url, banner_url, owner_id
  org_members   — org_id, user_id, role (owner/officer/member), joined_at

Listing affiliation:
  listings.org_id (nullable FK → orgs.id)

Endpoints:
  POST   /api/orgs                  — create org (auth required)
  GET    /api/orgs/{tag}            — public org profile
  PUT    /api/orgs/{tag}            — update org (owner/officer)
  DELETE /api/orgs/{tag}            — delete org (owner only)
  GET    /api/orgs/{tag}/members    — member roster
  POST   /api/orgs/{tag}/invite     — invite user (owner/officer)
  DELETE /api/orgs/{tag}/members/{username}  — remove member (owner/officer or self)
  PUT    /api/orgs/{tag}/members/{username}/role — change role (owner only)
  GET    /api/orgs/my               — orgs the caller belongs to
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from database import get_conn
from auth import get_current_user, get_optional_user

router = APIRouter(prefix="/api/orgs", tags=["orgs"])

ORG_ROLES = {"owner", "officer", "member"}


# ── Models ────────────────────────────────────────────────────────────────────

class OrgCreate(BaseModel):
    tag:         str = Field(..., min_length=2, max_length=8)   # e.g. "XPRT"
    name:        str = Field(..., min_length=2, max_length=80)
    description: str = Field("", max_length=1000)
    avatar_url:  str = Field("", max_length=500)
    banner_url:  str = Field("", max_length=500)

class OrgUpdate(BaseModel):
    name:        Optional[str] = Field(None, max_length=80)
    description: Optional[str] = Field(None, max_length=1000)
    avatar_url:  Optional[str] = Field(None, max_length=500)
    banner_url:  Optional[str] = Field(None, max_length=500)

class InviteBody(BaseModel):
    username: str

class RoleBody(BaseModel):
    role: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_org(conn, tag: str) -> dict:
    row = conn.execute("SELECT * FROM orgs WHERE tag=?", (tag.upper(),)).fetchone()
    if not row:
        raise HTTPException(404, "Org not found")
    return dict(row)

def _membership(conn, org_id: int, user_id: int) -> Optional[dict]:
    row = conn.execute(
        "SELECT * FROM org_members WHERE org_id=? AND user_id=?", (org_id, user_id)
    ).fetchone()
    return dict(row) if row else None

def _require_role(conn, org_id: int, user_id: int, min_role: str):
    """min_role: 'member' | 'officer' | 'owner'"""
    rank = {"owner": 3, "officer": 2, "member": 1}
    m = _membership(conn, org_id, user_id)
    if not m or rank.get(m["role"], 0) < rank.get(min_role, 99):
        raise HTTPException(403, f"Requires {min_role} role or higher")


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/my")
def my_orgs(user=Depends(get_current_user)):
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT o.*, om.role AS my_role
            FROM orgs o
            JOIN org_members om ON om.org_id = o.id
            WHERE om.user_id = ?
            ORDER BY o.name
        """, (user["id"],)).fetchall()
    return [dict(r) for r in rows]


@router.post("", status_code=201)
def create_org(body: OrgCreate, user=Depends(get_current_user)):
    tag = body.tag.upper().strip()
    with get_conn() as conn:
        if conn.execute("SELECT id FROM orgs WHERE tag=?", (tag,)).fetchone():
            raise HTTPException(409, f"Tag [{tag}] is already taken")
        # Limit: one owned org per user
        owned = conn.execute(
            "SELECT id FROM org_members WHERE user_id=? AND role='owner'", (user["id"],)
        ).fetchone()
        if owned:
            raise HTTPException(400, "You already own an org. Transfer ownership before creating another.")

        cur = conn.execute("""
            INSERT INTO orgs (tag, name, description, avatar_url, banner_url, owner_id)
            VALUES (?,?,?,?,?,?)
        """, (tag, body.name, body.description, body.avatar_url, body.banner_url, user["id"]))
        org_id = cur.lastrowid
        conn.execute(
            "INSERT INTO org_members (org_id, user_id, role) VALUES (?,?,'owner')",
            (org_id, user["id"])
        )
    return {"id": org_id, "tag": tag}


@router.get("/{tag}")
def get_org(tag: str, user=Depends(get_optional_user)):
    with get_conn() as conn:
        org = _get_org(conn, tag)

        # Member count + roster preview
        members = conn.execute("""
            SELECT om.role, om.joined_at, u.username, u.avatar_url, u.rsi_verified
            FROM org_members om
            JOIN users u ON u.id = om.user_id
            WHERE om.org_id = ?
            ORDER BY CASE om.role WHEN 'owner' THEN 1 WHEN 'officer' THEN 2 ELSE 3 END, u.username
        """, (org["id"],)).fetchall()
        org["members"] = [dict(m) for m in members]
        org["member_count"] = len(org["members"])

        # Active listing count
        org["listing_count"] = conn.execute(
            "SELECT COUNT(*) FROM listings WHERE org_id=? AND status='active'",
            (org["id"],)
        ).fetchone()[0]

        # My membership role (if logged in)
        org["my_role"] = None
        if user:
            m = _membership(conn, org["id"], user["id"])
            org["my_role"] = m["role"] if m else None

    return org


@router.put("/{tag}")
def update_org(tag: str, body: OrgUpdate, user=Depends(get_current_user)):
    with get_conn() as conn:
        org = _get_org(conn, tag)
        _require_role(conn, org["id"], user["id"], "officer")
        updates, params = [], []
        if body.name        is not None: updates.append("name=?");        params.append(body.name)
        if body.description is not None: updates.append("description=?"); params.append(body.description)
        if body.avatar_url  is not None: updates.append("avatar_url=?");  params.append(body.avatar_url)
        if body.banner_url  is not None: updates.append("banner_url=?");  params.append(body.banner_url)
        if not updates:
            raise HTTPException(400, "Nothing to update")
        params.append(org["id"])
        conn.execute(f"UPDATE orgs SET {', '.join(updates)}, updated_at=CURRENT_TIMESTAMP WHERE id=?", params)
    return {"ok": True}


@router.delete("/{tag}")
def delete_org(tag: str, user=Depends(get_current_user)):
    with get_conn() as conn:
        org = _get_org(conn, tag)
        _require_role(conn, org["id"], user["id"], "owner")
        conn.execute("DELETE FROM org_members WHERE org_id=?", (org["id"],))
        conn.execute("UPDATE listings SET org_id=NULL WHERE org_id=?", (org["id"],))
        conn.execute("DELETE FROM orgs WHERE id=?", (org["id"],))
    return {"ok": True}


@router.post("/{tag}/invite")
def invite_member(tag: str, body: InviteBody, user=Depends(get_current_user)):
    with get_conn() as conn:
        org = _get_org(conn, tag)
        _require_role(conn, org["id"], user["id"], "officer")
        target = conn.execute(
            "SELECT id FROM users WHERE username=? AND banned=0", (body.username,)
        ).fetchone()
        if not target:
            raise HTTPException(404, f"User @{body.username} not found")
        if _membership(conn, org["id"], target["id"]):
            raise HTTPException(409, f"@{body.username} is already a member")
        conn.execute(
            "INSERT INTO org_members (org_id, user_id, role) VALUES (?,?,'member')",
            (org["id"], target["id"])
        )
    return {"ok": True}


@router.delete("/{tag}/members/{username}")
def remove_member(tag: str, username: str, user=Depends(get_current_user)):
    with get_conn() as conn:
        org = _get_org(conn, tag)
        target = conn.execute("SELECT id FROM users WHERE username=?", (username,)).fetchone()
        if not target:
            raise HTTPException(404, "User not found")
        # Can remove self, or officers/owners can remove others
        if target["id"] != user["id"]:
            _require_role(conn, org["id"], user["id"], "officer")
        m = _membership(conn, org["id"], target["id"])
        if not m:
            raise HTTPException(404, "Not a member")
        if m["role"] == "owner":
            raise HTTPException(400, "Transfer ownership before leaving")
        conn.execute(
            "DELETE FROM org_members WHERE org_id=? AND user_id=?", (org["id"], target["id"])
        )
    return {"ok": True}


@router.put("/{tag}/members/{username}/role")
def set_member_role(tag: str, username: str, body: RoleBody, user=Depends(get_current_user)):
    if body.role not in ORG_ROLES:
        raise HTTPException(400, f"Invalid role. Must be one of: {', '.join(ORG_ROLES)}")
    with get_conn() as conn:
        org = _get_org(conn, tag)
        _require_role(conn, org["id"], user["id"], "owner")
        target = conn.execute("SELECT id FROM users WHERE username=?", (username,)).fetchone()
        if not target:
            raise HTTPException(404, "User not found")
        if target["id"] == user["id"]:
            raise HTTPException(400, "Cannot change your own role")
        if body.role == "owner":
            # Transfer ownership: demote current owner to officer
            conn.execute(
                "UPDATE org_members SET role='officer' WHERE org_id=? AND user_id=?",
                (org["id"], user["id"])
            )
            conn.execute("UPDATE orgs SET owner_id=? WHERE id=?", (target["id"], org["id"]))
        conn.execute(
            "UPDATE org_members SET role=? WHERE org_id=? AND user_id=?",
            (body.role, org["id"], target["id"])
        )
    return {"ok": True}
