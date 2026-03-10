"""
Image Upload Router
──────────────────────────────────────────────────────────────────────────────
POST /api/upload/listing-image  — upload a listing image (authenticated)

- Accepts: JPEG, PNG, WebP, GIF
- Max size: 5 MB
- Magic-byte validation (not just content-type header)
- Resizes to max 1200px on longest edge using Pillow
- Saves as WebP quality=82
- Rate limited: 20 uploads / hour per IP
- Returns: { "url": "/uploads/listings/..." }
"""

import io
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile

from auth import get_current_user
from ratelimit import upload_limiter

router = APIRouter(prefix="/api/upload", tags=["upload"])

UPLOADS_DIR    = Path(__file__).parent.parent / "uploads" / "listings"
MAX_SIZE_BYTES = 5 * 1024 * 1024   # 5 MB
MAX_DIMENSION  = 1200               # px longest edge

# Magic bytes for allowed image formats
_MAGIC: list[tuple[bytes, str]] = [
    (b"\xff\xd8\xff",              "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n",        "image/png"),
    (b"RIFF",                      "image/webp"),  # further validated below
    (b"GIF87a",                    "image/gif"),
    (b"GIF89a",                    "image/gif"),
]


def _validate_magic(data: bytes) -> str:
    """Return detected mime type or raise HTTP 400."""
    for magic, mime in _MAGIC:
        if data[:len(magic)] == magic:
            # WebP: bytes 8-12 must be 'WEBP'
            if mime == "image/webp" and data[8:12] != b"WEBP":
                continue
            return mime
    raise HTTPException(400, "File does not appear to be a valid image (JPEG, PNG, WebP, or GIF).")


def _ensure_dir():
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/listing-image")
async def upload_listing_image(
    request: Request,
    file: UploadFile = File(...),
    user: dict       = Depends(get_current_user),
):
    # ── Rate limit ────────────────────────────────────────────────────────────
    upload_limiter.check(request)

    # ── Read & size-check ─────────────────────────────────────────────────────
    data = await file.read()
    if len(data) > MAX_SIZE_BYTES:
        raise HTTPException(413, f"File too large. Maximum size is {MAX_SIZE_BYTES // 1024 // 1024} MB.")
    if len(data) < 12:
        raise HTTPException(400, "File is too small to be a valid image.")

    # ── Magic-byte validation (ignore client-supplied content-type) ───────────
    _validate_magic(data)

    # ── Process with Pillow ───────────────────────────────────────────────────
    try:
        from PIL import Image

        img = Image.open(io.BytesIO(data))
        img.verify()                     # catch truncated / corrupt files
        img = Image.open(io.BytesIO(data))  # re-open after verify() (it consumes the stream)

        # Normalise colour mode for WebP output
        if img.mode == "P":
            img = img.convert("RGBA")
        elif img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGB")

        # Resize if needed (preserve aspect ratio)
        w, h = img.size
        if max(w, h) > MAX_DIMENSION:
            ratio = MAX_DIMENSION / max(w, h)
            img   = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)

        _ensure_dir()
        filename = f"{user['id']}_{uuid.uuid4().hex[:12]}.webp"
        dest     = UPLOADS_DIR / filename
        img.save(str(dest), "WEBP", quality=82, method=4)

    except ImportError:
        # Pillow not installed — store raw file, preserving original extension
        _ensure_dir()
        ext      = (file.filename or "img").rsplit(".", 1)[-1].lower()[:4]
        filename = f"{user['id']}_{uuid.uuid4().hex[:12]}.{ext}"
        dest     = UPLOADS_DIR / filename
        dest.write_bytes(data)

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(500, f"Image processing failed: {exc}")

    return {"url": f"/uploads/listings/{filename}"}
