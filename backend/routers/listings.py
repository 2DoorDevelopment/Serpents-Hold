import os
import uuid
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from auth import get_current_user, get_optional_user
from database import get_conn
from trust import compute_trust_score

router = APIRouter(prefix="/api/listings", tags=["listings"])

UPLOADS_DIR = Path(__file__).parent.parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

VALID_CATEGORIES = {"commodities", "ships", "fps-gear"}
VALID_LISTING_TYPES = {"WTS", "WTB", "WTT", "WTR"}
VALID_SOURCES = {"Looted", "Pledged", "Purchased In-Game", "Pirated", "Gifted", ""}
VALID_AVAILABILITY = {
    "Immediate", "Ready for Pickup", "On-Demand",
    "Pre-order", "Work Order", "Reserve Only",
    "Scheduled", "In Progress", "Negotiable", "",
}
VALID_SYSTEMS = {"Stanton", "Pyro", "Nyx", ""}
VALID_LANGUAGES = {
    "English", "German", "Spanish", "French",
    "Italian", "Portuguese", "Russian", "Chinese", "",
}
SORT_MAP = {
    "newest":       "l.created_at DESC",
    "oldest":       "l.created_at ASC",
    "price_asc":    "l.price ASC",
    "price_desc":   "l.price DESC",
    "views":        "l.views DESC",
    "most_traded":  "l.deal_count DESC",
    "least_traded": "l.deal_count ASC",
    "top_rated":    "(l.upvotes - l.downvotes) DESC",
    "lowest_rated": "(l.upvotes - l.downvotes) ASC",
}

DEFAULT_EXPIRY_DAYS = int(os.getenv("LISTING_EXPIRY_DAYS", "30"))

# Input length caps
MAX_TITLE_LEN       = 120
MAX_DESC_LEN        = 5000
MAX_LOCATION_LEN    = 100
MAX_SUBCATEGORY_LEN = 80
MAX_VERSION_LEN     = 20


@router.get("/meta")
def listing_meta():
    """Return valid options for all listing dropdowns. Used by the frontend form."""
    return {
        "listing_types":  sorted(VALID_LISTING_TYPES),
        "sources":        sorted(s for s in VALID_SOURCES if s),
        "availability":   sorted(a for a in VALID_AVAILABILITY if a),
        "systems":        sorted(s for s in VALID_SYSTEMS if s),
        "languages":      sorted(l for l in VALID_LANGUAGES if l),
        "sort_options":   list(SORT_MAP.keys()),
    }


def _save_upload(file: UploadFile) -> str:
    ext = Path(file.filename).suffix.lower()
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOADS_DIR / filename
    contents = file.file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(400, "Image must be under 5 MB")
    dest.write_bytes(contents)
    return f"/uploads/{filename}"


def _record_price(conn, listing_id: int, price: float, currency: str):
    conn.execute(
        "INSERT INTO price_history (listing_id, price, currency) VALUES (?, ?, ?)",
        (listing_id, price, currency),
    )


def _expire_stale(conn):
    """Mark listings as expired if past their expires_at date."""
    conn.execute("""
        UPDATE listings SET status = 'expired'
        WHERE status = 'active'
          AND expires_at IS NOT NULL
          AND expires_at < CURRENT_TIMESTAMP
    """)


# ---------- GET all ----------

