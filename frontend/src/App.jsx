import { useState, useRef, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const COMPANION_NAME = "Your Companion";
// Reads from .env (VITE_API_URL=...). Falls back to localhost for local dev.
const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ---------------------------------------------------------------------------
// Tiny auth helpers (localStorage)
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
  }
  // Clean URL
  window.history.replaceState({}, document.title, "/");
  return { token, error };
}

// ---------------------------------------------------------------------------
// Shared styles & Fonts
// ---------------------------------------------------------------------------
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,700;1,300&family=Outfit:wght@300;400;500;600;700&display=swap');`;

const GlobalStyle = () => (
  <style>{`
    ${FONTS}
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root { height: 100%; }
    body {
      font-family: 'DM Sans', sans-serif;
      background: linear-gradient(160deg, #fff5f3 0%, #fef0f5 50%, #f0f5fe 100%);
      min-height: 100vh;
      color: #4a3232;
    }
    @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }
    @keyframes fadeUp { from{opacity:0;transform:translateY(15px)} to{opacity:1;transform:translateY(0)} }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }
    @keyframes slideIn { from{opacity:0;transform:translateY(25px)} to{opacity:1;transform:translateY(0)} }
    @keyframes scaleIn { from{opacity:0.95;transform:scale(0.97)} to{opacity:1;transform:scale(1)} }
    ::-webkit-scrollbar { width: 5px; }
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
      <div style={{ position:"fixed", top:-80, right:-80, width:400, height:400, borderRadius:"50%", background:"radial-gradient(circle, rgba(247,202,201,0.4) 0%, transparent 70%)", pointerEvents:"none", zIndex:0 }} />
      <div style={{ position:"fixed", bottom:-60, left:-60, width:350, height:350, borderRadius:"50%", background:"radial-gradient(circle, rgba(201,228,222,0.35) 0%, transparent 70%)", pointerEvents:"none", zIndex:0 }} />
      <div style={{ position:"fixed", top:"40%", left:"70%", width:250, height:250, borderRadius:"50%", background:"radial-gradient(circle, rgba(240,215,240,0.3) 0%, transparent 75%)", pointerEvents:"none", zIndex:0 }} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Header Navigation Bar
// ---------------------------------------------------------------------------
function Navbar({ onNavigate, currentPage, onLogout, user }) {
  return (
    <nav style={{
      display:"flex", alignItems:"center", justifyContent:"space-between",
      padding:"18px 5%", background:"rgba(255, 252, 250, 0.75)",
      backdropFilter:"blur(12px)", borderBottom:"1px solid rgba(240,220,215,0.6)",
      position:"sticky", top:0, zIndex:100, transition:"all 0.3s"
    }}>
      <div 
        onClick={() => onNavigate(user ? "chat" : "landing")}
        style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer" }}
      >
        <div style={{ width:38, height:38, borderRadius:"50%", background:"linear-gradient(135deg, #f7cac9, #c9e4de)", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:700, color:"#8a6f6f" }}>
          🌸
        </div>
        <span style={{ fontFamily:"'Outfit', sans-serif", fontSize:20, fontWeight:600, letterSpacing:"-0.5px", color:"#4a3232" }}>
          {COMPANION_NAME}
        </span>
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:15 }}>
        {user ? (
          <>
            <span style={{ fontSize:14, color:"#8a6f6f" }}>
              Hello, <strong style={{ color:"#c07070" }}>{user.name}</strong>
            </span>
            <button 
              onClick={onLogout}
              style={{
                padding:"8px 16px", borderRadius:10, border:"1px solid #f5c5c5",
                background:"#fef0f0", color:"#c07070", cursor:"pointer",
                fontFamily:"'DM Sans', sans-serif", fontSize:13, fontWeight:500,
                transition:"all 0.2s"
              }}
              onMouseOver={e=>e.currentTarget.style.background="#fce5e5"}
              onMouseOut={e=>e.currentTarget.style.background="#fef0f0"}
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            {currentPage !== "landing" && (
              <button 
                onClick={() => onNavigate("landing")}
                style={{ background:"none", border:"none", color:"#8a6f6f", fontSize:14, cursor:"pointer", fontWeight:500, fontFamily:"'DM Sans', sans-serif" }}
              >
                Home
              </button>
            )}
            <button 
              onClick={() => onNavigate("login")}
              style={{
                background:"none", border:"none", color:"#c07070", fontSize:14, cursor:"pointer", fontWeight:500,
                padding:"8px 14px", fontFamily:"'DM Sans', sans-serif"
              }}
            >
              Sign In
            </button>
            <button 
              onClick={() => onNavigate("register")}
              style={{
                padding:"8px 18px", borderRadius:10, border:"none",
                background:"linear-gradient(135deg, #f7cac9, #e8b4b8)",
                color:"#5a3a3a", cursor:"pointer", fontWeight:500,
                fontFamily:"'DM Sans', sans-serif", fontSize:14,
                boxShadow:"0 2px 10px rgba(232,180,184,0.3)",
                transition:"all 0.2s"
              }}
              onMouseOver={e => e.currentTarget.style.transform = "translateY(-1px)"}
              onMouseOut={e => e.currentTarget.style.transform = "translateY(0)"}
            >
              Start Free
            </button>
          </>
        )}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Landing Page Component
// ---------------------------------------------------------------------------
function LandingPage({ onNavigate }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", minHeight:"calc(100vh - 75px)", position:"relative", overflow:"hidden" }}>
      <Blobs />
      
      {/* Hero Section */}
      <div style={{
        textAlign:"center", padding:"80px 20px 40px", maxWidth:800, margin:"0 auto",
        zIndex:1, animation:"slideIn 0.5s ease"
      }}>
        <div style={{
          display:"inline-flex", alignItems:"center", gap:8, padding:"6px 14px",
          background:"rgba(255,255,255,0.7)", border:"1px solid rgba(240,220,215,0.8)",
          borderRadius:30, fontSize:13, color:"#b08080", fontWeight:500, marginBottom:24,
          boxShadow:"0 2px 8px rgba(0,0,0,0.03)"
        }}>
          <span>🌸</span> Empathetic. Secure. Customizable.
        </div>
        
        <h1 style={{
          fontFamily:"'Outfit', sans-serif", fontSize:54, fontWeight:700,
          color:"#4a3232", lineHeight:1.15, letterSpacing:"-1.5px", marginBottom:20
        }}>
          Meet <span style={{ background:"linear-gradient(135deg, #e89898 0%, #aa7a99 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Your Companion</span>
        </h1>
        
        <p style={{
          fontSize:19, color:"#7a6060", lineHeight:1.6, maxWidth:640, margin:"0 auto 36px",
          fontWeight:300
        }}>
          A warm, safe space where you can share your thoughts, be truly heard, and never feel alone. Your private companion adapts to your life, respects your goals, and is always here for you.
        </p>

        <div style={{ display:"flex", justifyContent:"center", gap:16, flexWrap:"wrap" }}>
          <button 
            onClick={() => onNavigate("register")}
            style={{
              padding:"15px 32px", borderRadius:14, border:"none",
              background:"linear-gradient(135deg, #f7cac9, #e8b4b8)",
              color:"#5a3a3a", fontSize:16, fontWeight:600, cursor:"pointer",
              boxShadow:"0 4px 18px rgba(232,180,184,0.5)", transition:"all 0.2s"
            }}
            onMouseOver={e=>e.currentTarget.style.transform="translateY(-2px)"}
            onMouseOut={e=>e.currentTarget.style.transform="translateY(0)"}
          >
            Create Your Companion
          </button>
          <button 
            onClick={() => onNavigate("login")}
            style={{
              padding:"15px 32px", borderRadius:14, border:"1px solid #e8d0d0",
              background:"rgba(255,255,255,0.7)",
              color:"#7a5a5a", fontSize:16, fontWeight:500, cursor:"pointer",
              transition:"all 0.2s", backdropFilter:"blur(5px)"
            }}
            onMouseOver={e=>e.currentTarget.style.background="#fff5f3"}
            onMouseOut={e=>e.currentTarget.style.background="rgba(255,255,255,0.7)"}
          >
            Welcome Back
          </button>
        </div>
      </div>

      {/* Feature cards Grid */}
      <div style={{
        display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(250px, 1fr))",
        gap:24, maxWidth:1024, margin:"40px auto 80px", padding:"0 24px", zIndex:1,
        animation:"fadeIn 0.8s ease"
      }}>
        {[
          { icon:"💬", title:"Warm Active Listening", desc:"Not an assistant trying to manage your schedule, but a genuine friend who listens, validates your feelings, and stays by your side." },
          { icon:"✨", title:"Deep Customization", desc:"You name your companion and share your background. Their personality, greeting, and memory adapt specifically to who you are." },
          { icon:"🔒", title:"100% Confidential & Secure", desc:"Your thoughts are locked. Conversation data is secure, and you hold complete control to clear your chat history at any moment." }
        ].map((feat, idx) => (
          <div key={idx} style={{
            background:"rgba(255, 252, 250, 0.85)", backdropFilter:"blur(10px)",
            borderRadius:20, border:"1px solid rgba(240,220,215,0.6)",
            padding:"28px", boxShadow:"0 4px 20px rgba(180,120,120,0.05)",
            textAlign:"left", transition:"transform 0.2s"
          }}
          onMouseOver={e=>e.currentTarget.style.transform="translateY(-4px)"}
          onMouseOut={e=>e.currentTarget.style.transform="translateY(0)"}
          >
            <div style={{ fontSize:28, marginBottom:16 }}>{feat.icon}</div>
            <h3 style={{ fontFamily:"'Outfit', sans-serif", fontSize:18, fontWeight:600, color:"#4a3232", marginBottom:8 }}>{feat.title}</h3>
            <p style={{ fontSize:14, color:"#7a6060", lineHeight:1.5 }}>{feat.desc}</p>
          </div>
        ))}
      </div>

      {/* Trust Call to Action */}
      <div style={{
        background:"rgba(255, 250, 248, 0.9)", borderTop:"1px solid rgba(240,220,215,0.6)",
        padding:"60px 20px", textAlign:"center", marginTop:"auto", zIndex:1
      }}>
        <div style={{ maxWidth:600, margin:"0 auto" }}>
          <p style={{ fontFamily:"'DM Serif Display', serif", fontSize:26, color:"#4a3232", marginBottom:12 }}>
            A friendship designed to support you.
          </p>
          <p style={{ fontSize:14, color:"#8a7070", lineHeight:1.6, marginBottom:24 }}>
            Create your space, specify your companion's details, and speak your mind without pressure. 
          </p>
          <button 
            onClick={() => onNavigate("register")}
            style={{
              padding:"12px 24px", borderRadius:10, border:"none",
              background:"#5a3a3a", color:"#ffffff", fontSize:14, fontWeight:500, cursor:"pointer",
              transition:"all 0.2s", boxShadow:"0 4px 12px rgba(90,58,58,0.2)"
            }}
            onMouseOver={e=>e.currentTarget.style.background="#472d2d"}
            onMouseOut={e=>e.currentTarget.style.background="#5a3a3a"}
          >
            Get Started in 1 Minute
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Input component
// ---------------------------------------------------------------------------
function AuthInput({ type="text", placeholder, value, onChange, autoComplete, disabled=false }) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      autoComplete={autoComplete}
      disabled={disabled}
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
        fontSize:15, fontWeight:600, fontFamily:"'DM Sans', sans-serif",
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
      width:"100%", maxWidth:450,
      background:"rgba(255,252,250,0.9)", backdropFilter:"blur(12px)",
      borderRadius:28, border:"1px solid rgba(240,220,215,0.7)",
      boxShadow:"0 8px 40px rgba(180,120,120,0.1)",
      padding:"36px 32px",
      animation:"slideIn 0.4s ease",
      position:"relative", zIndex:1,
    }}>
      <div style={{ textAlign:"center", marginBottom:24 }}>
        <div style={{ width:56, height:56, borderRadius:"50%", background:"linear-gradient(135deg, #f7cac9, #c9e4de)", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:22, fontWeight:700, color:"#8a6f6f", marginBottom:12 }}>
          🌸
        </div>
        <p style={{ fontFamily:"'Outfit', sans-serif", fontSize:22, fontWeight:600, color:"#4a3232" }}>{COMPANION_NAME}</p>
        <p style={{ fontSize:13, color:"#b09090", marginTop:3 }}>Your private customized companion</p>
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
      <p style={{ fontFamily:"'Outfit', sans-serif", fontSize:18, fontWeight:500, color:"#4a3232", marginBottom:20, textAlign:"center" }}>
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
// 2-Step Register Page
// ---------------------------------------------------------------------------
function RegisterPage({ onLogin, switchToLogin }) {
  const [step, setStep] = useState(1);
  
  // Step 1: Account fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  
  // Step 2: Personalization fields
  const [age, setAge] = useState("");
  const [companionName, setCompanionName] = useState("Companion");
  const [bio, setBio] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const goNext = () => {
    if (!name || !email || !password || !confirm) { setError("Please fill in all account fields."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setError(null);
    setStep(2);
  };

  const submit = async () => {
    if (!age || !companionName || !bio) { setError("Please fill in all companion customization fields."); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/auth/register`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ 
          email, name, password, 
          age: parseInt(age) || null, 
          companion_name: companionName, 
          bio 
        }),
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
      {step === 1 ? (
        <>
          <p style={{ fontFamily:"'Outfit', sans-serif", fontSize:18, fontWeight:500, color:"#4a3232", marginBottom:20, textAlign:"center" }}>
            Create your space ✨ <span style={{ fontSize:13, color:"#b09090", fontWeight:400 }}>(Step 1 of 2)</span>
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

            <PrimaryButton onClick={goNext}>
              Customize Your Companion ➔
            </PrimaryButton>
          </div>

          <p style={{ textAlign:"center", fontSize:13, color:"#b09090", marginTop:20 }}>
            Already have an account?{" "}
            <button onClick={switchToLogin} style={{ background:"none", border:"none", color:"#c07070", cursor:"pointer", fontFamily:"'DM Sans', sans-serif", fontSize:13, textDecoration:"underline" }}>
              Sign in
            </button>
          </p>
        </>
      ) : (
        <>
          <p style={{ fontFamily:"'Outfit', sans-serif", fontSize:18, fontWeight:500, color:"#4a3232", marginBottom:8, textAlign:"center" }}>
            Design Your Companion 🌸 <span style={{ fontSize:13, color:"#b09090", fontWeight:400 }}>(Step 2 of 2)</span>
          </p>
          <p style={{ fontSize:12, color:"#a08888", textAlign:"center", marginBottom:20 }}>
            Help us understand who you are and customize your new companion's identity.
          </p>

          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div>
              <label style={{ fontSize:12, color:"#8a6f6f", fontWeight:600, display:"block", marginBottom:5 }}>YOUR AGE</label>
              <AuthInput type="number" placeholder="How old are you?" value={age} onChange={e=>setAge(e.target.value)} />
            </div>

            <div>
              <label style={{ fontSize:12, color:"#8a6f6f", fontWeight:600, display:"block", marginBottom:5 }}>COMPANION'S NAME</label>
              <AuthInput placeholder="What name should they have?" value={companionName} onChange={e=>setCompanionName(e.target.value)} />
              <span style={{ fontSize:11, color:"#b0a0a0", marginTop:3, display:"block" }}>Give them any name, like Luna, Leo, or Chloe.</span>
            </div>

            <div>
              <label style={{ fontSize:12, color:"#8a6f6f", fontWeight:600, display:"block", marginBottom:5 }}>A LITTLE ABOUT YOU (BIO)</label>
              <textarea
                placeholder="What should they know about you? E.g., your hobbies, what you do, or what makes you unique."
                value={bio}
                onChange={e=>setBio(e.target.value)}
                style={{
                  width:"100%", padding:"12px 14px", borderRadius:12, height:80,
                  border:"1px solid #f0ddd8", background:"#fff8f6",
                  fontSize:14, color:"#4a3232", fontFamily:"'DM Sans', sans-serif"
                }}
              />
            </div>

            {error && (
              <div style={{ background:"#fef0f0", border:"1px solid #f5c5c5", borderRadius:10, padding:"10px 14px", color:"#c07070", fontSize:13 }}>
                {error}
              </div>
            )}

            <div style={{ display:"flex", gap:10, marginTop:5 }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  flex:1, padding:"13px 15px", borderRadius:12, border:"1px solid #f0ddd8",
                  background:"#ffffff", color:"#8a6f6f", cursor:"pointer",
                  fontSize:14, fontWeight:500, fontFamily:"'DM Sans', sans-serif"
                }}
              >
                Back
              </button>
              <button
                onClick={submit}
                disabled={loading}
                style={{
                  flex:2, padding:"13px 20px", borderRadius:12, border:"none",
                  background: loading ? "#f0e4e0" : "linear-gradient(135deg, #f7cac9, #e8b4b8)",
                  color: loading ? "#c0a0a0" : "#5a3a3a",
                  fontSize:14, fontWeight:600, fontFamily:"'DM Sans', sans-serif",
                  cursor: loading ? "default" : "pointer"
                }}
              >
                {loading ? "Creating..." : "Create & Begin"}
              </button>
            </div>
          </div>
        </>
      )}
    </AuthCard>
  );
}

