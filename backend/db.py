# -*- coding: utf-8 -*-
"""
db.py — Cliente de Supabase compartido + helpers de normalización
------------------------------------------------------------------
Todos los routers importan `supabase` desde acá, así hay un solo
cliente y una sola lectura de variables de entorno.
"""

from __future__ import annotations

import os
import re
import unicodedata

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def limpiar_nit(nit: str | None) -> str:
    """
    Deja el NIT solo con letras y números, en mayúsculas.
    "1234567-01" → "123456701",  " 1.023.456 " → "1023456".
    Se usa al guardar y al hacer login, así un NIT tipeado con
    guiones o puntos igual coincide.
    """
    return re.sub(r"[^0-9A-Za-z]", "", nit or "").upper()


def normalizar_nombre(nombre: str | None) -> str:
    """
    Versión "comparable" de un nombre: sin tildes, en minúsculas,
    sin signos de puntuación y con un solo espacio entre palabras.
    "Farmacia  San José S.R.L." → "farmacia san jose srl"
    Solo se usa para comparar en el login, nunca se guarda así.
    """
    s = unicodedata.normalize("NFKD", nombre or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^\w\s]", "", s.lower())
    return re.sub(r"\s+", " ", s).strip()


def limpiar_espacios(texto: str | None) -> str:
    """Saca espacios de más al principio, al final y en el medio."""
    return re.sub(r"\s+", " ", texto or "").strip()


def traer_todo(armar, tam: int = 1000) -> list[dict]:
    """
    Supabase devuelve como máximo 1000 filas por consulta. Esto pide de a
    `tam` hasta traer todo. `armar` es una función que devuelve la consulta
    SIN ejecutar (con select/filtros/orden), por ejemplo:
        traer_todo(lambda: supabase.table("accesos").select("*").order("creado"))
    El orden tiene que ser estable para que las páginas no se pisen.
    """
    filas: list[dict] = []
    desde = 0
    while True:
        lote = armar().range(desde, desde + tam - 1).execute().data or []
        filas.extend(lote)
        if len(lote) < tam:
            return filas
        desde += tam
