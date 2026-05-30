"""
auth.py — JWT + Google OAuth authentication helpers for the companion app.

Tables created automatically in companion.db:
  users  (id, email, name, hashed_password, google_id, created_at)
"""

import os
import sqlite3
from datetime import datetime, timedelta
from typing import Optional

from passlib.context import CryptContext
from jose import JWTError, jwt

# ---------------------------------------------------------------------------
# Config — override via environment variables
# ---------------------------------------------------------------------------
SECRET_KEY = os.getenv("JWT_SECRET", "CHANGE_ME_PLEASE_USE_A_LONG_RANDOM_STRING")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))  # 7 days

DB_PATH = os.getenv("DB_PATH", "companion.db")

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create tables if they don't exist yet."""
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                email           TEXT    UNIQUE NOT NULL,
                name            TEXT    NOT NULL DEFAULT '',
                hashed_password TEXT,
                google_id       TEXT    UNIQUE,
                age             INTEGER,
                companion_name  TEXT    DEFAULT 'Companion',
                bio             TEXT    DEFAULT '',
                personality     TEXT    DEFAULT 'warm_friendly',
                created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
            )
        """)
        # Persistent chat message history — survives server restarts
        conn.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL,
                role       TEXT    NOT NULL,
                content    TEXT    NOT NULL,
                created_at TEXT    NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        # Run migrations to add columns if they don't exist in an existing DB
        for col, col_type in [("age", "INTEGER"), ("companion_name", "TEXT DEFAULT 'Companion'"), ("bio", "TEXT DEFAULT ''"), ("personality", "TEXT DEFAULT 'warm_friendly'")]:
            try:
                conn.execute(f"ALTER TABLE users ADD COLUMN {col} {col_type}")
            except sqlite3.OperationalError:
                pass  # Column already exists
        conn.commit()


# ---------------------------------------------------------------------------
# User CRUD
# ---------------------------------------------------------------------------

def get_user_by_email(email: str) -> Optional[sqlite3.Row]:
    with get_conn() as conn:
        return conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()


def get_user_by_id(user_id: int) -> Optional[sqlite3.Row]:
    with get_conn() as conn:
        return conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


def get_user_by_google_id(google_id: str) -> Optional[sqlite3.Row]:
    with get_conn() as conn:
        return conn.execute("SELECT * FROM users WHERE google_id = ?", (google_id,)).fetchone()


def create_user_email(email: str, name: str, password: str, age: Optional[int] = None, companion_name: str = "Companion", bio: str = "", personality: str = "warm_friendly") -> sqlite3.Row:
    hashed = pwd_ctx.hash(password)
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO users (email, name, hashed_password, age, companion_name, bio, personality) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (email, name, hashed, age, companion_name, bio, personality),
        )
        conn.commit()
    return get_user_by_email(email)


def create_or_update_google_user(google_id: str, email: str, name: str) -> sqlite3.Row:
    """Upsert a Google-authenticated user."""
    existing = get_user_by_google_id(google_id)
    if existing:
        # Update name/email in case they changed in Google profile
        with get_conn() as conn:
            conn.execute(
                "UPDATE users SET name = ?, email = ? WHERE google_id = ?",
                (name, email, google_id),
            )
            conn.commit()
        return get_user_by_google_id(google_id)

    # New Google user — might already have an email row from password sign-up
    existing_email = get_user_by_email(email)
    if existing_email:
        with get_conn() as conn:
            conn.execute(
                "UPDATE users SET google_id = ?, name = ? WHERE email = ?",
                (google_id, name, email),
            )
            conn.commit()
        return get_user_by_email(email)

    with get_conn() as conn:
        conn.execute(
            "INSERT INTO users (email, name, google_id) VALUES (?, ?, ?)",
            (email, name, google_id),
        )
        conn.commit()
    return get_user_by_email(email)


# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)


def authenticate_user(email: str, password: str) -> Optional[sqlite3.Row]:
    user = get_user_by_email(email)
    if not user or not user["hashed_password"]:
        return None
    if not verify_password(password, user["hashed_password"]):
        return None
    return user


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def create_access_token(user_id: int, email: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "email": email, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
