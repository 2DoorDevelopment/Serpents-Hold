"""
Public Read API  — /api/v1/*
─────────────────────────────────────────────────────────────────────────────
Read-only endpoints for Discord bots, external tools, and community integrations.
Requires an API key passed as  X-API-Key  header or  ?api_key=  query param.

API keys are stored in the api_keys table and issued by admins.

Endpoints:
  GET /api/v1/listings           — browse active listings (filters + pagination)
  GET /api/v1/listings/{id}      — single listing
  GET /api/v1/sellers/{username} — public seller profile + stats
  GET /api/v1/prices/{item_name} — price stats for an item name
  GET /api/v1/status             — site health (no key required)
  POST /api/v1/keys              — (admin) create an API key
  GET  /api/v1/keys              — (admin) list all keys
  DELETE /api/v1/keys/{key_id}   — (admin) revoke a key
"""

import secrets
from fastapi import APIRouter, Depends, HTTPException, Header, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from database import get_conn
from auth import get_admin_user

router = APIRouter(prefix="/api/v1", tags=["public-api"])

# ── Key auth ──────────────────────────────────────────────────────────────────

def get_api_key(
    x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
    api_key: Optional[str]   = Query(default=None),
):
    key = x_api_key or api_key
    if not key:
        raise HTTPException(401, detail={"error": "API key required", "docs": "Pass X-API-Key header or ?api_key= query param"})
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM api_keys WHERE key_value=? AND active=1", (key,)
        ).fetchone()
        if not row:
            raise HTTPException(403, detail={"error": "Invalid or revoked API key"})
        # Bump usage counter
        conn.execute("UPDATE api_keys SET uses=uses+1, last_used_at=CURRENT_TIMESTAMP WHERE id=?", (row["id"],))
    return dict(row)


def api_response(data, key_row: dict):
    """Wrap response with rate-limit metadata headers."""
    return JSONResponse(content=data, headers={
        "X-Key-Name":  key_row.get("name", ""),
        "X-API-Version": "1",
    })


# ── Status (no key needed) ───────────────────────────────────────────────────

@router.get("/status")
def api_status():
    with get_conn() as conn:
        active_listings = conn.execute("SELECT COUNT(*) FROM listings WHERE status='active'").fetchone()[0]
        total_users     = conn.execute("SELECT COUNT(*) FROM users WHERE banned=0").fetchone()[0]
        total_deals     = conn.execute("SELECT COUNT(*) FROM deals WHERE status='completed'").fetchone()[0]
    return {
        "status":          "ok",
        "version":         "1",
        "active_listings": active_listings,
        "total_users":     total_users,
        "completed_deals": total_deals,
    }


# ── Listings ─────────────────────────────────────────────────────────────────

@router.get("/listings")
def pub_listings(
    category:      Optional[str]   = None,
    search:        Optional[str]   = None,
    listing_type:  Optional[str]   = None,
    system_name:   Optional[str]   = None,
    price_min:     Optional[float] = None,
    price_max:     Optional[float] = None,
    sort:          str             = "newest",
    page:          int             = 1,
    limit:         int             = 20,
    key=Depends(get_api_key)
):
    limit = min(limit, 50)  # hard cap per request

    SORT_MAP = {
        "newest":       "l.created_at DESC",
        "oldest":       "l.created_at ASC",
        "price_asc":    "l.price ASC",
        "price_desc":   "l.price DESC",
        "most_traded":  "l.deal_count DESC",
    }
    VALID_CATS   = {"commodities", "ships", "fps-gear"}
    VALID_TYPES  = {"WTS", "WTB", "WTT", "WTR"}
    VALID_SYSTEMS = {"Stanton", "Pyro", "Nyx"}

    with get_conn() as conn:
        where, params = "l.status='active'", []
        if category     and category     in VALID_CATS:    where += " AND l.category=?";     params.append(category)
        if listing_type and listing_type in VALID_TYPES:   where += " AND l.listing_type=?"; params.append(listing_type)
        if system_name  and system_name  in VALID_SYSTEMS: where += " AND l.system_name=?";  params.append(system_name)
        if price_min is not None: where += " AND l.price>=?"; params.append(price_min)
        if price_max is not None: where += " AND (l.price<=? OR l.price=0)"; params.append(price_max)
        if search: where += " AND (l.title LIKE ? OR l.description LIKE ?)"; params.extend([f"%{search}%"]*2)

        total = conn.execute(f"SELECT COUNT(*) FROM listings l WHERE {where}", params).fetchone()[0]
        order = SORT_MAP.get(sort, SORT_MAP["newest"])
        rows  = conn.execute(f"""
            SELECT l.id, l.title, l.category, l.subcategory, l.listing_type, l.price, l.currency,
                   l.quantity, l.location, l.system_name, l.availability, l.deal_count,
                   l.created_at, l.views, l.upvotes, l.downvotes,
                   u.username AS seller, u.rsi_verified AS seller_verified
            FROM listings l JOIN users u ON l.seller_id=u.id
            WHERE {where} ORDER BY {order} LIMIT ? OFFSET ?
        """, params + [limit, (page-1)*limit]).fetchall()

    return api_response({
        "listings": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "limit": limit,
    }, key)


