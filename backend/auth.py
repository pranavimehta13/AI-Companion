"""
auth.py — JWT + Google OAuth authentication helpers for Confide.

Uses PostgreSQL via psycopg2. Set the DATABASE_URL environment variable:
  DATABASE_URL=postgresql://user:password@host:5432/dbname

Tables created automatically on init_db():
  users    (id, email, name, hashed_password, google_id, age, companion_name, bio, personality, created_at)
  messages (id, user_id, role, content, created_at)
"""

import os
import psycopg2
import psycopg2.extras
from datetime import datetime, timedelta
from typing import Optional

from passlib.context import CryptContext
from jose import JWTError, jwt

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
SECRET_KEY = os.getenv("JWT_SECRET", "CHANGE_ME_PLEASE_USE_A_LONG_RANDOM_STRING")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))  # 7 days
DATABASE_URL = os.getenv("DATABASE_URL", "")

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ---------------------------------------------------------------------------
# Database connection
# ---------------------------------------------------------------------------

def get_conn():
    """Return a new psycopg2 connection with RealDictCursor (column access by name)."""
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    return conn


def init_db():
    """Create tables if they don't exist yet."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id              SERIAL PRIMARY KEY,
                    email           TEXT    UNIQUE NOT NULL,
                    name            TEXT    NOT NULL DEFAULT '',
                    hashed_password TEXT,
                    google_id       TEXT    UNIQUE,
                    age             INTEGER,
                    companion_name  TEXT    DEFAULT 'Companion',
                    bio             TEXT    DEFAULT '',
                    personality     TEXT    DEFAULT 'warm_friendly',
                    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id         SERIAL PRIMARY KEY,
                    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    role       TEXT    NOT NULL,
                    content    TEXT    NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            migrations = [
                ("age",            "INTEGER"),
                ("companion_name", "TEXT DEFAULT 'Companion'"),
                ("bio",            "TEXT DEFAULT ''"),
                ("personality",    "TEXT DEFAULT 'warm_friendly'"),
            ]
            for col, col_type in migrations:
                cur.execute(f"""
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.columns
                            WHERE table_name='users' AND column_name='{col}'
                        ) THEN
                            ALTER TABLE users ADD COLUMN {col} {col_type};
                        END IF;
                    END$$;
                """)
        conn.commit()
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# User CRUD
# ---------------------------------------------------------------------------

def get_user_by_email(email: str) -> Optional[dict]:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM users WHERE email = %s", (email,))
            row = cur.fetchone()
            return dict(row) if row else None
    finally:
        conn.close()


def get_user_by_id(user_id: int) -> Optional[dict]:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
            row = cur.fetchone()
            return dict(row) if row else None
    finally:
        conn.close()


def get_user_by_google_id(google_id: str) -> Optional[dict]:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM users WHERE google_id = %s", (google_id,))
            row = cur.fetchone()
            return dict(row) if row else None
    finally:
        conn.close()


def create_user_email(
    email: str,
    name: str,
    password: str,
    age: Optional[int] = None,
    companion_name: str = "Companion",
    bio: str = "",
    personality: str = "warm_friendly",
) -> dict:
    hashed = pwd_ctx.hash(password)
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (email, name, hashed_password, age, companion_name, bio, personality) VALUES (%s, %s, %s, %s, %s, %s, %s)",
                (email, name, hashed, age, companion_name, bio, personality),
            )
        conn.commit()
    finally:
        conn.close()
    return get_user_by_email(email)


def create_or_update_google_user(google_id: str, email: str, name: str) -> dict:
    existing = get_user_by_google_id(google_id)
    if existing:
        conn = get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("UPDATE users SET name = %s, email = %s WHERE google_id = %s", (name, email, google_id))
            conn.commit()
        finally:
            conn.close()
        return get_user_by_google_id(google_id)

    existing_email = get_user_by_email(email)
    if existing_email:
        conn = get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("UPDATE users SET google_id = %s, name = %s WHERE email = %s", (google_id, name, email))
            conn.commit()
        finally:
            conn.close()
        return get_user_by_email(email)

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO users (email, name, google_id) VALUES (%s, %s, %s)", (email, name, google_id))
        conn.commit()
    finally:
        conn.close()
    return get_user_by_email(email)


# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)


def authenticate_user(email: str, password: str) -> Optional[dict]:
    user = get_user_by_email(email)
    if not user or not user.get("hashed_password"):
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