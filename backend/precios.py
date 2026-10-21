# -*- coding: utf-8 -*-
"""
precios.py — Actualización mensual de la lista de precios (solo admin)
------------------------------------------------------------------------
POST /api/precios/importar    archivo .xlsx (+ aplicar=false|true)
        aplicar=false → PREVISUALIZA: dice qué precios cambiarían, no guarda nada
        aplicar=true  → guarda los precios nuevos y deja registro para poder deshacer
GET  /api/precios/historial   últimas cargas de precios
POST /api/precios/deshacer/:id  vuelve atrás una carga

Del Excel solo se usan el CÓDIGO del producto y la columna G (precio nuevo).
Reglas:
  · Solo se actualiza el precio de productos que YA existen (por código).
    Los códigos que no están se informan, no se crean.
  · Una fila sin precio válido (#N/A, vacía…) se ignora: el producto conserva
    su precio actual.
  · Si el precio no cambió, no se toca.
  · Cada carga queda en `cargas_precios` / `precios_historial`. Deshacer solo
    restituye los productos cuyo precio sigue siendo el que puso esa carga
    (si alguien lo editó a mano después, se respeta lo editado).
"""

from __future__ import annotations

import io
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from auth import UsuarioOut, get_admin
from db import supabase, traer_todo
from excel_datos import leer_precios

router = APIRouter(prefix="/api/precios", tags=["precios"])
Admin = Annotated[UsuarioOut, Depends(get_admin)]

MAX_BYTES        = 60 * 1024 * 1024     # el Excel real pesa ~22 MB (trae imágenes)
UMBRAL_GRANDE    = 30.0          # % de variación a partir del cual se marca "revisar"
EXTENSIONES      = (".xlsx", ".xlsm")


def _igual(a: float, b: float) -> bool:
    return abs(float(a) - float(b)) < 0.005


# ─── Diferencias entre el Excel y la base ────────────────────────────────────
def _calcular(datos: dict) -> dict:
    productos = {
        (p["codigo"] or "").upper(): p
        for p in traer_todo(
            lambda: supabase.table("productos")
            .select("id, codigo, nombre, linea, precio")
            .order("id")
        )
        if p.get("codigo")
    }

    cambios, sin_cambio, no_encontrados = [], 0, []
    for codigo, d in datos["precios"].items():
        p = productos.get(codigo)
        if p is None:
            no_encontrados.append({"codigo": codigo, "fila": d["fila"], "precio": d["precio"]})
            continue
        if _igual(p["precio"], d["precio"]):
            sin_cambio += 1
            continue
        anterior = float(p["precio"])
        pct = round((d["precio"] / anterior - 1) * 100, 1) if anterior > 0 else None
        cambios.append({
            "producto_id": p["id"],
            "codigo":      p["codigo"],
            "nombre":      p["nombre"],
            "linea":       p.get("linea"),
            "anterior":    round(anterior, 2),
            "nuevo":       d["precio"],
            "variacion":   pct,
            "revisar":     pct is None or abs(pct) >= UMBRAL_GRANDE,
        })

    ignorados = []
    for i in datos["ignorados"]:
        p = productos.get(i["codigo"])
        ignorados.append({
            "codigo": i["codigo"], "fila": i["fila"], "motivo": i["motivo"],
            "nombre": p["nombre"] if p else None,
            "en_catalogo": p is not None,
        })

    return {"cambios": cambios, "sin_cambio": sin_cambio, "no_encontrados": no_encontrados, "ignorados": ignorados}


