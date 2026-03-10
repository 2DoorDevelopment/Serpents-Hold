"""
Item Reports Router
Users report problems with existing item_types (wrong name, outdated, duplicate, etc.)
Admins resolve them.

  POST   /api/item-reports                  — submit a report (auth required)
  GET    /api/item-reports                  — admin: list all (filter ?resolved=0/1)
  GET    /api/item-reports/{id}             — admin: single report
  PUT    /api/item-reports/{id}/resolve     — admin: mark resolved
  DELETE /api/item-reports/{id}             — admin: delete
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_current_user, get_admin_user
from database import get_conn

router = APIRouter(prefix="/api/item-reports", tags=["item-reports"])

VALID_REASONS = [
    "Wrong name",
    "Wrong category",
    "Duplicate entry",
    "Item removed from game",
    "Incorrect image",
    "Other",
]


class ReportCreate(BaseModel):
    item_type_id: int
    reason: str
    detail: str = ""


@router.post("", status_code=201)
def create_report(body: ReportCreate, user=Depends(get_current_user)):
    if body.reason not in VALID_REASONS:
        raise HTTPException(400, f"reason must be one of: {', '.join(VALID_REASONS)}")
    with get_conn() as conn:
        # verify item exists
        if not conn.execute("SELECT id FROM item_types WHERE id=?", (body.item_type_id,)).fetchone():
            raise HTTPException(404, "Item not found")
        # prevent duplicate open reports from same user for same item
        existing = conn.execute(
            "SELECT id FROM item_reports WHERE reporter_id=? AND item_type_id=? AND resolved=0",
            (user["id"], body.item_type_id)
        ).fetchone()
        if existing:
            raise HTTPException(409, "You already have an open report for this item")
        conn.execute(
            "INSERT INTO item_reports (reporter_id, item_type_id, reason, detail) VALUES(?,?,?,?)",
            (user["id"], body.item_type_id, body.reason, body.detail)
        )
    return {"message": "Report submitted"}


@router.get("")
def list_reports(resolved: int = None, _=Depends(get_admin_user)):
    with get_conn() as conn:
        if resolved is None:
            rows = conn.execute("""
                SELECT ir.*, it.name AS item_name, it.category, u.username AS reporter
                FROM item_reports ir
                JOIN item_types it ON it.id = ir.item_type_id
                JOIN users u ON u.id = ir.reporter_id
                ORDER BY ir.created_at DESC
            """).fetchall()
        else:
            rows = conn.execute("""
                SELECT ir.*, it.name AS item_name, it.category, u.username AS reporter
                FROM item_reports ir
                JOIN item_types it ON it.id = ir.item_type_id
                JOIN users u ON u.id = ir.reporter_id
                WHERE ir.resolved = ?
                ORDER BY ir.created_at DESC
            """, (resolved,)).fetchall()
    return [dict(r) for r in rows]


@router.get("/{report_id}")
def get_report(report_id: int, _=Depends(get_admin_user)):
    with get_conn() as conn:
        row = conn.execute("""
            SELECT ir.*, it.name AS item_name, it.category, u.username AS reporter
            FROM item_reports ir
            JOIN item_types it ON it.id = ir.item_type_id
            JOIN users u ON u.id = ir.reporter_id
            WHERE ir.id = ?
        """, (report_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Report not found")
    return dict(row)


@router.put("/{report_id}/resolve")
def resolve_report(report_id: int, admin=Depends(get_admin_user)):
    with get_conn() as conn:
        row = conn.execute("SELECT id FROM item_reports WHERE id=?", (report_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Report not found")
        conn.execute(
            "UPDATE item_reports SET resolved=1, resolved_by=? WHERE id=?",
            (admin["id"], report_id)
        )
    return {"message": "Resolved"}


@router.delete("/{report_id}")
def delete_report(report_id: int, _=Depends(get_admin_user)):
    with get_conn() as conn:
        conn.execute("DELETE FROM item_reports WHERE id=?", (report_id,))
    return {"message": "Deleted"}
