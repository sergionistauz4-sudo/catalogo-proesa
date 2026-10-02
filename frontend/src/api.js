// -*- coding: utf-8 -*-
/**
 * api.js — Tokens de diseño PROESA + helpers compartidos
 * --------------------------------------------------------
 *   C            paleta (misma que el proyecto de Relevamiento)
 *   FONT         tipografía
 *   api(path, …) fetch al backend con el token, devuelve JSON o lanza
 *                Error(detail). Si el backend responde 401, avisa a App
 *                con el evento "sesion-expirada" para volver al login.
 *   formatoBs    número → "Bs 1.234,50"
 */

// ─── Tokens PROESA ────────────────────────────────────────────────────────────
export const C = {
  navy:       "#1A1A2E",
  navySoft:   "#23233D",
  red:        "#E63946",
  redHover:   "#CC2F3B",
  redLight:   "rgba(230,57,70,0.10)",
  redGlow:    "rgba(230,57,70,0.16)",
  green:      "#2A9D5C",
  greenLight: "rgba(42,157,92,0.10)",
  amber:      "#E9A825",
  amberLight: "rgba(233,168,37,0.12)",
  white:      "#FFFFFF",
  gray50:     "#F8F9FF",
  gray100:    "#F0F0F0",
  gray200:    "#E6E6E6",
  gray400:    "#AAAAAA",
  gray600:    "#666666",
  border:     "#E6E6E6",
  errorBg:    "#FFF5F5",
  errorText:  "#C0303B",
};

export const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// ─── Base de API, sin barra final ────────────────────────────────────────────
// Evita el bug de "//api/..." si VITE_API_URL quedó con "/" al final en el .env.
export const API = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

// ─── Sesión en localStorage ──────────────────────────────────────────────────
const CLAVES = ["token", "usuario_id", "usuario_nombre", "usuario_rol", "usuario_nit"];

export function guardarSesion(token, usuario) {
  localStorage.setItem("token",          token);
  localStorage.setItem("usuario_id",     usuario.id);
  localStorage.setItem("usuario_nombre", usuario.nombre);
  localStorage.setItem("usuario_rol",    usuario.rol);
  localStorage.setItem("usuario_nit",    usuario.nit ?? "");
}

export function limpiarSesionLocal() {
  CLAVES.forEach(k => localStorage.removeItem(k));
}

export function usuarioLocal() {
  const id     = localStorage.getItem("usuario_id");
  const nombre = localStorage.getItem("usuario_nombre");
  const rol    = localStorage.getItem("usuario_rol");
  if (!id || !nombre || !rol) return null;
  return { id, nombre, rol, nit: localStorage.getItem("usuario_nit") || null };
}

// ─── Fetch al backend ────────────────────────────────────────────────────────
export async function api(path, { method = "GET", body, form } = {}) {
  const token   = localStorage.getItem("token") ?? "";
  const headers = { Authorization: `Bearer ${token}` };
  let payload;
  if (form) {
    payload = form;                          // FormData: el navegador pone el Content-Type
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let resp;
  try {
    resp = await fetch(`${API}${path}`, { method, headers, body: payload });
  } catch (_) {
    throw new Error("Error de conexión. Verificá tu red e intentá de nuevo.");
  }

  const data = await resp.json().catch(() => ({}));

  if (resp.status === 401) {
    window.dispatchEvent(new CustomEvent("sesion-expirada", { detail: data.detail }));
  }
  if (!resp.ok) {
    // FastAPI devuelve detail como string, o como lista en errores de validación
    const d = data?.detail;
    const msg = Array.isArray(d)
      ? d.map(e => e.msg).join(" · ")
      : d || `Error ${resp.status}`;
    throw new Error(msg);
  }
  return data;
}

// ─── Descarga de archivos (Excel) ────────────────────────────────────────────
// El endpoint exige el token en un header, así que no sirve un <a href>:
// se pide con fetch, se arma un blob y se dispara la descarga.
export async function descargar(path, nombreArchivo) {
  const token = localStorage.getItem("token") ?? "";
  let resp;
  try {
    resp = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  } catch (_) {
    throw new Error("Error de conexión. Verificá tu red e intentá de nuevo.");
  }
  if (resp.status === 401) window.dispatchEvent(new CustomEvent("sesion-expirada"));
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data?.detail || `Error ${resp.status}`);
  }
  const url = URL.createObjectURL(await resp.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Fechas en hora de Bolivia (los reportes cuentan los días así) ───────────
export function hoyBolivia(offsetDias = 0) {
  const d = new Date(Date.now() + offsetDias * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz" }).format(d); // AAAA-MM-DD
}

// "2026-10-01" → "mié 01/10"
export function fechaCorta(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dia = new Intl.DateTimeFormat("es-BO", { weekday: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, d))).replace(".", "");
  return `${dia} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

// ─── Formatos ────────────────────────────────────────────────────────────────
const fmtBs = new Intl.NumberFormat("es-BO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatoBs(valor) {
  const n = Number(valor);
  return isNaN(n) ? "—" : `Bs ${fmtBs.format(n)}`;
}

export function iniciales(nombre = "") {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? "")
    .join("");
}