# ─── POST /api/precios/importar ──────────────────────────────────────────────
@router.post("/importar")
def importar(
    _: Admin,
    archivo: Annotated[UploadFile, File(description="Excel .xlsx con la lista de precios")],
    aplicar: Annotated[bool, Form()] = False,
):
    nombre = archivo.filename or "lista.xlsx"
    if not nombre.lower().endswith(EXTENSIONES):
        raise HTTPException(
            status_code=422,
            detail="El archivo tiene que ser un Excel .xlsx (si es .xlsb, abrilo en Excel y guardalo como .xlsx).",
        )
    # Se lee directo del archivo temporal (no se copia a memoria): el Excel pesa ~22 MB.
    fh = archivo.file
    fh.seek(0, io.SEEK_END)
    tamano = fh.tell()
    fh.seek(0)
    if tamano > MAX_BYTES:
        raise HTTPException(status_code=413, detail="El archivo es demasiado grande (máximo 60 MB).")

    try:
        datos = leer_precios(fh, nombre)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    if not datos["precios"]:
        raise HTTPException(
            status_code=422,
            detail="No encontré ningún precio válido en la columna G. ¿Es el archivo correcto?",
        )

    dif = _calcular(datos)
    cambios = dif["cambios"]

    carga_id = None
    if aplicar and cambios:
        carga_id = _aplicar(cambios, nombre)

    return {
        "aplicado": carga_id is not None,
        "carga_id": carga_id,
        "archivo":  nombre,
        "hoja":     datos["hoja"],
        "resumen": {
            "filas_en_archivo": datos["filas"],
            "cambian":          len(cambios),
            "sin_cambio":       dif["sin_cambio"],
            "sin_precio_nuevo": len(dif["ignorados"]),
            "no_encontrados":   len(dif["no_encontrados"]),
            "a_revisar":        sum(1 for c in cambios if c["revisar"]),
        },
        "cambios":        [{k: v for k, v in c.items() if k != "producto_id"} for c in cambios],
        "ignorados":      dif["ignorados"],
        "no_encontrados": dif["no_encontrados"],
        "avisos":         datos["avisos"],
    }


def _aplicar(cambios: list[dict], archivo: str) -> str:
    carga = (
        supabase.table("cargas_precios")
        .insert({"archivo": archivo[:200], "productos": len(cambios), "revertida": False})
        .execute()
        .data
    )
    if not carga:
        raise HTTPException(status_code=500, detail="No se pudo registrar la carga de precios.")
    carga_id = carga[0]["id"]

    # Primero el historial y después los precios: si algo se corta a la mitad,
    # todo lo que se alcanzó a cambiar tiene su registro para poder deshacerlo.
    historial = [
        {
            "carga_id": carga_id, "producto_id": c["producto_id"], "codigo": c["codigo"],
            "precio_anterior": c["anterior"], "precio_nuevo": c["nuevo"],
        }
        for c in cambios
    ]
    for i in range(0, len(historial), 300):
        supabase.table("precios_historial").insert(historial[i:i + 300]).execute()

    try:
        for c in cambios:
            supabase.table("productos").update({"precio": c["nuevo"]}).eq("id", c["producto_id"]).execute()
    except Exception as e:   # noqa: BLE001
        raise HTTPException(
            status_code=500,
            detail=f"Se cortó a la mitad de la carga ({e}). Revisá el historial: podés deshacerla y volver a intentar.",
        )
    return carga_id


# ─── GET /api/precios/historial ──────────────────────────────────────────────
@router.get("/historial")
def historial(_: Admin):
    cargas = (
        supabase.table("cargas_precios")
        .select("id, archivo, productos, revertida, creado")
        .order("creado", desc=True)
        .limit(10)
        .execute()
        .data
        or []
    )
    return cargas


# ─── POST /api/precios/deshacer/:id ──────────────────────────────────────────
@router.post("/deshacer/{carga_id}")
def deshacer(carga_id: str, _: Admin):
    carga = (supabase.table("cargas_precios").select("id, revertida").eq("id", carga_id).limit(1).execute().data or [None])[0]
    if not carga:
        raise HTTPException(status_code=404, detail="Carga no encontrada.")
    if carga["revertida"]:
        raise HTTPException(status_code=409, detail="Esa carga ya fue deshecha.")

    filas = traer_todo(
        lambda: supabase.table("precios_historial").select("*").eq("carga_id", carga_id).order("id")
    )
    actuales = {
        p["id"]: p["precio"]
        for p in traer_todo(lambda: supabase.table("productos").select("id, precio").order("id"))
    }

    restaurados = omitidos = 0
    for f in filas:
        actual = actuales.get(f["producto_id"])
        if actual is not None and _igual(actual, f["precio_nuevo"]):
            supabase.table("productos").update({"precio": f["precio_anterior"]}).eq("id", f["producto_id"]).execute()
            restaurados += 1
        else:
            omitidos += 1          # producto borrado o precio editado después → se respeta

    supabase.table("cargas_precios").update({"revertida": True}).eq("id", carga_id).execute()
    return {"restaurados": restaurados, "omitidos": omitidos}