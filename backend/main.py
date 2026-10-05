# -*- coding: utf-8 -*-
"""
main.py — Punto de entrada del backend FastAPI
-----------------------------------------------
Ejecutar en desarrollo:
  uvicorn main:app --reload --port 8000

En Render configurás:
  Build Command:  pip install -r requirements.txt
  Start Command:  uvicorn main:app --host 0.0.0.0 --port $PORT
"""

import os

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from auth      import router as auth_router
from productos import router as productos_router
from clientes  import router as clientes_router
from reportes  import router as reportes_router
from db        import supabase

app = FastAPI(
    title="Catálogo de Productos — PROESA",
    version="1.0.0",
)

# Orígenes permitidos: FRONTEND_ORIGINS="https://mi-front.onrender.com,http://localhost:5173"
ORIGENES = [
    o.strip().rstrip("/")
    for o in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://localhost:5174",
    ).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGENES,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ─────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(productos_router)
app.include_router(clientes_router)
app.include_router(reportes_router)


# UptimeRobot (plan gratis) pregunta con HEAD, por eso aceptamos GET y HEAD.
@app.api_route("/", methods=["GET", "HEAD"])
def health():
    return {"status": "ok", "proyecto": "Catálogo de Productos PROESA"}


@app.api_route("/salud", methods=["GET", "HEAD"])
def salud():
    """
    Apuntá UptimeRobot acá. Además de mantener despierto a Render, hace una
    consulta mínima a Supabase, que cuenta como actividad (el plan gratis de
    Supabase pausa los proyectos sin uso). Si la base no responde → 503.
    """
    try:
        supabase.table("clientes").select("id").limit(1).execute()
    except Exception:   # noqa: BLE001
        return JSONResponse({"status": "error", "base": "sin respuesta"}, status_code=503)
    return {"status": "ok", "base": "ok"}