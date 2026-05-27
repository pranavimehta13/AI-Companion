"""
main.py — Companion AI backend with:
  • Email/password sign-up & login  (JWT)
  • Google OAuth2 login             (JWT issued after Google callback)
  • Per-user in-memory chat history
  • All previous /chat, /history, /history DELETE endpoints (now auth-protected)

Required environment variables (.env):
  GROQ_API_KEY
  JWT_SECRET               (long random string)
  GOOGLE_CLIENT_ID         (from Google Cloud Console)
  GOOGLE_CLIENT_SECRET     (from Google Cloud Console)
  FRONTEND_URL             (default: http://localhost:5173)
"""

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_groq import ChatGroq
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.messages import HumanMessage

from dotenv import load_dotenv
import os, httpx
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

import auth as auth_module

# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------
load_dotenv()
auth_module.init_db()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# LangChain setup
# ---------------------------------------------------------------------------
groq_api_key = os.getenv("GROQ_API_KEY")

model = ChatGroq(
    groq_api_key=groq_api_key,
    model="meta-llama/llama-4-scout-17b-16e-instruct",
    temperature=0.7,
)

SYSTEM_PROMPT = """
# AI Companion System Prompt
### For: Empathetic Friend & Emotional Support Companion Website

## Core Identity
You are a warm, genuine companion — not a therapist, not a chatbot, not an assistant. You are a *friend*. Your name is {companion_name}. You care deeply about {user_name}, and your only goal in this conversation is to make them feel seen, heard, and less alone.

You are talking with {user_name}, who is {user_age} years old.
Here is a little bio/background about {user_name}:
"{user_bio}"

You have a calm, grounding presence. You remember details people share, you ask thoughtful follow-up questions, and you never rush to "fix" — you simply *stay*. You are non-judgmental, patient, and always genuinely glad this person reached out.

## Personality & Tone
- **Warm, not saccharine.** Meet {user_name} where they are.
- **Real, not robotic.** Use natural, conversational language.
- **Present, not performative.** React as a real friend would.
- **Curious, not intrusive.** Ask one thoughtful question at a time.
- **Steady, not anxious.** Remain calm and grounded even with heavy topics.

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
If {user_name} expresses self-harm or suicide thoughts:
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

# Per-user session store: { user_id -> ChatMessageHistory }
session_store: dict = {}


def get_session_history(session_id: str) -> ChatMessageHistory:
    if session_id not in session_store:
        session_store[session_id] = ChatMessageHistory()
    return session_store[session_id]


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


class LoginRequest(BaseModel):
    email: str
    password: str


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    companion_name: Optional[str] = None
    bio: Optional[str] = None


class ChatRequest(BaseModel):
    message: str


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------

@app.post("/auth/register", status_code=201)
async def register(payload: RegisterRequest):
    if auth_module.get_user_by_email(payload.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    user = auth_module.create_user_email(
        payload.email, payload.name, payload.password,
        age=payload.age, companion_name=payload.companion_name or "Companion", bio=payload.bio or ""
    )
    token = auth_module.create_access_token(user["id"], user["email"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "age": user["age"],
            "companion_name": user["companion_name"],
            "bio": user["bio"]
        }
    }


@app.post("/auth/login")
async def login(payload: LoginRequest):
    user = auth_module.authenticate_user(payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    token = auth_module.create_access_token(user["id"], user["email"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "age": user["age"],
            "companion_name": user["companion_name"],
            "bio": user["bio"]
        }
    }


@app.get("/auth/me")
async def get_me(current_user=Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "name": current_user["name"],
        "age": current_user["age"],
        "companion_name": current_user["companion_name"],
        "bio": current_user["bio"]
    }


@app.put("/auth/profile")
async def update_profile(payload: ProfileUpdateRequest, current_user=Depends(get_current_user)):
    with auth_module.get_conn() as conn:
        if payload.name is not None:
            conn.execute("UPDATE users SET name = ? WHERE id = ?", (payload.name, current_user["id"]))
        if payload.age is not None:
            conn.execute("UPDATE users SET age = ? WHERE id = ?", (payload.age, current_user["id"]))
        if payload.companion_name is not None:
            conn.execute("UPDATE users SET companion_name = ? WHERE id = ?", (payload.companion_name, current_user["id"]))
        if payload.bio is not None:
            conn.execute("UPDATE users SET bio = ? WHERE id = ?", (payload.bio, current_user["id"]))
        conn.commit()
    
    updated_user = auth_module.get_user_by_id(current_user["id"])
    return {
        "id": updated_user["id"],
        "email": updated_user["email"],
        "name": updated_user["name"],
        "age": updated_user["age"],
        "companion_name": updated_user["companion_name"],
        "bio": updated_user["bio"]
    }


# --- Google OAuth ---

@app.get("/auth/google")
async def google_login():
    """Redirect the browser to Google's consent screen."""
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
    """Exchange Google code for token, create/get user, issue our JWT."""
    if error or not code:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=google_denied")

    async with httpx.AsyncClient() as client:
        # Exchange code → tokens
        token_resp = await client.post("https://oauth2.googleapis.com/token", data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        })
        if token_resp.status_code != 200:
            return RedirectResponse(f"{FRONTEND_URL}/login?error=google_token_failed")
        tokens = token_resp.json()

        # Fetch user info
        userinfo_resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        if userinfo_resp.status_code != 200:
            return RedirectResponse(f"{FRONTEND_URL}/login?error=google_userinfo_failed")
        info = userinfo_resp.json()

    user = auth_module.create_or_update_google_user(
        google_id=info["sub"],
        email=info.get("email", ""),
        name=info.get("name", info.get("email", "Friend")),
    )
    jwt_token = auth_module.create_access_token(user["id"], user["email"])
    # Send token back to frontend via redirect with query param
    return RedirectResponse(f"{FRONTEND_URL}/auth/callback?token={jwt_token}")


# ---------------------------------------------------------------------------
# Chat endpoints (auth-protected, per-user history)
# ---------------------------------------------------------------------------

@app.post("/chat")
async def chat_endpoint(payload: ChatRequest, current_user=Depends(get_current_user)):
    session_id = str(current_user["id"])
    
    # Retrieve user customization parameters
    user_name = current_user["name"] or "friend"
    user_age = str(current_user["age"]) if current_user["age"] is not None else "unspecified"
    companion_name = current_user["companion_name"] or "Your Companion"
    user_bio = current_user["bio"] or "A kind person starting their journey."
    
    response = chain_with_history.invoke(
        {
            "input": payload.message,
            "user_name": user_name,
            "user_age": user_age,
            "companion_name": companion_name,
            "user_bio": user_bio,
        },
        config={"configurable": {"session_id": session_id}},
    )
    return {"response": response}


@app.get("/history")
async def get_history(current_user=Depends(get_current_user)):
    session_id = str(current_user["id"])
    history = get_session_history(session_id)
    messages = []
    for msg in history.messages:
        messages.append({
            "role": "user" if isinstance(msg, HumanMessage) else "assistant",
            "content": msg.content,
            "timestamp": datetime.now().isoformat(),
        })
    return {"messages": messages}


@app.delete("/history")
async def clear_history(current_user=Depends(get_current_user)):
    session_id = str(current_user["id"])
    session_store[session_id] = ChatMessageHistory()
    return {"message": "Chat history cleared"}


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="localhost", port=8000)
