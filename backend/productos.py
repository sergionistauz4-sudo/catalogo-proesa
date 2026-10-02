# -*- coding: utf-8 -*-
"""
productos.py — Catálogo de productos
--------------------------------------
GET    /api/productos/catalogo     → productos ACTIVOS, solo nombre/precio/descripción/imagen
                                     (el stock, código, línea y subclase NO se envían al cliente)
                                     (cualquier usuario logueado — es lo que ve el cliente)
GET    /api/productos              → todos los productos con todos sus campos (admin)
GET    /api/productos/:id          → detalle de un producto (admin)
POST   /api/productos              → crear producto (admin)
PUT    /api/productos/:id          → editar producto, incluido activo/inactivo (admin)
DELETE /api/productos/:id          → borrar producto definitivamente (admin)
POST   /api/productos/:id/imagen   → subir imagen a Cloudinary (admin)
DELETE /api/productos/:id/imagen   → quitar la imagen del producto (admin)

Un producto con activo=false NO aparece en el catálogo del cliente,
pero sigue existiendo — sirve para "pausarlo" sin perder sus datos.

Cloudinary es opcional: si faltan sus variables de entorno, todo
funciona igual salvo la subida de imágenes (devuelve 503 con aviso).
"""

from __future__ import annotations

import os
from datetime import datetime
from typing import Annotated

import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field

from auth import UsuarioOut, get_admin, get_usuario_actual
from db import limpiar_espacios, supabase

# ─── Cloudinary (opcional) ───────────────────────────────────────────────────
CLOUDINARY_OK = all(
    os.getenv(k) for k in ("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET")
)
if CLOUDINARY_OK:
    cloudinary.config(
        cloud_name = os.environ["CLOUDINARY_CLOUD_NAME"],
        api_key    = os.environ["CLOUDINARY_API_KEY"],
        api_secret = os.environ["CLOUDINARY_API_SECRET"],
        secure     = True,
    )

CARPETA_CLOUDINARY = "catalogo_proesa/productos"

router = APIRouter(prefix="/api/productos", tags=["productos"])


# ─── Modelos ─────────────────────────────────────────────────────────────────
class ProductoCatalogo(BaseModel):
    """Lo único que ve el cliente."""
    id:          str
    nombre:      str
    descripcion: str
    precio:      float
    imagen_url:  str | None = None


class ProductoOut(ProductoCatalogo):
    """Vista completa del admin."""
    codigo:     str | None = None
    linea:      str | None = None
    subclase:   str | None = None
    stock:      int | None = None
    activo:     bool
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ProductoCreate(BaseModel):
    nombre:      str
    descripcion: str = ""
    precio:      float = Field(ge=0)
    codigo:      str | None = None
    linea:       str | None = None
    subclase:    str | None = None
    stock:       int | None = Field(default=None, ge=0)
    imagen_url:  str | None = None
    activo:      bool = True


class ProductoUpdate(BaseModel):
    nombre:      str | None = None
    descripcion: str | None = None
    precio:      float | None = Field(default=None, ge=0)
    codigo:      str | None = None
    linea:       str | None = None
    subclase:    str | None = None
    stock:       int | None = Field(default=None, ge=0)
    imagen_url:  str | None = None   # mandar null explícito la quita
    activo:      bool | None = None


class ImagenOut(BaseModel):
    imagen_url:       str
    imagen_public_id: str


# ─── Helpers ─────────────────────────────────────────────────────────────────
CAMPOS = (
    "id, codigo, linea, subclase, nombre, descripcion, precio, stock, "
    "imagen_url, imagen_public_id, activo, created_at, updated_at"
)
OPCIONALES = ("codigo", "linea", "subclase")   # texto opcional: vacío → null


def _traer_producto(producto_id: str) -> dict:
    resp = (
        supabase.table("productos")
        .select(CAMPOS)
        .eq("id", producto_id)
        .limit(1)
        .execute()
    )
    fila = (resp.data or [None])[0]
    if not fila:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")
    return fila


