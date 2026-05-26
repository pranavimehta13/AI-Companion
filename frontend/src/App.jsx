import { useState, useRef, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const COMPANION_NAME = "Saniorita";
const API = "http://localhost:8000";

// ---------------------------------------------------------------------------
// Tiny auth helpers (localStorage — NOT browser storage API, just native JS)
// ---------------------------------------------------------------------------
const getToken = () => localStorage.getItem("companion_token");
const setToken = (t) => localStorage.setItem("companion_token", t);
const removeToken = () => localStorage.removeItem("companion_token");
const getUser = () => {
  try { return JSON.parse(localStorage.getItem("companion_user") || "null"); } catch { return null; }
};
const setUser = (u) => localStorage.setItem("companion_user", JSON.stringify(u));
const removeUser = () => localStorage.removeItem("companion_user");

// ---------------------------------------------------------------------------
// Google OAuth callback handler — runs when redirected back from Google
// URL pattern: /auth/callback?token=xxx
// ---------------------------------------------------------------------------
function handleOAuthCallback() {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  if (!url.pathname.endsWith("/auth/callback")) return false;
  const token = url.searchParams.get("token");
  const error = url.searchParams.get("error");
  if (token) {
    setToken(token);
    // We'll fetch /auth/me right after
  }
  // Clean URL
  window.history.replaceState({}, document.title, "/");
  return { token, error };
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');`;

const GlobalStyle = () => (
  <style>{`
    ${FONTS}
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root { height: 100%; }
    body {
      font-family: 'DM Sans', sans-serif;
      background: linear-gradient(160deg, #fff5f3 0%, #fef0f5 50%, #f0f5fe 100%);
      min-height: 100vh;
    }
    @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }
    @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }
    @keyframes slideIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-thumb { background: #e8d0cc; border-radius: 10px; }
    textarea:focus, input:focus { outline: none; }
    textarea { resize: none; }
    input:-webkit-autofill {
      -webkit-box-shadow: 0 0 0 30px #fff8f6 inset !important;
      -webkit-text-fill-color: #4a3232 !important;
    }
  `}</style>
);

// ---------------------------------------------------------------------------
// Decorative blobs (reused on all pages)
// ---------------------------------------------------------------------------
function Blobs() {
  return (
    <>
      <div style={{ position:"fixed", top:-80, right:-80, width:320, height:320, borderRadius:"50%", background:"radial-gradient(circle, rgba(247,202,201,0.35) 0%, transparent 70%)", pointerEvents:"none", zIndex:0 }} />
      <div style={{ position:"fixed", bottom:-60, left:-60, width:260, height:260, borderRadius:"50%", background:"radial-gradient(circle, rgba(201,228,222,0.3) 0%, transparent 70%)", pointerEvents:"none", zIndex:0 }} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Input component
// ---------------------------------------------------------------------------
function AuthInput({ type="text", placeholder, value, onChange, autoComplete }) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      autoComplete={autoComplete}
      style={{
        width:"100%", padding:"13px 16px", borderRadius:12,
        border:"1px solid #f0ddd8", background:"#fff8f6",
        fontSize:15, color:"#4a3232",
        fontFamily:"'DM Sans', sans-serif",
        transition:"border-color 0.2s",
      }}
      onFocus={e => e.target.style.borderColor="#e8a0a0"}
      onBlur={e => e.target.style.borderColor="#f0ddd8"}
    />
  );
}

// ---------------------------------------------------------------------------
// Google sign-in button
// ---------------------------------------------------------------------------
function GoogleButton({ label }) {
  return (
    <a
      href={`${API}/auth/google`}
      style={{
        display:"flex", alignItems:"center", justifyContent:"center", gap:10,
        padding:"12px 20px", borderRadius:12,
        border:"1px solid #e8d0d0", background:"#ffffff",
        color:"#4a3232", fontSize:14, fontWeight:500,
        fontFamily:"'DM Sans', sans-serif",
        textDecoration:"none", cursor:"pointer",
        transition:"all 0.2s", boxShadow:"0 1px 4px rgba(0,0,0,0.06)",
      }}
      onMouseOver={e => { e.currentTarget.style.background="#fff5f3"; e.currentTarget.style.borderColor="#d4a0a0"; }}
      onMouseOut={e => { e.currentTarget.style.background="#ffffff"; e.currentTarget.style.borderColor="#e8d0d0"; }}
    >
      {/* Google "G" SVG */}
      <svg width="18" height="18" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.1 0 5.6 1.1 7.6 2.8l5.7-5.7C33.5 3.5 29 1.5 24 1.5 14.9 1.5 7.1 7 3.6 14.8l6.7 5.2C12 14.1 17.5 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.5 24c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.4 5.7c4.3-4 6.8-9.9 6.8-16.4z"/>
        <path fill="#FBBC05" d="M10.3 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.1.8-4.6L3.6 14.2A23 23 0 0 0 1 24c0 3.7.9 7.2 2.5 10.3l6.8-5.7z"/>
        <path fill="#34A853" d="M24 46.5c5 0 9.2-1.6 12.3-4.4l-7.4-5.7c-1.7 1.1-3.8 1.8-6.4 1.8-5.4 0-10-3.6-11.7-8.6l-6.7 5.2C7 41.3 14.9 46.5 24 46.5z"/>
        <path fill="none" d="M0 0h48v48H0z"/>
      </svg>
      {label}
    </a>
  );
}

// ---------------------------------------------------------------------------
// Divider
// ---------------------------------------------------------------------------
function OrDivider() {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, margin:"4px 0" }}>
      <div style={{ flex:1, height:1, background:"#f0ddd8" }} />
      <span style={{ fontSize:12, color:"#c0a8a8", fontFamily:"'DM Sans', sans-serif" }}>or</span>
      <div style={{ flex:1, height:1, background:"#f0ddd8" }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Primary button
// ---------------------------------------------------------------------------
function PrimaryButton({ onClick, disabled, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width:"100%", padding:"13px 20px", borderRadius:12, border:"none",
        background: disabled ? "#f0e4e0" : "linear-gradient(135deg, #f7cac9, #e8b4b8)",
        color: disabled ? "#c0a0a0" : "#5a3a3a",
        fontSize:15, fontWeight:500, fontFamily:"'DM Sans', sans-serif",
        cursor: disabled ? "default" : "pointer",
        transition:"all 0.2s", boxShadow: disabled ? "none" : "0 2px 12px rgba(232,180,184,0.4)",
      }}
      onMouseOver={e => { if (!disabled) e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseOut={e => { e.currentTarget.style.transform = "translateY(0)"; }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Auth card wrapper
// ---------------------------------------------------------------------------
function AuthCard({ children }) {
  return (
    <div style={{
      width:"100%", maxWidth:420,
      background:"rgba(255,252,250,0.9)", backdropFilter:"blur(12px)",
      borderRadius:28, border:"1px solid rgba(240,220,215,0.7)",
      boxShadow:"0 8px 40px rgba(180,120,120,0.1)",
      padding:"36px 32px",
      animation:"slideIn 0.4s ease",
      position:"relative", zIndex:1,
    }}>
      {/* Logo */}
      <div style={{ textAlign:"center", marginBottom:28 }}>
        <div style={{ width:56, height:56, borderRadius:"50%", background:"linear-gradient(135deg, #f7cac9, #c9e4de)", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:22, fontWeight:700, color:"#8a6f6f", marginBottom:12 }}>
          {COMPANION_NAME[0]}
        </div>
        <p style={{ fontFamily:"'DM Serif Display', serif", fontSize:22, color:"#4a3232" }}>{COMPANION_NAME}</p>
        <p style={{ fontSize:13, color:"#b09090", marginTop:3 }}>Your empathetic companion</p>
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Login Page
// ---------------------------------------------------------------------------
function LoginPage({ onLogin, switchToRegister, oauthError }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(oauthError || null);

  const submit = async () => {
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Login failed");
      onLogin(data.access_token, data.user);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard>
      <p style={{ fontFamily:"'DM Serif Display', serif", fontSize:20, color:"#4a3232", marginBottom:20, textAlign:"center" }}>
        Welcome back 🌸
      </p>

      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <GoogleButton label="Continue with Google" />
        <OrDivider />
        <AuthInput type="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" />
        <AuthInput type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" />

        {error && (
          <div style={{ background:"#fef0f0", border:"1px solid #f5c5c5", borderRadius:10, padding:"10px 14px", color:"#c07070", fontSize:13 }}>
            {error}
          </div>
        )}

        <PrimaryButton onClick={submit} disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </PrimaryButton>
      </div>

      <p style={{ textAlign:"center", fontSize:13, color:"#b09090", marginTop:20 }}>
        Don't have an account?{" "}
        <button onClick={switchToRegister} style={{ background:"none", border:"none", color:"#c07070", cursor:"pointer", fontFamily:"'DM Sans', sans-serif", fontSize:13, textDecoration:"underline" }}>
          Create one
        </button>
      </p>
    </AuthCard>
  );
}

// ---------------------------------------------------------------------------
// Register Page
// ---------------------------------------------------------------------------
function RegisterPage({ onLogin, switchToLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (!name || !email || !password) { setError("Please fill in all fields."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/auth/register`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ email, name, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Registration failed");
      onLogin(data.access_token, data.user);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard>
      <p style={{ fontFamily:"'DM Serif Display', serif", fontSize:20, color:"#4a3232", marginBottom:20, textAlign:"center" }}>
        Create your space ✨
      </p>

      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <GoogleButton label="Sign up with Google" />
        <OrDivider />
        <AuthInput placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} autoComplete="name" />
        <AuthInput type="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" />
        <AuthInput type="password" placeholder="Password (min 6 chars)" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" />
        <AuthInput type="password" placeholder="Confirm password" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password" />

        {error && (
          <div style={{ background:"#fef0f0", border:"1px solid #f5c5c5", borderRadius:10, padding:"10px 14px", color:"#c07070", fontSize:13 }}>
            {error}
          </div>
        )}

        <PrimaryButton onClick={submit} disabled={loading}>
          {loading ? "Creating account…" : "Create account"}
        </PrimaryButton>
      </div>

      <p style={{ textAlign:"center", fontSize:13, color:"#b09090", marginTop:20 }}>
        Already have an account?{" "}
        <button onClick={switchToLogin} style={{ background:"none", border:"none", color:"#c07070", cursor:"pointer", fontFamily:"'DM Sans', sans-serif", fontSize:13, textDecoration:"underline" }}>
          Sign in
        </button>
      </p>
    </AuthCard>
  );
}

// ---------------------------------------------------------------------------
// Auth wrapper page
// ---------------------------------------------------------------------------
function AuthPage({ onLogin, oauthError }) {
  const [mode, setMode] = useState("login");
  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px 16px", position:"relative" }}>
      <Blobs />
      {mode === "login"
        ? <LoginPage onLogin={onLogin} switchToRegister={()=>setMode("register")} oauthError={oauthError} />
        : <RegisterPage onLogin={onLogin} switchToLogin={()=>setMode("login")} />
      }
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat components (unchanged styling, new auth wiring)
// ---------------------------------------------------------------------------
const OPENING_MESSAGE = {
  id: 0, role:"assistant",
  text: "Hey, glad you're here 🌸 What's on your mind today?",
  time: new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }),
};

function TypingIndicator() {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6, padding:"12px 16px", background:"#fdf6f0", borderRadius:"18px 18px 18px 4px", width:"fit-content", maxWidth:80 }}>
      {[0,1,2].map(i=>(
        <span key={i} style={{ width:7, height:7, borderRadius:"50%", background:"#d4a0a0", display:"inline-block", animation:"bounce 1.2s infinite", animationDelay:`${i*0.2}s` }} />
      ))}
    </div>
  );
}

function ChatMessage({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:isUser?"flex-end":"flex-start", marginBottom:18, animation:"fadeUp 0.3s ease" }}>
      {!isUser && (
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
          <div style={{ width:28, height:28, borderRadius:"50%", background:"linear-gradient(135deg, #f7cac9, #c9e4de)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:600, color:"#8a6f6f" }}>
            {COMPANION_NAME[0]}
          </div>
          <span style={{ fontSize:12, color:"#b09090", fontFamily:"'DM Sans', sans-serif" }}>{COMPANION_NAME}</span>
        </div>
      )}
      <div style={{
        maxWidth:"72%", padding:"11px 16px",
        borderRadius: isUser?"18px 18px 4px 18px":"18px 18px 18px 4px",
        background: isUser?"linear-gradient(135deg, #f7cac9 0%, #e8b4b8 100%)":"#fdf6f0",
        color: isUser?"#5a3a3a":"#4a3a3a",
        fontSize:15, lineHeight:1.6,
        fontFamily:"'DM Sans', sans-serif",
        border: isUser?"none":"1px solid #f0e0dc",
        boxShadow:"0 1px 4px rgba(180,120,120,0.07)",
        wordBreak:"break-word",
      }}>
        {msg.text}
      </div>
      <span style={{ fontSize:11, color:"#c0a8a8", marginTop:4 }}>{msg.time}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat Page
// ---------------------------------------------------------------------------
function ChatPage({ user, onLogout }) {
  const [messages, setMessages] = useState([OPENING_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const authHeaders = useCallback(() => ({
    "Content-Type":"application/json",
    "Authorization":`Bearer ${getToken()}`,
  }), []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/history`, { headers: authHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        if (data.messages?.length) {
          setMessages([OPENING_MESSAGE, ...data.messages.map((m,i)=>({
            id:i+1, role:m.role, text:m.content,
            time: new Date(m.timestamp).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }),
          }))]);
        }
      } catch {}
    })();
  }, [authHeaders]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, loading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg = { id:Date.now(), role:"user", text, time:new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) };
    setMessages(prev=>[...prev, userMsg]);
    setInput(""); setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/chat`, {
        method:"POST", headers:authHeaders(), body:JSON.stringify({ message:text }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setMessages(prev=>[...prev, { id:Date.now()+1, role:"assistant", text:data.response, time:new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) }]);
    } catch (e) { setError("Couldn't reach the server. Is your backend running?"); }
    finally { setLoading(false); inputRef.current?.focus(); }
  };

  const clearHistory = async () => {
    if (!window.confirm("Clear all chat history?")) return;
    try {
      await fetch(`${API}/history`, { method:"DELETE", headers:authHeaders() });
      setMessages([OPENING_MESSAGE]); setError(null);
    } catch { setError("Couldn't clear history. Try again?"); }
  };

  const reloadHistory = async () => {
    try {
      const res = await fetch(`${API}/history`, { headers:authHeaders() });
      const data = await res.json();
      if (data.messages?.length) {
        setMessages([OPENING_MESSAGE, ...data.messages.map((m,i)=>({ id:i+1, role:m.role, text:m.content, time:new Date(m.timestamp).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) }))]);
      } else { setMessages([OPENING_MESSAGE]); }
    } catch { setError("Couldn't reload history."); }
  };

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(160deg, #fff5f3 0%, #fef0f5 50%, #f0f5fe 100%)", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px 16px" }}>
      <Blobs />
      <div style={{ width:"100%", maxWidth:520, display:"flex", flexDirection:"column", height:"90vh", maxHeight:780, background:"rgba(255,252,250,0.85)", backdropFilter:"blur(12px)", borderRadius:28, border:"1px solid rgba(240,220,215,0.7)", boxShadow:"0 8px 40px rgba(180,120,120,0.1)", overflow:"hidden", animation:"fadeIn 0.5s ease", position:"relative", zIndex:1 }}>

        {/* Header */}
        <div style={{ padding:"16px 20px", borderBottom:"1px solid #f5e5e0", background:"rgba(255,250,248,0.9)", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ position:"relative" }}>
                <div style={{ width:44, height:44, borderRadius:"50%", background:"linear-gradient(135deg, #f7cac9, #c9e4de)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, fontWeight:700, color:"#8a6f6f" }}>
                  {COMPANION_NAME[0]}
                </div>
                <div style={{ position:"absolute", bottom:1, right:1, width:10, height:10, borderRadius:"50%", background:"#7dba9e", border:"2px solid #fffaf8" }} />
              </div>
              <div>
                <p style={{ fontFamily:"'DM Serif Display', serif", fontSize:17, color:"#4a3232" }}>{COMPANION_NAME}</p>
                <p style={{ fontSize:11, color:"#b09090" }}>
                  Chatting as <strong style={{ color:"#c07070" }}>{user?.name || user?.email}</strong>
                </p>
              </div>
            </div>

            <div style={{ display:"flex", gap:6 }}>
              {[
                { label:"↻", title:"Reload history", onClick:reloadHistory, base:"#fff8f6", hover:"#f5e5e0", border:"#f0ddd8", color:"#8a6f6f" },
                { label:"🗑", title:"Clear history", onClick:clearHistory, base:"#fef0f0", hover:"#fce5e5", border:"#f5c5c5", color:"#c07070" },
                { label:"Sign out", title:"Sign out", onClick:onLogout, base:"#f5f5ff", hover:"#ededff", border:"#d0d0f5", color:"#6060b0" },
              ].map(btn => (
                <button key={btn.label} onClick={btn.onClick} title={btn.title}
                  style={{ padding:"5px 10px", fontSize:11, border:`1px solid ${btn.border}`, borderRadius:8, background:btn.base, color:btn.color, cursor:"pointer", fontFamily:"'DM Sans', sans-serif", transition:"all 0.2s" }}
                  onMouseOver={e=>e.currentTarget.style.background=btn.hover}
                  onMouseOut={e=>e.currentTarget.style.background=btn.base}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex:1, overflowY:"auto", padding:"20px 20px 8px" }}>
          {messages.map(msg=><ChatMessage key={msg.id} msg={msg} />)}
          {loading && (
            <div style={{ marginBottom:18, animation:"fadeUp 0.3s ease" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                <div style={{ width:28, height:28, borderRadius:"50%", background:"linear-gradient(135deg, #f7cac9, #c9e4de)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:600, color:"#8a6f6f" }}>{COMPANION_NAME[0]}</div>
              </div>
              <TypingIndicator />
            </div>
          )}
          {error && <div style={{ textAlign:"center", padding:"8px 16px", background:"#fef0f0", border:"1px solid #f5c5c5", borderRadius:12, color:"#c07070", fontSize:13, marginBottom:16 }}>{error}</div>}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding:"12px 16px 16px", borderTop:"1px solid #f5e5e0", background:"rgba(255,250,248,0.9)", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"flex-end", gap:10, background:"#fff8f6", border:"1px solid #f0ddd8", borderRadius:20, padding:"8px 8px 8px 16px" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();} }}
              placeholder="Talk to me…"
              rows={1}
              style={{ flex:1, background:"transparent", border:"none", fontSize:15, color:"#4a3232", fontFamily:"'DM Sans', sans-serif", lineHeight:1.5, maxHeight:120, overflowY:"auto", paddingTop:4, paddingBottom:4 }}
              onInput={e=>{ e.target.style.height="auto"; e.target.style.height=Math.min(e.target.scrollHeight,120)+"px"; }}
            />
            <button
              onClick={sendMessage}
              disabled={loading||!input.trim()}
              style={{ width:38, height:38, borderRadius:"50%", border:"none", background:input.trim()&&!loading?"linear-gradient(135deg, #f7cac9, #e8b4b8)":"#f0e4e0", cursor:input.trim()&&!loading?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.2s" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim()&&!loading?"#8a5a5a":"#c0a0a0"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <p style={{ textAlign:"center", fontSize:11, color:"#c8b0b0", marginTop:10 }}>
            {COMPANION_NAME} is a friendly companion, not a therapist. If you're in crisis, please reach out to a professional. 🌸
          </p>
        </div>

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root App — handles routing between auth + chat
// ---------------------------------------------------------------------------
export default function App() {
  const [user, setUser] = useState(getUser);
  const [tokenChecked, setTokenChecked] = useState(false);
  const [oauthError, setOauthError] = useState(null);

  // Handle Google OAuth callback on first render
  useEffect(() => {
    const result = handleOAuthCallback();
    if (result && result.error) {
      setOauthError("Google sign-in was cancelled or failed. Please try again.");
    }
    if (result && result.token) {
      // Fetch user profile with the new token
      fetch(`${API}/auth/me`, {
        headers: { "Authorization": `Bearer ${result.token}` }
      }).then(r => r.json()).then(u => {
        setUser(u);
        setUser(u);
        setUser(prev => { setUser(u); return u; }); // trigger re-render
        setUser(u);
      }).catch(() => removeToken());
    }
  }, []);

  // Validate existing token on mount
  useEffect(() => {
    const token = getToken();
    if (!token) { setTokenChecked(true); return; }
    fetch(`${API}/auth/me`, {
      headers: { "Authorization": `Bearer ${token}` }
    }).then(r => {
      if (!r.ok) throw new Error("invalid");
      return r.json();
    }).then(u => {
      setUser(u);
      setUser(u);
    }).catch(() => {
      removeToken(); removeUser(); setUser(null);
    }).finally(() => setTokenChecked(true));
  }, []);

  const handleLogin = (token, userData) => {
    setToken(token);
    setUser(userData);
    setUser(userData);
  };

  const handleLogout = () => {
    removeToken(); removeUser(); setUser(null);
  };

  if (!tokenChecked) {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <GlobalStyle />
        <Blobs />
        <div style={{ textAlign:"center" }}>
          <div style={{ width:48, height:48, borderRadius:"50%", background:"linear-gradient(135deg, #f7cac9, #c9e4de)", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:700, color:"#8a6f6f", marginBottom:12 }}>
            {COMPANION_NAME[0]}
          </div>
          <p style={{ fontFamily:"'DM Sans', sans-serif", color:"#b09090", fontSize:14 }}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <GlobalStyle />
      {user
        ? <ChatPage user={user} onLogout={handleLogout} />
        : <AuthPage onLogin={handleLogin} oauthError={oauthError} />
      }
    </>
  );
}
