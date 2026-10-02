# -*- coding: utf-8 -*-
"""
auth.py — Login y sesión (JWT)
--------------------------------
POST /api/auth/login   → { token, usuario }   (público)
GET  /api/auth/me      → { usuario }          (requiere token)

Cada login de un cliente (y cada vez que reabre la app con sesión guardada)
se anota en la tabla `accesos` — ver accesos.py y el reporte en reportes.py.

Dos roles:
  · admin   (asesor de ventas) → usuario y contraseña salen de las
            variables de entorno ADMIN_USUARIO / ADMIN_PASSWORD
            (por defecto admin123 / admin123 — cambialas en producción).
  · cliente (farmacéutico)     → nombre + NIT, contra la tabla `clientes`.

Comparación del login de clientes:
  - El NIT se limpia (sin puntos/guiones/espacios) y se busca exacto.
  - El nombre se compara "normalizado": sin tildes, sin mayúsculas,
    sin puntuación — "Farmacia San José S.R.L." == "farmacia san jose srl".
  - Un cliente con activo=false no puede entrar.

Dependencias para otros routers:
  get_usuario_actual  → cualquier usuario logueado
  get_admin           → solo admin (403 si no)
"""

from __future__ import annotations

import hmac
import os
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from accesos import registrar_acceso
from db import limpiar_nit, normalizar_nombre, supabase

# ─── Configuración ───────────────────────────────────────────────────────────
JWT_SECRET       = os.environ["JWT_SECRET"]
JWT_ALGORITMO    = "HS256"
JWT_EXPIRA_HORAS = int(os.getenv("JWT_EXPIRA_HORAS", "12"))

ADMIN_USUARIO  = os.getenv("ADMIN_USUARIO",  "admin123")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
ADMIN_NOMBRE   = os.getenv("ADMIN_NOMBRE",   "Asesor de ventas")
ADMIN_ID       = "admin"

router = APIRouter(prefix="/api/auth", tags=["auth"])
bearer = HTTPBearer(auto_error=False)


# ─── Modelos ─────────────────────────────────────────────────────────────────
class LoginBody(BaseModel):
    nombre:   str
    password: str


class UsuarioOut(BaseModel):
    id:     str
    nombre: str
    rol:    Literal["admin", "cliente"]
    nit:    str | None = None


class LoginOut(BaseModel):
    token:   str
    usuario: UsuarioOut


class MeOut(BaseModel):
    usuario: UsuarioOut


# ─── Helpers ─────────────────────────────────────────────────────────────────
def _iguales(a: str, b: str) -> bool:
    """Comparación en tiempo constante (evita timing attacks)."""
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


def _crear_token(usuario: UsuarioOut) -> str:
    ahora = datetime.now(timezone.utc)
    payload = {
        "sub":    usuario.id,
        "rol":    usuario.rol,
        "nombre": usuario.nombre,
        "iat":    ahora,
        "exp":    ahora + timedelta(hours=JWT_EXPIRA_HORAS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITMO)


def _admin() -> UsuarioOut:
    return UsuarioOut(id=ADMIN_ID, nombre=ADMIN_NOMBRE, rol="admin")


def _credenciales_invalidas() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Usuario o contraseña incorrectos.",
    )


def _cuenta_desactivada() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Tu cuenta está desactivada. Consultá con tu asesor de ventas.",
    )


# ─── Dependencias ────────────────────────────────────────────────────────────
def get_usuario_actual(
    cred: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> UsuarioOut:
    """
    Valida el JWT del header Authorization: Bearer <token>.
    Para clientes vuelve a mirar la base: si el admin lo desactivó o lo
    borró después de que inició sesión, el token deja de servir.
    """
    if cred is None or not cred.credentials:
        raise HTTPException(status_code=401, detail="Falta el token de sesión.")

    try:
        payload = jwt.decode(cred.credentials, JWT_SECRET, algorithms=[JWT_ALGORITMO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="La sesión expiró. Volvé a iniciar sesión.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido.")

    rol = payload.get("rol")
    sub = payload.get("sub")

    if rol == "admin" and sub == ADMIN_ID:
        return _admin()

    if rol == "cliente" and sub:
        resp = (
            supabase.table("clientes")
            .select("id, nombre, nit, activo")
            .eq("id", sub)
            .limit(1)
            .execute()
        )
        fila = (resp.data or [None])[0]
        if not fila:
            raise HTTPException(status_code=401, detail="El usuario ya no existe.")
        if not fila.get("activo", False):
            raise _cuenta_desactivada()
        return UsuarioOut(id=fila["id"], nombre=fila["nombre"], rol="cliente", nit=fila["nit"])

    raise HTTPException(status_code=401, detail="Token inválido.")


def get_admin(
    usuario: Annotated[UsuarioOut, Depends(get_usuario_actual)],
) -> UsuarioOut:
    if usuario.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el asesor de ventas puede hacer esta acción.",
        )
    return usuario


# ─── POST /api/auth/login ────────────────────────────────────────────────────
@router.post("/login", response_model=LoginOut)
def login(body: LoginBody):
    nombre   = body.nombre.strip()
    password = body.password.strip()

    if not nombre or not password:
        raise HTTPException(
            status_code=422,
            detail="Ingresá tu nombre y tu contraseña.",
        )

    # 1. ¿Es el admin?
    if _iguales(nombre.lower(), ADMIN_USUARIO.lower()) and _iguales(password, ADMIN_PASSWORD):
        usuario = _admin()
        return LoginOut(token=_crear_token(usuario), usuario=usuario)

    # 2. ¿Es un cliente? → buscar por NIT y comparar el nombre normalizado
    nit = limpiar_nit(password)
    if not nit:
        raise _credenciales_invalidas()

    # El NIT puede repetirse entre clientes (sucursales con el mismo NIT),
    # así que traemos todos los que lo tienen y nos quedamos con los que
    # además coinciden en el nombre.
    resp = (
        supabase.table("clientes")
        .select("id, nombre, nit, activo")
        .eq("nit", nit)
        .execute()
    )
    nombre_norm = normalizar_nombre(nombre)
    coinciden = [f for f in (resp.data or []) if normalizar_nombre(f["nombre"]) == nombre_norm]

    if not coinciden:
        raise _credenciales_invalidas()

    # Si hay varios con el mismo nombre y NIT, entra el primero que esté activo.
    fila = next((f for f in coinciden if f.get("activo", False)), None)
    if fila is None:
        raise _cuenta_desactivada()

    usuario = UsuarioOut(id=fila["id"], nombre=fila["nombre"], rol="cliente", nit=fila["nit"])
    registrar_acceso(usuario.id)
    return LoginOut(token=_crear_token(usuario), usuario=usuario)


# ─── GET /api/auth/me ────────────────────────────────────────────────────────
@router.get("/me", response_model=MeOut)
def me(usuario: Annotated[UsuarioOut, Depends(get_usuario_actual)]):
    # Se llama cada vez que alguien reabre la app con la sesión guardada:
    # cuenta como entrada (si pasaron más de 30 min desde la anterior).
    if usuario.rol == "cliente":
        registrar_acceso(usuario.id)
    return MeOut(usuario=usuario)
