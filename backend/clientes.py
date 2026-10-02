# -*- coding: utf-8 -*-
"""
clientes.py — Clientes (farmacéuticos): alta, edición, baja
-------------------------------------------------------------
GET    /api/clientes          → lista de clientes, con búsqueda (admin)
POST   /api/clientes          → crear cliente (admin)
PUT    /api/clientes/:id      → editar cliente (admin)
DELETE /api/clientes/:id      → borrar cliente definitivamente (admin)

El cliente inicia sesión con su NOMBRE + su NIT (como contraseña).
El NIT puede repetirse entre clientes (sucursales que comparten NIT);
lo que identifica a cada uno es su código de cliente (único).
Si solo querés bloquearle el acceso sin perder el registro, usá
PUT con { "activo": false }.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from auth import UsuarioOut, get_admin
from db import limpiar_espacios, limpiar_nit, normalizar_nombre, supabase

router = APIRouter(prefix="/api/clientes", tags=["clientes"])


# ─── Modelos ─────────────────────────────────────────────────────────────────
class ClienteOut(BaseModel):
    id:             str
    codigo_cliente: str | None = None
    nombre:         str
    nit:            str
    ambito:         str | None = None
    vendedor:       str | None = None
    activo:         bool
    created_at:     datetime | None = None


class ClienteCreate(BaseModel):
    nombre:         str
    nit:            str
    codigo_cliente: str | None = None
    ambito:         str | None = None
    vendedor:       str | None = None
    activo:         bool = True


class ClienteUpdate(BaseModel):
    nombre:         str | None = None
    nit:            str | None = None
    codigo_cliente: str | None = None
    ambito:         str | None = None
    vendedor:       str | None = None
    activo:         bool | None = None


# ─── Helpers ─────────────────────────────────────────────────────────────────
CAMPOS = "id, codigo_cliente, nombre, nit, ambito, vendedor, activo, created_at"
OPCIONALES = ("codigo_cliente", "ambito", "vendedor")


def _traer_cliente(cliente_id: str) -> dict:
    resp = (
        supabase.table("clientes")
        .select(CAMPOS)
        .eq("id", cliente_id)
        .limit(1)
        .execute()
    )
    fila = (resp.data or [None])[0]
    if not fila:
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")
    return fila


def _validar_nombre(nombre: str) -> str:
    nombre = limpiar_espacios(nombre)
    if not nombre:
        raise HTTPException(status_code=422, detail="El nombre del cliente no puede estar vacío.")
    return nombre


def _validar_nit(nit: str) -> str:
    """Limpia el NIT (solo letras y números). Puede repetirse entre clientes."""
    nit = limpiar_nit(nit)
    if not nit:
        raise HTTPException(status_code=422, detail="El NIT no puede estar vacío.")
    return nit


def _limpiar_opcional(valor: str | None) -> str | None:
    """Texto opcional: sin espacios de más; vacío → None."""
    valor = limpiar_espacios(valor)
    return valor or None


def _validar_codigo_unico(codigo: str | None, excluir_id: str | None = None) -> None:
    if not codigo:
        return
    resp = supabase.table("clientes").select("id, nombre").eq("codigo_cliente", codigo).limit(1).execute()
    otro = (resp.data or [None])[0]
    if otro and otro["id"] != excluir_id:
        raise HTTPException(
            status_code=409,
            detail=f"El código {codigo} ya está registrado para «{otro['nombre']}».",
        )


# ─── GET /api/clientes ───────────────────────────────────────────────────────
@router.get("", response_model=list[ClienteOut])
def listar_clientes(
    _admin: Annotated[UsuarioOut, Depends(get_admin)],
    busqueda: str | None  = Query(None),
    activo:   bool | None = Query(None, description="None = todos"),
):
    query = supabase.table("clientes").select(CAMPOS).order("nombre")
    if activo is not None:
        query = query.eq("activo", activo)
    filas = query.execute().data or []

    if busqueda and busqueda.strip():
        t_texto = normalizar_nombre(busqueda)
        t_nit   = limpiar_nit(busqueda)
        filas = [
            f for f in filas
            if (t_texto and (
                t_texto in normalizar_nombre(f["nombre"])
                or t_texto in normalizar_nombre(f.get("vendedor"))
                or t_texto in normalizar_nombre(f.get("codigo_cliente"))
            ))
            or (t_nit and t_nit in f["nit"])
        ]
    return filas


# ─── POST /api/clientes ──────────────────────────────────────────────────────
@router.post("", response_model=ClienteOut, status_code=201)
def crear_cliente(
    body: ClienteCreate,
    _admin: Annotated[UsuarioOut, Depends(get_admin)],
):
    nuevo = {
        "nombre": _validar_nombre(body.nombre),
        "nit":    _validar_nit(body.nit),
        "activo": body.activo,
    }
    for campo in OPCIONALES:
        nuevo[campo] = _limpiar_opcional(getattr(body, campo))
    _validar_codigo_unico(nuevo["codigo_cliente"])

    resp = supabase.table("clientes").insert(nuevo).execute()
    if not resp.data:
        raise HTTPException(status_code=500, detail="Error al crear el cliente.")
    return _traer_cliente(resp.data[0]["id"])


# ─── PUT /api/clientes/:id ───────────────────────────────────────────────────
@router.put("/{cliente_id}", response_model=ClienteOut)
def editar_cliente(
    cliente_id: str,
    body: ClienteUpdate,
    _admin: Annotated[UsuarioOut, Depends(get_admin)],
):
    _traer_cliente(cliente_id)  # 404 si no existe

    # exclude_unset: solo lo que vino en el body; así un campo opcional
    # enviado vacío se puede borrar, y lo que no vino no se toca.
    cambios = body.model_dump(exclude_unset=True)
    for campo in ("nombre", "nit", "activo"):
        if campo in cambios and cambios[campo] is None:
            cambios.pop(campo)  # estos no admiten null

    if "nombre" in cambios:
        cambios["nombre"] = _validar_nombre(cambios["nombre"])
    if "nit" in cambios:
        cambios["nit"] = _validar_nit(cambios["nit"])
    for campo in OPCIONALES:
        if campo in cambios:
            cambios[campo] = _limpiar_opcional(cambios[campo])
    if "codigo_cliente" in cambios:
        _validar_codigo_unico(cambios["codigo_cliente"], excluir_id=cliente_id)

    if not cambios:
        raise HTTPException(status_code=422, detail="No se enviaron campos para actualizar.")

    supabase.table("clientes").update(cambios).eq("id", cliente_id).execute()
    return _traer_cliente(cliente_id)


# ─── DELETE /api/clientes/:id ────────────────────────────────────────────────
@router.delete("/{cliente_id}", status_code=200)
def eliminar_cliente(
    cliente_id: str,
    _admin: Annotated[UsuarioOut, Depends(get_admin)],
):
    _traer_cliente(cliente_id)
    supabase.table("clientes").delete().eq("id", cliente_id).execute()
    return {"mensaje": "Cliente eliminado correctamente."}
