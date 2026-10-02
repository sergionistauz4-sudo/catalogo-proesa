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
from fastapi.middleware.cors import CORSMiddleware

from auth      import router as auth_router
from productos import router as productos_router
from clientes  import router as clientes_router
from reportes  import router as reportes_router

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


@app.get("/")
def health():
    return {"status": "ok", "proyecto": "Catálogo de Productos PROESA"}
