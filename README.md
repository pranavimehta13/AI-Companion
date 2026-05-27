# 🌸 Your Companion — AI Companion

An empathetic AI companion web app that makes people feel heard, seen, and less alone. Built with a warm conversational UI, Llama 4 under the hood, and full user authentication.

---

## ✨ Features

- 💬 **Empathetic AI chat** — powered by Groq's Llama 4 (llama-4-scout-17b), designed to listen first and respond like a genuine friend
- 🔐 **Email & password auth** — sign up, log in, JWT-protected sessions
- 🔑 **Google OAuth** — one-click sign in with Google
- 🧠 **Per-user chat history** — each user has their own isolated conversation memory
- 🗑 **Clear & reload history** — full control over your chat session
- 📱 **Responsive UI** — soft pastel design that feels calm and welcoming
- 🚨 **Crisis support** — built-in crisis resource prompts when needed

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), DM Sans + DM Serif Display |
| Backend | FastAPI, Python |
| AI | LangChain + Groq API (Llama 4 Scout) |
| Auth | JWT (python-jose), bcrypt (passlib), Google OAuth2 |
| Database | SQLite (via Python sqlite3) |
| HTTP | httpx, python-multipart |

---

## 📁 Project Structure

```
AI-Companion/
├── backend/
│   ├── main.py          # FastAPI app — all routes
│   ├── auth.py          # Auth helpers — JWT, bcrypt, SQLite user store
│   ├── companion.db     # SQLite database (auto-created, gitignored)
│   ├── .env             # Environment variables (gitignored)
│   └── requirements.txt
└── frontend/
    └── src/
        └── App.jsx      # Full React app — auth pages + chat UI
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- A [Groq API key](https://console.groq.com)
- A [Google Cloud OAuth 2.0 client](https://console.cloud.google.com) (optional, for Google login)

---

### Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

# Install dependencies
pip install fastapi uvicorn langchain-core langchain-groq langchain-community \
            passlib[bcrypt] python-jose[cryptography] httpx python-multipart \
            python-dotenv

# Create your .env file
cp .env.example .env
# Fill in your keys (see below)

# Run the server
python main.py
```

Backend runs at `http://localhost:8000`

---

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`

---

### Environment Variables

Create a `.env` file in the `backend/` folder:

```env
GROQ_API_KEY=your_groq_api_key_here
JWT_SECRET=some_long_random_string_here
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
FRONTEND_URL=http://localhost:5173
```

---

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → APIs & Services → Credentials
3. Create an **OAuth 2.0 Client ID** (Web application)
4. Add `http://localhost:8000/auth/google/callback` as an authorized redirect URI
5. Copy the Client ID and Secret into your `.env`

---

## 🔌 API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | ❌ | Create account with email + password |
| POST | `/auth/login` | ❌ | Login, returns JWT |
| GET | `/auth/me` | ✅ | Get current user info |
| GET | `/auth/google` | ❌ | Redirect to Google consent screen |
| GET | `/auth/google/callback` | ❌ | Google OAuth callback |
| POST | `/chat` | ✅ | Send a message, get AI response |
| GET | `/history` | ✅ | Get current user's chat history |
| DELETE | `/history` | ✅ | Clear current user's chat history |

---

## 🔒 Security Notes

- Passwords are hashed with **bcrypt** — never stored in plain text
- JWTs expire after **7 days** by default (configurable via `ACCESS_TOKEN_EXPIRE_MINUTES`)
- `.env` and `companion.db` are gitignored — never commit them
- Rotate your API keys immediately if they are ever accidentally exposed

---

## 🌱 Roadmap

- [ ] Persistent chat history in database (survive server restarts)
- [ ] Streaming responses
- [ ] Mobile app (React Native)
- [ ] Voice input support
- [ ] Multiple companion personas

---

## ⚠️ Disclaimer

Your Companion is a friendly AI companion, not a licensed therapist or mental health professional. If you or someone you know is in crisis, please reach out to a professional.

- **iCall (India):** 9152987821
- **Vandrevala Foundation (India, 24/7):** 1860-2662-345
- **International crisis centres:** https://www.iasp.info/resources/Crisis_Centres/

---

## 👩‍💻 Author

**Pranavi Mehta** — [@pranavimehta13](https://github.com/pranavimehta13)

---

*Built with 🌸 and a lot of care.*