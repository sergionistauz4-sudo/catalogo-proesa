// -*- coding: utf-8 -*-
/**
 * Navbar.jsx — Barra de navegación principal
 * -------------------------------------------
 * Franja superior:
 *   Mobile (<640px):  logo (izq) | avatar (der, abre menú desplegable)
 *   Desktop (≥640px): logo (izq) | badge rol + avatar + nombre + logout (der)
 * Franja inferior (solo admin): Productos · Clientes · Vista cliente
 *
 * Props:
 *   usuario       { id, nombre, rol, nit }
 *   paginaActual  "productos" | "clientes" | "catalogo"
 *   onNavegar     (pagina) => void
 *   onLogout      () => void
 */

import { useState, useRef, useEffect } from "react";
import { C, FONT, iniciales } from "../api";

// ─── Tabs (solo se muestran al admin) ─────────────────────────────────────────
export const TABS_ADMIN = [
  { id: "productos", label: "Productos",     icon: "📦" },
  { id: "clientes",  label: "Clientes",      icon: "👥" },
  { id: "accesos",   label: "Accesos",       icon: "📊" },
  { id: "catalogo",  label: "Vista cliente", icon: "👁️" },
];

const ROL_LABEL = { admin: "Asesor de ventas", cliente: "Cliente" };

const Icon = {
  Salida: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 16l5-4-5-4M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

// ─── Estilos ──────────────────────────────────────────────────────────────────
const S = {
  wrapper: {
    width: "100%", background: C.white,
    borderBottom: `1px solid ${C.border}`,
    position: "sticky", top: 0, zIndex: 100,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    fontFamily: FONT,
    maxWidth: "100vw",
  },
  topBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0 1rem", height: "56px", gap: "10px",
    maxWidth: "1200px", margin: "0 auto",
  },
  logoWrap: { display: "flex", alignItems: "center", gap: "9px", minWidth: 0, overflow: "hidden" },
  logoMark: {
    width: "34px", height: "34px", background: C.red, borderRadius: "9px",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 700, fontSize: "13px", color: C.white, flexShrink: 0,
  },
  logoText: { fontSize: "15px", fontWeight: 700, color: C.navy, letterSpacing: "0.2px", whiteSpace: "nowrap" },
  logoSub:  { fontSize: "11px", color: C.gray400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },

  rightGroupFull: { display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 },
  rolBadge: (admin) => ({
    display: "inline-flex", alignItems: "center", gap: "5px",
    background: admin ? C.redLight : C.greenLight,
    color: admin ? C.red : C.green,
    fontSize: "11px", fontWeight: 600, padding: "3px 10px",
    borderRadius: "20px", whiteSpace: "nowrap",
  }),
  dividerV: { width: "1px", height: "20px", background: C.gray100, flexShrink: 0 },
  avatarBtn: {
    background: "none", border: "none", padding: 0, cursor: "pointer",
    flexShrink: 0, WebkitTapHighlightColor: "transparent", position: "relative",
  },
  avatarCircle: {
    width: "34px", height: "34px", borderRadius: "50%", background: C.navy,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "12px", fontWeight: 700, color: C.white, flexShrink: 0, letterSpacing: "0.5px",
  },
  nombre: {
    fontSize: "13px", fontWeight: 600, color: C.navy, lineHeight: 1.2,
    whiteSpace: "nowrap", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis",
  },
  btnLogout: (hover) => ({
    display: "flex", alignItems: "center", gap: "5px",
    background: hover ? C.redLight : "none", border: "none", cursor: "pointer",
    fontSize: "12.5px", color: hover ? C.red : C.gray600,
    padding: "6px 9px", borderRadius: "6px",
    transition: "color 0.15s, background 0.15s", whiteSpace: "nowrap", fontFamily: "inherit",
  }),

  dropdownWrap: {
    position: "absolute", top: "calc(100% + 8px)", right: 0,
    background: C.white, borderRadius: "12px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.18)", border: `1px solid ${C.border}`,
    minWidth: "220px", maxWidth: "calc(100vw - 32px)", padding: "12px", zIndex: 200, textAlign: "left",
  },
  dropdownHeader: {
    display: "flex", alignItems: "center", gap: "10px",
    paddingBottom: "10px", borderBottom: `1px solid ${C.gray100}`, marginBottom: "10px",
  },
  dropdownNombre: { fontSize: "13.5px", fontWeight: 600, color: C.navy, lineHeight: 1.25, wordBreak: "break-word" },
  dropdownLogoutBtn: (hover) => ({
    width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
    background: hover ? C.redLight : C.gray50, border: "none", cursor: "pointer",
    fontSize: "13px", fontWeight: 600, color: hover ? C.red : C.navy,
    padding: "10px", borderRadius: "8px", transition: "color 0.15s, background 0.15s",
    fontFamily: "inherit", WebkitTapHighlightColor: "transparent",
  }),

  tabsWrap: { borderTop: `1px solid ${C.gray100}` },
  tabsBar: {
    display: "flex", alignItems: "flex-end", padding: "0 1rem", height: "44px",
    overflowX: "auto", maxWidth: "1200px", margin: "0 auto",
  },
  tab: (activo, hover) => ({
    display: "flex", alignItems: "center", gap: "6px", padding: "0 1rem", height: "100%",
    fontSize: "13.5px", fontWeight: activo ? 600 : 500,
    color: activo || hover ? C.navy : C.gray600,
    borderBottom: activo ? `3px solid ${C.red}` : "3px solid transparent",
    borderTop: "none", borderLeft: "none", borderRight: "none",
    background: "none", cursor: "pointer", whiteSpace: "nowrap",
    transition: "color 0.15s, border-bottom-color 0.15s",
    outline: "none", flexShrink: 0, fontFamily: "inherit",
  }),
};

