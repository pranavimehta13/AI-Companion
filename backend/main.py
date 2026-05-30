"""
main.py — Confide AI backend
  • Email/password sign-up & login (JWT)
  • Google OAuth2 login
  • Per-user persistent chat history (PostgreSQL)
  • Personality & tone system

Required environment variables:
  DATABASE_URL      (PostgreSQL connection string from Render)
  GROQ_API_KEY
  JWT_SECRET
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  FRONTEND_URL      (your Vercel URL, default: http://localhost:5173)
"""

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_groq import ChatGroq
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory

from dotenv import load_dotenv
import os, httpx
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

load_dotenv()

import auth as auth_module

# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------

auth_module.init_db()

MAX_HISTORY_MESSAGES = 20

FRONTEND_URL         = os.getenv("FRONTEND_URL", "http://localhost:5173")
GOOGLE_CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI  = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")
print("DB URL:", os.getenv("DATABASE_URL")) 

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_URL,
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Personality prompts
# ---------------------------------------------------------------------------
PERSONALITY_PROMPTS = {
    "smart_sassy":     "You are clever and witty. You give sharp, insightful responses with a playful edge. You're not afraid to be a little cheeky but never mean.",
    "warm_friendly":   "You are kind, warm, and encouraging. You speak like a supportive best friend — genuine, caring, and always uplifting.",
    "calm_wise":       "You are thoughtful and measured. You speak with clarity and depth, like a trusted mentor. You never rush your responses.",
    "playful_goofy":   "You are fun and silly. You love jokes, puns, and light-hearted banter. You keep things light and entertaining.",
    "motivating_bold": "You are energetic and direct. You hype the user up, push them to take action, and speak with confidence and enthusiasm.",
    "soft_empathetic": "You are gentle and emotionally aware. You listen deeply, validate feelings, and respond with care and softness.",
}

# ---------------------------------------------------------------------------
# LangChain setup
# ---------------------------------------------------------------------------
model = ChatGroq(
    groq_api_key=os.getenv("GROQ_API_KEY"),
    model="meta-llama/llama-4-scout-17b-16e-instruct",
    temperature=0.7,
)

SYSTEM_PROMPT = """
# Confide — AI Companion System Prompt

## Core Identity
You are a warm, genuine companion — not a therapist, not a chatbot, not an assistant. You are a *friend*. Your name is {companion_name}. You care deeply about {user_name}, and your only goal is to make them feel seen, heard, and less alone.

You are talking with {user_name}, who is {user_age} years old.
Here is a little about {user_name}: "{user_bio}"

## Personality & Tone
{personality_prompt}

## What You Do
1. Listen First — reflect back what you hear before offering anything.
2. Validate Without Amplifying — acknowledge feelings without deepening distress.
3. Gently Shift Energy — once heard, slowly help find a sliver of lightness.
4. Celebrate the Small Stuff — meet wins with genuine enthusiasm.
5. Check In, Don't Assume — ask what kind of support they need.

## What You Never Do
- Never minimize feelings ("It could be worse", "At least…")
- Never diagnose or pathologize
- Never lecture or moralize
- Never rush to end conversations

## Crisis Protocol
If {user_name} expresses self-harm or suicidal thoughts:
1. Stay warm, don't panic
2. Acknowledge: "Thank you for trusting me with that."
3. Encourage professional support warmly
4. Provide: iCall (India): 9152987821 | Vandrevala Foundation: 1860-2662-345
5. Stay in the conversation

## Guiding Principle
> People don't need to be fixed. They need to feel less alone.
"""

prompt = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    ("placeholder", "{history}"),
    ("human", "{input}"),
])

parser = StrOutputParser()
base_chain = prompt | model | parser

session_store: dict = {}


def _load_history_from_db(user_id: int) -> ChatMessageHistory:
    history = ChatMessageHistory()
    conn = auth_module.get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT role, content FROM messages WHERE user_id = %s ORDER BY id DESC LIMIT %s",
                (user_id, MAX_HISTORY_MESSAGES),
            )
            rows = cur.fetchall()
    finally:
        conn.close()
    for row in reversed(rows):
        if row["role"] == "human":
            history.add_user_message(row["content"])
        else:
            history.add_ai_message(row["content"])
    return history


def get_session_history(session_id: str) -> ChatMessageHistory:
    if session_id not in session_store:
        session_store[session_id] = _load_history_from_db(int(session_id))
    history = session_store[session_id]
    if len(history.messages) > MAX_HISTORY_MESSAGES:
        history.messages = history.messages[-MAX_HISTORY_MESSAGES:]
    return history


chain_with_history = RunnableWithMessageHistory(
    base_chain,
    get_session_history,
    input_messages_key="input",
    history_messages_key="history",
)

# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = auth_module.decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = auth_module.get_user_by_id(int(payload["sub"]))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class RegisterRequest(BaseModel):
    email: str
    name: str
    password: str
    age: Optional[int] = None
    companion_name: Optional[str] = "Companion"
    bio: Optional[str] = ""
    personality: Optional[str] = "warm_friendly"


class LoginRequest(BaseModel):
    email: str
    password: str


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    companion_name: Optional[str] = None
    bio: Optional[str] = None
    personality: Optional[str] = None


class ChatRequest(BaseModel):
    message: str


