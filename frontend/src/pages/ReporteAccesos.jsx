// -*- coding: utf-8 -*-
/**
 * ReporteAccesos.jsx — Qué clientes entran al catálogo y cuántas veces por día (solo admin)
 * -------------------------------------------------------------------------------------------
 * Elegís un período (Hoy / 7 días / 30 días / fechas a gusto) y ves:
 *   · totales: entradas, clientes que entraron, clientes activos que NO entraron
 *   · Por cliente: cuántas veces entró cada uno y en qué días
 *   · Por día: entradas y clientes distintos de cada día
 *   · No entraron: a quién conviene llamar
 * "Descargar Excel" baja lo mismo con el detalle hora por hora.
 *
 * Una "entrada" es un inicio de sesión (o reabrir la app con la sesión guardada);
 * recargar o navegar dentro de los 30 minutos siguientes no suma. Los días se
 * cuentan en hora de Bolivia.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { C, FONT, api, descargar, fechaCorta, hoyBolivia, iniciales } from "../api";
import { BarraBusqueda, BannerError, Boton, EstadoVacio, Segmentado, Skeleton, Toast, useToast } from "../components/ui";

const PERIODOS = [
  { id: "hoy", label: "Hoy"     },
  { id: "7",   label: "7 días"  },
  { id: "30",  label: "30 días" },
  { id: "rango", label: "Fechas" },
];
const VISTAS = [
  { id: "clientes", label: "Por cliente" },
  { id: "dias",     label: "Por día"     },
  { id: "ausentes", label: "No entraron" },
];

const S = {
  page: { minHeight: "calc(100vh - 100px)", background: C.gray50, fontFamily: FONT, padding: "18px 1rem 2.5rem" },
  contenedor: { maxWidth: "1100px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "14px" },
  encabezado: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" },
  titulo: { fontSize: "22px", fontWeight: 700, color: C.navy, letterSpacing: "-0.3px" },
  subtitulo: { fontSize: "13px", color: C.gray600, marginTop: "3px" },
  barra: { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" },
  fecha: {
    height: "36px", border: `1px solid ${C.border}`, borderRadius: "8px", padding: "0 10px",
    fontSize: "13px", fontFamily: "inherit", color: C.navy, background: C.white,
  },
  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px" },
  kpi: { background: C.white, border: `1px solid ${C.border}`, borderRadius: "12px", padding: "12px 14px" },
  kpiN: { fontSize: "26px", fontWeight: 700, color: C.navy, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 },
  kpiL: { fontSize: "12px", color: C.gray600, marginTop: "3px" },
  lista: { background: C.white, borderRadius: "12px", border: `1px solid ${C.border}`, overflow: "hidden" },
  fila: (ultima) => ({
    display: "flex", alignItems: "center", gap: "12px", padding: "11px 14px",
    borderBottom: ultima ? "none" : `1px solid ${C.gray100}`, minHeight: "58px",
  }),
  avatar: {
    width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0, background: C.navy, color: C.white,
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700,
  },
  info: { flex: 1, minWidth: 0 },
  nombre: { fontSize: "14px", fontWeight: 600, color: C.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  meta: { fontSize: "12px", color: C.gray600, marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  total: {
    minWidth: "44px", textAlign: "center", fontSize: "15px", fontWeight: 700, color: C.red,
    background: C.redLight, borderRadius: "20px", padding: "3px 10px", fontVariantNumeric: "tabular-nums",
  },
  nota: {
    fontSize: "12.5px", color: C.gray600, lineHeight: 1.5,
    background: C.white, border: `1px solid ${C.gray100}`, borderRadius: "10px", padding: "10px 12px",
  },
};

// Mini gráfico: una barrita por día del período, con el número de entradas
function Barritas({ dias, porDia }) {
  const max = Math.max(1, ...dias.map(d => porDia[d] ?? 0));
  return (
    <div className="ra-barritas" style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "28px" }} aria-hidden="true">
      {dias.map(d => {
        const n = porDia[d] ?? 0;
        return (
          <div key={d} title={`${fechaCorta(d)}: ${n} ${n === 1 ? "entrada" : "entradas"}`}
            style={{
              width: dias.length > 40 ? "3px" : "6px", borderRadius: "2px",
              height: n ? `${Math.max(18, (n / max) * 100)}%` : "3px",
              background: n ? C.red : C.gray200,
            }} />
        );
      })}
    </div>
  );
}

export default function ReporteAccesos() {
  const [periodo, setPeriodo] = useState("7");
  const [desde,   setDesde]   = useState(hoyBolivia(-6));
  const [hasta,   setHasta]   = useState(hoyBolivia());
  const [vista,   setVista]   = useState("clientes");
  const [busqueda, setBusqueda] = useState("");
  const [datos,   setDatos]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [bajando, setBajando] = useState(false);
  const [toast, mostrar] = useToast();

  // Fechas efectivas según el período elegido
  const rango = useMemo(() => {
    if (periodo === "hoy") return { d: hoyBolivia(), h: hoyBolivia() };
    if (periodo === "7")   return { d: hoyBolivia(-6),  h: hoyBolivia() };
    if (periodo === "30")  return { d: hoyBolivia(-29), h: hoyBolivia() };
    return { d: desde, h: hasta };
  }, [periodo, desde, hasta]);

  const cargar = useCallback(async () => {
    if (!rango.d || !rango.h) return;
    setLoading(true);
    setError(null);
    try {
      setDatos(await api(`/api/reportes/accesos?desde=${rango.d}&hasta=${rango.h}`));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [rango]);

  useEffect(() => { cargar(); }, [cargar]);

  async function bajarExcel() {
    setBajando(true);
    try {
      await descargar(`/api/reportes/accesos/excel?desde=${rango.d}&hasta=${rango.h}`,
        `accesos_catalogo_${rango.d}_a_${rango.h}.xlsx`);
    } catch (e) {
      mostrar(e.message, "error");
    } finally {
      setBajando(false);
    }
  }

  const clientes = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    const todos = datos?.por_cliente ?? [];
    return t ? todos.filter(c => c.nombre.toLowerCase().includes(t) || (c.vendedor ?? "").toLowerCase().includes(t)
      || (c.codigo_cliente ?? "").toLowerCase().includes(t)) : todos;
  }, [datos, busqueda]);

  const ausentes = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    const todos = datos?.sin_ingreso ?? [];
    return t ? todos.filter(c => c.nombre.toLowerCase().includes(t) || (c.vendedor ?? "").toLowerCase().includes(t)
      || (c.codigo_cliente ?? "").toLowerCase().includes(t)) : todos;
  }, [datos, busqueda]);

  const r = datos?.resumen;
  const maxDia = Math.max(1, ...(datos?.por_dia ?? []).map(x => x.entradas));
  const LIMITE = 200;   // para que la lista no se haga eterna; el Excel trae todo

  return (
    <div style={S.page}>
      <style>{`.ra-barritas { display: none !important; } @media (min-width: 640px) { .ra-barritas { display: flex !important; } }`}</style>
      <div style={S.contenedor}>

        <div style={S.encabezado}>
          <div>
            <h1 style={S.titulo}>Accesos al catálogo</h1>
            <p style={S.subtitulo}>Qué clientes entran y cuántas veces por día</p>
          </div>
          <Boton variante="navy" onClick={bajarExcel} loading={bajando} disabled={loading || !!error}>
            ⬇ Descargar Excel
          </Boton>
        </div>

        <div style={S.barra}>
          <Segmentado opciones={PERIODOS} valor={periodo} onChange={setPeriodo} />
          {periodo === "rango" && (
            <>
              <input type="date" aria-label="Desde" style={S.fecha} value={desde} max={hasta}
                onChange={e => setDesde(e.target.value)} />
              <span style={{ color: C.gray400, fontSize: "13px" }}>a</span>
              <input type="date" aria-label="Hasta" style={S.fecha} value={hasta} min={desde} max={hoyBolivia()}
                onChange={e => setHasta(e.target.value)} />
            </>
          )}
        </div>

        <BannerError mensaje={error} onReintentar={cargar} />

        {loading && !datos && <Skeleton height={90} radius={12} />}

        {datos && !error && (
          <>
            <div style={{ ...S.kpis, opacity: loading ? 0.55 : 1, transition: "opacity 0.15s" }}>
              <div style={S.kpi}><div style={S.kpiN}>{r.entradas}</div><div style={S.kpiL}>Entradas en total</div></div>
              <div style={S.kpi}><div style={S.kpiN}>{r.clientes_que_entraron}</div><div style={S.kpiL}>Clientes que entraron</div></div>
              <div style={S.kpi}><div style={{ ...S.kpiN, color: r.sin_ingreso ? C.amber : C.green }}>{r.sin_ingreso}</div>
                <div style={S.kpiL}>Activos que no entraron</div></div>
            </div>

            <div style={S.barra}>
              <Segmentado opciones={VISTAS} valor={vista} onChange={v => { setVista(v); setBusqueda(""); }} />
              {vista !== "dias" && <BarraBusqueda value={busqueda} onChange={setBusqueda} placeholder="Buscar cliente o vendedor…" />}
            </div>

            {/* ── Por cliente ───────────────────────────────────────── */}
            {vista === "clientes" && (clientes.length === 0 ? (
              <EstadoVacio icono="📊" titulo={busqueda ? "Sin resultados" : "Nadie entró en este período"}
                texto={busqueda ? `No hay clientes para «${busqueda}».` : "Probá con un período más largo."} />
            ) : (
              <div style={S.lista}>
                {clientes.slice(0, LIMITE).map((c, i, arr) => (
                  <div key={c.cliente_id} style={S.fila(i === arr.length - 1)}>
                    <div style={S.avatar}>{iniciales(c.nombre)}</div>
                    <div style={S.info}>
                      <div style={S.nombre}>{c.nombre}</div>
                      <div style={S.meta}>
                        {c.vendedor ? `${c.vendedor} · ` : ""}entró {c.dias_activos} {c.dias_activos === 1 ? "día" : "días"} · última: {c.ultimo_acceso}
                      </div>
                    </div>
                    {datos.dias.length > 1 && datos.dias.length <= 31 && <Barritas dias={datos.dias} porDia={c.por_dia} />}
                    <div style={S.total} title="Entradas en el período">{c.total}</div>
                  </div>
                ))}
              </div>
            ))}
            {vista === "clientes" && clientes.length > LIMITE && (
              <div style={S.nota}>Se muestran los {LIMITE} primeros de {clientes.length}. Buscá por nombre o bajá el Excel para verlos todos.</div>
            )}

            {/* ── Por día ───────────────────────────────────────────── */}
            {vista === "dias" && (
              <div style={S.lista}>
                {[...datos.por_dia].reverse().map((x, i, arr) => (
                  <div key={x.fecha} style={S.fila(i === arr.length - 1)}>
                    <div style={{ width: "92px", fontSize: "13.5px", fontWeight: 600, color: C.navy, flexShrink: 0 }}>{fechaCorta(x.fecha)}</div>
                    <div style={{ flex: 1, height: "10px", background: C.gray100, borderRadius: "6px", overflow: "hidden" }}>
                      <div style={{ width: `${(x.entradas / maxDia) * 100}%`, height: "100%", background: C.red, borderRadius: "6px" }} />
                    </div>
                    <div style={{ width: "112px", textAlign: "right", fontSize: "12.5px", color: C.gray600, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                      <b style={{ color: C.navy }}>{x.entradas}</b> {x.entradas === 1 ? "entrada" : "entradas"}<br />
                      {x.clientes} {x.clientes === 1 ? "cliente" : "clientes"}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── No entraron ───────────────────────────────────────── */}
            {vista === "ausentes" && (ausentes.length === 0 ? (
              <EstadoVacio icono="🎉" titulo={busqueda ? "Sin resultados" : "Todos los clientes activos entraron"} />
            ) : (
              <div style={S.lista}>
                {ausentes.slice(0, LIMITE).map((c, i, arr) => (
                  <div key={(c.codigo_cliente ?? "") + c.nombre + i} style={S.fila(i === arr.length - 1)}>
                    <div style={{ ...S.avatar, background: C.gray200, color: C.gray600 }}>{iniciales(c.nombre)}</div>
                    <div style={S.info}>
                      <div style={S.nombre}>{c.nombre}</div>
                      <div style={S.meta}>{[c.codigo_cliente, c.vendedor].filter(Boolean).join(" · ") || "—"}</div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {vista === "ausentes" && ausentes.length > LIMITE && (
              <div style={S.nota}>Se muestran los {LIMITE} primeros de {ausentes.length}. El Excel (hoja «No entraron») trae la lista completa.</div>
            )}

            <div style={S.nota}>
              ℹ️ Una <b>entrada</b> es cuando el cliente inicia sesión o reabre el catálogo con su sesión guardada.
              Si recarga o navega dentro de los 30 minutos siguientes no se cuenta de nuevo. Los días son en hora de Bolivia.
              Tu propio uso como asesor no se registra.
            </div>
          </>
        )}
      </div>
      <Toast toast={toast} />
    </div>
  );
}