// Mobile-first: por defecto solo el avatar; desde 640px el grupo completo.
const RESPONSIVE_CSS = `
  .navbar-right-full { display: none !important; }
  .navbar-avatar-only { display: flex; }
  @media (min-width: 640px) {
    .navbar-right-full { display: flex !important; }
    .navbar-avatar-only { display: none; }
  }
`;

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Navbar({ usuario, paginaActual, onNavegar, onLogout }) {
  const [hoverLogout,     setHoverLogout]     = useState(false);
  const [hoverDropLogout, setHoverDropLogout] = useState(false);
  const [hoverTabs,       setHoverTabs]       = useState({});
  const [menuAbierto,     setMenuAbierto]     = useState(false);
  const menuRef = useRef(null);
  const esAdmin = usuario?.rol === "admin";

  // Cerrar el menú al tocar afuera
  useEffect(() => {
    if (!menuAbierto) return;
    function handleClickFuera(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuAbierto(false);
    }
    document.addEventListener("mousedown", handleClickFuera);
    document.addEventListener("touchstart", handleClickFuera);
    return () => {
      document.removeEventListener("mousedown", handleClickFuera);
      document.removeEventListener("touchstart", handleClickFuera);
    };
  }, [menuAbierto]);

  const rolLabel = ROL_LABEL[usuario?.rol] ?? usuario?.rol ?? "";

  return (
    <nav style={S.wrapper} aria-label="Navegación principal">
      <style>{RESPONSIVE_CSS}</style>

      {/* ── Franja superior ─────────────────────────────────────────── */}
      <div style={S.topBar}>
        <div style={S.logoWrap}>
          <div style={S.logoMark}>CP</div>
          <div style={{ minWidth: 0, overflow: "hidden" }}>
            <div style={S.logoText}>PROESA</div>
            <div style={S.logoSub}>Catálogo de Productos</div>
          </div>
        </div>

        {/* Desktop (≥640px) */}
        <div className="navbar-right-full" style={S.rightGroupFull}>
          <span style={S.rolBadge(esAdmin)}>{rolLabel}</span>
          <div style={S.dividerV} />
          <div style={S.avatarCircle} title={usuario?.nombre}>{iniciales(usuario?.nombre)}</div>
          <span style={S.nombre} title={usuario?.nombre}>{usuario?.nombre ?? "—"}</span>
          <div style={S.dividerV} />
          <button
            style={S.btnLogout(hoverLogout)}
            onClick={onLogout}
            onMouseEnter={() => setHoverLogout(true)}
            onMouseLeave={() => setHoverLogout(false)}
            type="button"
          >
            <Icon.Salida /> Salir
          </button>
        </div>

        {/* Mobile (<640px): avatar + menú */}
        <div className="navbar-avatar-only" ref={menuRef} style={{ position: "relative" }}>
          <button
            style={S.avatarBtn}
            onClick={() => setMenuAbierto(v => !v)}
            aria-label="Abrir menú de cuenta"
            aria-expanded={menuAbierto}
            type="button"
          >
            <div style={S.avatarCircle}>{iniciales(usuario?.nombre)}</div>
          </button>

          {menuAbierto && (
            <div style={S.dropdownWrap}>
              <div style={S.dropdownHeader}>
                <div style={S.avatarCircle}>{iniciales(usuario?.nombre)}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={S.dropdownNombre}>{usuario?.nombre ?? "—"}</div>
                  <span style={{ ...S.rolBadge(esAdmin), marginTop: "4px" }}>{rolLabel}</span>
                </div>
              </div>
              <button
                style={S.dropdownLogoutBtn(hoverDropLogout)}
                onClick={onLogout}
                onMouseEnter={() => setHoverDropLogout(true)}
                onMouseLeave={() => setHoverDropLogout(false)}
                type="button"
              >
                <Icon.Salida /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Franja inferior: tabs (solo admin) ──────────────────────── */}
      {esAdmin && (
        <div style={S.tabsWrap}>
          <div style={S.tabsBar} role="tablist">
            {TABS_ADMIN.map(tab => {
              const activo = paginaActual === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activo}
                  style={S.tab(activo, !!hoverTabs[tab.id])}
                  onClick={() => onNavegar?.(tab.id)}
                  onMouseEnter={() => setHoverTabs(h => ({ ...h, [tab.id]: true }))}
                  onMouseLeave={() => setHoverTabs(h => ({ ...h, [tab.id]: false }))}
                  type="button"
                >
                  <span style={{ fontSize: "15px", lineHeight: 1 }}>{tab.icon}</span>
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
