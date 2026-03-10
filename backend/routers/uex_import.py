"""
UEX Corp Import Router — Cache-First Edition
─────────────────────────────────────────────
Flow:
  1. Admin triggers "Import" — backend checks uex_cache table first.
  2. If cache is fresh (< CACHE_TTL_HOURS), import runs entirely from local DB — zero UEX calls.
  3. If cache is stale/missing, it fetches UEX, stores raw JSON in uex_cache, THEN imports.
  4. "Refresh Cache" forces a new fetch without necessarily re-importing.

Endpoints (all admin-only except noted):
  GET    /api/uex/status             — item counts + cache age per key
  GET    /api/uex/cache              — list cache entries
  POST   /api/uex/cache/refresh      — force re-fetch all 3 UEX endpoints (updates cache only)
  POST   /api/uex/cache/refresh/{key}— force re-fetch one key: items | vehicles | commodities
  DELETE /api/uex/cache              — purge entire cache (next import will re-fetch)
  DELETE /api/uex/cache/{key}        — purge one cache entry
  POST   /api/uex/import             — import all categories (cache-first)
  POST   /api/uex/import/{cat}       — import one: ships | fps-gear | commodities
  GET    /api/uex/preview/{cat}      — dry-run (uses cache if fresh)
"""

import asyncio
import json
from datetime import datetime, timezone, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException

from auth import get_admin_user
from database import get_conn

router = APIRouter(prefix="/api/uex", tags=["uex-import"])

UEX_BASE        = "https://uexcorp.space/api/2.0"
TIMEOUT         = 20
CACHE_TTL_HOURS = 24   # cache considered fresh for this long

# ── Category mapping ─────────────────────────────────────────────────────────

ITEMS_CATEGORY_MAP = {
    "Personal Armor":   ("fps-gear", "Armor"),
    "Helmet":           ("fps-gear", "Helmets"),
    "Undersuit":        ("fps-gear", "Undersuits"),
    "FPS Weapon":       ("fps-gear", "Weapons"),
    "Medical":          ("fps-gear", "Medical"),
    "Backpack":         ("fps-gear", "Backpacks"),
    "Grenade":          ("fps-gear", "Weapons"),
    "Gadget":           ("fps-gear", "Other"),
    "Ship Weapon":      ("ships",    "Weapons"),
    "Shield Generator": ("ships",    "Shields"),
    "Quantum Drive":    ("ships",    "Quantum Drive"),
    "Thruster":         ("ships",    "Thrusters"),
    "Cooler":           ("ships",    "Hull & Structure"),
    "Power Plant":      ("ships",    "Hull & Structure"),
    "Missile":          ("ships",    "Weapons"),
    "Mining Laser":     ("ships",    "Other"),
    "Tractor Beam":     ("ships",    "Other"),
    "Emp":              ("ships",    "Weapons"),
    "Radar":            ("ships",    "Hull & Structure"),
    "Computer":         ("ships",    "Hull & Structure"),
    "Fuel Intake":      ("ships",    "Hull & Structure"),
    "Fuel Tank":        ("ships",    "Hull & Structure"),
}

# ── Cache helpers ─────────────────────────────────────────────────────────────

def _now_utc():
    return datetime.now(timezone.utc)

def _cache_read(conn, key: str):
    """Return (data_list, fetched_at) if cache exists, else (None, None)."""
    row = conn.execute(
        "SELECT data, fetched_at FROM uex_cache WHERE cache_key = ?", (key,)
    ).fetchone()
    if not row:
        return None, None
    fetched_at = datetime.fromisoformat(row["fetched_at"])
    if fetched_at.tzinfo is None:
        fetched_at = fetched_at.replace(tzinfo=timezone.utc)
    return json.loads(row["data"]), fetched_at

def _cache_is_fresh(fetched_at) -> bool:
    if fetched_at is None:
        return False
    return (_now_utc() - fetched_at) < timedelta(hours=CACHE_TTL_HOURS)

def _cache_write(conn, key: str, data: list):
    conn.execute("""
        INSERT INTO uex_cache (cache_key, data, fetched_at, item_count)
        VALUES (?, ?, CURRENT_TIMESTAMP, ?)
        ON CONFLICT(cache_key) DO UPDATE
          SET data       = excluded.data,
              fetched_at = excluded.fetched_at,
              item_count = excluded.item_count
    """, (key, json.dumps(data), len(data)))

