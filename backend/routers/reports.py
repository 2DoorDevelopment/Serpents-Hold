from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from auth import get_current_user
from database import get_conn

router = APIRouter(prefix="/api/reports", tags=["reports"])


class ReportBody(BaseModel):
    reason: str
    listing_id: Optional[int] = None
    user_id:    Optional[int] = None


@router.post("")
def submit_report(body: ReportBody, current_user: dict = Depends(get_current_user)):
    if not body.reason.strip():
        raise HTTPException(400, "Reason required")

    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO reports (reporter_id, listing_id, user_id, reason, status) VALUES (?, ?, ?, ?, 'open')",
            (current_user["id"], body.listing_id, body.user_id, body.reason),
        )
        report_id = cur.lastrowid

    return {"id": report_id, "success": True}