def _filtrar_busqueda(filas: list[dict], busqueda: str | None) -> list[dict]:
    if not busqueda or not busqueda.strip():
        return filas
    t = busqueda.strip().lower()
    campos = ("nombre", "descripcion", "codigo", "linea", "subclase")
    return [f for f in filas if any(t in (f.get(c) or "").lower() for c in campos)]


def _validar_nombre(nombre: str) -> str:
    nombre = limpiar_espacios(nombre)
    if not nombre:
        raise HTTPException(
            status_code=422,
            detail="El nombre del producto no puede estar vacío.",
        )
    return nombre


def _limpiar_opcional(valor: str | None) -> str | None:
    valor = limpiar_espacios(valor)
    return valor or None


def _validar_codigo_unico(codigo: str | None, excluir_id: str | None = None) -> None:
    if not codigo:
        return
    resp = supabase.table("productos").select("id, nombre").eq("codigo", codigo).limit(1).execute()
    otro = (resp.data or [None])[0]
    if otro and otro["id"] != excluir_id:
        raise HTTPException(
            status_code=409,
            detail=f"El código {codigo} ya está registrado para «{otro['nombre']}».",
        )


def _borrar_imagen_cloudinary(public_id: str | None) -> None:
    """Best effort: si falla, no frenamos la operación principal."""
    if not public_id or not CLOUDINARY_OK:
        return
    try:
        cloudinary.uploader.destroy(public_id)
    except Exception:
        pass


# ─── GET /api/productos/catalogo ─────────────────────────────────────────────
@router.get("/catalogo", response_model=list[ProductoCatalogo])
def catalogo(
    _usuario: Annotated[UsuarioOut, Depends(get_usuario_actual)],
    busqueda: str | None = Query(None),
):
    resp = (
        supabase.table("productos")
        .select("id, nombre, descripcion, precio, imagen_url")
        .eq("activo", True)
        .order("nombre")
        .execute()
    )
    return _filtrar_busqueda(resp.data or [], busqueda)


# ─── GET /api/productos ──────────────────────────────────────────────────────
@router.get("", response_model=list[ProductoOut])
def listar_productos(
    _admin: Annotated[UsuarioOut, Depends(get_admin)],
    busqueda: str | None  = Query(None),
    activo:   bool | None = Query(None, description="None = todos"),
):
    query = supabase.table("productos").select(CAMPOS).order("nombre")
    if activo is not None:
        query = query.eq("activo", activo)
    return _filtrar_busqueda(query.execute().data or [], busqueda)


# ─── GET /api/productos/:id ──────────────────────────────────────────────────
@router.get("/{producto_id}", response_model=ProductoOut)
def obtener_producto(
    producto_id: str,
    _admin: Annotated[UsuarioOut, Depends(get_admin)],
):
    return _traer_producto(producto_id)


# ─── POST /api/productos ─────────────────────────────────────────────────────
@router.post("", response_model=ProductoOut, status_code=status.HTTP_201_CREATED)
def crear_producto(
    body: ProductoCreate,
    _admin: Annotated[UsuarioOut, Depends(get_admin)],
):
    nuevo = body.model_dump()
    nuevo["nombre"]      = _validar_nombre(body.nombre)
    nuevo["descripcion"] = (body.descripcion or "").strip()
    nuevo["precio"]      = round(body.precio, 2)
    for campo in OPCIONALES:
        nuevo[campo] = _limpiar_opcional(nuevo[campo])
    _validar_codigo_unico(nuevo["codigo"])

    resp = supabase.table("productos").insert(nuevo).execute()
    if not resp.data:
        raise HTTPException(status_code=500, detail="Error al crear el producto.")
    return _traer_producto(resp.data[0]["id"])


