"""
Deals Router
─────────────────────────────────────────────────────────────────────────────
Deal lifecycle:
  1. Buyer clicks "Buy Now" on a listing → POST /api/deals  (status: pending_seller)
  2. Seller accepts              → PUT /api/deals/{id}/accept  (status: in_progress)
     Seller declines             → PUT /api/deals/{id}/decline (status: declined)
  3. Seller marks delivery done  → PUT /api/deals/{id}/delivered (status: pending_buyer)
  4. Buyer confirms receipt      → PUT /api/deals/{id}/confirm  (status: completed)
     Buyer disputes              → PUT /api/deals/{id}/dispute  (status: disputed)
  5. After status = completed, both parties can leave a verified rating.

Endpoints:
  POST   /api/deals                        — buyer initiates a deal
  GET    /api/deals                        — list my deals (as buyer or seller)
  GET    /api/deals/{id}                   — get one deal
  PUT    /api/deals/{id}/accept            — seller accepts
  PUT    /api/deals/{id}/decline           — seller declines
  PUT    /api/deals/{id}/delivered         — seller marks delivered
  PUT    /api/deals/{id}/confirm           — buyer confirms receipt → completed
  PUT    /api/deals/{id}/dispute           — buyer disputes
  PUT    /api/deals/{id}/resolve-dispute   — admin resolves dispute
  GET    /api/deals/{id}/can-rate          — can the calling user rate this deal?
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from database import get_conn
from auth import get_current_user, get_admin_user
from routers.notifications import create_notification, TYPE_DEAL

router = APIRouter(prefix="/api/deals", tags=["deals"])

VALID_TRANSITIONS = {
    # current_status: {action: new_status}
    "pending_seller": {"accept": "in_progress", "decline": "declined"},
    "in_progress":    {"delivered": "pending_buyer"},
    "pending_buyer":  {"confirm": "completed", "dispute": "disputed"},
    "disputed":       {"resolve": "completed"},
}


class DealCreate(BaseModel):
    listing_id: int
    message:    str = Field("", max_length=500)
    quantity:   int = Field(1, ge=1)


class DisputeResolve(BaseModel):
    notes:   str = ""
    ruling:  str = "completed"   # "completed" | "refund" (future)
    favor:   str = ""            # "buyer" | "seller" | "" — informational only


# ── Admin: List disputed deals ────────────────────────────────────────────────

@router.get("/admin/disputed")
def admin_list_disputed(admin=Depends(get_admin_user)):
    """Return all deals currently in disputed status, richly joined."""
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT d.*,
                   l.title        AS listing_title,
                   l.image_url    AS listing_image,
                   b.username     AS buyer_name,
                   s.username     AS seller_name
            FROM deals d
            JOIN listings l ON l.id = d.listing_id
            JOIN users    b ON b.id = d.buyer_id
            JOIN users    s ON s.id = d.seller_id
            WHERE d.status = 'disputed'
            ORDER BY d.updated_at ASC
        """).fetchall()
    return [dict(r) for r in rows]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_deal_or_404(conn, deal_id: int) -> dict:
    row = conn.execute("SELECT * FROM deals WHERE id=?", (deal_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Deal not found")
    return dict(row)


def _require_party(deal: dict, user_id: int, role: str):
    """role = 'buyer' | 'seller' | 'either'"""
    if role == "buyer"  and deal["buyer_id"]  != user_id:
        raise HTTPException(403, "Only the buyer can do this")
    if role == "seller" and deal["seller_id"] != user_id:
        raise HTTPException(403, "Only the seller can do this")
    if role == "either" and deal["buyer_id"] != user_id and deal["seller_id"] != user_id:
        raise HTTPException(403, "Not your deal")


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("", status_code=201)
def create_deal(body: DealCreate, user=Depends(get_current_user)):
    with get_conn() as conn:
        listing = conn.execute("SELECT * FROM listings WHERE id=?", (body.listing_id,)).fetchone()
        if not listing:
            raise HTTPException(404, "Listing not found")
        if listing["status"] != "active":
            raise HTTPException(400, "Listing is not active")
        if listing["seller_id"] == user["id"]:
            raise HTTPException(400, "Cannot deal with yourself")

        # Prevent duplicate open deal on same listing by same buyer
        existing = conn.execute("""
            SELECT id FROM deals
            WHERE listing_id=? AND buyer_id=? AND status NOT IN ('declined','completed')
        """, (body.listing_id, user["id"])).fetchone()
        if existing:
            raise HTTPException(409, "You already have an open deal on this listing")

        cur = conn.execute("""
            INSERT INTO deals (listing_id, buyer_id, seller_id, quantity, buyer_message, status)
            VALUES (?,?,?,?,?,'pending_seller')
        """, (body.listing_id, user["id"], listing["seller_id"], body.quantity, body.message))
        deal_id = cur.lastrowid

        create_notification(
            conn,
            user_id=listing["seller_id"],
            notif_type=TYPE_DEAL,
            title=f"New deal request on \"{listing['title']}\"",
            body=f"{user['username']} wants to buy × {body.quantity}. {body.message[:60]}",
            link=f"/listing/{body.listing_id}"
        )

    return {"id": deal_id, "status": "pending_seller"}


@router.get("")
def list_my_deals(status: str = "", user=Depends(get_current_user)):
    with get_conn() as conn:
        where = "(d.buyer_id=? OR d.seller_id=?)"
        params = [user["id"], user["id"]]
        if status:
            where += " AND d.status=?"
            params.append(status)
        rows = conn.execute(f"""
            SELECT d.*,
                   l.title      AS listing_title,
                   l.price      AS listing_price,
                   l.currency   AS listing_currency,
                   l.image_url  AS listing_image,
                   b.username   AS buyer_name,
                   s.username   AS seller_name
            FROM deals d
            JOIN listings l ON l.id = d.listing_id
            JOIN users b    ON b.id = d.buyer_id
            JOIN users s    ON s.id = d.seller_id
            WHERE {where}
            ORDER BY d.updated_at DESC
        """, params).fetchall()
    return [dict(r) for r in rows]


@router.get("/{deal_id}")
def get_deal(deal_id: int, user=Depends(get_current_user)):
    with get_conn() as conn:
        row = conn.execute("""
            SELECT d.*,
                   l.title AS listing_title, l.price AS listing_price,
                   l.currency AS listing_currency, l.image_url AS listing_image,
                   b.username AS buyer_name, s.username AS seller_name
            FROM deals d
            JOIN listings l ON l.id = d.listing_id
            JOIN users b    ON b.id = d.buyer_id
            JOIN users s    ON s.id = d.seller_id
            WHERE d.id=?
        """, (deal_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Deal not found")
        deal = dict(row)
        if deal["buyer_id"] != user["id"] and deal["seller_id"] != user["id"]:
            raise HTTPException(403, "Not your deal")
    return deal


@router.put("/{deal_id}/accept")
def accept_deal(deal_id: int, user=Depends(get_current_user)):
    with get_conn() as conn:
        deal = _get_deal_or_404(conn, deal_id)
        _require_party(deal, user["id"], "seller")
        if deal["status"] != "pending_seller":
            raise HTTPException(400, f"Cannot accept a deal with status '{deal['status']}'")
        conn.execute("UPDATE deals SET status='in_progress', updated_at=CURRENT_TIMESTAMP WHERE id=?", (deal_id,))
        create_notification(conn, deal["buyer_id"], TYPE_DEAL,
            "Deal accepted!", f"Your deal on listing #{deal['listing_id']} was accepted. Awaiting delivery.",
            f"/listing/{deal['listing_id']}")
    return {"status": "in_progress"}


@router.put("/{deal_id}/decline")
def decline_deal(deal_id: int, user=Depends(get_current_user)):
    with get_conn() as conn:
        deal = _get_deal_or_404(conn, deal_id)
        _require_party(deal, user["id"], "seller")
        if deal["status"] != "pending_seller":
            raise HTTPException(400, f"Cannot decline a deal with status '{deal['status']}'")
        conn.execute("UPDATE deals SET status='declined', updated_at=CURRENT_TIMESTAMP WHERE id=?", (deal_id,))
        create_notification(conn, deal["buyer_id"], TYPE_DEAL,
            "Deal declined", f"Your deal on listing #{deal['listing_id']} was declined by the seller.",
            f"/listing/{deal['listing_id']}")
    return {"status": "declined"}


@router.put("/{deal_id}/delivered")
def mark_delivered(deal_id: int, user=Depends(get_current_user)):
    with get_conn() as conn:
        deal = _get_deal_or_404(conn, deal_id)
        _require_party(deal, user["id"], "seller")
        if deal["status"] != "in_progress":
            raise HTTPException(400, f"Cannot mark delivered with status '{deal['status']}'")
        conn.execute("UPDATE deals SET status='pending_buyer', updated_at=CURRENT_TIMESTAMP WHERE id=?", (deal_id,))
        create_notification(conn, deal["buyer_id"], TYPE_DEAL,
            "Delivery marked — please confirm!",
            "The seller says the item was delivered. Confirm receipt or open a dispute.",
            f"/listing/{deal['listing_id']}")
    return {"status": "pending_buyer"}


@router.put("/{deal_id}/confirm")
def confirm_deal(deal_id: int, user=Depends(get_current_user)):
    with get_conn() as conn:
        deal = _get_deal_or_404(conn, deal_id)
        _require_party(deal, user["id"], "buyer")
        if deal["status"] != "pending_buyer":
            raise HTTPException(400, f"Cannot confirm with status '{deal['status']}'")

        conn.execute("""
            UPDATE deals SET status='completed', completed_at=CURRENT_TIMESTAMP,
                             updated_at=CURRENT_TIMESTAMP WHERE id=?
        """, (deal_id,))

        # Increment deal_count on the listing
        conn.execute(
            "UPDATE listings SET deal_count = deal_count + 1 WHERE id=?",
            (deal["listing_id"],)
        )

        create_notification(conn, deal["seller_id"], TYPE_DEAL,
            "Deal completed! ✓",
            f"Buyer confirmed receipt. You can now leave a rating.",
            f"/listing/{deal['listing_id']}")
    return {"status": "completed"}


@router.put("/{deal_id}/dispute")
def dispute_deal(deal_id: int, user=Depends(get_current_user)):
    with get_conn() as conn:
        deal = _get_deal_or_404(conn, deal_id)
        _require_party(deal, user["id"], "buyer")
        if deal["status"] != "pending_buyer":
            raise HTTPException(400, f"Cannot dispute with status '{deal['status']}'")
        conn.execute("UPDATE deals SET status='disputed', updated_at=CURRENT_TIMESTAMP WHERE id=?", (deal_id,))
        create_notification(conn, deal["seller_id"], TYPE_DEAL,
            "Deal disputed ⚑",
            "The buyer opened a dispute on this deal. An admin will review.",
            f"/listing/{deal['listing_id']}")
    return {"status": "disputed"}


@router.put("/{deal_id}/resolve-dispute")
def resolve_dispute(deal_id: int, body: DisputeResolve, _=Depends(get_admin_user)):
    with get_conn() as conn:
        deal = _get_deal_or_404(conn, deal_id)
        if deal["status"] != "disputed":
            raise HTTPException(400, "Deal is not disputed")
        conn.execute("""
            UPDATE deals SET status='completed', completed_at=CURRENT_TIMESTAMP,
                             updated_at=CURRENT_TIMESTAMP, admin_notes=? WHERE id=?
        """, (body.notes, deal_id))
        conn.execute("UPDATE listings SET deal_count = deal_count + 1 WHERE id=?", (deal["listing_id"],))

        favor_text = f" Ruling in favour of {body.favor}." if body.favor else ""
        summary    = f"{body.notes[:120]}{favor_text}".strip() or "No notes provided."

        for uid in [deal["buyer_id"], deal["seller_id"]]:
            create_notification(conn, uid, TYPE_DEAL,
                "Dispute resolved",
                f"Admin resolved the dispute on your deal.{favor_text} {body.notes[:80]}".strip(),
                f"/listing/{deal['listing_id']}")
    return {"status": "completed"}


@router.get("/{deal_id}/can-rate")
def can_rate(deal_id: int, user=Depends(get_current_user)):
    """Returns whether calling user can leave a rating for this deal."""
    with get_conn() as conn:
        deal = _get_deal_or_404(conn, deal_id)
        if deal["buyer_id"] != user["id"] and deal["seller_id"] != user["id"]:
            raise HTTPException(403, "Not your deal")
        if deal["status"] != "completed":
            return {"can_rate": False, "reason": "Deal not completed"}
        # Check if they already rated
        rate_target = deal["seller_id"] if user["id"] == deal["buyer_id"] else deal["buyer_id"]
        already = conn.execute(
            "SELECT id FROM ratings WHERE reviewer_id=? AND listing_id=?",
            (user["id"], deal["listing_id"])
        ).fetchone()
        return {"can_rate": not bool(already), "target_id": rate_target,
                "reason": "Already rated" if already else ""}
