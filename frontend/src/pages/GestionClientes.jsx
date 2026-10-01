// -*- coding: utf-8 -*-
/**
 * GestionClientes.jsx — CRUD de clientes / farmacéuticos (solo admin)
 * ---------------------------------------------------------------------
 * Cada cliente entra al catálogo con su NOMBRE + su NIT (contraseña).
 * Lista con búsqueda (por nombre o NIT) y filtro Todos / Activos / Bloqueados.
 * "Bloqueado" (activo=false) = no puede iniciar sesión, pero el registro
 * se conserva. Eliminar lo borra definitivamente.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { C, FONT, api, iniciales } from "../api";
import {
  BarraBusqueda, BannerError, Boton, Campo, EstadoVacio, Interruptor,
  Modal, Segmentado, Skeleton, Toast, useToast,
} from "../components/ui";

const FILTROS = [
  { id: "todos",      label: "Todos"      },
  { id: "activos",    label: "Activos"    },
  { id: "bloqueados", label: "Bloqueados" },
];

const S = {
  page: { minHeight: "calc(100vh - 100px)", background: C.gray50, fontFamily: FONT, padding: "18px 1rem 2.5rem" },
  contenedor: { maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "14px" },
  encabezado: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" },
  titulo: { fontSize: "22px", fontWeight: 700, color: C.navy, letterSpacing: "-0.3px" },
  subtitulo: { fontSize: "13px", color: C.gray600, marginTop: "3px" },
  barra: { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" },
  lista: { background: C.white, borderRadius: "12px", border: `1px solid ${C.border}`, overflow: "hidden" },
  fila: (ultima) => ({
    display: "flex", alignItems: "center", gap: "12px", padding: "11px 14px",
    borderBottom: ultima ? "none" : `1px solid ${C.gray100}`, minHeight: "62px",
  }),
  avatar: (activo) => ({
    width: "38px", height: "38px", borderRadius: "50%", flexShrink: 0,
    background: activo ? C.navy : C.gray200, color: activo ? C.white : C.gray600,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "12.5px", fontWeight: 700, letterSpacing: "0.5px",
  }),
  info: { flex: 1, minWidth: 0 },
  nombre: { fontSize: "14px", fontWeight: 600, color: C.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  nit: { fontSize: "12px", color: C.gray600, marginTop: "2px", fontVariantNumeric: "tabular-nums" },
  chip: (activo) => ({
    fontSize: "10.5px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", whiteSpace: "nowrap",
    color: activo ? C.green : C.errorText, background: activo ? C.greenLight : C.redLight,
  }),
  ayuda: {
    fontSize: "12.5px", color: C.gray600, lineHeight: 1.5,
    background: C.gray50, border: `1px solid ${C.gray100}`, borderRadius: "10px", padding: "10px 12px",
  },
};

const RESPONSIVE_CSS = `
  .gc-chip { display: none; }
  .gc-btn-editar-txt { display: none; }
  @media (min-width: 480px) { .gc-chip { display: inline-block; } }
  @media (min-width: 640px) { .gc-btn-editar-txt { display: inline; } }
`;

// ─── Formulario (crear / editar) ──────────────────────────────────────────────
function FormCliente({ cliente, onCerrar, onGuardado, onEliminado, mostrarToast }) {
  const esNuevo = !cliente?.id;
  const [form, setForm] = useState({
    nombre: cliente?.nombre ?? "",
    nit:    cliente?.nit ?? "",
    activo: cliente?.activo ?? true,
  });
  const [errores,      setErrores]      = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [guardando,    setGuardando]    = useState(false);
  const [eliminando,   setEliminando]   = useState(false);

  const set = (campo) => (valor) => {
    setForm(f => ({ ...f, [campo]: valor }));
    setErrores(e => ({ ...e, [campo]: null }));
    setErrorGeneral(null);
  };

  async function guardar() {
    const e = {};
    if (!form.nombre.trim()) e.nombre = "Escribí el nombre del cliente.";
    if (!form.nit.replace(/[^0-9a-z]/gi, "")) e.nit = "Ingresá el NIT.";
    setErrores(e);
    if (Object.keys(e).length) return;

    setGuardando(true);
    try {
      const body = { nombre: form.nombre.trim(), nit: form.nit.trim(), activo: form.activo };
      const guardado = esNuevo
        ? await api("/api/clientes", { method: "POST", body })
        : await api(`/api/clientes/${cliente.id}`, { method: "PUT", body });
      mostrarToast(esNuevo ? "✓ Cliente creado" : "✓ Cambios guardados");
      onGuardado(guardado);
    } catch (err) {
      // El 409 de NIT duplicado lo mostramos debajo del campo NIT
      if (/NIT/i.test(err.message)) setErrores({ nit: err.message });
      else setErrorGeneral(err.message);
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!confirm(`¿Eliminar a «${cliente.nombre}» definitivamente?\n\nSi solo querés que no pueda entrar, desactivá "Puede iniciar sesión".`)) return;
    setEliminando(true);
    try {
      await api(`/api/clientes/${cliente.id}`, { method: "DELETE" });
      mostrarToast("Cliente eliminado");
      onEliminado(cliente.id);
    } catch (err) {
      setErrorGeneral(err.message);
      setEliminando(false);
    }
  }

  return (
    <Modal
      abierto
      titulo={esNuevo ? "Nuevo cliente" : "Editar cliente"}
      onCerrar={guardando ? undefined : onCerrar}
      pie={
        <>
          {!esNuevo && (
            <div style={{ marginRight: "auto" }}>
              <Boton variante="peligro" onClick={eliminar} loading={eliminando} disabled={guardando}>Eliminar</Boton>
            </div>
          )}
          <Boton variante="secundario" onClick={onCerrar} disabled={guardando || eliminando}>Cancelar</Boton>
          <Boton onClick={guardar} loading={guardando} disabled={eliminando}>
            {esNuevo ? "Crear cliente" : "Guardar cambios"}
          </Boton>
        </>
      }
    >
      <Campo label="Nombre (usuario)" value={form.nombre} onChange={set("nombre")}
        placeholder="Ej: Farmacia San José" error={errores.nombre} autoFocus={esNuevo} />

      <Campo label="NIT (contraseña)" value={form.nit} onChange={set("nit")}
        placeholder="Ej: 1023456019" inputMode="text" error={errores.nit}
        ayuda="Se guarda sin puntos, guiones ni espacios." />

      <div style={S.ayuda}>
        🔑 El cliente inicia sesión escribiendo este <b>nombre</b> y su <b>NIT</b> como contraseña.
        No importan mayúsculas, tildes ni puntos.
      </div>

      <Interruptor
        checked={form.activo}
        onChange={set("activo")}
        label="Puede iniciar sesión"
        descripcion={form.activo ? "Tiene acceso al catálogo" : "Bloqueado: no puede entrar"}
      />

      {errorGeneral && <BannerError mensaje={errorGeneral} />}
    </Modal>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function GestionClientes() {
  const [clientes, setClientes] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtro,   setFiltro]   = useState("todos");
  const [editando, setEditando] = useState(null);
  const [toast, mostrarToast]   = useToast();

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setClientes(await api("/api/clientes"));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const visibles = useMemo(() => {
    const quitarTildes = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const t   = quitarTildes(busqueda.trim());
    const nit = busqueda.replace(/[^0-9a-z]/gi, "").toUpperCase();
    return clientes
      .filter(c => filtro === "todos" || (filtro === "activos" ? c.activo : !c.activo))
      .filter(c => !t || quitarTildes(c.nombre).includes(t) || (nit && c.nit.includes(nit)));
  }, [clientes, busqueda, filtro]);

  const activos = clientes.filter(c => c.activo).length;

  function handleGuardado(cli) {
    setClientes(prev => {
      const existe = prev.some(c => c.id === cli.id);
      const lista  = existe ? prev.map(c => (c.id === cli.id ? cli : c)) : [...prev, cli];
      return lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    });
    setEditando(null);
  }

  function handleEliminado(id) {
    setClientes(prev => prev.filter(c => c.id !== id));
    setEditando(null);
  }

  const cerrar = useCallback(() => setEditando(null), []);

  return (
    <div style={S.page}>
      <style>{RESPONSIVE_CSS}</style>
      <div style={S.contenedor}>

        <div style={S.encabezado}>
          <div>
            <h1 style={S.titulo}>Clientes</h1>
            <p style={S.subtitulo}>
              {loading ? "Cargando…" : `${clientes.length} en total · ${activos} con acceso`}
            </p>
          </div>
          <Boton onClick={() => setEditando({})}>＋ Nuevo cliente</Boton>
        </div>

        <div style={S.barra}>
          <BarraBusqueda value={busqueda} onChange={setBusqueda} placeholder="Buscar por nombre o NIT…" />
          <Segmentado opciones={FILTROS} valor={filtro} onChange={setFiltro} />
        </div>

        <BannerError mensaje={error} onReintentar={cargar} />

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={62} />)}
          </div>
        )}

        {!loading && !error && clientes.length === 0 && (
          <EstadoVacio icono="👥" titulo="Todavía no hay clientes"
            texto="Agregá tus farmacias una por una, o cargalas todas juntas con el script importar_clientes.py del backend.">
            <div style={{ marginTop: "8px" }}>
              <Boton onClick={() => setEditando({})}>＋ Nuevo cliente</Boton>
            </div>
          </EstadoVacio>
        )}

        {!loading && clientes.length > 0 && visibles.length === 0 && (
          <EstadoVacio titulo="Sin resultados" texto="Probá con otra búsqueda o cambiá el filtro." />
        )}

        {!loading && visibles.length > 0 && (
          <div style={S.lista}>
            {visibles.map((c, i) => (
              <div key={c.id} style={S.fila(i === visibles.length - 1)}>
                <div style={S.avatar(c.activo)}>{iniciales(c.nombre)}</div>
                <div style={S.info}>
                  <div style={S.nombre} title={c.nombre}>{c.nombre}</div>
                  <div style={S.nit}>
                    NIT {c.nit}
                    {!c.activo && <span style={{ color: C.errorText, fontWeight: 600 }}> · bloqueado</span>}
                  </div>
                </div>
                <span className="gc-chip" style={S.chip(c.activo)}>{c.activo ? "Activo" : "Bloqueado"}</span>
                <Boton variante="secundario" chico onClick={() => setEditando(c)} ariaLabel={`Editar ${c.nombre}`}>
                  ✏️<span className="gc-btn-editar-txt">Editar</span>
                </Boton>
              </div>
            ))}
          </div>
        )}
      </div>

      {editando && (
        <FormCliente
          key={editando.id ?? "nuevo"}
          cliente={editando}
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