@router.get("")
def list_listings(
    category:      Optional[str] = None,
    search:        Optional[str] = None,
    sort:          str = "newest",
    page:          int = 1,
    limit:         int = 20,
    seller_id:     Optional[int] = None,
    item_type_id:  Optional[int] = None,
    listing_type:  Optional[str] = None,
    source:        Optional[str] = None,
    availability:  Optional[str] = None,
    system_name:   Optional[str] = None,
    language:      Optional[str] = None,
    price_min:     Optional[float] = None,
    price_max:     Optional[float] = None,
    posted_within: Optional[int]   = None,   # days: 1, 7, 30
    org_id:        Optional[int]   = None,
    current_user:  Optional[dict] = Depends(get_optional_user),
):
    with get_conn() as conn:
        _expire_stale(conn)

        base_where = "l.status = 'active'"
        params: list = []

        if category and category in VALID_CATEGORIES:
            base_where += " AND l.category = ?"
            params.append(category)
        if seller_id:
            base_where += " AND l.seller_id = ?"
            params.append(seller_id)
        if item_type_id:
            base_where += " AND l.item_type_id = ?"
            params.append(item_type_id)
        if listing_type and listing_type in VALID_LISTING_TYPES:
            base_where += " AND l.listing_type = ?"
            params.append(listing_type)
        if source and source in VALID_SOURCES:
            base_where += " AND l.source = ?"
            params.append(source)
        if availability and availability in VALID_AVAILABILITY:
            base_where += " AND l.availability = ?"
            params.append(availability)
        if system_name and system_name in VALID_SYSTEMS:
            base_where += " AND l.system_name = ?"
            params.append(system_name)
        if language and language in VALID_LANGUAGES:
            base_where += " AND l.language = ?"
            params.append(language)
        if search:
            base_where += " AND (l.title LIKE ? OR l.description LIKE ?)"
            params.extend([f"%{search}%", f"%{search}%"])
        if price_min is not None:
            base_where += " AND l.price >= ?"
            params.append(price_min)
        if price_max is not None:
            base_where += " AND (l.price <= ? OR l.price = 0)"
            params.append(price_max)
        if posted_within and posted_within > 0:
            base_where += " AND l.created_at >= datetime('now', ?)"
            params.append(f"-{posted_within} days")
        if org_id:
            base_where += " AND l.org_id = ?"
            params.append(org_id)

        total = conn.execute(
            f"SELECT COUNT(*) FROM listings l WHERE {base_where}", params
        ).fetchone()[0]

        order = SORT_MAP.get(sort, SORT_MAP["newest"])
        offset = (page - 1) * limit
        rows = conn.execute(f"""
            SELECT l.*,
                   u.username       AS seller_name,
                   u.rsi_verified   AS seller_verified,
                   u.rsi_handle     AS seller_rsi,
                   u.last_active_at AS seller_last_active
            FROM listings l
            JOIN users u ON l.seller_id = u.id
            WHERE {base_where}
            ORDER BY {order}
            LIMIT ? OFFSET ?
        """, params + [limit, offset]).fetchall()

    return {
        "listings": [dict(r) for r in rows],
        "total":    total,
        "page":     page,
        "pages":    math.ceil(total / limit) if limit else 1,
    }


# ---------- GET one ----------

@router.get("/{listing_id}")
def get_listing(listing_id: int, current_user: Optional[dict] = Depends(get_optional_user)):
    with get_conn() as conn:
        row = conn.execute("""
            SELECT l.*,
                   u.username       AS seller_name,
                   u.rsi_verified   AS seller_verified,
                   u.rsi_handle     AS seller_rsi,
                   u.bio            AS seller_bio,
                   u.avatar_url     AS seller_avatar,
                   u.last_active_at AS seller_last_active,
                   u.created_at     AS seller_created_at
            FROM listings l
            JOIN users u ON l.seller_id = u.id
            WHERE l.id = ?
        """, (listing_id,)).fetchone()

        if not row:
            raise HTTPException(404, "Listing not found")

        conn.execute("UPDATE listings SET views = views + 1 WHERE id = ?", (listing_id,))

        listing = dict(row)

        # Seller trust score
        stats = conn.execute("""
            SELECT
                COUNT(*) FILTER (WHERE status = 'completed') AS completed_deals,
                COUNT(*) FILTER (WHERE status = 'disputed')  AS disputed_deals
            FROM deals WHERE seller_id = ?
        """, (listing["seller_id"],)).fetchone()
        rating = conn.execute("""
            SELECT COUNT(*) AS cnt, AVG(score) AS avg
            FROM ratings WHERE seller_id = ?
        """, (listing["seller_id"],)).fetchone()

        listing["seller_trust"] = compute_trust_score(
            rsi_verified    = bool(listing["seller_verified"]),
            completed_deals = stats["completed_deals"],
            disputed_deals  = stats["disputed_deals"],
            rating_avg      = rating["avg"],
            rating_count    = rating["cnt"],
            created_at      = listing["seller_created_at"],
        )

    return listing


# ---------- CREATE ----------

