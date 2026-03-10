"""
Listing Share Card
──────────────────────────────────────────────────────────────────────────────
GET /listing/{id}/card   — standalone HTML page with OpenGraph meta tags
                           + a clean visual card for Discord/Slack unfurls

The page also renders a full visual card for direct browser visits.
No auth required — only active (and hidden) listings are accessible,
but hidden listings show a "removed" card so bots don't 404.
"""

from fastapi import APIRouter
from fastapi.responses import HTMLResponse
from database import get_conn
import html

router = APIRouter(tags=["share"])


def _esc(v) -> str:
    return html.escape(str(v or ""), quote=True)


def _price_str(price, currency, listing_type) -> str:
    if listing_type == "WTB":
        prefix = "Offering "
    elif listing_type == "WTT":
        return "Trade / negotiable"
    elif listing_type == "WTR":
        return "Rental"
    else:
        prefix = ""
    if not price:
        return "Negotiable"
    cur = currency or "aUEC"
    p = f"{int(price):,}" if price == int(price) else f"{price:,.2f}"
    return f"{prefix}{p} {cur}"


@router.get("/listing/{listing_id}/card", response_class=HTMLResponse)
def listing_share_card(listing_id: int):
    with get_conn() as conn:
        row = conn.execute("""
            SELECT l.*, u.username AS seller_name, u.rsi_verified AS seller_verified,
                   u.avatar_url AS seller_avatar
            FROM listings l
            JOIN users u ON u.id = l.seller_id
            WHERE l.id = ?
        """, (listing_id,)).fetchone()

    site_url = "http://localhost:3000"  # updated by deploy env

    if not row or row["status"] not in ("active", "hidden", "expired"):
        return HTMLResponse(_removed_card(listing_id, site_url), status_code=404)

    l = dict(row)
    removed = l["status"] != "active"

    title       = _esc(l["title"])
    seller      = _esc(l["seller_name"])
    category    = _esc(l["category"] or "")
    system      = _esc(l["system_name"] or "")
    ltype       = _esc(l["listing_type"] or "WTS")
    price_str   = _esc(_price_str(l["price"], l["currency"], l["listing_type"]))
    desc_raw    = (l["description"] or "")[:200].replace("\n", " ")
    desc        = _esc(desc_raw + ("…" if len(l["description"] or "") > 200 else ""))
    img_url     = _esc(l["image_url"] or "")
    listing_url = f"{site_url}/listing/{listing_id}"

    og_img   = img_url or f"{site_url}/static/og-default.png"
    og_title = f"{l['listing_type']} · {l['title']}" if not removed else "Listing Removed"
    og_desc  = f"{price_str} · Sold by @{l['seller_name']} · {l['category'] or ''}" if not removed else "This listing is no longer available."

    # Colour by listing type
    type_colors = {"WTS": "#4a8a3a", "WTB": "#1a5a7a", "WTT": "#5a3a8a", "WTR": "#8a5a10"}
    accent = type_colors.get(l["listing_type"] or "WTS", "#8b45d4")

    return HTMLResponse(f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{_esc(og_title)} — Serpent's Hold</title>

  <!-- OpenGraph -->
  <meta property="og:type"        content="website">
  <meta property="og:url"         content="{_esc(listing_url)}">
  <meta property="og:title"       content="{_esc(og_title)}">
  <meta property="og:description" content="{_esc(og_desc)}">
  <meta property="og:image"       content="{_esc(og_img)}">
  <meta property="og:site_name"   content="Serpent's Hold">

  <!-- Twitter / Discord fallback -->
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:title"       content="{_esc(og_title)}">
  <meta name="twitter:description" content="{_esc(og_desc)}">
  <meta name="twitter:image"       content="{_esc(og_img)}">

  <style>
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      background: #0b0b12;
      color: #e0d8f0;
      font-family: 'Segoe UI', system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 1rem;
    }}
    .card {{
      background: #131320;
      border: 1px solid #2a2040;
      border-left: 4px solid {accent};
      border-radius: 4px;
      width: 100%;
      max-width: 520px;
      overflow: hidden;
    }}
    .card-img {{
      width: 100%;
      aspect-ratio: 16/9;
      object-fit: cover;
      display: block;
      background: #0b0b18;
    }}
    .card-img-placeholder {{
      width: 100%;
      aspect-ratio: 16/9;
      background: linear-gradient(135deg, #131320 0%, #1a1030 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 3rem;
      color: #2a2040;
    }}
    .card-body {{ padding: 1rem 1.25rem; }}
    .type-badge {{
      display: inline-block;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      padding: 2px 8px;
      border: 1px solid {accent};
      color: {accent};
      background: {accent}18;
      border-radius: 2px;
      margin-bottom: 0.6rem;
    }}
    .card-title {{
      font-size: 1.1rem;
      font-weight: 700;
      color: #f0eaff;
      margin-bottom: 0.4rem;
      line-height: 1.3;
    }}
    .card-price {{
      font-size: 1.25rem;
      font-weight: 900;
      color: {accent};
      font-family: monospace;
      margin-bottom: 0.6rem;
    }}
    .card-meta {{
      font-size: 0.75rem;
      color: #8070a0;
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin-bottom: 0.6rem;
    }}
    .card-desc {{
      font-size: 0.82rem;
      color: #a090c0;
      line-height: 1.5;
      margin-bottom: 0.85rem;
    }}
    .card-footer {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding-top: 0.75rem;
      border-top: 1px solid #1e1a30;
      flex-wrap: wrap;
    }}
    .seller {{
      font-size: 0.78rem;
      color: #a090c0;
    }}
    .seller strong {{ color: #e0d8f0; }}
    .verified {{ color: #4a8a3a; font-size: 0.7rem; }}
    .view-btn {{
      display: inline-block;
      padding: 0.4rem 1rem;
      background: {accent};
      color: #fff;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-decoration: none;
      border-radius: 2px;
    }}
    .site-badge {{
      font-size: 0.62rem;
      color: #3a3050;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      text-align: center;
      padding: 0.5rem;
      border-top: 1px solid #1a1628;
    }}
    .removed-msg {{
      padding: 2rem;
      text-align: center;
      color: #604060;
    }}
    .removed-msg h2 {{ color: #8b45d4; margin-bottom: 0.5rem; }}
  </style>

  <!-- Redirect to the real listing page on click -->
  <script>
    // Auto-redirect bots that follow meta refresh; browsers get the card
    // Uncomment the line below to auto-redirect browsers too:
    // setTimeout(() => window.location.href = "{_esc(listing_url)}", 0);
  </script>
</head>
<body>
  <div class="card">
    {"<div class='removed-msg'><h2>⬡ SERPENT'S HOLD</h2><p>This listing has been removed or is no longer active.</p></div>" if removed else f"""
    {"<img class='card-img' src='" + img_url + "' alt='" + title + "' onerror=\"this.style.display='none';this.nextSibling.style.display='flex'\">" if img_url else ""}
    <div class="card-img-placeholder" {"style='display:none'" if img_url else ""}>⬡</div>
    <div class="card-body">
      <div class="type-badge">{ltype}</div>
      <div class="card-title">{title}</div>
      <div class="card-price">{price_str}</div>
      <div class="card-meta">
        {"<span>📦 " + category + "</span>" if category else ""}
        {"<span>🪐 " + system + "</span>" if system else ""}
      </div>
      {"<div class='card-desc'>" + desc + "</div>" if desc else ""}
      <div class="card-footer">
        <div class="seller">
          by <strong>@{seller}</strong>
          {"<span class='verified'> ✓ RSI</span>" if l["seller_verified"] else ""}
        </div>
        <a class="view-btn" href="{_esc(listing_url)}">VIEW LISTING →</a>
      </div>
    </div>
    """}
    <div class="site-badge">⬡ SERPENT'S HOLD · Star Citizen Underground Market</div>
  </div>
</body>
</html>""")


def _removed_card(listing_id: int, site_url: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Listing Not Found — Serpent's Hold</title>
  <meta property="og:title" content="Listing Not Found">
  <meta property="og:description" content="This listing does not exist on Serpent's Hold.">
  <style>
    body {{ background:#0b0b12; color:#604060; font-family:system-ui,sans-serif;
            display:flex; align-items:center; justify-content:center; min-height:100vh; }}
    .box {{ text-align:center; }}
    h2 {{ color:#8b45d4; margin-bottom:0.5rem; }}
    a {{ color:#8b45d4; }}
  </style>
</head>
<body>
  <div class="box">
    <h2>⬡ SERPENT'S HOLD</h2>
    <p>Listing #{listing_id} not found.</p>
    <p style="margin-top:1rem"><a href="{html.escape(site_url)}">Browse the market →</a></p>
  </div>
</body>
</html>"""
