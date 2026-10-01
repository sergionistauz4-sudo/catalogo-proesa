// -*- coding: utf-8 -*-
/**
 * Login.jsx — Inicio de sesión
 * ------------------------------
 * Cliente (farmacéutico): nombre registrado + NIT como contraseña.
 * Admin (asesor de ventas): usuario y contraseña del .env del backend.
 *
 * Props:
 *   onLoginSuccess(usuario) → { id, nombre, rol, nit }
 */

import { useState } from "react";
import logoProesa from "../assets/logo_proesa.png";
import { C, FONT, API, guardarSesion } from "../api";

// ─── estilos inline ───────────────────────────────────────────────────────────
// Layout: fondo navy sólido a pantalla completa, con una tarjeta blanca
// centrada y flotante (con sombra) que contiene el logo y el formulario.
const S = {
  page: {
    minHeight: "100vh",
    width: "100%",
    background: C.navy,
    fontFamily: FONT,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: `calc(env(safe-area-inset-top, 0px) + 24px) 20px calc(env(safe-area-inset-bottom, 0px) + 24px)`,
    position: "relative",
    overflow: "hidden",
  },
  bgCircle1: {
    position: "absolute", bottom: "-120px", left: "-100px",
    width: "320px", height: "320px", borderRadius: "50%",
    background: C.red, opacity: 0.08, pointerEvents: "none",
  },
  bgCircle2: {
    position: "absolute", top: "-100px", right: "-90px",
    width: "260px", height: "260px", borderRadius: "50%",
    background: C.red, opacity: 0.07, pointerEvents: "none",
  },
  centerCol: {
    width: "100%", maxWidth: "380px",
    display: "flex", flexDirection: "column", alignItems: "center",
    position: "relative", zIndex: 1,
  },
  logoWrap: { display: "flex", justifyContent: "center", marginBottom: "18px" },
  logoImg:  { height: "128px", width: "auto", maxWidth: "100%", display: "block", objectFit: "contain" },
  card: {
    width: "100%", background: C.white, borderRadius: "20px",
    boxShadow: "0 20px 50px rgba(0,0,0,0.30)", padding: "32px 26px 28px",
  },
  formTitle: {
    fontSize: "21px", fontWeight: 700, color: C.navy,
    marginBottom: "4px", textAlign: "center",
  },
  formSubtitle: {
    fontSize: "13px", color: C.gray400, marginBottom: "1.4rem", textAlign: "center",
  },
  badge: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
    background: C.redLight, color: C.red, fontSize: "11px", fontWeight: 600,
    padding: "6px 12px", borderRadius: "20px",
    margin: "0 auto 1.5rem", width: "fit-content",
  },
  field: { marginBottom: "1rem" },
  label: {
    display: "block", fontSize: "11.5px", fontWeight: 600, color: C.gray600,
    letterSpacing: "0.4px", textTransform: "uppercase", marginBottom: "7px",
  },
  inputWrap: { position: "relative" },
  inputIconWrap: {
    position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)",
    color: C.gray400, pointerEvents: "none", display: "flex", alignItems: "center",
  },
  input: (focused) => ({
    width: "100%", height: "52px", padding: "0 44px 0 42px",
    border: `1.5px solid ${focused ? C.red : "#E0E0E0"}`,
    borderRadius: "10px",
    fontSize: "16px", // 16px fijo: evita el zoom automático de iOS en inputs
    color: C.navy, background: focused ? C.white : "#FAFAFA",
    outline: "none", boxShadow: focused ? `0 0 0 4px ${C.redGlow}` : "none",
    transition: "border-color 0.15s, box-shadow 0.15s, background 0.15s",
    WebkitAppearance: "none", fontFamily: "inherit",
  }),
  eyeBtn: {
    position: "absolute", right: "6px", top: "50%", transform: "translateY(-50%)",
    background: "none", border: "none", cursor: "pointer", color: C.gray400,
    padding: "10px", display: "flex", alignItems: "center",
    WebkitTapHighlightColor: "transparent",
  },
  errorMsg: {
    display: "flex", alignItems: "flex-start", gap: "8px",
    background: C.errorBg, borderLeft: `3px solid ${C.red}`,
    borderRadius: "0 8px 8px 0", padding: "11px 13px",
    fontSize: "13px", color: C.errorText, marginTop: "10px", lineHeight: 1.4,
  },
  btnSubmit: (loading) => ({
    width: "100%", height: "52px",
    background: loading ? "#B0272F" : C.red, color: C.white,
    border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: 600,
    cursor: loading ? "not-allowed" : "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
    marginTop: "1.4rem", letterSpacing: "0.2px", transition: "background 0.15s",
    pointerEvents: loading ? "none" : "auto", fontFamily: "inherit",
    WebkitTapHighlightColor: "transparent",
  }),
  dividerWrap: { display: "flex", alignItems: "center", gap: "10px", margin: "1.4rem 0 0" },
  dividerLine: { flex: 1, height: "1px", background: C.gray100 },
  dividerText: { fontSize: "11px", color: "#BBBBBB" },
  helpText: {
    fontSize: "12.5px", color: C.gray400, textAlign: "center",
    marginTop: "1.1rem", lineHeight: 1.5,
  },
  helpLink: { color: C.red, textDecoration: "none", fontWeight: 500 },

  // ── Estado éxito ──────────────────────────────────────────────────────────
  successWrap: { display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" },
  successCircle: {
    width: "60px", height: "60px", borderRadius: "50%", background: C.redLight,
    display: "flex", alignItems: "center", justifyContent: "center",
    marginBottom: "16px", color: C.red,
  },
  successName: { fontSize: "18px", fontWeight: 700, color: C.navy, marginBottom: "4px" },
  successRole: { fontSize: "13px", color: C.gray400, marginBottom: "1.6rem" },
  btnEnter: {
    width: "100%", height: "52px", background: C.red, color: C.white,
    border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: 600,
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    gap: "8px", transition: "background 0.15s", fontFamily: "inherit",
  },
};