@router.get("/listings/{listing_id}")
def pub_listing(listing_id: int, key=Depends(get_api_key)):
    with get_conn() as conn:
        row = conn.execute("""
            SELECT l.id, l.title, l.description, l.category, l.subcategory, l.listing_type,
                   l.price, l.currency, l.quantity, l.location, l.system_name, l.availability,
                   l.source, l.deal_count, l.created_at, l.updated_at, l.views,
                   l.upvotes, l.downvotes, l.image_url,
                   u.username AS seller, u.rsi_verified AS seller_verified,
                   u.rsi_handle AS seller_rsi
            FROM listings l JOIN users u ON l.seller_id=u.id
            WHERE l.id=? AND l.status='active'
        """, (listing_id,)).fetchone()
        if not row:
            raise HTTPException(404, {"error": "Listing not found or not active"})
    return api_response(dict(row), key)


# ── Sellers ───────────────────────────────────────────────────────────────────

@router.get("/sellers/{username}")
def pub_seller(username: str, key=Depends(get_api_key)):
    with get_conn() as conn:
        user = conn.execute("""
            SELECT id, username, bio, rsi_handle, rsi_verified, created_at, last_active_at
            FROM users WHERE username=? AND banned=0
        """, (username,)).fetchone()
        if not user:
            raise HTTPException(404, {"error": "Seller not found"})
        u = dict(user)
        stats = conn.execute("SELECT COUNT(*) AS c, AVG(score) AS a FROM ratings WHERE seller_id=?", (u["id"],)).fetchone()
        deals = conn.execute("SELECT COUNT(*) FROM deals WHERE seller_id=? AND status='completed'", (u["id"],)).fetchone()[0]
        listings = conn.execute("SELECT COUNT(*) FROM listings WHERE seller_id=? AND status='active'", (u["id"],)).fetchone()[0]
        u.update({"rating_count": stats["c"], "rating_avg": round(stats["a"],1) if stats["a"] else None,
                  "completed_deals": deals, "active_listings": listings})
    return api_response(u, key)


# ── Prices ────────────────────────────────────────────────────────────────────

