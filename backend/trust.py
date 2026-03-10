"""
Trust Score Calculator
─────────────────────────────────────────────────────────────────────────────
Produces a single 0–100 trust score for a seller based on weighted signals.

Signals and max contributions:
  RSI verified            +20   (binary — verified identity)
  Completed deals         +25   (logarithmic: 25 * log10(deals+1) / log10(101), caps at 25)
  Rating average          +25   (linear: avg/5 * 25, only if ≥3 ratings)
  Rating count            +10   (logarithmic: caps at 10 with ~50 ratings)
  Account age             +10   (linear: days/365, caps at 1 year)
  Dispute rate penalty    −15   (proportion of deals that ended disputed)

Score bands:
  0–29   → UNVERIFIED  (grey)
  30–49  → EMERGING    (dim amber)
  50–69  → TRUSTED     (amber)
  70–84  → REPUTABLE   (bright amber)
  85–100 → ELITE       (gold)
"""

import math
from datetime import datetime, timezone


def compute_trust_score(
    rsi_verified:    bool,
    completed_deals: int,
    disputed_deals:  int,
    rating_avg:      float | None,
    rating_count:    int,
    created_at:      str,          # ISO datetime string
) -> dict:
    score = 0.0

    # ── RSI verified ──────────────────────────────────────────────────────────
    if rsi_verified:
        score += 20

    # ── Completed deals (log scale, cap 25) ───────────────────────────────────
    if completed_deals > 0:
        deal_score = 25 * math.log10(completed_deals + 1) / math.log10(101)
        score += min(deal_score, 25)

    # ── Rating average (only meaningful with ≥3 ratings) ─────────────────────
    if rating_avg and rating_count >= 3:
        score += (rating_avg / 5.0) * 25

    # ── Rating count (log scale, cap 10) ─────────────────────────────────────
    if rating_count > 0:
        count_score = 10 * math.log10(rating_count + 1) / math.log10(51)
        score += min(count_score, 10)

    # ── Account age (cap 1 year = 10pts) ─────────────────────────────────────
    try:
        created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        age_days = (datetime.now(timezone.utc) - created).days
        age_score = min(age_days / 365.0, 1.0) * 10
        score += age_score
    except Exception:
        pass

    # ── Dispute rate penalty ──────────────────────────────────────────────────
    total_deals = completed_deals + disputed_deals
    if total_deals >= 3 and disputed_deals > 0:
        dispute_rate = disputed_deals / total_deals
        score -= min(dispute_rate * 15, 15)

    score = max(0.0, min(100.0, score))
    rounded = round(score)

    if rounded >= 85:
        band, color = "ELITE",      "#c084fc"
    elif rounded >= 70:
        band, color = "REPUTABLE",  "#a855f7"
    elif rounded >= 50:
        band, color = "TRUSTED",    "#8b45d4"
    elif rounded >= 30:
        band, color = "EMERGING",   "#4a1a7a"
    else:
        band, color = "UNVERIFIED", "#3a3a4a"

    return {
        "score": rounded,
        "band":  band,
        "color": color,
        "breakdown": {
            "rsi_verified":    20 if rsi_verified else 0,
            "deals":           round(min(25 * math.log10(completed_deals + 1) / math.log10(101), 25), 1) if completed_deals > 0 else 0,
            "rating_quality":  round((rating_avg / 5.0) * 25, 1) if (rating_avg and rating_count >= 3) else 0,
            "rating_volume":   round(min(10 * math.log10(rating_count + 1) / math.log10(51), 10), 1) if rating_count > 0 else 0,
            "account_age":     round(min((age_days if 'age_days' in dir() else 0) / 365.0, 1.0) * 10, 1),
            "dispute_penalty": -round(min((disputed_deals / total_deals) * 15, 15), 1) if total_deals >= 3 and disputed_deals > 0 else 0,
        }
    }
