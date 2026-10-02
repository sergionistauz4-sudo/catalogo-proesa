// -*- coding: utf-8 -*-
/**
 * App.jsx — Punto de entrada de la aplicación
 * ---------------------------------------------
 * Maneja el estado global de sesión y el routing entre pantallas:
 *   · Login
 *   · Cliente (farmacéutico): solo el Catálogo (lectura)
 *   · Admin (asesor de ventas): Productos (CRUD) · Clientes (CRUD) · Accesos (reporte) · Vista cliente
 *
 * No usa react-router — el routing es por estado simple dado que son
 * pocas páginas post-login.
 *
 * Para levantar el proyecto:
 *   cd frontend
 *   npm install
 *   # Crear .env con VITE_API_URL=http://localhost:8000
 *   npm run dev
 */

import { useState, useEffect, useCallback } from "react";

import Login            from "./pages/Login";
import Catalogo         from "./pages/Catalogo";
import GestionProductos from "./pages/GestionProductos";
import GestionClientes  from "./pages/GestionClientes";
import ReporteAccesos   from "./pages/ReporteAccesos";
import Navbar           from "./components/Navbar";
import { API, C, FONT, limpiarSesionLocal, usuarioLocal } from "./api";

function paginaInicial(usuario) {
  return usuario?.rol === "admin" ? "productos" : "catalogo";
}

export default function App() {
  // ── Estado global de sesión ──────────────────────────────────────────────
  const [usuario,      setUsuario]      = useState(null);
  const [paginaActual, setPaginaActual] = useState("catalogo");
  const [verificando,  setVerificando]  = useState(true);

  // ── Limpiar sesión ────────────────────────────────────────────────────────
  const limpiarSesion = useCallback(() => {
    limpiarSesionLocal();
    setUsuario(null);
    setPaginaActual("catalogo");
  }, []);

  // ── Al montar: si hay token guardado, validarlo y restaurar la sesión ────
  useEffect(() => {
    async function restaurarSesion() {
      const token = localStorage.getItem("token");
      if (!token) { setVerificando(false); return; }

      try {
        const resp = await fetch(`${API.replace(/\/+$/, "")}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) {
          const data = await resp.json();
          setUsuario(data.usuario);
          setPaginaActual(paginaInicial(data.usuario));
        } else {
          limpiarSesion();  // token expirado, inválido, o cuenta bloqueada
        }
      } catch (_) {
        // Sin conexión → mantener sesión local por ahora
        const local = usuarioLocal();
        if (local) {
          setUsuario(local);
          setPaginaActual(paginaInicial(local));
        }
      } finally {
        setVerificando(false);
      }
    }
    restaurarSesion();
  }, [limpiarSesion]);

  // ── Si cualquier llamada al backend devuelve 401, volver al login ────────
  useEffect(() => {
    window.addEventListener("sesion-expirada", limpiarSesion);
    return () => window.removeEventListener("sesion-expirada", limpiarSesion);
  }, [limpiarSesion]);

  function handleLoginSuccess(u) {
    setUsuario(u);
    setPaginaActual(paginaInicial(u));
  }

  // ── Pantalla de verificación inicial ─────────────────────────────────────
  if (verificando) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: C.gray50, fontFamily: FONT, flexDirection: "column", gap: "14px",
      }}>
        <div style={{
          width: "44px", height: "44px", background: C.red, borderRadius: "12px",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, fontSize: "17px", color: "#fff",
        }}>CP</div>
        <svg width="22" height="22" viewBox="0 0 22 22" style={{ animation: "spin 0.75s linear infinite" }}>
          <circle cx="11" cy="11" r="9" fill="none" stroke="#E6E6E6" strokeWidth="2.5"/>
          <path d="M11 2 A9 9 0 0 1 20 11" fill="none" stroke={C.red} strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
        <span style={{ fontSize: "13px", color: C.gray400 }}>Verificando sesión…</span>
      </div>
    );
  }

  // ── Pantalla de login ─────────────────────────────────────────────────────
  if (!usuario) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const esAdmin = usuario.rol === "admin";

  // ── App principal (post-login) ────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: C.gray50 }}>
      <Navbar
        usuario={usuario}
        paginaActual={paginaActual}
        onNavegar={setPaginaActual}
        onLogout={limpiarSesion}
      />

      {/* Cliente: siempre el catálogo. Admin: según la pestaña. */}
      {(!esAdmin || paginaActual === "catalogo") && <Catalogo vistaPrevia={esAdmin} />}
      {esAdmin && paginaActual === "productos" && <GestionProductos />}
      {esAdmin && paginaActual === "clientes"  && <GestionClientes />}
      {esAdmin && paginaActual === "accesos"   && <ReporteAccesos />}
    </div>
  );
}
