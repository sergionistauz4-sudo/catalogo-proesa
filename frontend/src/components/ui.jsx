// -*- coding: utf-8 -*-
/**
 * ui.jsx — Piezas de interfaz reutilizables (estilo PROESA)
 * -----------------------------------------------------------
 *   Spinner, Skeleton, BarraBusqueda, Segmentado, EstadoVacio,
 *   BannerError, Campo, Interruptor, Modal, Toast + useToast,
 *   Boton (primario / secundario / peligro / fantasma)
 */

import { useEffect, useState, useCallback } from "react";
import { C, FONT } from "../api";

export const TOUCH = 44;

// ─── Spinner ─────────────────────────────────────────────────────────────────
export function Spinner({ size = 16, color = "white", track = "rgba(255,255,255,0.3)" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16"
      style={{ animation: "spin 0.7s linear infinite", flexShrink: 0 }}>
      <circle cx="8" cy="8" r="6" fill="none" stroke={track} strokeWidth="2" />
      <path d="M8 2A6 6 0 0 1 14 8" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
export function Skeleton({ height = 52, radius = 12, style }) {
  return (
    <div style={{
      height, borderRadius: radius,
      background: "linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite",
      ...style,
    }} />
  );
}

// ─── Barra de búsqueda ───────────────────────────────────────────────────────
export function BarraBusqueda({ value, onChange, placeholder = "Buscar…" }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: "relative", flex: "1 1 200px", minWidth: "160px" }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"
        style={{ position: "absolute", left: "11px", top: "50%", transform: "translateY(-50%)",
          color: focused ? C.red : C.gray400, pointerEvents: "none" }}>
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        aria-label={placeholder}
        style={{
          width: "100%", height: "40px",
          padding: "0 12px 0 34px",
          border: `1px solid ${focused ? C.red : C.border}`,
          borderRadius: "8px", fontSize: "14px", color: C.navy,
          background: focused ? C.white : C.gray50,
          outline: "none",
          boxShadow: focused ? `0 0 0 3px ${C.redLight}` : "none",
          transition: "all 0.15s", fontFamily: "inherit",
          WebkitAppearance: "none",
        }}
      />
    </div>
  );
}