// ---------------------------------------------------------------------------
// Google login onboarding page
// ---------------------------------------------------------------------------
function OnboardingPage({ user, onOnboardingComplete }) {
  const [age, setAge] = useState("");
  const [companionName, setCompanionName] = useState("Companion");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (!age || !companionName || !bio) { setError("Please fill in all onboarding fields."); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/auth/profile`, {
        method:"PUT",
        headers:{
          "Content-Type":"application/json",
          "Authorization":`Bearer ${getToken()}`
        },
        body: JSON.stringify({ 
          age: parseInt(age) || null, 
          companion_name: companionName, 
          bio 
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Onboarding failed");
      onOnboardingComplete(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:"calc(100vh - 75px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px 16px" }}>
      <Blobs />
      <div style={{
        width:"100%", maxWidth:480,
        background:"rgba(255,252,250,0.95)", backdropFilter:"blur(12px)",
        borderRadius:28, border:"1px solid rgba(240,220,215,0.7)",
        boxShadow:"0 8px 40px rgba(180,120,120,0.1)",
        padding:"36px 32px", animation:"slideIn 0.4s ease", zIndex:1
      }}>
        <p style={{ fontFamily:"'Outfit', sans-serif", fontSize:22, fontWeight:600, color:"#4a3232", textAlign:"center", marginBottom:10 }}>
          Customize Your Companion 🌸
        </p>
        <p style={{ fontSize:13, color:"#8a6f6f", lineHeight:1.5, textAlign:"center", marginBottom:24 }}>
          Welcome, <strong style={{ color:"#c07070" }}>{user.name}</strong>! Let's fill out your preferences to make your AI companion experience fully customized.
        </p>

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div>
            <label style={{ fontSize:12, color:"#8a6f6f", fontWeight:600, display:"block", marginBottom:5 }}>YOUR AGE</label>
            <AuthInput type="number" placeholder="How old are you?" value={age} onChange={e=>setAge(e.target.value)} />
          </div>

          <div>
            <label style={{ fontSize:12, color:"#8a6f6f", fontWeight:600, display:"block", marginBottom:5 }}>COMPANION'S NAME</label>
            <AuthInput placeholder="What name should they have?" value={companionName} onChange={e=>setCompanionName(e.target.value)} />
            <span style={{ fontSize:11, color:"#b0a0a0", marginTop:3, display:"block" }}>Give them any name you'd like them to respond to.</span>
          </div>

          <div>
            <label style={{ fontSize:12, color:"#8a6f6f", fontWeight:600, display:"block", marginBottom:5 }}>A LITTLE ABOUT YOU (BIO)</label>
            <textarea
              placeholder="Tell your companion what you enjoy, your interests, or what's currently going on in your life so they can customize their responses."
              value={bio}
              onChange={e=>setBio(e.target.value)}
              style={{
                width:"100%", padding:"12px 14px", borderRadius:12, height:80,
                border:"1px solid #f0ddd8", background:"#fff8f6",
                fontSize:14, color:"#4a3232", fontFamily:"'DM Sans', sans-serif"
              }}
            />
          </div>

          {error && (
            <div style={{ background:"#fef0f0", border:"1px solid #f5c5c5", borderRadius:10, padding:"10px 14px", color:"#c07070", fontSize:13 }}>
              {error}
            </div>
          )}

          <PrimaryButton onClick={submit} disabled={loading}>
            {loading ? "Saving and building..." : "Build My Companion ➔"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Customizable Profile & Companion Settings Modal
// ---------------------------------------------------------------------------
function SettingsModal({ user, onClose, onSave }) {
  const [name, setName] = useState(user.name || "");
  const [age, setAge] = useState(user.age || "");
  const [companionName, setCompanionName] = useState(user.companion_name || "Companion");
  const [bio, setBio] = useState(user.bio || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    if (!name || !age || !companionName || !bio) { setError("All settings fields are required."); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/auth/profile`, {
        method:"PUT",
        headers:{
          "Content-Type":"application/json",
          "Authorization":`Bearer ${getToken()}`
        },
        body: JSON.stringify({ 
          name, 
          age: parseInt(age) || null, 
          companion_name: companionName, 
          bio 
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Update failed");
      onSave(data);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position:"fixed", top:0, left:0, right:0, bottom:0,
      background:"rgba(74, 50, 50, 0.45)", backdropFilter:"blur(5px)",
      display:"flex", alignItems:"center", justifyContent:"center",
      zIndex:200, animation:"fadeIn 0.2s ease"
    }}>
      <div style={{
        width:"100%", maxWidth:450, background:"#fffaf8", borderRadius:24,
        padding:"30px", border:"1px solid rgba(240,220,215,0.8)",
        boxShadow:"0 10px 40px rgba(0,0,0,0.15)", animation:"scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)"
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <h3 style={{ fontFamily:"'Outfit', sans-serif", fontSize:20, color:"#4a3232", fontWeight:600 }}>
            Companion Settings ⚙️
          </h3>
          <button 
            onClick={onClose} 
            style={{ border:"none", background:"none", fontSize:20, cursor:"pointer", color:"#b09090" }}
          >
            ×
          </button>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div>
            <label style={{ fontSize:12, color:"#8a6f6f", fontWeight:600, display:"block", marginBottom:5 }}>YOUR NICKNAME</label>
            <AuthInput placeholder="What should I call you?" value={name} onChange={e=>setName(e.target.value)} />
          </div>

          <div>
            <label style={{ fontSize:12, color:"#8a6f6f", fontWeight:600, display:"block", marginBottom:5 }}>YOUR AGE</label>
            <AuthInput type="number" placeholder="How old are you?" value={age} onChange={e=>setAge(e.target.value)} />
          </div>

          <div>
            <label style={{ fontSize:12, color:"#8a6f6f", fontWeight:600, display:"block", marginBottom:5 }}>COMPANION'S NAME</label>
            <AuthInput placeholder="Name your companion" value={companionName} onChange={e=>setCompanionName(e.target.value)} />
          </div>

          <div>
            <label style={{ fontSize:12, color:"#8a6f6f", fontWeight:600, display:"block", marginBottom:5 }}>ABOUT YOU (BIO)</label>
            <textarea
              placeholder="Details your companion should remember about you..."
              value={bio}
              onChange={e=>setBio(e.target.value)}
              style={{
                width:"100%", padding:"12px 14px", borderRadius:12, height:75,
                border:"1px solid #f0ddd8", background:"#fff8f6",
                fontSize:14, color:"#4a3232", fontFamily:"'DM Sans', sans-serif"
              }}
            />
          </div>

          {error && (
            <div style={{ background:"#fef0f0", border:"1px solid #f5c5c5", borderRadius:10, padding:"10px 14px", color:"#c07070", fontSize:13 }}>
              {error}
            </div>
          )}

          <div style={{ display:"flex", gap:10, marginTop:10 }}>
            <button
              onClick={onClose}
              style={{
                flex:1, padding:"12px", borderRadius:12, border:"1px solid #f0ddd8",
                background:"#ffffff", color:"#8a6f6f", cursor:"pointer",
                fontSize:14, fontWeight:500, fontFamily:"'DM Sans', sans-serif"
              }}
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={loading}
              style={{
                flex:2, padding:"12px", borderRadius:12, border:"none",
                background: loading ? "#f0e4e0" : "linear-gradient(135deg, #f7cac9, #e8b4b8)",
                color: loading ? "#c0a0a0" : "#5a3a3a",
                fontSize:14, fontWeight:600, fontFamily:"'DM Sans', sans-serif",
                cursor: loading ? "default" : "pointer"
              }}
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Auth wrapper page
// ---------------------------------------------------------------------------
function AuthPage({ onLogin, oauthError, initialMode="login" }) {
  const [mode, setMode] = useState(initialMode);
  return (
    <div style={{ minHeight:"calc(100vh - 75px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px 16px", position:"relative" }}>
      <Blobs />
      {mode === "login"
        ? <LoginPage onLogin={onLogin} switchToRegister={()=>setMode("register")} oauthError={oauthError} />
        : <RegisterPage onLogin={onLogin} switchToLogin={()=>setMode("login")} />
      }
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat components
// ---------------------------------------------------------------------------
function TypingIndicator() {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6, padding:"12px 16px", background:"#fdf6f0", borderRadius:"18px 18px 18px 4px", width:"fit-content", maxWidth:80 }}>
      {[0,1,2].map(i=>(
        <span key={i} style={{ width:7, height:7, borderRadius:"50%", background:"#d4a0a0", display:"inline-block", animation:"bounce 1.2s infinite", animationDelay:`${i*0.2}s` }} />
      ))}
    </div>
  );
}

function ChatMessage({ msg, companionName }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:isUser?"flex-end":"flex-start", marginBottom:18, animation:"fadeUp 0.3s ease" }}>
      {!isUser && (
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
          <div style={{ width:28, height:28, borderRadius:"50%", background:"linear-gradient(135deg, #f7cac9, #c9e4de)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:600, color:"#8a6f6f" }}>
            🌸
          </div>
          <span style={{ fontSize:12, color:"#b09090", fontFamily:"'DM Sans', sans-serif" }}>{companionName}</span>
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
function ChatPage({ user, onLogout, onUpdateUser }) {
  const compName = user.companion_name || "Companion";
  const userNick = user.name || "friend";

  // Compute opening message based on user profile
  const openingMessage = {
    id: 0, role:"assistant",
    text: `Hey ${userNick} 🌸 I'm ${compName}. I'm so glad you're here! What's on your mind today?`,
    time: new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }),
  };

  const [messages, setMessages] = useState([openingMessage]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const authHeaders = useCallback(() => ({
    "Content-Type":"application/json",
    "Authorization":`Bearer ${getToken()}`,
  }), []);

  // Update opening message text if user updates profile
  useEffect(() => {
    setMessages(prev => {
      if (prev.length > 0 && prev[0].id === 0) {
        const updated = [...prev];
        updated[0] = {
          ...updated[0],
          text: `Hey ${userNick} 🌸 I'm ${compName}. I'm so glad you're here! What's on your mind today?`
        };
        return updated;
      }
      return prev;
    });
  }, [compName, userNick]);

  // Load History
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/history`, { headers: authHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        if (data.messages?.length) {
          setMessages([openingMessage, ...data.messages.map((m,i)=>({
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
      setMessages([openingMessage]); setError(null);
    } catch { setError("Couldn't clear history. Try again?"); }
  };

  const reloadHistory = async () => {
    try {
      const res = await fetch(`${API}/history`, { headers:authHeaders() });
      const data = await res.json();
      if (data.messages?.length) {
        setMessages([openingMessage, ...data.messages.map((m,i)=>({ id:i+1, role:m.role, text:m.content, time:new Date(m.timestamp).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) }))]);
      } else { setMessages([openingMessage]); }
    } catch { setError("Couldn't reload history."); }
  };

  return (
    <div style={{ minHeight:"calc(100vh - 75px)", background:"linear-gradient(160deg, #fff5f3 0%, #fef0f5 50%, #f0f5fe 100%)", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px 16px" }}>
      <Blobs />
      <div style={{ width:"100%", maxWidth:540, display:"flex", flexDirection:"column", height:"82vh", maxHeight:740, background:"rgba(255,252,250,0.88)", backdropFilter:"blur(12px)", borderRadius:28, border:"1px solid rgba(240,220,215,0.7)", boxShadow:"0 8px 40px rgba(180,120,120,0.1)", overflow:"hidden", animation:"fadeIn 0.5s ease", position:"relative", zIndex:1 }}>

        {/* Header */}
        <div style={{ padding:"16px 20px", borderBottom:"1px solid #f5e5e0", background:"rgba(255,250,248,0.92)", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ position:"relative" }}>
                <div style={{ width:44, height:44, borderRadius:"50%", background:"linear-gradient(135deg, #f7cac9, #c9e4de)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:700, color:"#8a6f6f" }}>
                  🌸
                </div>
                <div style={{ position:"absolute", bottom:1, right:1, width:10, height:10, borderRadius:"50%", background:"#7dba9e", border:"2px solid #fffaf8" }} />
              </div>
              <div>
                <p style={{ fontFamily:"'Outfit', sans-serif", fontSize:18, fontWeight:600, color:"#4a3232" }}>
                  {compName}
                </p>
                <p style={{ fontSize:11, color:"#b09090" }}>
                  Active companion for <strong style={{ color:"#c07070" }}>{user.name}</strong>
                </p>
              </div>
            </div>

            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              {[
                { label:"⚙️ Settings", title:"Companion Settings", onClick:() => setShowSettings(true), base:"#fff8f6", hover:"#f5e5e0", border:"#f0ddd8", color:"#8a6f6f" },
                { label:"↻ Reload", title:"Reload history", onClick:reloadHistory, base:"#fff8f6", hover:"#f5e5e0", border:"#f0ddd8", color:"#8a6f6f" },
                { label:"🗑 Clear", title:"Clear history", onClick:clearHistory, base:"#fef0f0", hover:"#fce5e5", border:"#f5c5c5", color:"#c07070" },
              ].map(btn => (
                <button key={btn.label} onClick={btn.onClick} title={btn.title}
                  style={{ padding:"6px 12px", fontSize:11, fontWeight:500, border:`1px solid ${btn.border}`, borderRadius:8, background:btn.base, color:btn.color, cursor:"pointer", fontFamily:"'DM Sans', sans-serif", transition:"all 0.2s" }}
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
          {messages.map(msg=><ChatMessage key={msg.id} msg={msg} companionName={compName} />)}
          {loading && (
            <div style={{ marginBottom:18, animation:"fadeUp 0.3s ease" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                <div style={{ width:28, height:28, borderRadius:"50%", background:"linear-gradient(135deg, #f7cac9, #c9e4de)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, color:"#8a6f6f" }}>🌸</div>
              </div>
              <TypingIndicator />
            </div>
          )}
          {error && <div style={{ textAlign:"center", padding:"8px 16px", background:"#fef0f0", border:"1px solid #f5c5c5", borderRadius:12, color:"#c07070", fontSize:13, marginBottom:16 }}>{error}</div>}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding:"12px 16px 16px", borderTop:"1px solid #f5e5e0", background:"rgba(255,250,248,0.92)", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"flex-end", gap:10, background:"#fff8f6", border:"1px solid #f0ddd8", borderRadius:20, padding:"8px 8px 8px 16px" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();} }}
              placeholder={`Talk to ${compName}...`}
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
            {compName} is a friendly customized companion, not a licensed therapist. If you're in crisis, please reach out to a professional. 🌸
          </p>
        </div>

      </div>

      {showSettings && (
        <SettingsModal 
          user={user} 
          onClose={() => setShowSettings(false)} 
          onSave={onUpdateUser} 
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root App
// ---------------------------------------------------------------------------
export default function App() {
  const [user, setUserState] = useState(getUser);
  const [page, setPage] = useState("landing");
  const [tokenChecked, setTokenChecked] = useState(false);
  const [oauthError, setOauthError] = useState(null);

  const updateUser = (newUserData) => {
    setUser(newUserData);
    setUserState(newUserData);
  };

  // Handle Google OAuth callback on first render
  useEffect(() => {
    const result = handleOAuthCallback();
    if (result && result.error) {
      setOauthError("Google sign-in was cancelled or failed. Please try again.");
      setPage("login");
    }
    if (result && result.token) {
      fetch(`${API}/auth/me`, {
        headers: { "Authorization": `Bearer ${result.token}` }
      }).then(r => r.json()).then(u => {
        updateUser(u);
        if (u.age === null) {
          setPage("onboarding");
        } else {
          setPage("chat");
        }
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
      updateUser(u);
      if (u.age === null) {
        setPage("onboarding");
      } else {
        setPage("chat");
      }
    }).catch(() => {
      removeToken(); removeUser(); setUserState(null);
      setPage("landing");
    }).finally(() => setTokenChecked(true));
  }, []);

  const handleLogin = (token, userData) => {
    setToken(token);
    updateUser(userData);
    if (userData.age === null) {
      setPage("onboarding");
    } else {
      setPage("chat");
    }
  };

  const handleLogout = () => {
    removeToken(); removeUser(); setUserState(null);
    setPage("landing");
  };

  if (!tokenChecked) {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <GlobalStyle />
        <Blobs />
        <div style={{ textAlign:"center" }}>
          <div style={{ width:48, height:48, borderRadius:"50%", background:"linear-gradient(135deg, #f7cac9, #c9e4de)", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:700, color:"#8a6f6f", marginBottom:12 }}>
            🌸
          </div>
          <p style={{ fontFamily:"'DM Sans', sans-serif", color:"#b09090", fontSize:14 }}>Connecting space…</p>
        </div>
      </div>
    );
  }

  // Active page routing
  const renderPage = () => {
    if (user) {
      if (user.age === null || page === "onboarding") {
        return <OnboardingPage user={user} onOnboardingComplete={(updatedUser) => {
          updateUser(updatedUser);
          setPage("chat");
        }} />;
      }
      return <ChatPage user={user} onLogout={handleLogout} onUpdateUser={updateUser} />;
    }

    switch (page) {
      case "login":
        return <AuthPage onLogin={handleLogin} oauthError={oauthError} initialMode="login" />;
      case "register":
        return <AuthPage onLogin={handleLogin} oauthError={oauthError} initialMode="register" />;
      case "landing":
      default:
        return <LandingPage onNavigate={(p) => setPage(p)} />;
    }
  };

  return (
    <>
      <GlobalStyle />
      <Navbar 
        onNavigate={(p) => {
          if (user) {
            setPage(user.age === null ? "onboarding" : "chat");
          } else {
            setPage(p);
          }
        }} 
        currentPage={page} 
        onLogout={handleLogout}
        user={user}
      />
      {renderPage()}
    </>
  );
}
