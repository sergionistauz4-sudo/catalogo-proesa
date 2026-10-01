// -*- coding: utf-8 -*-
/**
 * GestionProductos.jsx — CRUD de productos (solo admin)
 * -------------------------------------------------------
 * Lista con búsqueda y filtro Todos / Visibles / Ocultos.
 * "Nuevo producto" y "Editar" abren el mismo formulario:
 *   nombre · precio · descripción · imagen · visible para clientes
 * Desde el formulario de edición también se puede eliminar.
 *
 * "Oculto" (activo=false) = no aparece en el catálogo del cliente,
 * pero no se borra — sirve para pausar un producto sin perderlo.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { C, FONT, api, formatoBs } from "../api";
import {
  BarraBusqueda, BannerError, Boton, Campo, EstadoVacio, Interruptor,
  Modal, Segmentado, Skeleton, Toast, useToast, TOUCH,
} from "../components/ui";
import { ImagenProducto } from "./Catalogo";

const FILTROS = [
  { id: "todos",    label: "Todos"    },
  { id: "visibles", label: "Visibles" },
  { id: "ocultos",  label: "Ocultos"  },
];

const S = {
  page: { minHeight: "calc(100vh - 100px)", background: C.gray50, fontFamily: FONT, padding: "18px 1rem 2.5rem" },
  contenedor: { maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "14px" },
  encabezado: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" },
  titulo: { fontSize: "22px", fontWeight: 700, color: C.navy, letterSpacing: "-0.3px" },
  subtitulo: { fontSize: "13px", color: C.gray600, marginTop: "3px" },
  barra: { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" },
  lista: {
    background: C.white, borderRadius: "12px", border: `1px solid ${C.border}`, overflow: "hidden",
  },
  fila: (ultima) => ({
    display: "flex", alignItems: "center", gap: "12px", padding: "11px 14px",
    borderBottom: ultima ? "none" : `1px solid ${C.gray100}`, minHeight: "68px",
  }),
  thumb: {
    width: "52px", height: "52px", borderRadius: "9px", background: C.gray100, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  info: { flex: 1, minWidth: 0 },
  nombre: {
    fontSize: "14px", fontWeight: 600, color: C.navy,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  desc: {
    fontSize: "12px", color: C.gray600, marginTop: "2px",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  derecha: { display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 },
  precio: { fontSize: "14px", fontWeight: 700, color: C.navy, fontVariantNumeric: "tabular-nums", textAlign: "right" },
  chip: (visible) => ({
    fontSize: "10.5px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", whiteSpace: "nowrap",
    color: visible ? C.green : C.gray600, background: visible ? C.greenLight : C.gray100,
  }),
  imgEditor: {
    display: "flex", gap: "14px", alignItems: "center",
    padding: "12px", borderRadius: "10px", border: `1px dashed ${C.gray200}`, background: C.gray50,
  },
  imgPreview: {
    width: "96px", height: "96px", borderRadius: "10px", background: C.white,
    border: `1px solid ${C.gray100}`, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  labelSeccion: {
    fontSize: "11.5px", fontWeight: 600, color: C.gray600, letterSpacing: "0.4px",
    textTransform: "uppercase", marginBottom: "7px",
  },
};

const RESPONSIVE_CSS = `
  .gp-precio-col { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
  .gp-btn-editar-txt { display: none; }
  @media (min-width: 640px) { .gp-btn-editar-txt { display: inline; } }
`;

const FORM_VACIO = { nombre: "", precio: "", descripcion: "", activo: true };

// ─── Formulario (crear / editar) ──────────────────────────────────────────────
function FormProducto({ producto, onCerrar, onGuardado, onEliminado, mostrarToast }) {
  const esNuevo = !producto?.id;
  const [form, setForm] = useState(() => esNuevo ? FORM_VACIO : {
    nombre:      producto.nombre,
    precio:      String(producto.precio ?? ""),
    descripcion: producto.descripcion ?? "",
    activo:      producto.activo,
  });
  const [archivo,      setArchivo]      = useState(null);   // File nuevo a subir
  const [previewLocal, setPreviewLocal] = useState(null);
  const [quitarImagen, setQuitarImagen] = useState(false);
  const [errores,      setErrores]      = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [guardando,    setGuardando]    = useState(false);
  const [eliminando,   setEliminando]   = useState(false);

  useEffect(() => {
    if (!archivo) { setPreviewLocal(null); return; }
    const url = URL.createObjectURL(archivo);
    setPreviewLocal(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  const set = (campo) => (valor) => {
    setForm(f => ({ ...f, [campo]: valor }));
    setErrores(e => ({ ...e, [campo]: null }));
  };

  const imagenActual = previewLocal ?? (quitarImagen ? null : producto?.imagen_url);

  function elegirArchivo(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      setErrorGeneral("Formato no permitido. Usá JPG, PNG o WEBP."); return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setErrorGeneral("La imagen supera el límite de 5 MB."); return;
    }
    setErrorGeneral(null);
    setArchivo(f);
    setQuitarImagen(false);
  }

  function validar() {
    const e = {};
    if (!form.nombre.trim()) e.nombre = "Escribí el nombre del producto.";
    const precio = parseFloat(String(form.precio).replace(",", "."));
    if (String(form.precio).trim() === "" || isNaN(precio)) e.precio = "Ingresá un precio válido.";
    else if (precio < 0) e.precio = "El precio no puede ser negativo.";
    setErrores(e);
    return Object.keys(e).length === 0 ? precio : null;
  }

  async function guardar() {
    const precio = validar();
    if (precio === null) return;
    setGuardando(true);
    setErrorGeneral(null);

    const body = {
      nombre:      form.nombre.trim(),
      precio,
      descripcion: form.descripcion.trim(),
      activo:      form.activo,
    };

    let guardado;
    try {
      guardado = esNuevo
        ? await api("/api/productos", { method: "POST", body })
        : await api(`/api/productos/${producto.id}`, { method: "PUT", body });
    } catch (e) {
      setErrorGeneral(e.message);
      setGuardando(false);
      return;
    }

    // Imagen: el producto ya quedó guardado; si la imagen falla, avisamos
    // sin perder lo demás.
    try {
      if (archivo) {
        const fd = new FormData();
        fd.append("imagen", archivo);
        const img = await api(`/api/productos/${guardado.id}/imagen`, { method: "POST", form: fd });
        guardado = { ...guardado, imagen_url: img.imagen_url };
      } else if (quitarImagen && producto?.imagen_url) {
        guardado = await api(`/api/productos/${guardado.id}/imagen`, { method: "DELETE" });
      }
      mostrarToast(esNuevo ? "✓ Producto creado" : "✓ Cambios guardados");
    } catch (e) {
      mostrarToast(`Producto guardado, pero la imagen falló: ${e.message}`, "error");
    }

    setGuardando(false);
    onGuardado(guardado);
  }

  async function eliminar() {
    if (!confirm(`¿Eliminar «${producto.nombre}» definitivamente?\n\nSi solo querés que los clientes no lo vean, desactivá "Visible para clientes".`)) return;
    setEliminando(true);
    try {
      await api(`/api/productos/${producto.id}`, { method: "DELETE" });
      mostrarToast("Producto eliminado");
      onEliminado(producto.id);
    } catch (e) {
      setErrorGeneral(e.message);
      setEliminando(false);
    }
  }

  return (
    <Modal
      abierto
      titulo={esNuevo ? "Nuevo producto" : "Editar producto"}
      onCerrar={guardando ? undefined : onCerrar}
      ancho={520}
      pie={
        <>
          {!esNuevo && (
            <div style={{ marginRight: "auto" }}>
              <Boton variante="peligro" onClick={eliminar} loading={eliminando} disabled={guardando}>
                Eliminar
              </Boton>
            </div>
          )}
          <Boton variante="secundario" onClick={onCerrar} disabled={guardando || eliminando}>Cancelar</Boton>
          <Boton onClick={guardar} loading={guardando} disabled={eliminando}>
            {esNuevo ? "Crear producto" : "Guardar cambios"}
          </Boton>
        </>
      }
    >
      <Campo label="Nombre del producto" value={form.nombre} onChange={set("nombre")}
        placeholder="Ej: Paracetamol 500 mg x 100 comp." error={errores.nombre} autoFocus={esNuevo} />

      <Campo label="Precio" value={form.precio} onChange={set("precio")} prefijo="Bs"
        type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" error={errores.precio} />

      <Campo label="Descripción" value={form.descripcion} onChange={set("descripcion")} multilinea
        placeholder="Presentación, laboratorio, indicaciones, etc." />

      <div>
        <div style={S.labelSeccion}>Imagen</div>
        <div style={S.imgEditor}>
          <div style={S.imgPreview}>
            <ImagenProducto url={imagenActual} alt="Vista previa"
              estilo={{ width: "100%", height: "100%", objectFit: "contain", padding: "6px" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 }}>
            <label style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px",
              height: `${TOUCH - 8}px`, padding: "0 14px", borderRadius: "8px",
              background: C.white, border: `1.5px solid ${C.gray200}`, color: C.navy,
              fontSize: "13px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
            }}>
              📷 {imagenActual ? "Cambiar imagen" : "Elegir imagen"}
              <input type="file" accept="image/jpeg,image/png,image/webp"
                onChange={elegirArchivo} style={{ display: "none" }} />
            </label>
            {imagenActual && (
              <Boton variante="fantasma" chico onClick={() => { setArchivo(null); setQuitarImagen(true); }}>
                Quitar imagen
              </Boton>
            )}
            <span style={{ fontSize: "11.5px", color: C.gray400 }}>JPG, PNG o WEBP · máx. 5 MB</span>
          </div>
        </div>
      </div>

      <Interruptor
        checked={form.activo}
        onChange={set("activo")}
        label="Visible para clientes"
        descripcion={form.activo ? "Aparece en el catálogo" : "Oculto: los clientes no lo ven"}
      />

      {errorGeneral && <BannerError mensaje={errorGeneral} />}
    </Modal>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function GestionProductos() {
  const [productos, setProductos] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [busqueda,  setBusqueda]  = useState("");
  const [filtro,    setFiltro]    = useState("todos");
  const [editando,  setEditando]  = useState(null);   // null | {} (nuevo) | producto
  const [toast, mostrarToast]     = useToast();

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProductos(await api("/api/productos"));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const visibles = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    return productos
      .filter(p => filtro === "todos" || (filtro === "visibles" ? p.activo : !p.activo))
      .filter(p => !t || p.nombre.toLowerCase().includes(t) || (p.descripcion ?? "").toLowerCase().includes(t));
  }, [productos, busqueda, filtro]);

  const totalVisibles = productos.filter(p => p.activo).length;

  function handleGuardado(prod) {
    setProductos(prev => {
      const existe = prev.some(p => p.id === prod.id);
      const lista  = existe ? prev.map(p => (p.id === prod.id ? prod : p)) : [...prev, prod];
      return lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    });
    setEditando(null);
  }

  function handleEliminado(id) {
    setProductos(prev => prev.filter(p => p.id !== id));
    setEditando(null);
  }

  const cerrar = useCallback(() => setEditando(null), []);

  return (
    <div style={S.page}>
      <style>{RESPONSIVE_CSS}</style>
      <div style={S.contenedor}>

        <div style={S.encabezado}>
          <div>
            <h1 style={S.titulo}>Productos</h1>
            <p style={S.subtitulo}>
              {loading ? "Cargando…" : `${productos.length} en total · ${totalVisibles} visibles para clientes`}
            </p>
          </div>
          <Boton onClick={() => setEditando({})}>＋ Nuevo producto</Boton>
        </div>

        <div style={S.barra}>
          <BarraBusqueda value={busqueda} onChange={setBusqueda} placeholder="Buscar producto…" />
          <Segmentado opciones={FILTROS} valor={filtro} onChange={setFiltro} />
        </div>

        <BannerError mensaje={error} onReintentar={cargar} />

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={68} />)}
          </div>
        )}

        {!loading && !error && productos.length === 0 && (
          <EstadoVacio icono="📦" titulo="Todavía no cargaste productos"
            texto="Creá el primero y va a aparecer en el catálogo de tus clientes.">
            <div style={{ marginTop: "8px" }}>
              <Boton onClick={() => setEditando({})}>＋ Nuevo producto</Boton>
            </div>
          </EstadoVacio>
        )}

        {!loading && productos.length > 0 && visibles.length === 0 && (
          <EstadoVacio titulo="Sin resultados" texto="Probá con otra búsqueda o cambiá el filtro." />
        )}

        {!loading && visibles.length > 0 && (
          <div style={S.lista}>
            {visibles.map((p, i) => (
              <div key={p.id} style={S.fila(i === visibles.length - 1)}>
                <div style={S.thumb}>
                  <ImagenProducto url={p.imagen_url} alt={p.nombre}
                    estilo={{ width: "100%", height: "100%", objectFit: "contain", padding: "4px", background: C.white }} />
                </div>
                <div style={S.info}>
                  <div style={S.nombre} title={p.nombre}>{p.nombre}</div>
                  <div style={S.desc}>{p.descripcion || "Sin descripción"}</div>
                </div>
                <div style={S.derecha}>
                  <div className="gp-precio-col">
                    <span style={S.precio}>{formatoBs(p.precio)}</span>
                    <span style={S.chip(p.activo)}>{p.activo ? "Visible" : "Oculto"}</span>
                  </div>
                  <Boton variante="secundario" chico onClick={() => setEditando(p)} ariaLabel={`Editar ${p.nombre}`}>
                    ✏️<span className="gp-btn-editar-txt">Editar</span>
                  </Boton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editando && (
        <FormProducto
          key={editando.id ?? "nuevo"}
          producto={editando}
          onCerrar={cerrar}
          onGuardado={handleGuardado}
          onEliminado={handleEliminado}
          mostrarToast={mostrarToast}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}