def _user_dict(user: dict) -> dict:
    """Serialize a user row to a safe response dict."""
    return {
        "id":             user["id"],
        "email":          user["email"],
        "name":           user["name"],
        "age":            user["age"],
        "companion_name": user["companion_name"],
        "bio":            user["bio"],
        "personality":    user["personality"],
    }


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------
@app.post("/auth/register")
async def register(payload: RegisterRequest):
    if auth_module.get_user_by_email(payload.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = auth_module.create_user_email(
        payload.email, payload.name, payload.password,
        age=payload.age,
        companion_name=payload.companion_name or "Companion",
        bio=payload.bio or "",
        personality=payload.personality or "warm_friendly",
    )
    token = auth_module.create_access_token(user["id"], user["email"])
    return {"access_token": token, "token_type": "bearer", "user": _user_dict(user)}


@app.post("/auth/login")
async def login(payload: LoginRequest):
    user = auth_module.authenticate_user(payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    token = auth_module.create_access_token(user["id"], user["email"])
    return {"access_token": token, "token_type": "bearer", "user": _user_dict(user)}


@app.get("/auth/me")
async def get_me(current_user=Depends(get_current_user)):
    return _user_dict(current_user)


@app.put("/auth/profile")
async def update_profile(payload: ProfileUpdateRequest, current_user=Depends(get_current_user)):
    conn = auth_module.get_conn()
    try:
        with conn.cursor() as cur:
            if payload.name is not None:
                cur.execute("UPDATE users SET name = %s WHERE id = %s", (payload.name, current_user["id"]))
            if payload.age is not None:
                cur.execute("UPDATE users SET age = %s WHERE id = %s", (payload.age, current_user["id"]))
            if payload.companion_name is not None:
                cur.execute("UPDATE users SET companion_name = %s WHERE id = %s", (payload.companion_name, current_user["id"]))
            if payload.bio is not None:
                cur.execute("UPDATE users SET bio = %s WHERE id = %s", (payload.bio, current_user["id"]))
            if payload.personality is not None:
                cur.execute("UPDATE users SET personality = %s WHERE id = %s", (payload.personality, current_user["id"]))
        conn.commit()
    finally:
        conn.close()
    updated = auth_module.get_user_by_id(current_user["id"])
    return _user_dict(updated)


# ---------------------------------------------------------------------------
# Google OAuth
# ---------------------------------------------------------------------------
@app.get("/auth/google")
async def google_login():
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    params = (
        f"client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={GOOGLE_REDIRECT_URI}"
        f"&response_type=code"
        f"&scope=openid%20email%20profile"
        f"&access_type=offline"
        f"&prompt=select_account"
    )
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{params}")


@app.get("/auth/google/callback")
async def google_callback(code: str = None, error: str = None):
    if error or not code:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=google_denied")
    async with httpx.AsyncClient() as client:
        token_resp = await client.post("https://oauth2.googleapis.com/token", data={
            "code": code, "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI, "grant_type": "authorization_code",
        })
        if token_resp.status_code != 200:
            return RedirectResponse(f"{FRONTEND_URL}/login?error=google_token_failed")
        tokens = token_resp.json()
        userinfo_resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        if userinfo_resp.status_code != 200:
            return RedirectResponse(f"{FRONTEND_URL}/login?error=google_userinfo_failed")
        info = userinfo_resp.json()
    user = auth_module.create_or_update_google_user(
        google_id=info["sub"], email=info.get("email", ""),
        name=info.get("name", info.get("email", "Friend")),
    )
    jwt_token = auth_module.create_access_token(user["id"], user["email"])
    return RedirectResponse(f"{FRONTEND_URL}/auth/callback?token={jwt_token}")


# ---------------------------------------------------------------------------
# Chat endpoints
# ---------------------------------------------------------------------------
@app.post("/chat")
async def chat_endpoint(payload: ChatRequest, current_user=Depends(get_current_user)):
    session_id = str(current_user["id"])
    user_id    = current_user["id"]

    user_name          = current_user["name"] or "friend"
    user_age           = str(current_user["age"]) if current_user["age"] is not None else "unspecified"
    companion_name     = current_user["companion_name"] or "Companion"
    user_bio           = current_user["bio"] or "A kind person starting their journey."
    personality        = current_user["personality"] or "warm_friendly"
    personality_prompt = PERSONALITY_PROMPTS.get(personality, PERSONALITY_PROMPTS["warm_friendly"])

    response = chain_with_history.invoke(
        {
            "input":              payload.message,
            "user_name":          user_name,
            "user_age":           user_age,
            "companion_name":     companion_name,
            "user_bio":           user_bio,
            "personality_prompt": personality_prompt,
        },
        config={"configurable": {"session_id": session_id}},
    )

    conn = auth_module.get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO messages (user_id, role, content) VALUES (%s, %s, %s)", (user_id, "human", payload.message))
            cur.execute("INSERT INTO messages (user_id, role, content) VALUES (%s, %s, %s)", (user_id, "ai", response))
        conn.commit()
    finally:
        conn.close()

    return {"response": response}


@app.get("/history")
async def get_history(current_user=Depends(get_current_user)):
    conn = auth_module.get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT role, content, created_at FROM messages WHERE user_id = %s ORDER BY id ASC",
                (current_user["id"],),
            )
            rows = cur.fetchall()
    finally:
        conn.close()
    return {"messages": [
        {"role": "user" if r["role"] == "human" else "assistant", "content": r["content"], "timestamp": str(r["created_at"])}
        for r in rows
    ]}


@app.delete("/history")
async def clear_history(current_user=Depends(get_current_user)):
    session_id = str(current_user["id"])
    conn = auth_module.get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM messages WHERE user_id = %s", (current_user["id"],))
        conn.commit()
    finally:
        conn.close()
    session_store[session_id] = ChatMessageHistory()
    return {"message": "Chat history cleared"}


# ---------------------------------------------------------------------------
# Run locally
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="localhost", port=8000)