# ─── PUT /api/productos/:id ──────────────────────────────────────────────────
@router.put("/{producto_id}", response_model=ProductoOut)
def editar_producto(
    producto_id: str,
    body: ProductoUpdate,
    _admin: Annotated[UsuarioOut, Depends(get_admin)],
):
    actual = _traer_producto(producto_id)  # 404 si no existe

    # exclude_unset: solo lo que vino en el body — así un null explícito
    # (ej. imagen_url: null) sí se aplica, y lo que no vino no se toca.
    cambios = body.model_dump(exclude_unset=True)

    for campo in ("nombre", "precio", "activo"):
        if campo in cambios and cambios[campo] is None:
            cambios.pop(campo)  # estos no admiten null

    if "nombre" in cambios:
        cambios["nombre"] = _validar_nombre(cambios["nombre"])
    if "descripcion" in cambios:
        cambios["descripcion"] = (cambios["descripcion"] or "").strip()
    if "precio" in cambios:
        cambios["precio"] = round(cambios["precio"], 2)
    for campo in OPCIONALES:
        if campo in cambios:
            cambios[campo] = _limpiar_opcional(cambios[campo])
    if "codigo" in cambios:
        _validar_codigo_unico(cambios["codigo"], excluir_id=producto_id)
    if "imagen_url" in cambios and not cambios["imagen_url"]:
        # Quitar imagen a mano → limpiar también la de Cloudinary
        cambios["imagen_url"] = None
        cambios["imagen_public_id"] = None
        _borrar_imagen_cloudinary(actual.get("imagen_public_id"))

    if not cambios:
        raise HTTPException(
            status_code=422,
            detail="No se enviaron campos para actualizar.",
        )

    supabase.table("productos").update(cambios).eq("id", producto_id).execute()
    return _traer_producto(producto_id)


# ─── DELETE /api/productos/:id ───────────────────────────────────────────────
@router.delete("/{producto_id}", status_code=status.HTTP_200_OK)
def eliminar_producto(
    producto_id: str,
    _admin: Annotated[UsuarioOut, Depends(get_admin)],
):
    """
    Borrado definitivo. Si solo querés ocultarlo a los clientes,
    usá PUT con { "activo": false }.
    """
    actual = _traer_producto(producto_id)
    supabase.table("productos").delete().eq("id", producto_id).execute()
    _borrar_imagen_cloudinary(actual.get("imagen_public_id"))
    return {"mensaje": "Producto eliminado correctamente."}


# ─── POST /api/productos/:id/imagen ──────────────────────────────────────────
@router.post("/{producto_id}/imagen", response_model=ImagenOut)
async def subir_imagen(
    producto_id: str,
    _admin: Annotated[UsuarioOut, Depends(get_admin)],
    imagen: UploadFile = File(..., description="JPG, PNG o WEBP. Máx 5MB."),
):
    MAX_MB   = 5
    FORMATOS = {"image/jpeg", "image/png", "image/webp"}

    if not CLOUDINARY_OK:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="La subida de imágenes no está configurada (faltan las variables de Cloudinary).",
        )

    if imagen.content_type not in FORMATOS:
        raise HTTPException(
            status_code=422,
            detail="Formato no permitido. Usá JPG, PNG o WEBP.",
        )

    contenido = await imagen.read()
    if len(contenido) > MAX_MB * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"La imagen supera el límite de {MAX_MB} MB.",
        )

    _traer_producto(producto_id)  # 404 si no existe

    try:
        resultado = cloudinary.uploader.upload(
            contenido,
            public_id      = f"{CARPETA_CLOUDINARY}/{producto_id}",
            overwrite      = True,
            invalidate     = True,
            transformation = [
                {"width": 800, "crop": "limit"},
                {"quality": "auto"},
                {"fetch_format": "auto"},
            ],
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error al subir la imagen a Cloudinary: {e}",
        )

    url       = resultado["secure_url"]
    public_id = resultado["public_id"]

    supabase.table("productos").update(
        {"imagen_url": url, "imagen_public_id": public_id}
    ).eq("id", producto_id).execute()

    return ImagenOut(imagen_url=url, imagen_public_id=public_id)


# ─── DELETE /api/productos/:id/imagen ────────────────────────────────────────
@router.delete("/{producto_id}/imagen", response_model=ProductoOut)
def quitar_imagen(
    producto_id: str,
    _admin: Annotated[UsuarioOut, Depends(get_admin)],
):
    actual = _traer_producto(producto_id)
    supabase.table("productos").update(
        {"imagen_url": None, "imagen_public_id": None}
    ).eq("id", producto_id).execute()
    _borrar_imagen_cloudinary(actual.get("imagen_public_id"))
    return _traer_producto(producto_id)