// ─── Control segmentado (Todos / Activos / Inactivos) ────────────────────────
export function Segmentado({ opciones, valor, onChange }) {
  return (
    <div style={{ display: "flex", background: C.gray100, borderRadius: "8px", padding: "3px", gap: "2px" }}>
      {opciones.map(o => {
        const activo = valor === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={activo}
            style={{
              padding: "5px 11px", borderRadius: "6px", border: "none",
              fontSize: "12px", fontWeight: activo ? 600 : 500,
              color: activo ? C.navy : C.gray600,
              background: activo ? C.white : "transparent",
              cursor: "pointer", transition: "all 0.15s",
              boxShadow: activo ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              whiteSpace: "nowrap", fontFamily: "inherit",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Estado vacío ────────────────────────────────────────────────────────────
export function EstadoVacio({ icono = "🔍", titulo, texto, children }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "4rem 1rem", gap: "10px",
      color: C.gray400, textAlign: "center",
    }}>
      <span style={{ fontSize: "34px" }}>{icono}</span>
      <div style={{ fontSize: "15px", fontWeight: 600, color: C.navy }}>{titulo}</div>
      {texto && <div style={{ fontSize: "13px", maxWidth: "320px", lineHeight: 1.5 }}>{texto}</div>}
      {children}
    </div>
  );
}

// ─── Banner de error ─────────────────────────────────────────────────────────
export function BannerError({ mensaje, onReintentar }) {
  if (!mensaje) return null;
  return (
    <div role="alert" style={{
      padding: "10px 14px",
      background: C.errorBg, borderLeft: `4px solid ${C.red}`,
      borderRadius: "0 8px 8px 0", fontSize: "13px", color: C.errorText,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      flexWrap: "wrap", gap: "8px",
    }}>
      <span>⚠ {mensaje}</span>
      {onReintentar && (
        <Boton variante="primario" chico onClick={onReintentar}>Reintentar</Boton>
      )}
    </div>
  );
}

// ─── Botón ───────────────────────────────────────────────────────────────────
const VARIANTES = {
  primario:   { bg: C.red,     bgH: C.redHover, fg: C.white, borde: "none" },
  secundario: { bg: C.white,   bgH: C.gray50,   fg: C.navy,  borde: `1.5px solid ${C.gray200}` },
  peligro:    { bg: C.errorBg, bgH: "#FFE9EA",  fg: C.errorText, borde: `1.5px solid rgba(230,57,70,0.35)` },
  fantasma:   { bg: "transparent", bgH: C.gray100, fg: C.gray600, borde: "none" },
  navy:       { bg: C.navy,    bgH: C.navySoft, fg: C.white, borde: "none" },
};

export function Boton({
  children, onClick, variante = "primario", disabled, loading, chico,
  ancho, type = "button", title, ariaLabel,
}) {
  const [hover, setHover] = useState(false);
  const v = VARIANTES[variante] ?? VARIANTES.primario;
  const off = disabled || loading;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={off}
      title={title}
      aria-label={ariaLabel}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: chico ? "32px" : `${TOUCH}px`,
        padding: chico ? "0 12px" : "0 18px",
        width: ancho ? "100%" : undefined,
        background: hover && !off ? v.bgH : v.bg,
        color: v.fg, border: v.borde,
        borderRadius: chico ? "7px" : "10px",
        fontSize: chico ? "12.5px" : "14px", fontWeight: 600,
        cursor: off ? "not-allowed" : "pointer",
        opacity: disabled && !loading ? 0.55 : 1,
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "7px",
        transition: "background 0.15s",
        whiteSpace: "nowrap", fontFamily: "inherit",
        WebkitTapHighlightColor: "transparent",
        flexShrink: 0,
      }}
    >
      {loading
        ? <Spinner size={15}
            color={v.fg === C.white ? "white" : C.red}
            track={v.fg === C.white ? "rgba(255,255,255,0.3)" : C.gray200} />
        : children}
    </button>
  );
}

// ─── Campo de formulario ─────────────────────────────────────────────────────
export function Campo({
  label, value, onChange, placeholder, type = "text", prefijo, multilinea,
  error, ayuda, autoFocus, inputMode, step, min, id,
}) {
  const [focused, setFocused] = useState(false);
  const inputId = id ?? `campo-${label?.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const estilo = {
    width: "100%",
    minHeight: `${TOUCH + 4}px`,
    padding: multilinea ? "11px 12px" : `0 12px 0 ${prefijo ? "34px" : "12px"}`,
    border: `1.5px solid ${error ? C.red : focused ? C.red : "#E0E0E0"}`,
    borderRadius: "10px",
    fontSize: "16px", // 16px fijo: evita el zoom automático de iOS
    color: C.navy,
    background: focused ? C.white : "#FAFAFA",
    outline: "none",
    boxShadow: focused ? `0 0 0 4px ${C.redGlow}` : "none",
    transition: "border-color 0.15s, box-shadow 0.15s, background 0.15s",
    fontFamily: "inherit",
    WebkitAppearance: "none",
    resize: multilinea ? "vertical" : undefined,
    lineHeight: multilinea ? 1.45 : undefined,
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
      <label htmlFor={inputId} style={{
        fontSize: "11.5px", fontWeight: 600, color: C.gray600,
        letterSpacing: "0.4px", textTransform: "uppercase",
      }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        {prefijo && (
          <span style={{
            position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)",
            fontSize: "13px", fontWeight: 600, color: focused ? C.red : C.gray400,
            pointerEvents: "none",
          }}>{prefijo}</span>
        )}
        {multilinea ? (
          <textarea
            id={inputId} rows={4} value={value} placeholder={placeholder}
            onChange={e => onChange(e.target.value)}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            style={estilo}
          />
        ) : (
          <input
            id={inputId} type={type} value={value} placeholder={placeholder}
            inputMode={inputMode} step={step} min={min} autoFocus={autoFocus}
            onChange={e => onChange(e.target.value)}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            aria-invalid={!!error}
            style={estilo}
          />
        )}
      </div>
      {(error || ayuda) && (
        <span style={{ fontSize: "12px", color: error ? C.errorText : C.gray400, lineHeight: 1.4 }}>
          {error || ayuda}
        </span>
      )}
    </div>
  );
}

// ─── Interruptor (on/off) ────────────────────────────────────────────────────
export function Interruptor({ checked, onChange, label, descripcion, disabled }) {
  return (
    <label style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
      padding: "12px 14px", borderRadius: "10px", background: C.gray50,
      border: `1px solid ${C.gray100}`, cursor: disabled ? "default" : "pointer",
    }}>
      <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <span style={{ fontSize: "14px", fontWeight: 600, color: C.navy }}>{label}</span>
        {descripcion && <span style={{ fontSize: "12px", color: C.gray600 }}>{descripcion}</span>}
      </span>
      <span style={{ position: "relative", flexShrink: 0 }}>
        <input
          type="checkbox" role="switch" checked={checked} disabled={disabled}
          onChange={e => onChange(e.target.checked)}
          style={{ position: "absolute", opacity: 0, width: "100%", height: "100%", margin: 0, cursor: "inherit" }}
        />
        <span aria-hidden="true" style={{
          display: "block", width: "44px", height: "26px", borderRadius: "13px",
          background: checked ? C.green : C.gray200, transition: "background 0.15s",
          position: "relative",
        }}>
          <span style={{
            position: "absolute", top: "3px", left: checked ? "21px" : "3px",
            width: "20px", height: "20px", borderRadius: "50%", background: C.white,
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.15s",
          }} />
        </span>
      </span>
    </label>
  );
}

// ─── Modal (hoja inferior en celular, tarjeta centrada en desktop) ───────────
const MODAL_CSS = `
  .modal-wrap { align-items: flex-end; }
  .modal-card { border-radius: 20px 20px 0 0; max-height: 92vh; }
  @media (min-width: 640px) {
    .modal-wrap { align-items: center; }
    .modal-card { border-radius: 20px; max-height: 88vh; }
  }
`;

export function Modal({ abierto, titulo, onCerrar, children, pie, ancho = 480 }) {
  useEffect(() => {
    if (!abierto) return;
    const onKey = e => { if (e.key === "Escape") onCerrar?.(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div
      className="modal-wrap"
      onMouseDown={e => { if (e.target === e.currentTarget) onCerrar?.(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(26,26,46,0.55)",
        display: "flex", justifyContent: "center",
        padding: "0", animation: "fadeIn 0.15s ease",
        fontFamily: FONT,
      }}
    >
      <style>{MODAL_CSS}</style>
      <div
        className="modal-card"
        role="dialog" aria-modal="true" aria-label={titulo}
        style={{
          width: "100%", maxWidth: `${ancho}px`,
          background: C.white,
          boxShadow: "0 20px 50px rgba(0,0,0,0.30)",
          display: "flex", flexDirection: "column",
          animation: "subir 0.2s ease",
          margin: "0 auto",
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 20px 14px", borderBottom: `1px solid ${C.gray100}`, gap: "12px",
        }}>
          <h2 style={{ fontSize: "17px", fontWeight: 700, color: C.navy }}>{titulo}</h2>
          <button
            type="button" onClick={onCerrar} aria-label="Cerrar"
            style={{
              width: "34px", height: "34px", borderRadius: "8px", border: "none",
              background: C.gray50, color: C.gray600, cursor: "pointer", fontSize: "18px",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >×</button>
        </div>
        <div style={{ padding: "18px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
          {children}
        </div>
        {pie && (
          <div style={{
            padding: "14px 20px calc(env(safe-area-inset-bottom, 0px) + 14px)",
            borderTop: `1px solid ${C.gray100}`,
            display: "flex", gap: "10px", justifyContent: "flex-end", flexWrap: "wrap",
          }}>
            {pie}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────
export function useToast() {
  const [toast, setToast] = useState(null);
  const mostrar = useCallback((msg, tipo = "ok") => {
    setToast({ msg, tipo, id: Date.now() });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);
  return [toast, mostrar];
}

export function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div role="status" aria-live="polite" style={{
      position: "fixed", left: "50%", transform: "translateX(-50%)",
      bottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
      background: toast.tipo === "ok" ? C.green : C.red,
      color: C.white, fontSize: "13px", fontWeight: 600,
      padding: "11px 18px", borderRadius: "10px",
      boxShadow: "0 6px 18px rgba(0,0,0,0.2)", zIndex: 400,
      maxWidth: "calc(100vw - 32px)", textAlign: "center",
      animation: "subir 0.2s ease", fontFamily: FONT,
    }}>
      {toast.msg}
    </div>
  );
}