// ─── Iconos SVG (un solo trazo, consistentes con la paleta) ──────────────────
const Icon = {
  Usuario: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2"/>
      <path d="M4 20c0-3.5 3.5-6 8-6s8 2.5 8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  Credencial: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2.2" stroke="currentColor" strokeWidth="1.8"/>
      <circle cx="8" cy="11.2" r="1.7" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M5.6 15.2c0-1.3 1.1-2 2.4-2s2.4 0.7 2.4 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M14 9.8h5M14 12.2h5M14 14.6h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  OjoAbierto: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M2 12c2.2-4.2 6-6.5 10-6.5s7.8 2.3 10 6.5c-2.2 4.2-6 6.5-10 6.5S4.2 16.2 2 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8"/>
    </svg>
  ),
  OjoCerrado: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M3 12c1-1.9 2.4-3.4 4-4.4M21 12c-1 1.9-2.4 3.4-4 4.4M9.6 6.4C10.3 6.1 11.1 6 12 6c4 0 7.8 2.3 10 6.5-0.5 1-1.2 1.9-1.9 2.7M14.4 17.6c-0.7 0.3-1.5 0.4-2.4 0.4-4 0-7.8-2.3-10-6.5 0.5-1 1.2-1.9 1.9-2.7"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  Caja: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
  ),
  Flecha: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Check: (p) => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M5 13l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Alerta: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M12 3.5 2 20.5h20L12 3.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M12 10v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="12" cy="17" r="1" fill="currentColor"/>
    </svg>
  ),
};

function Spinner() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" style={{ animation: "spin 0.7s linear infinite" }}>
      <circle cx="9" cy="9" r="7" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
      <path d="M9 2 A7 7 0 0 1 16 9" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const ROL_LABEL = { admin: "Asesor de ventas", cliente: "Cliente" };

