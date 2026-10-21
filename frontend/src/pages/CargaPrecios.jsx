// -*- coding: utf-8 -*-
/**
 * CargaPrecios.jsx — Actualización mensual de la lista de precios (solo admin)
 * ------------------------------------------------------------------------------
 * 1. El asesor elige el Excel de precios del mes (.xlsx). De todo el archivo solo
 *    se usan el CÓDIGO del producto y la columna G (precio nuevo).
 * 2. VISTA PREVIA: se muestra qué precios cambian (antes → después), cuáles no
 *    tienen precio nuevo (conservan el actual) y qué códigos no existen. No se
 *    guarda nada todavía.
 * 3. "Aplicar" guarda. Queda en el historial y se puede DESHACER.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { C, FONT, api, formatoBs } from "../api";
import { BarraBusqueda, BannerError, Boton, EstadoVacio, Skeleton, Toast, useToast } from "../components/ui";

const S = {
  page: { minHeight: "calc(100vh - 100px)", background: C.gray50, fontFamily: FONT, padding: "18px 1rem 2.5rem" },
  contenedor: { maxWidth: "1000px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "14px" },
  titulo: { fontSize: "22px", fontWeight: 700, color: C.navy, letterSpacing: "-0.3px" },
  subtitulo: { fontSize: "13px", color: C.gray600, marginTop: "3px", lineHeight: 1.5 },
  zona: (activa) => ({
    border: `2px dashed ${activa ? C.red : "#D5D5DD"}`, background: activa ? C.redLight : C.white,
    borderRadius: "14px", padding: "26px 16px", textAlign: "center", transition: "all 0.15s",
    display: "flex", flexDirection: "column", alignItems: "center", gap: "10px",
  }),
  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px" },
  kpi: { background: C.white, border: `1px solid ${C.border}`, borderRadius: "12px", padding: "12px 14px" },
  kpiN: (color) => ({ fontSize: "26px", fontWeight: 700, color: color ?? C.navy, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }),
  kpiL: { fontSize: "12px", color: C.gray600, marginTop: "3px" },
  lista: { background: C.white, borderRadius: "12px", border: `1px solid ${C.border}`, overflow: "hidden" },
  fila: (ultima) => ({
    display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px",
    borderBottom: ultima ? "none" : `1px solid ${C.gray100}`, minHeight: "56px",
  }),
  info: { flex: 1, minWidth: 0 },
  nombre: { fontSize: "13.5px", fontWeight: 600, color: C.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  meta: { fontSize: "12px", color: C.gray600, marginTop: "2px", fontVariantNumeric: "tabular-nums" },
  precios: { textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", flexShrink: 0 },
  viejo: { fontSize: "12px", color: C.gray400, textDecoration: "line-through" },
  nuevo: { fontSize: "14.5px", fontWeight: 700, color: C.navy },
  chip: (tipo) => ({
    fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", whiteSpace: "nowrap",
    fontVariantNumeric: "tabular-nums",
    color: tipo === "revisar" ? "#8A6100" : tipo === "sube" ? C.errorText : C.green,
    background: tipo === "revisar" ? C.amberLight : tipo === "sube" ? C.redLight : C.greenLight,
  }),
  nota: {
    fontSize: "12.5px", color: C.gray600, lineHeight: 1.5,
    background: C.white, border: `1px solid ${C.gray100}`, borderRadius: "10px", padding: "10px 12px",
  },
  exito: {
    background: C.greenLight, border: `1px solid rgba(42,157,92,0.35)`, color: "#1D7043",
    borderRadius: "12px", padding: "12px 14px", fontSize: "14px", fontWeight: 600,
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap",
  },
  barraAcciones: {
    display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap",
    position: "sticky", bottom: 0, background: C.gray50, padding: "10px 0", zIndex: 30,
  },
  detalles: { background: C.white, border: `1px solid ${C.border}`, borderRadius: "12px", overflow: "hidden" },
  resumen: { padding: "12px 14px", fontSize: "13.5px", fontWeight: 600, color: C.navy, cursor: "pointer" },
};

const fechaHora = (iso) =>
  new Date(iso).toLocaleString("es-BO", { timeZone: "America/La_Paz", dateStyle: "medium", timeStyle: "short" });

function FilaCambio({ c, ultima }) {
  const tipo = c.revisar ? "revisar" : (c.variacion ?? 0) > 0 ? "sube" : "baja";
  const pct = c.variacion == null ? "—" : `${c.variacion > 0 ? "▲ +" : "▼ "}${String(c.variacion).replace(".", ",")}%`;
  return (
    <div style={S.fila(ultima)}>
      <div style={S.info}>
        <div style={S.nombre}>{c.nombre}</div>
        <div style={S.meta}>Cód. {c.codigo}{c.linea ? ` · ${c.linea}` : ""}</div>
      </div>
      <div style={S.precios}>
        <div style={S.viejo}>{formatoBs(c.anterior)}</div>
        <div style={S.nuevo}>{formatoBs(c.nuevo)}</div>
      </div>
      <span style={S.chip(tipo)} title={c.revisar ? "Variación grande: conviene revisarlo" : undefined}>
        {c.revisar ? "⚠ " : ""}{pct}
      </span>
    </div>
  );
}

export default function CargaPrecios() {
  const [archivo,   setArchivo]   = useState(null);
  const [vista,     setVista]     = useState(null);      // respuesta de la vista previa
  const [aplicado,  setAplicado]  = useState(null);      // respuesta al aplicar
  const [leyendo,   setLeyendo]   = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [error,     setError]     = useState(null);
  const [busqueda,  setBusqueda]  = useState("");
  const [arrastrando, setArrastrando] = useState(false);
  const [historial, setHistorial] = useState(null);
  const [deshaciendo, setDeshaciendo] = useState(null);
  const [toast, mostrar] = useToast();
  const inputRef = useRef(null);

  const cargarHistorial = useCallback(async () => {
    try { setHistorial(await api("/api/precios/historial")); } catch (_) { setHistorial([]); }
  }, []);
  useEffect(() => { cargarHistorial(); }, [cargarHistorial]);

  async function subir(file, aplicar) {
    const form = new FormData();
    form.append("archivo", file);
    form.append("aplicar", aplicar ? "true" : "false");
    return api("/api/precios/importar", { method: "POST", form });
  }

  async function elegir(file) {
    if (!file) return;
    setError(null); setVista(null); setAplicado(null); setBusqueda("");
    setArchivo(file); setLeyendo(true);
    try {
      setVista(await subir(file, false));
    } catch (e) {
      setError(e.message); setArchivo(null);
    } finally {
      setLeyendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function cancelar() { setArchivo(null); setVista(null); setError(null); setBusqueda(""); }

  async function aplicar() {
    const n = vista.resumen.cambian;
    if (!confirm(`¿Actualizar el precio de ${n} ${n === 1 ? "producto" : "productos"}?\n\nLos clientes van a ver los precios nuevos al instante. Si algo sale mal, podés deshacerlo desde el historial.`)) return;
    setAplicando(true); setError(null);
    try {
      const r = await subir(archivo, true);
      setAplicado(r); setVista(null); setArchivo(null);
      cargarHistorial();
    } catch (e) {
      setError(e.message);
    } finally {
      setAplicando(false);
    }
  }

  async function deshacer(carga) {
    if (!confirm("¿Deshacer esta carga de precios?\n\nLos productos vuelven al precio que tenían antes. Si alguno lo editaste a mano después, se deja como está.")) return;
    setDeshaciendo(carga.id);
    try {
      const r = await api(`/api/precios/deshacer/${carga.id}`, { method: "POST" });
      mostrar(`✓ Se restauraron ${r.restaurados} precios${r.omitidos ? ` (${r.omitidos} editados a mano se respetaron)` : ""}`);
      setAplicado(null);
      cargarHistorial();
    } catch (e) {
      mostrar(e.message, "error");
    } finally {
      setDeshaciendo(null);
    }
  }

  const cambios = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    const todos = vista?.cambios ?? [];
    return t ? todos.filter(c => c.nombre.toLowerCase().includes(t) || c.codigo.toLowerCase().includes(t)) : todos;
  }, [vista, busqueda]);

  const ultimaActiva = historial?.find(h => !h.revertida);
  const r = vista?.resumen;

  return (
    <div style={S.page}>
      <div style={S.contenedor}>

        <div>
          <h1 style={S.titulo}>Actualizar precios</h1>
          <p style={S.subtitulo}>
            Subí el Excel con la lista de precios del mes. Se usan el <b>código</b> del producto y la <b>columna G</b> (precio nuevo);
            lo demás del archivo se ignora. Primero ves qué cambiaría y recién después lo aplicás.
          </p>
        </div>

        {aplicado && (
          <div style={S.exito}>
            <span>✓ Se actualizaron {aplicado.resumen.cambian} precios con «{aplicado.archivo}».</span>
            {ultimaActiva && (
              <Boton variante="secundario" chico onClick={() => deshacer(ultimaActiva)} loading={deshaciendo === ultimaActiva.id}>
                Deshacer
              </Boton>
            )}
          </div>
        )}

        <BannerError mensaje={error} />

        {/* ── Elegir archivo ───────────────────────────────────────── */}
        {!vista && !leyendo && (
          <div
            style={S.zona(arrastrando)}
            onDragOver={e => { e.preventDefault(); setArrastrando(true); }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={e => { e.preventDefault(); setArrastrando(false); elegir(e.dataTransfer.files?.[0]); }}
          >
            <div style={{ fontSize: "30px" }} aria-hidden="true">📄</div>
            <div style={{ fontSize: "14px", color: C.navy, fontWeight: 600 }}>Arrastrá el Excel acá o elegilo desde tu computadora</div>
            <div style={{ fontSize: "12.5px", color: C.gray600 }}>Formato .xlsx · el archivo puede pesar varios MB, puede tardar unos segundos</div>
            <input ref={inputRef} type="file" accept=".xlsx,.xlsm" style={{ display: "none" }}
              onChange={e => elegir(e.target.files?.[0])} data-testid="archivo-precios" />
            <Boton onClick={() => inputRef.current?.click()}>Elegir archivo</Boton>
          </div>
        )}

        {leyendo && (
          <>
            <div style={{ ...S.nota, textAlign: "center" }}>Leyendo «{archivo?.name}»… esto puede tardar unos segundos.</div>
            <Skeleton height={90} radius={12} />
          </>
        )}

        {/* ── Vista previa ─────────────────────────────────────────── */}
        {vista && (
          <>
            <div style={S.nota}>
              Archivo: <b>{vista.archivo}</b> · hoja «{vista.hoja}» · {r.filas_en_archivo} filas.{" "}
              <b>Todavía no se guardó nada.</b>
            </div>

            <div style={S.kpis}>
              <div style={S.kpi}><div style={S.kpiN(r.cambian ? C.red : C.gray400)}>{r.cambian}</div><div style={S.kpiL}>Precios que cambian</div></div>
              <div style={S.kpi}><div style={S.kpiN()}>{r.sin_cambio}</div><div style={S.kpiL}>Ya estaban al día</div></div>
              <div style={S.kpi}><div style={S.kpiN(r.sin_precio_nuevo ? C.amber : undefined)}>{r.sin_precio_nuevo}</div><div style={S.kpiL}>Sin precio nuevo (se mantienen)</div></div>
              <div style={S.kpi}><div style={S.kpiN(r.no_encontrados ? C.amber : undefined)}>{r.no_encontrados}</div><div style={S.kpiL}>Códigos que no existen</div></div>
            </div>

            {r.a_revisar > 0 && (
              <div style={{ ...S.nota, background: C.amberLight, borderColor: "rgba(233,168,37,0.4)", color: "#8A6100" }}>
                ⚠ {r.a_revisar} {r.a_revisar === 1 ? "precio varía" : "precios varían"} 30 % o más. Revisalos antes de aplicar: puede ser un error del Excel.
              </div>
            )}

            {r.cambian > 0 ? (
              <>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <BarraBusqueda value={busqueda} onChange={setBusqueda} placeholder="Buscar por nombre o código…" />
                  <span style={{ fontSize: "12.5px", color: C.gray600, whiteSpace: "nowrap" }}>
                    {cambios.length} {cambios.length === 1 ? "cambio" : "cambios"}
                  </span>
                </div>
                {cambios.length === 0
                  ? <EstadoVacio titulo="Sin resultados" texto={`No hay cambios para «${busqueda}».`} />
                  : <div style={S.lista}>{cambios.map((c, i) => <FilaCambio key={c.codigo} c={c} ultima={i === cambios.length - 1} />)}</div>}
              </>
            ) : (
              <EstadoVacio icono="✅" titulo="No hay nada que actualizar"
                texto="Todos los precios del archivo ya coinciden con los del catálogo." />
            )}

            {r.sin_precio_nuevo > 0 && (
              <details style={S.detalles}>
                <summary style={S.resumen}>Sin precio nuevo ({r.sin_precio_nuevo}) — conservan el precio actual</summary>
                {vista.ignorados.map((i, k) => (
                  <div key={i.codigo + k} style={S.fila(k === vista.ignorados.length - 1)}>
                    <div style={S.info}>
                      <div style={S.nombre}>{i.nombre ?? "(no está en el catálogo)"}</div>
                      <div style={S.meta}>Cód. {i.codigo || "—"} · fila {i.fila} · {i.motivo}</div>
                    </div>
                  </div>
                ))}
              </details>
            )}

            {r.no_encontrados > 0 && (
              <details style={S.detalles}>
                <summary style={S.resumen}>Códigos que no están en el catálogo ({r.no_encontrados}) — no se crean</summary>
                {vista.no_encontrados.map((i, k) => (
                  <div key={i.codigo} style={S.fila(k === vista.no_encontrados.length - 1)}>
                    <div style={S.info}>
                      <div style={S.nombre}>Cód. {i.codigo}</div>
                      <div style={S.meta}>fila {i.fila} · precio en el archivo: {formatoBs(i.precio)}</div>
                    </div>
                  </div>
                ))}
              </details>
            )}

            {vista.avisos.length > 0 && <div style={S.nota}>{vista.avisos.map((a, i) => <div key={i}>• {a}</div>)}</div>}

            <div style={S.barraAcciones}>
              <Boton onClick={aplicar} loading={aplicando} disabled={r.cambian === 0}>
                Aplicar {r.cambian} {r.cambian === 1 ? "cambio" : "cambios"}
              </Boton>
              <Boton variante="secundario" onClick={cancelar} disabled={aplicando}>Cancelar</Boton>
            </div>
          </>
        )}

        {/* ── Historial ────────────────────────────────────────────── */}
        {!vista && !leyendo && historial && historial.length > 0 && (
          <div>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: C.navy, margin: "6px 0 8px" }}>Cargas anteriores</h2>
            <div style={S.lista}>
              {historial.map((h, i) => (
                <div key={h.id} style={S.fila(i === historial.length - 1)}>
                  <div style={S.info}>
                    <div style={S.nombre}>{h.archivo}</div>
                    <div style={S.meta}>{fechaHora(h.creado)} · {h.productos} {h.productos === 1 ? "precio" : "precios"}</div>
                  </div>
                  {h.revertida
                    ? <span style={S.chip("revisar")}>Deshecha</span>
                    : h.id === ultimaActiva?.id && (
                      <Boton variante="secundario" chico onClick={() => deshacer(h)} loading={deshaciendo === h.id}>Deshacer</Boton>
                    )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <Toast toast={toast} />
    </div>
  );
}
