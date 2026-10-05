// -*- coding: utf-8 -*-
/**
 * Catalogo.jsx — Catálogo de solo lectura (lo que ve el cliente)
 * ----------------------------------------------------------------
 * 1. Portada: una tarjeta grande por LÍNEA (Kenvue, Kimberly-Clark) con su logo.
 *    Tocar una línea muestra solo sus productos. Si se escribe en el buscador
 *    de la portada, se busca en todas las líneas a la vez.
 * 2. Productos de la línea: grilla con imagen · nombre · precio · descripción,
 *    en el orden del catálogo oficial (lo ordena el backend).
 * Tocar una tarjeta abre el detalle. No hay ninguna acción de edición.
 *
 * Para agregar una línea nueva: sumarla a LINEAS (id = como figura la columna
 * LINEA en el Excel) y poner su logo en src/assets. Los productos con una línea
 * que no está en LINEAS (o sin línea) aparecen en la tarjeta "Otros productos".
 *
 * Props:
 *   vistaPrevia  boolean — true cuando el admin lo mira desde "Vista cliente"
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { C, FONT, api, formatoBs } from "../api";
import { BarraBusqueda, BannerError, EstadoVacio, Modal, Skeleton } from "../components/ui";
import logoKenvue   from "../assets/linea_kenvue.png";
import logoKimberly from "../assets/linea_kimberly.png";

// ─── Líneas del catálogo ──────────────────────────────────────────────────────
export const LINEAS = [
  { id: "KENVUE",   nombre: "Kenvue",         logo: logoKenvue,   fondo: "#019B81" },
  { id: "KIMBERLY", nombre: "Kimberly-Clark", logo: logoKimberly, fondo: "#FFFFFF" },
];
const OTROS = { id: "__otros", nombre: "Otros productos", logo: null, fondo: C.navy };
const lineaDe = (p) => (LINEAS.some(l => l.id === (p.linea ?? "").toUpperCase()) ? p.linea.toUpperCase() : OTROS.id);

const S = {
  page: {
    minHeight: "calc(100vh - 56px)", background: C.gray50, fontFamily: FONT,
    padding: "18px 1rem 2.5rem",
  },
  contenedor: { maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "14px" },
  encabezado: {
    display: "flex", alignItems: "flex-end", justifyContent: "space-between",
    gap: "10px", flexWrap: "wrap",
  },
  titulo: { fontSize: "22px", fontWeight: 700, color: C.navy, letterSpacing: "-0.3px" },
  subtitulo: { fontSize: "13px", color: C.gray600, marginTop: "3px" },
  barra: {
    display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap",
    position: "sticky", top: "56px", zIndex: 40,
    background: C.gray50, padding: "6px 0",
  },
  contador: { fontSize: "12.5px", color: C.gray600, whiteSpace: "nowrap" },
  avisoPrevia: {
    display: "flex", alignItems: "center", gap: "8px",
    background: C.amberLight, border: `1px solid rgba(233,168,37,0.4)`,
    color: "#8A6100", fontSize: "13px", fontWeight: 500,
    padding: "10px 14px", borderRadius: "10px",
  },
  grilla: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
    gap: "12px",
  },
  tarjeta: (hover) => ({
    background: C.white, borderRadius: "14px",
    border: `1px solid ${hover ? "#D8D8E0" : C.border}`,
    overflow: "hidden", display: "flex", flexDirection: "column",
    cursor: "pointer", textAlign: "left", padding: 0, fontFamily: "inherit",
    boxShadow: hover ? "0 8px 22px rgba(26,26,46,0.10)" : "0 1px 2px rgba(0,0,0,0.03)",
    transform: hover ? "translateY(-2px)" : "none",
    transition: "box-shadow 0.15s, transform 0.15s, border-color 0.15s",
    WebkitTapHighlightColor: "transparent",
  }),
  imgWrap: {
    aspectRatio: "1 / 1", background: C.gray100,
    display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  img: { width: "100%", height: "100%", objectFit: "contain", padding: "10px", background: C.white },
  cuerpo: { padding: "11px 12px 13px", display: "flex", flexDirection: "column", gap: "5px", flex: 1 },
  nombre: {
    fontSize: "14px", fontWeight: 600, color: C.navy, lineHeight: 1.3,
    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
  },
  porUnidad: { fontSize: "11px", fontWeight: 500, color: C.gray400 },
  precio: { fontSize: "16px", fontWeight: 700, color: C.red, fontVariantNumeric: "tabular-nums" },
  descripcion: {
    fontSize: "12.5px", color: C.gray600, lineHeight: 1.45,
    display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
  },
};

const RESPONSIVE_CSS = `
  @media (min-width: 640px) {
    .catalogo-grilla { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)) !important; gap: 16px !important; }
    .catalogo-lineas { grid-template-columns: repeat(2, 1fr) !important; gap: 20px !important; }
  }
`;

const L = {
  grilla: { display: "grid", gridTemplateColumns: "1fr", gap: "14px" },
  tarjeta: (hover) => ({
    background: C.white, borderRadius: "18px", overflow: "hidden", padding: 0,
    border: `1px solid ${hover ? "#D8D8E0" : C.border}`, cursor: "pointer", textAlign: "left",
    fontFamily: "inherit", display: "flex", flexDirection: "column",
    boxShadow: hover ? "0 12px 30px rgba(26,26,46,0.14)" : "0 2px 6px rgba(26,26,46,0.05)",
    transform: hover ? "translateY(-3px)" : "none",
    transition: "box-shadow 0.18s, transform 0.18s, border-color 0.18s",
    WebkitTapHighlightColor: "transparent",
  }),
  imagen: (fondo) => ({
    aspectRatio: "3 / 2", background: fondo, display: "flex", alignItems: "center", justifyContent: "center",
    borderBottom: `1px solid ${C.gray100}`,
  }),
  pie: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
    padding: "14px 18px",
  },
  nombre: { fontSize: "17px", fontWeight: 700, color: C.navy },
  cantidad: { fontSize: "12.5px", color: C.gray600, marginTop: "2px" },
  flecha: (hover) => ({
    fontSize: "13px", fontWeight: 600, color: hover ? C.white : C.red,
    background: hover ? C.red : C.redLight, borderRadius: "20px", padding: "7px 14px",
    whiteSpace: "nowrap", transition: "background 0.18s, color 0.18s",
  }),
  volver: {
    display: "inline-flex", alignItems: "center", gap: "6px", alignSelf: "flex-start",
    border: "none", background: "transparent", color: C.gray600, fontSize: "13.5px", fontWeight: 600,
    cursor: "pointer", padding: "6px 2px", fontFamily: "inherit",
  },
  cabecera: { display: "flex", alignItems: "center", gap: "14px" },
  miniLogo: (fondo) => ({
    width: "84px", aspectRatio: "3 / 2", borderRadius: "10px", overflow: "hidden", flexShrink: 0,
    background: fondo, border: `1px solid ${C.border}`,
  }),
};

// ─── Imagen o placeholder ─────────────────────────────────────────────────────
export function ImagenProducto({ url, alt, estilo }) {
  const [fallo, setFallo] = useState(false);
  if (!url || fallo) {
    return (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: "#C8C8D0" }}>
        <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    );
  }
  return <img src={url} alt={alt} loading="lazy" onError={() => setFallo(true)} style={estilo ?? S.img} />;
}

function Tarjeta({ producto, onAbrir }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      style={S.tarjeta(hover)}
      onClick={() => onAbrir(producto)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={`${producto.nombre}, ${formatoBs(producto.precio)}`}
    >
      <div style={S.imgWrap}>
        <ImagenProducto url={producto.imagen_url} alt={producto.nombre} />
      </div>
      <div style={S.cuerpo}>
        <div style={S.nombre}>{producto.nombre}</div>
        <div style={S.precio}>{formatoBs(producto.precio)} <span style={S.porUnidad}>por unidad</span></div>
        {producto.descripcion && <div style={S.descripcion}>{producto.descripcion}</div>}
      </div>
    </button>
  );
}

// ─── Tarjeta grande de una línea (portada) ───────────────────────────────────
function TarjetaLinea({ linea, cantidad, onAbrir }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      style={L.tarjeta(hover)}
      onClick={() => onAbrir(linea.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={`Ver productos de ${linea.nombre} (${cantidad})`}
    >
      <div style={L.imagen(linea.fondo)}>
        {linea.logo
          ? <img src={linea.logo} alt={linea.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ color: C.white, fontSize: "26px", fontWeight: 700 }}>{linea.nombre}</span>}
      </div>
      <div style={L.pie}>
        <div>
          <div style={L.nombre}>{linea.nombre}</div>
          <div style={L.cantidad}>{cantidad} {cantidad === 1 ? "producto" : "productos"}</div>
        </div>
        <span style={L.flecha(hover)}>Ver productos →</span>
      </div>
    </button>
  );
}

function MiniLogo({ linea }) {
  return (
    <div style={L.miniLogo(linea.fondo)}>
      {linea.logo && <img src={linea.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Catalogo({ vistaPrevia = false }) {
  const [productos,  setProductos]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [busqueda,   setBusqueda]   = useState("");
  const [detalle,    setDetalle]    = useState(null);
  const [lineaSel,   setLineaSel]   = useState(null);   // null = portada con las líneas

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProductos(await api("/api/productos/catalogo"));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Cuántos productos tiene cada línea (para las tarjetas de la portada)
  const porLinea = useMemo(() => {
    const cuenta = {};
    productos.forEach(p => { const l = lineaDe(p); cuenta[l] = (cuenta[l] ?? 0) + 1; });
    return cuenta;
  }, [productos]);

  const lineasPortada = useMemo(
    () => [...LINEAS, OTROS].filter(l => porLinea[l.id]),
    [porLinea]
  );
  const lineaActual = lineaSel ? ([...LINEAS, OTROS].find(l => l.id === lineaSel) ?? null) : null;

  // Búsqueda local: el catálogo ya está cargado entero, no hace falta ir al backend.
  // El orden es el que manda el backend (el del catálogo oficial).
  const visibles = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    const base = lineaSel ? productos.filter(p => lineaDe(p) === lineaSel) : productos;
    if (!t) return base;
    return base.filter(p =>
      p.nombre.toLowerCase().includes(t) || (p.descripcion ?? "").toLowerCase().includes(t)
    );
  }, [productos, busqueda, lineaSel]);

  function abrirLinea(id) {
    setLineaSel(id);
    setBusqueda("");
    window.scrollTo({ top: 0 });
  }

  function volverALineas() {
    setLineaSel(null);
    setBusqueda("");
    window.scrollTo({ top: 0 });
  }

  // En la portada sin búsqueda se muestran las líneas; si se busca, los productos
  const enPortada = !lineaSel && !busqueda.trim();

  const cerrarDetalle = useCallback(() => setDetalle(null), []);

  return (
    <div style={S.page}>
      <style>{RESPONSIVE_CSS}</style>
      <div style={S.contenedor}>

        {vistaPrevia && (
          <div style={S.avisoPrevia}>
            👁️ Así ven el catálogo tus clientes. Los productos inactivos no aparecen acá.
          </div>
        )}

        {lineaActual ? (
          <>
            <button type="button" style={L.volver} onClick={volverALineas}>← Todas las líneas</button>
            <div style={L.cabecera}>
              <MiniLogo linea={lineaActual} />
              <div>
                <h1 style={S.titulo}>{lineaActual.nombre}</h1>
                <p style={S.subtitulo}>Precios y presentaciones vigentes</p>
              </div>
            </div>
          </>
        ) : (
          <div style={S.encabezado}>
            <div>
              <h1 style={S.titulo}>Catálogo de productos</h1>
              <p style={S.subtitulo}>Elegí una línea para ver sus productos</p>
            </div>
          </div>
        )}

        <div style={S.barra}>
          <BarraBusqueda value={busqueda} onChange={setBusqueda}
            placeholder={lineaActual ? `Buscar en ${lineaActual.nombre}…` : "Buscar en todo el catálogo…"} />
          {!loading && !error && !enPortada && (
            <span style={S.contador}>
              {visibles.length} {visibles.length === 1 ? "producto" : "productos"}
            </span>
          )}
        </div>

        <BannerError mensaje={error} onReintentar={cargar} />

        {loading && (lineaSel ? (
          <div className="catalogo-grilla" style={S.grilla}>
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} height={280} radius={14} />)}
          </div>
        ) : (
          <div className="catalogo-lineas" style={L.grilla}>
            {LINEAS.map(l => <Skeleton key={l.id} height={300} radius={18} />)}
          </div>
        ))}

        {!loading && !error && enPortada && productos.length > 0 && (
          <div className="catalogo-lineas" style={L.grilla}>
            {lineasPortada.map(l => (
              <TarjetaLinea key={l.id} linea={l} cantidad={porLinea[l.id]} onAbrir={abrirLinea} />
            ))}
          </div>
        )}

        {!loading && !error && productos.length === 0 && (
          <EstadoVacio icono="📦" titulo="Todavía no hay productos"
            texto="Cuando tu asesor de ventas cargue productos, los vas a ver acá." />
        )}

        {!loading && !enPortada && productos.length > 0 && visibles.length === 0 && (
          <EstadoVacio titulo="Sin resultados" texto={busqueda
            ? `No encontramos productos para «${busqueda}»${lineaActual ? ` en ${lineaActual.nombre}` : ""}.`
            : "Esta línea todavía no tiene productos."} />
        )}

        {!loading && !enPortada && visibles.length > 0 && (
          <div className="catalogo-grilla" style={S.grilla}>
            {visibles.map(p => <Tarjeta key={p.id} producto={p} onAbrir={setDetalle} />)}
          </div>
        )}
      </div>

      {/* ── Detalle (solo lectura) ─────────────────────────────────── */}
      <Modal abierto={!!detalle} titulo={detalle?.nombre ?? ""} onCerrar={cerrarDetalle} ancho={520}>
        {detalle && (
          <>
            <div style={{ ...S.imgWrap, aspectRatio: "4 / 3", borderRadius: "12px", background: C.white, border: `1px solid ${C.gray100}` }}>
              <ImagenProducto url={detalle.imagen_url} alt={detalle.nombre}
                estilo={{ width: "100%", height: "100%", objectFit: "contain", padding: "14px" }} />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "10px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: C.gray600, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                Precio
              </span>
              <span style={{ ...S.precio, fontSize: "24px" }}>{formatoBs(detalle.precio)} <span style={S.porUnidad}>por unidad</span></span>
            </div>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: C.gray600, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "6px" }}>
                Descripción
              </div>
              <p style={{ fontSize: "14.5px", color: C.navy, lineHeight: 1.6, whiteSpace: "pre-line" }}>
                {detalle.descripcion || "Sin descripción."}
              </p>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}