@router.post("")
def create_listing(
    title:        str   = Form(...),
    category:     str   = Form(...),
    price:        float = Form(0),
    description:  str   = Form(""),
    subcategory:  str   = Form(""),
    currency:     str   = Form("aUEC"),
    quantity:     int   = Form(1),
    location:     str   = Form(""),
    item_type_id: Optional[int] = Form(None),
    listing_type: str   = Form("WTS"),
    source:       str   = Form(""),
    availability: str   = Form("Immediate"),
    game_version: str   = Form(""),
    language:     str   = Form("English"),
    system_name:  str   = Form(""),
    org_id:       Optional[int] = Form(None),
    image:        Optional[UploadFile] = File(None),
    image_url:    str = Form(""),
    current_user: dict = Depends(get_current_user),
):
    if category not in VALID_CATEGORIES:
        raise HTTPException(400, "Invalid category")
    if listing_type not in VALID_LISTING_TYPES:
        raise HTTPException(400, "Invalid listing type")
    if not title.strip():
        raise HTTPException(400, "Title is required")

    # Truncate free-text fields to configured caps
    title       = title.strip()[:MAX_TITLE_LEN]
    description = description[:MAX_DESC_LEN]
    location    = location[:MAX_LOCATION_LEN]
    subcategory = subcategory[:MAX_SUBCATEGORY_LEN]
    game_version = game_version[:MAX_VERSION_LEN]

    # Prefer pre-uploaded URL; fall back to legacy direct-upload; fall back to empty
    if not image_url:
        image_url = _save_upload(image) if image and image.filename else ""
    expires_at = (datetime.now(timezone.utc) + timedelta(days=DEFAULT_EXPIRY_DAYS)).isoformat()

    with get_conn() as conn:
        # Validate org membership if org_id provided
        if org_id:
            member = conn.execute(
                "SELECT id FROM org_members WHERE org_id=? AND user_id=?",
                (org_id, current_user["id"])
            ).fetchone()
            if not member:
                org_id = None  # silently strip if not a member

        cur = conn.execute("""
            INSERT INTO listings
              (seller_id, title, description, category, subcategory, price, currency,
               quantity, image_url, location, item_type_id, expires_at,
               listing_type, source, availability, game_version, language, system_name, org_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (current_user["id"], title, description, category, subcategory,
              price, currency, quantity, image_url, location, item_type_id, expires_at,
              listing_type, source, availability, game_version, language, system_name, org_id))

        listing_id = cur.lastrowid
        # Only track price history for WTS/WTR (not WTB/WTT which may be negotiable)
        if listing_type in ("WTS", "WTR") and price > 0:
            _record_price(conn, listing_id, price, currency)
        row = conn.execute("SELECT * FROM listings WHERE id = ?", (listing_id,)).fetchone()

    return dict(row)


# ---------- UPDATE ----------

@router.put("/{listing_id}")
def update_listing(
    listing_id:   int,
    title:        Optional[str]   = Form(None),
    description:  Optional[str]   = Form(None),
    category:     Optional[str]   = Form(None),
    subcategory:  Optional[str]   = Form(None),
    price:        Optional[float] = Form(None),
    currency:     Optional[str]   = Form(None),
    quantity:     Optional[int]   = Form(None),
    location:     Optional[str]   = Form(None),
    status:       Optional[str]   = Form(None),
    item_type_id: Optional[int]   = Form(None),
    listing_type: Optional[str]   = Form(None),
    source:       Optional[str]   = Form(None),
    availability: Optional[str]   = Form(None),
    game_version: Optional[str]   = Form(None),
    language:     Optional[str]   = Form(None),
    system_name:  Optional[str]   = Form(None),
    image:        Optional[UploadFile] = File(None),
    image_url:    Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    with get_conn() as conn:
        existing = conn.execute("SELECT * FROM listings WHERE id = ?", (listing_id,)).fetchone()
        if not existing:
            raise HTTPException(404, "Listing not found")
        if existing["seller_id"] != current_user["id"] and current_user["role"] != "admin":
            raise HTTPException(403, "Not your listing")

        # Prefer pre-uploaded URL if provided; else try legacy direct upload; else keep existing
        if image_url:
            final_image_url = image_url
        elif image and image.filename:
            final_image_url = _save_upload(image)
        else:
            final_image_url = existing["image_url"]
        image_url = final_image_url

        # Record price history if price changed
        new_currency = currency if currency is not None else existing["currency"]
        if price is not None and price != existing["price"]:
            _record_price(conn, listing_id, price, new_currency)

        conn.execute("""
            UPDATE listings
            SET title        = COALESCE(?, title),
                description  = COALESCE(?, description),
                category     = COALESCE(?, category),
                subcategory  = COALESCE(?, subcategory),
                price        = COALESCE(?, price),
                currency     = COALESCE(?, currency),
                quantity     = COALESCE(?, quantity),
                image_url    = ?,
                location     = COALESCE(?, location),
                status       = COALESCE(?, status),
                item_type_id = COALESCE(?, item_type_id),
                listing_type = COALESCE(?, listing_type),
                source       = COALESCE(?, source),
                availability = COALESCE(?, availability),
                game_version = COALESCE(?, game_version),
                language     = COALESCE(?, language),
                system_name  = COALESCE(?, system_name),
                updated_at   = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (title, description, category, subcategory, price, currency,
              quantity, image_url, location, status, item_type_id,
              listing_type, source, availability, game_version, language, system_name,
              listing_id))

        row = conn.execute("SELECT * FROM listings WHERE id = ?", (listing_id,)).fetchone()

    return dict(row)