@router.get("/prices/{item_name}")
def pub_prices(item_name: str, key=Depends(get_api_key)):
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT l.price, l.currency, l.listing_type, l.created_at
            FROM listings l
            WHERE l.status='active' AND l.price > 0
              AND l.title LIKE ?
            ORDER BY l.created_at DESC LIMIT 50
        """, (f"%{item_name}%",)).fetchall()

        wts = [r["price"] for r in rows if r["listing_type"] == "WTS"]
        wtb = [r["price"] for r in rows if r["listing_type"] == "WTB"]

    def stats(prices):
        if not prices: return None
        return {"count": len(prices), "min": min(prices), "max": max(prices),
                "avg": round(sum(prices)/len(prices))}

    return api_response({
        "item_name":  item_name,
        "wts":        stats(wts),
        "wtb":        stats(wtb),
        "listings":   [dict(r) for r in rows[:10]],
    }, key)


# ── Key management (admin only) ───────────────────────────────────────────────

class KeyCreate(BaseModel):
    name: str
    notes: str = ""


@router.post("/keys", status_code=201)
def create_api_key(body: KeyCreate, admin=Depends(get_admin_user)):
    key_value = secrets.token_urlsafe(32)
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO api_keys (name, key_value, notes, created_by) VALUES (?,?,?,?)",
            (body.name, key_value, body.notes, admin["id"])
        )
        key_id = cur.lastrowid
    return {"id": key_id, "name": body.name, "key": key_value,
            "message": "Store this key securely — it will not be shown again."}


@router.get("/keys")
def list_api_keys(admin=Depends(get_admin_user)):
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT k.id, k.name, k.notes, k.active, k.uses, k.last_used_at, k.created_at,
                   u.username AS created_by_name
            FROM api_keys k LEFT JOIN users u ON u.id=k.created_by
            ORDER BY k.created_at DESC
        """).fetchall()
    return [dict(r) for r in rows]


@router.delete("/keys/{key_id}")
def revoke_api_key(key_id: int, admin=Depends(get_admin_user)):
    with get_conn() as conn:
        conn.execute("UPDATE api_keys SET active=0 WHERE id=?", (key_id,))
    return {"ok": True}


# ── Orgs (new) ────────────────────────────────────────────────────────────────

@router.get("/orgs/{tag}")
def public_org(tag: str, _=Depends(get_api_key)):
    with get_conn() as conn:
        org = conn.execute("SELECT * FROM orgs WHERE tag=?", (tag.upper(),)).fetchone()
        if not org:
            raise HTTPException(404, "Org not found")
        o = dict(org)
        o["member_count"] = conn.execute(
            "SELECT COUNT(*) FROM org_members WHERE org_id=?", (o["id"],)
        ).fetchone()[0]
        o["active_listings"] = conn.execute(
            "SELECT COUNT(*) FROM listings WHERE org_id=? AND status='active'", (o["id"],)
        ).fetchone()[0]
        members = conn.execute("""
            SELECT om.role, u.username, u.rsi_verified, u.rsi_handle
            FROM org_members om JOIN users u ON u.id=om.user_id
            WHERE om.org_id=?
            ORDER BY CASE om.role WHEN 'owner' THEN 1 WHEN 'officer' THEN 2 ELSE 3 END
        """, (o["id"],)).fetchall()
        o["members"] = [dict(m) for m in members]
        del o["id"], o["owner_id"]
    return o


# ── Search (new) ──────────────────────────────────────────────────────────────

@router.get("/search")
def public_search(
    q:     str   = Query(..., min_length=2, max_length=200),
    page:  int   = Query(1, ge=1),
    limit: int   = Query(20, ge=1, le=40),
    _=Depends(get_api_key)
):
    with get_conn() as conn:
        like  = f"%{q}%"
        total = conn.execute(
            "SELECT COUNT(*) FROM listings l WHERE l.status='active' AND (l.title LIKE ? OR l.description LIKE ?)",
            (like, like)
        ).fetchone()[0]
        rows = conn.execute("""
            SELECT l.id, l.title, l.category, l.listing_type, l.price, l.currency,
                   l.quantity, l.system_name, l.deal_count, l.created_at,
                   u.username AS seller_name, u.rsi_verified AS seller_verified,
                   o.tag AS org_tag
            FROM listings l
            JOIN users u ON u.id=l.seller_id
            LEFT JOIN orgs o ON o.id=l.org_id
            WHERE l.status='active' AND (l.title LIKE ? OR l.description LIKE ?)
            ORDER BY l.created_at DESC
            LIMIT ? OFFSET ?
        """, (like, like, limit, (page-1)*limit)).fetchall()
    import math
    return {
        "results": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "pages": math.ceil(total / limit) if limit else 1,
        "query": q,
    }
