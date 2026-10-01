# -*- coding: utf-8 -*-
"""
clientes.py — Clientes (farmacéuticos): alta, edición, baja
-------------------------------------------------------------
GET    /api/clientes          → lista de clientes, con búsqueda (admin)
POST   /api/clientes          → crear cliente (admin)
PUT    /api/clientes/:id      → editar nombre / NIT / activo (admin)
DELETE /api/clientes/:id      → borrar cliente definitivamente (admin)

El cliente inicia sesión con su NOMBRE + su NIT (como contraseña),
así que el NIT es único: no puede haber dos clientes con el mismo.
Si solo querés bloquearle el acceso sin perder el registro, usá
PUT con { "activo": false }.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from auth import UsuarioOut, get_admin
from db import limpiar_espacios, limpiar_nit, normalizar_nombre, supabase

router = APIRouter(prefix="/api/clientes", tags=["clientes"])


# ─── Modelos ─────────────────────────────────────────────────────────────────
class ClienteOut(BaseModel):
    id:         str
    nombre:     str
    nit:        str
    activo:     bool
    created_at: datetime | None = None


class ClienteCreate(BaseModel):
    nombre: str
    nit:    str
    activo: bool = True


class ClienteUpdate(BaseModel):
    nombre: str | None = None
    nit:    str | None = None
    activo: bool | None = None


# ─── Helpers ─────────────────────────────────────────────────────────────────
CAMPOS = "id, nombre, nit, activo, created_at"


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
        raise HTTPException(
            status_code=422,
            detail="El nombre del cliente no puede estar vacío.",
        )
    return nombre


def _validar_nit(nit: str, excluir_id: str | None = None) -> str:
    """Limpia el NIT y verifica que no lo tenga otro cliente."""
    nit = limpiar_nit(nit)
    if not nit:
        raise HTTPException(
            status_code=422,
            detail="El NIT no puede estar vacío.",
        )
    resp = supabase.table("clientes").select("id, nombre").eq("nit", nit).limit(1).execute()
    otro = (resp.data or [None])[0]
    if otro and otro["id"] != excluir_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"El NIT {nit} ya está registrado para «{otro['nombre']}».",
        )
    return nit


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
        t_nombre = normalizar_nombre(busqueda)
        t_nit    = limpiar_nit(busqueda)
        filas = [
            f for f in filas
            if (t_nombre and t_nombre in normalizar_nombre(f["nombre"]))
            or (t_nit and t_nit in f["nit"])
        ]
    return filas


# ─── POST /api/clientes ──────────────────────────────────────────────────────
@router.post("", response_model=ClienteOut, status_code=status.HTTP_201_CREATED)
def crear_cliente(
    body: ClienteCreate,
    _admin: Annotated[UsuarioOut, Depends(get_admin)],
):
    nuevo = {
        "nombre": _validar_nombre(body.nombre),
        "nit":    _validar_nit(body.nit),
        "activo": body.activo,
    }
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

    cambios = body.model_dump(exclude_none=True)
    if "nombre" in cambios:
        cambios["nombre"] = _validar_nombre(cambios["nombre"])
    if "nit" in cambios:
        cambios["nit"] = _validar_nit(cambios["nit"], excluir_id=cliente_id)

    if not cambios:
        raise HTTPException(
            status_code=422,
            detail="No se enviaron campos para actualizar.",
        )

    supabase.table("clientes").update(cambios).eq("id", cliente_id).execute()
    return _traer_cliente(cliente_id)


# ─── DELETE /api/clientes/:id ────────────────────────────────────────────────
@router.delete("/{cliente_id}", status_code=status.HTTP_200_OK)
def eliminar_cliente(
    cliente_id: str,
    _admin: Annotated[UsuarioOut, Depends(get_admin)],
):
    _traer_cliente(cliente_id)
    supabase.table("clientes").delete().eq("id", cliente_id).execute()
    return {"mensaje": "Cliente eliminado correctamente."}
