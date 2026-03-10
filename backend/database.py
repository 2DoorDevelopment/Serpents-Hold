import sqlite3
import os
from pathlib import Path

DB_PATH = Path(__file__).parent / "market.db"


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    # executescript issues an implicit COMMIT first, so run schema creation separately
    conn = get_conn()
    conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                username        TEXT    UNIQUE NOT NULL,
                email           TEXT    UNIQUE DEFAULT NULL,
                password_hash   TEXT    DEFAULT '',
                bio             TEXT    DEFAULT '',
                avatar_url      TEXT    DEFAULT '',
                rsi_handle      TEXT    DEFAULT '',
                rsi_verified    INTEGER DEFAULT 0,
                rsi_verify_code TEXT    DEFAULT '',
                role            TEXT    DEFAULT 'user',
                created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
                banned          INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS listings (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                seller_id    INTEGER NOT NULL,
                title        TEXT    NOT NULL,
                description  TEXT    DEFAULT '',
                category     TEXT    NOT NULL,
                subcategory  TEXT    DEFAULT '',
                price        REAL    NOT NULL,
                currency     TEXT    DEFAULT 'aUEC',
                quantity     INTEGER DEFAULT 1,
                image_url    TEXT    DEFAULT '',
                status       TEXT    DEFAULT 'active',
                location     TEXT    DEFAULT '',
                created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
                views        INTEGER DEFAULT 0,
                FOREIGN KEY (seller_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS messages (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                listing_id   INTEGER NOT NULL,
                sender_id    INTEGER NOT NULL,
                recipient_id INTEGER NOT NULL,
                body         TEXT    NOT NULL,
                type         TEXT    DEFAULT 'inquiry',
                read         INTEGER DEFAULT 0,
                created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (listing_id)   REFERENCES listings(id),
                FOREIGN KEY (sender_id)    REFERENCES users(id),
                FOREIGN KEY (recipient_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS reports (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                reporter_id INTEGER NOT NULL,
                listing_id  INTEGER,
                user_id     INTEGER,
                reason      TEXT    NOT NULL,
                resolved    INTEGER DEFAULT 0,
                status      TEXT    DEFAULT 'open',
                created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS item_types (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT    NOT NULL,
                category    TEXT    NOT NULL,
                subcategory TEXT    DEFAULT '',
                description TEXT    DEFAULT '',
                image_url   TEXT    DEFAULT '',
                active      INTEGER DEFAULT 1,
                created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS favorites (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL,
                listing_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, listing_id),
                FOREIGN KEY (user_id)    REFERENCES users(id),
                FOREIGN KEY (listing_id) REFERENCES listings(id)
            );

            CREATE TABLE IF NOT EXISTS ratings (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                reviewer_id INTEGER NOT NULL,
                seller_id   INTEGER NOT NULL,
                listing_id  INTEGER,
                score       INTEGER NOT NULL CHECK(score BETWEEN 1 AND 5),
                comment     TEXT    DEFAULT '',
                created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(reviewer_id, listing_id),
                FOREIGN KEY (reviewer_id) REFERENCES users(id),
                FOREIGN KEY (seller_id)   REFERENCES users(id),
                FOREIGN KEY (listing_id)  REFERENCES listings(id)
            );

            CREATE TABLE IF NOT EXISTS price_history (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                listing_id  INTEGER NOT NULL,
                price       REAL    NOT NULL,
                currency    TEXT    DEFAULT 'aUEC',
                recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (listing_id) REFERENCES listings(id)
            );

            CREATE TABLE IF NOT EXISTS announcements (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                author_id  INTEGER NOT NULL,
                title      TEXT    NOT NULL,
                body       TEXT    NOT NULL,
                pinned     INTEGER DEFAULT 0,
                active     INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (author_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS direct_messages (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id    INTEGER NOT NULL,
                recipient_id INTEGER NOT NULL,
                body         TEXT    NOT NULL,
                read         INTEGER DEFAULT 0,
                created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sender_id)    REFERENCES users(id),
                FOREIGN KEY (recipient_id) REFERENCES users(id)
            );
    """)
    conn.close()

    # Safe migrations — run in a fresh connection after executescript
    with get_conn() as conn:
        # Original columns
        _safe_add_column(conn, "listings", "expires_at",   "DATETIME DEFAULT NULL")
        _safe_add_column(conn, "listings", "sold_at",      "DATETIME DEFAULT NULL")
        _safe_add_column(conn, "listings", "item_type_id", "INTEGER  DEFAULT NULL")

        # Discord OAuth columns
        _safe_add_column(conn, "users", "discord_id",  "TEXT DEFAULT NULL")
        _safe_add_column(conn, "users", "discord_tag", "TEXT DEFAULT ''")
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id) WHERE discord_id IS NOT NULL"
        )

        # Seller "last active" tracking
        _safe_add_column(conn, "users", "last_active_at", "DATETIME DEFAULT CURRENT_TIMESTAMP")

        # New listing fields
        _safe_add_column(conn, "listings", "listing_type",  "TEXT DEFAULT 'WTS'")
        _safe_add_column(conn, "listings", "source",        "TEXT DEFAULT ''")
        _safe_add_column(conn, "listings", "availability",  "TEXT DEFAULT 'Immediate'")
        _safe_add_column(conn, "listings", "deal_count",    "INTEGER DEFAULT 0")
        _safe_add_column(conn, "listings", "game_version",  "TEXT DEFAULT ''")
        _safe_add_column(conn, "listings", "language",      "TEXT DEFAULT 'English'")
        _safe_add_column(conn, "listings", "system_name",   "TEXT DEFAULT ''")
        _safe_add_column(conn, "listings", "upvotes",       "INTEGER DEFAULT 0")
        _safe_add_column(conn, "listings", "downvotes",     "INTEGER DEFAULT 0")

        # UEX raw-response cache — one row per endpoint key
        conn.execute("""
            CREATE TABLE IF NOT EXISTS uex_cache (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                cache_key  TEXT    UNIQUE NOT NULL,
                data       TEXT    NOT NULL,
                fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                item_count INTEGER DEFAULT 0
            )
        """)

        # Item reports — users flag bad/outdated/duplicate item_types
        conn.execute("""
            CREATE TABLE IF NOT EXISTS item_reports (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                reporter_id  INTEGER NOT NULL,
                item_type_id INTEGER NOT NULL,
                reason       TEXT    NOT NULL,
                detail       TEXT    DEFAULT '',
                resolved     INTEGER DEFAULT 0,
                resolved_by  INTEGER DEFAULT NULL,
                resolved_item_id INTEGER DEFAULT NULL,
                created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (reporter_id)  REFERENCES users(id),
                FOREIGN KEY (item_type_id) REFERENCES item_types(id),
                FOREIGN KEY (resolved_item_id) REFERENCES item_types(id)
            )
        """)

        # Missing item requests — users request items that don't exist yet
        conn.execute("""
            CREATE TABLE IF NOT EXISTS missing_item_requests (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                requester_id     INTEGER NOT NULL,
                name             TEXT    NOT NULL,
                category         TEXT    NOT NULL,
                subcategory      TEXT    DEFAULT '',
                description      TEXT    DEFAULT '',
                votes            INTEGER DEFAULT 1,
                status           TEXT    DEFAULT 'open',
                resolved_item_id INTEGER DEFAULT NULL,
                created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (requester_id)     REFERENCES users(id),
                FOREIGN KEY (resolved_item_id) REFERENCES item_types(id)
            )
        """)

        # One upvote per user per missing-item request
        conn.execute("""
            CREATE TABLE IF NOT EXISTS missing_item_votes (
                user_id    INTEGER NOT NULL,
                request_id INTEGER NOT NULL,
                PRIMARY KEY (user_id, request_id),
                FOREIGN KEY (user_id)    REFERENCES users(id),
                FOREIGN KEY (request_id) REFERENCES missing_item_requests(id)
            )
        """)

        # Per-listing upvote/downvote tracking
        conn.execute("""
            CREATE TABLE IF NOT EXISTS listing_votes (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL,
                listing_id INTEGER NOT NULL,
                vote       INTEGER NOT NULL CHECK(vote IN (1, -1)),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, listing_id),
                FOREIGN KEY (user_id)    REFERENCES users(id),
                FOREIGN KEY (listing_id) REFERENCES listings(id)
            )
        """)

        # In-app notifications
        conn.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL,
                type       TEXT    NOT NULL,
                title      TEXT    NOT NULL,
                body       TEXT    DEFAULT '',
                link       TEXT    DEFAULT '',
                read       INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)

        # Deal flow — buyer/seller transaction tracking
        conn.execute("""
            CREATE TABLE IF NOT EXISTS deals (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                listing_id     INTEGER NOT NULL,
                buyer_id       INTEGER NOT NULL,
                seller_id      INTEGER NOT NULL,
                quantity       INTEGER DEFAULT 1,
                buyer_message  TEXT    DEFAULT '',
                status         TEXT    DEFAULT 'pending_seller',
                admin_notes    TEXT    DEFAULT '',
                completed_at   DATETIME DEFAULT NULL,
                created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (listing_id) REFERENCES listings(id),
                FOREIGN KEY (buyer_id)   REFERENCES users(id),
                FOREIGN KEY (seller_id)  REFERENCES users(id)
            )
        """)

        # Orgs — player organisation accounts
        conn.execute("""
            CREATE TABLE IF NOT EXISTS orgs (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                tag         TEXT    NOT NULL UNIQUE,
                name        TEXT    NOT NULL,
                description TEXT    DEFAULT '',
                avatar_url  TEXT    DEFAULT '',
                banner_url  TEXT    DEFAULT '',
                owner_id    INTEGER NOT NULL,
                created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (owner_id) REFERENCES users(id)
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS org_members (
                org_id    INTEGER NOT NULL,
                user_id   INTEGER NOT NULL,
                role      TEXT    DEFAULT 'member',
                joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (org_id, user_id),
                FOREIGN KEY (org_id)  REFERENCES orgs(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)

        # Listing templates — reusable form presets per user
        conn.execute("""
            CREATE TABLE IF NOT EXISTS listing_templates (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL,
                name       TEXT    NOT NULL,
                fields     TEXT    NOT NULL DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)

        # Moderator action log
        conn.execute("""
            CREATE TABLE IF NOT EXISTS mod_log (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                mod_id      INTEGER NOT NULL,
                action      TEXT    NOT NULL,
                target_type TEXT    NOT NULL,
                target_id   INTEGER NOT NULL,
                notes       TEXT    DEFAULT '',
                created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (mod_id) REFERENCES users(id)
            )
        """)

        # Public API keys
        conn.execute("""
            CREATE TABLE IF NOT EXISTS api_keys (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                name         TEXT    NOT NULL,
                key_value    TEXT    NOT NULL UNIQUE,
                notes        TEXT    DEFAULT '',
                active       INTEGER DEFAULT 1,
                uses         INTEGER DEFAULT 0,
                created_by   INTEGER,
                last_used_at DATETIME DEFAULT NULL,
                created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id)
            )
        """)

        # ── Safe column migrations ────────────────────────────────────────────
        _safe_add_column(conn, "listings", "org_id",        "INTEGER DEFAULT NULL")
        _safe_add_column(conn, "listings", "expiry_warned", "INTEGER DEFAULT 0")

        # Reports: add status column if missing; backfill from legacy resolved int
        if _safe_add_column(conn, "reports", "status", "TEXT DEFAULT 'open'"):
            conn.execute("UPDATE reports SET status='resolved' WHERE resolved=1 AND status='open'")

        # ── Indexes ──────────────────────────────────────────────────────────
        # These are safe to run repeatedly (IF NOT EXISTS)
        _create_indexes(conn)


def _create_indexes(conn):
    """Create performance indexes. All are IF NOT EXISTS so safe to re-run."""
    indexes = [
        # Listings — the most-queried table
        "CREATE INDEX IF NOT EXISTS idx_listings_seller    ON listings(seller_id)",
        "CREATE INDEX IF NOT EXISTS idx_listings_status    ON listings(status)",
        "CREATE INDEX IF NOT EXISTS idx_listings_category  ON listings(category)",
        "CREATE INDEX IF NOT EXISTS idx_listings_type      ON listings(listing_type)",
        "CREATE INDEX IF NOT EXISTS idx_listings_created   ON listings(created_at DESC)",
        "CREATE INDEX IF NOT EXISTS idx_listings_expires   ON listings(expires_at) WHERE status='active'",
        # Compound index for the common active-listings browse query
        "CREATE INDEX IF NOT EXISTS idx_listings_active_cat ON listings(status, category, created_at DESC)",
        # Expiry job: finds active, unwarned, expiring-soon listings
        "CREATE INDEX IF NOT EXISTS idx_listings_expiry_job ON listings(status, expiry_warned, expires_at)",

        # Deals
        "CREATE INDEX IF NOT EXISTS idx_deals_buyer    ON deals(buyer_id)",
        "CREATE INDEX IF NOT EXISTS idx_deals_seller   ON deals(seller_id)",
        "CREATE INDEX IF NOT EXISTS idx_deals_listing  ON deals(listing_id)",
        "CREATE INDEX IF NOT EXISTS idx_deals_status   ON deals(status)",

        # Direct messages — inbox/thread queries
        "CREATE INDEX IF NOT EXISTS idx_dm_recipient ON direct_messages(recipient_id, read)",
        "CREATE INDEX IF NOT EXISTS idx_dm_sender    ON direct_messages(sender_id)",
        "CREATE INDEX IF NOT EXISTS idx_dm_thread    ON direct_messages(sender_id, recipient_id, created_at)",

        # Notifications
        "CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read, created_at DESC)",

        # Ratings
        "CREATE INDEX IF NOT EXISTS idx_ratings_seller   ON ratings(seller_id)",
        "CREATE INDEX IF NOT EXISTS idx_ratings_reviewer ON ratings(reviewer_id)",

        # Reports
        "CREATE INDEX IF NOT EXISTS idx_reports_listing ON reports(listing_id)",
        "CREATE INDEX IF NOT EXISTS idx_reports_status  ON reports(status)",

        # Price history
        "CREATE INDEX IF NOT EXISTS idx_price_hist_listing ON price_history(listing_id, recorded_at)",

        # Favorites
        "CREATE INDEX IF NOT EXISTS idx_favorites_user    ON favorites(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_favorites_listing ON favorites(listing_id)",

        # Org members
        "CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_org_members_org  ON org_members(org_id)",

        # Mod log
        "CREATE INDEX IF NOT EXISTS idx_mod_log_target ON mod_log(target_type, target_id)",

        # Users — search
        "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username COLLATE NOCASE)",
    ]
    for sql in indexes:
        conn.execute(sql)


def _safe_add_column(conn, table: str, column: str, definition: str) -> bool:
    """Add a column if it doesn't already exist. Returns True if column was added."""
    existing = [row[1] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()]
    if column not in existing:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
        return True
    return False