def _cache_summary(conn) -> list:
    rows = conn.execute(
        "SELECT cache_key, fetched_at, item_count FROM uex_cache ORDER BY cache_key"
    ).fetchall()
    out = []
    for r in rows:
        fetched_at = datetime.fromisoformat(r["fetched_at"])
        if fetched_at.tzinfo is None:
            fetched_at = fetched_at.replace(tzinfo=timezone.utc)
        age_h = (_now_utc() - fetched_at).total_seconds() / 3600
        out.append({
            "key":        r["cache_key"],
            "fetched_at": r["fetched_at"],
            "item_count": r["item_count"],
            "age_hours":  round(age_h, 1),
            "fresh":      age_h < CACHE_TTL_HOURS,
        })
    return out

# ── UEX network fetch ─────────────────────────────────────────────────────────

async def _fetch_uex(path: str) -> list:
    async with httpx.AsyncClient() as client:
        try:
            r = await client.get(f"{UEX_BASE}/{path}", timeout=TIMEOUT)
            r.raise_for_status()
            payload = r.json()
            if isinstance(payload, dict):
                return payload.get("data", [])
            if isinstance(payload, list):
                return payload
        except Exception:
            pass
    return []

async def _get_data(key: str, uex_path: str, force: bool = False):
    """
    Returns (data, source) where source is 'cache' or 'uex'.
    Uses cache if fresh and not forced; otherwise fetches UEX and updates cache.
    """
    with get_conn() as conn:
        cached, fetched_at = _cache_read(conn, key)
        if not force and _cache_is_fresh(fetched_at):
            return cached, "cache"

    data = await _fetch_uex(uex_path)
    with get_conn() as conn:
        _cache_write(conn, key, data)
    return data, "uex"

# ── Transform helpers ─────────────────────────────────────────────────────────

def _transform_vehicles(raw: list) -> list:
    out = []
    for v in raw:
        name = (v.get("name") or v.get("vehicle_name") or "").strip()
        if name:
            out.append({
                "name":        name,
                "category":    "ships",
                "subcategory": "Full Ships",
                "description": v.get("description") or v.get("career") or "",
                "image_url":   v.get("link") or "",
            })
    return out

def _transform_items(raw: list) -> list:
    out = []
    for it in raw:
        cat_name = (it.get("category_name") or it.get("type") or it.get("item_type") or "").strip()
        mapping = ITEMS_CATEGORY_MAP.get(cat_name)
        if not mapping:
            for k, v in ITEMS_CATEGORY_MAP.items():
                if k.lower() in cat_name.lower():
                    mapping = v
                    break
        if not mapping:
            continue
        name = (it.get("name") or "").strip()
        if not name:
            continue
        our_cat, our_sub = mapping
        out.append({
            "name":        name,
            "category":    our_cat,
            "subcategory": our_sub,
            "description": it.get("description") or "",
            "image_url":   it.get("thumbnail") or it.get("image") or "",
        })
    return out

def _transform_commodities(raw: list) -> list:
    out = []
    for c in raw:
        name = (c.get("name") or c.get("commodity_name") or "").strip()
        if not name:
            continue
        kind = (c.get("kind") or c.get("type") or "").lower()
        if any(x in kind for x in ("mineral","ore","raw")):
            sub = "Minerals"
        elif any(x in kind for x in ("drug","contraband","illegal")):
            sub = "Contraband"
        elif any(x in kind for x in ("food","drink","beverage")):
            sub = "Food & Drink"
        elif any(x in kind for x in ("medical","med")):
            sub = "Medical"
        elif any(x in kind for x in ("agri","farm","plant")):
            sub = "Agricultural"
        else:
            sub = "Other"
        out.append({
            "name":        name,
            "category":    "commodities",
            "subcategory": sub,
            "description": c.get("description") or "",
            "image_url":   c.get("thumbnail") or "",
        })
    return out

# ── DB upsert ─────────────────────────────────────────────────────────────────

def _upsert(conn, items: list) -> dict:
    counts = {"inserted": 0, "updated": 0, "skipped": 0}
    for it in items:
        name = (it.get("name") or "").strip()
        cat  = it.get("category", "")
        if not name or not cat:
            counts["skipped"] += 1
            continue
        row = conn.execute(
            "SELECT id FROM item_types WHERE name = ? AND category = ?", (name, cat)
        ).fetchone()
        if row:
            conn.execute(
                "UPDATE item_types SET subcategory=?,description=?,image_url=?,active=1 WHERE id=?",
                (it.get("subcategory",""), it.get("description",""), it.get("image_url",""), row["id"])
            )
            counts["updated"] += 1
        else:
            conn.execute(
                "INSERT INTO item_types (name,category,subcategory,description,image_url,active) VALUES(?,?,?,?,?,1)",
                (name, cat, it.get("subcategory",""), it.get("description",""), it.get("image_url",""))
            )
            counts["inserted"] += 1
    return counts