// ─── Componente principal ────────────────────────────────────────────────────
export default function Login({ onLoginSuccess }) {
  const [nombre,       setNombre]       = useState("");
  const [password,     setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focusNombre,  setFocusNombre]  = useState(false);
  const [focusPass,    setFocusPass]    = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [usuario,      setUsuario]      = useState(null); // estado de éxito

  const handleNombreChange = (e) => { setNombre(e.target.value);   setError(""); };
  const handlePassChange   = (e) => { setPassword(e.target.value); setError(""); };

  // Enter avanza entre campos
  const handleNombreKey = (e) => { if (e.key === "Enter") document.getElementById("passwordInput").focus(); };
  const handlePassKey   = (e) => { if (e.key === "Enter") handleLogin(); };

  async function handleLogin() {
    if (!nombre.trim())   { setError("Ingresá tu nombre de usuario."); return; }
    if (!password.trim()) { setError("Ingresá tu contraseña (tu NIT)."); return; }

    setLoading(true);
    setError("");

    try {
      // El backend devuelve { token, usuario: {...} }
      // o lanza HTTPException con { detail: "mensaje" }.
      const res = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), password: password.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(typeof data.detail === "string"
          ? data.detail
          : "Usuario o contraseña incorrectos.");
        return;
      }

      guardarSesion(data.token, data.usuario);
      setUsuario(data.usuario);
    } catch (_) {
      setError("Error de conexión. Verificá tu red e intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  function handleEnter() {
    if (onLoginSuccess) onLoginSuccess(usuario);
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <div style={S.bgCircle1} />
      <div style={S.bgCircle2} />

      <div style={S.centerCol}>
        <div style={S.card}>

          {/* Logo, dentro de la tarjeta */}
          <div style={S.logoWrap}>
            <img src={logoProesa} alt="PROESA" style={S.logoImg} />
          </div>

          {usuario ? (
            // ── Estado éxito ──────────────────────────────────────────────
            <div style={S.successWrap} role="status" aria-live="polite">
              <div style={S.successCircle}><Icon.Check /></div>
              <div style={S.successName}>{usuario.nombre}</div>
              <div style={S.successRole}>{ROL_LABEL[usuario.rol] ?? usuario.rol}</div>
              <button
                style={S.btnEnter}
                onClick={handleEnter}
                autoFocus
                onMouseEnter={e => (e.currentTarget.style.background = C.redHover)}
                onMouseLeave={e => (e.currentTarget.style.background = C.red)}
              >
                {usuario.rol === "admin" ? "Entrar al panel" : "Ver catálogo"} <Icon.Flecha />
              </button>
            </div>
          ) : (
            // ── Formulario ────────────────────────────────────────────────
            <>
              <h1 style={S.formTitle}>Iniciar sesión</h1>
              <p  style={S.formSubtitle}>Ingresá tus credenciales para continuar</p>

              <div style={S.badge}>
                <Icon.Caja /> Catálogo de productos
              </div>

              {/* Campo nombre */}
              <div style={S.field}>
                <label htmlFor="nombreInput" style={S.label}>Nombre de usuario</label>
                <div style={S.inputWrap}>
                  <span style={S.inputIconWrap}><Icon.Usuario /></span>
                  <input
                    id="nombreInput"
                    type="text"
                    value={nombre}
                    onChange={handleNombreChange}
                    onKeyDown={handleNombreKey}
                    onFocus={() => setFocusNombre(true)}
                    onBlur={() => setFocusNombre(false)}
                    placeholder="Ej: Farmacia San José"
                    autoComplete="username"
                    autoCapitalize="words"
                    style={S.input(focusNombre)}
                  />
                </div>
              </div>

              {/* Campo contraseña (NIT) */}
              <div style={S.field}>
                <label htmlFor="passwordInput" style={S.label}>Contraseña (NIT)</label>
                <div style={S.inputWrap}>
                  <span style={S.inputIconWrap}><Icon.Credencial /></span>
                  <input
                    id="passwordInput"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={handlePassChange}
                    onKeyDown={handlePassKey}
                    onFocus={() => setFocusPass(true)}
                    onBlur={() => setFocusPass(false)}
                    placeholder="Tu número de NIT"
                    autoComplete="current-password"
                    style={S.input(focusPass)}
                  />
                  <button
                    style={S.eyeBtn}
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? <Icon.OjoCerrado /> : <Icon.OjoAbierto />}
                  </button>
                </div>
              </div>

              {error && (
                <div style={S.errorMsg} role="alert" aria-live="assertive">
                  <span style={{ flexShrink: 0, marginTop: "1px" }}><Icon.Alerta /></span>
                  <span>{error}</span>
                </div>
              )}

              <button
                style={S.btnSubmit(loading)}
                onClick={handleLogin}
                disabled={loading}
                type="button"
                onMouseEnter={e => { if (!loading) e.currentTarget.style.background = C.redHover; }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.background = C.red; }}
              >
                {loading ? <Spinner /> : <>Ingresar <Icon.Flecha /></>}
              </button>

              <div style={S.dividerWrap}>
                <div style={S.dividerLine} />
                <span style={S.dividerText}>o</span>
                <div style={S.dividerLine} />
              </div>

              <p style={S.helpText}>
                ¿No podés ingresar?{" "}
                <a href="mailto:israeltinini2@gmail.com" style={S.helpLink}>
                  Contactá a tu asesor de ventas
                </a>
              </p>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