@router.post("/{listing_id}/sold")
def mark_sold(listing_id: int, current_user: dict = Depends(get_current_user)):
    """Seller marks their listing as sold. Increments deal_count."""
    with get_conn() as conn:
        existing = conn.execute("SELECT * FROM listings WHERE id = ?", (listing_id,)).fetchone()
        if not existing:
            raise HTTPException(404, "Listing not found")
        if existing["seller_id"] != current_user["id"] and current_user["role"] != "admin":
            raise HTTPException(403, "Not your listing")
        conn.execute(
            "UPDATE listings SET status = 'sold', sold_at = CURRENT_TIMESTAMP, deal_count = deal_count + 1 WHERE id = ?",
            (listing_id,),
        )
        row = conn.execute("SELECT * FROM listings WHERE id = ?", (listing_id,)).fetchone()
    return dict(row)


@router.post("/{listing_id}/renew")
def renew_listing(listing_id: int, current_user: dict = Depends(get_current_user)):
    """Extend expiry by DEFAULT_EXPIRY_DAYS from now and re-activate if expired."""
    with get_conn() as conn:
        existing = conn.execute("SELECT * FROM listings WHERE id = ?", (listing_id,)).fetchone()
        if not existing:
            raise HTTPException(404, "Listing not found")
        if existing["seller_id"] != current_user["id"] and current_user["role"] != "admin":
            raise HTTPException(403, "Not your listing")

        new_expiry = (datetime.now(timezone.utc) + timedelta(days=DEFAULT_EXPIRY_DAYS)).isoformat()
        conn.execute(
            "UPDATE listings SET expires_at = ?, status = 'active', expiry_warned = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (new_expiry, listing_id),
        )
        row = conn.execute("SELECT * FROM listings WHERE id = ?", (listing_id,)).fetchone()
    return dict(row)


@router.get("/{listing_id}/price-history")
def price_history(listing_id: int):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT price, currency, recorded_at FROM price_history WHERE listing_id = ? ORDER BY recorded_at ASC",
            (listing_id,),
        ).fetchall()
    return [dict(r) for r in rows]


@router.get("/suggest-price/{item_type_id}")
def suggest_price(item_type_id: int):
    """Return avg/min/max/count of active WTS listings for this item type to guide pricing."""
    with get_conn() as conn:
        row = conn.execute("""
            SELECT
                COUNT(*)    AS count,
                AVG(price)  AS avg_price,
                MIN(price)  AS min_price,
                MAX(price)  AS max_price,
                currency
            FROM listings
            WHERE item_type_id = ?
              AND status = 'active'
              AND listing_type = 'WTS'
              AND price > 0
            GROUP BY currency
            ORDER BY COUNT(*) DESC
            LIMIT 1
        """, (item_type_id,)).fetchone()
        item = conn.execute(
            "SELECT name FROM item_types WHERE id = ?", (item_type_id,)
        ).fetchone()
    if not row or row["count"] == 0:
        return {"count": 0, "suggestion": None}
    return {
        "item_name":  item["name"] if item else "",
        "count":      row["count"],
        "avg_price":  round(row["avg_price"]),
        "min_price":  row["min_price"],
        "max_price":  row["max_price"],
        "currency":   row["currency"],
        "suggestion": round(row["avg_price"]),
    }


# ---------- DELETE ----------

@router.delete("/{listing_id}")
def delete_listing(listing_id: int, current_user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        existing = conn.execute("SELECT * FROM listings WHERE id = ?", (listing_id,)).fetchone()
        if not existing:
            raise HTTPException(404, "Listing not found")
        if existing["seller_id"] != current_user["id"] and current_user["role"] != "admin":
            raise HTTPException(403, "Not your listing")
        conn.execute("DELETE FROM listings WHERE id = ?", (listing_id,))

    return {"success": True}