# ── Per-category runners ──────────────────────────────────────────────────────

async def _run(key, uex_path, transform_fn, force=False, dry_run=False):
    raw, source = await _get_data(key, uex_path, force=force)
    items = transform_fn(raw)
    if dry_run:
        return {"preview": items[:20], "total": len(items), "source": source}
    with get_conn() as conn:
        counts = _upsert(conn, items)
    return {**counts, "source": source}

# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/status")
def import_status(_=Depends(get_admin_user)):
    with get_conn() as conn:
        rows  = conn.execute("""
            SELECT category,
                   COUNT(*) AS total,
                   SUM(CASE WHEN active=1 THEN 1 ELSE 0 END) AS active
            FROM item_types GROUP BY category
        """).fetchall()
        cache = _cache_summary(conn)
    return {"counts": [dict(r) for r in rows], "cache": cache, "ttl_hours": CACHE_TTL_HOURS}


@router.get("/cache")
def list_cache(_=Depends(get_admin_user)):
    with get_conn() as conn:
        return {"cache": _cache_summary(conn), "ttl_hours": CACHE_TTL_HOURS}


@router.post("/cache/refresh")
async def refresh_all_cache(_=Depends(get_admin_user)):
    """Force re-fetch all 3 UEX endpoints and update cache — does NOT import to item_types."""
    keys = [("items","items"), ("vehicles","vehicles"), ("commodities","commodities")]
    results = await asyncio.gather(*[_fetch_uex(path) for _, path in keys])
    with get_conn() as conn:
        for (key, _), data in zip(keys, results):
            _cache_write(conn, key, data)
    return {
        "refreshed": {k: len(d) for (k,_), d in zip(keys, results)},
        "timestamp": _now_utc().isoformat(),
    }


@router.post("/cache/refresh/{key}")
async def refresh_one_cache(key: str, _=Depends(get_admin_user)):
    """Force re-fetch one UEX endpoint."""
    path_map = {"items": "items", "vehicles": "vehicles", "commodities": "commodities"}
    if key not in path_map:
        raise HTTPException(400, "key must be: items | vehicles | commodities")
    data = await _fetch_uex(path_map[key])
    with get_conn() as conn:
        _cache_write(conn, key, data)
    return {"refreshed": key, "count": len(data), "timestamp": _now_utc().isoformat()}


@router.delete("/cache")
def purge_all_cache(_=Depends(get_admin_user)):
    with get_conn() as conn:
        conn.execute("DELETE FROM uex_cache")
    return {"deleted": "all"}


@router.delete("/cache/{key}")
def purge_one_cache(key: str, _=Depends(get_admin_user)):
    with get_conn() as conn:
        conn.execute("DELETE FROM uex_cache WHERE cache_key = ?", (key,))
    return {"deleted": key}


@router.post("/import")
async def import_all(_=Depends(get_admin_user)):
    ships, fps, comms = await asyncio.gather(
        _run("vehicles",    "vehicles",    _transform_vehicles),
        _run("items",       "items",       _transform_items),
        _run("commodities", "commodities", _transform_commodities),
    )
    return {
        "timestamp":          _now_utc().isoformat(),
        "ships":              ships,
        "fps_and_components": fps,
        "commodities":        comms,
        "total_inserted":     ships.get("inserted",0) + fps.get("inserted",0) + comms.get("inserted",0),
        "total_updated":      ships.get("updated",0)  + fps.get("updated",0)  + comms.get("updated",0),
    }


@router.post("/import/{cat}")
async def import_category(cat: str, _=Depends(get_admin_user)):
    if   cat == "ships":       result = await _run("vehicles",    "vehicles",    _transform_vehicles)
    elif cat == "fps-gear":    result = await _run("items",       "items",       _transform_items)
    elif cat == "commodities": result = await _run("commodities", "commodities", _transform_commodities)
    else: raise HTTPException(400, "Use: ships | fps-gear | commodities")
    return {"timestamp": _now_utc().isoformat(), "category": cat, **result}


@router.get("/preview/{cat}")
async def preview_import(cat: str, _=Depends(get_admin_user)):
    if   cat == "ships":       result = await _run("vehicles",    "vehicles",    _transform_vehicles,    dry_run=True)
    elif cat == "fps-gear":    result = await _run("items",       "items",       _transform_items,       dry_run=True)
    elif cat == "commodities": result = await _run("commodities", "commodities", _transform_commodities, dry_run=True)
    else: raise HTTPException(400, "Use: ships | fps-gear | commodities")
    return {"category": cat, **result}
