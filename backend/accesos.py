# -*- coding: utf-8 -*-
"""
accesos.py — Registro de entradas de los clientes al catálogo
---------------------------------------------------------------
Una "entrada" = un cliente inicia sesión, o reabre la app con la sesión
guardada. Para no inflar el número cuando alguien recarga la página o
navega, si el mismo cliente ya tiene una entrada en los últimos
VENTANA_MIN minutos (30 por defecto) no se anota otra.

Registrar NUNCA debe romper el login: cualquier error se ignora.
Las visitas del admin no se registran.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone

from db import supabase

VENTANA_MIN = int(os.getenv("ACCESO_VENTANA_MIN", "30"))
log = logging.getLogger("accesos")


def registrar_acceso(cliente_id: str) -> bool:
    """Devuelve True si anotó una entrada nueva, False si no hacía falta o falló."""
    try:
        ultimo = (
            supabase.table("accesos")
            .select("creado")
            .eq("cliente_id", cliente_id)
            .order("creado", desc=True)
            .limit(1)
            .execute()
            .data
        )
        if ultimo:
            antes = datetime.fromisoformat(str(ultimo[0]["creado"]).replace("Z", "+00:00"))
            if antes.tzinfo is None:
                antes = antes.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) - antes < timedelta(minutes=VENTANA_MIN):
                return False
        supabase.table("accesos").insert({"cliente_id": cliente_id}).execute()
        return True
    except Exception:   # noqa: BLE001 — registrar es secundario
        log.exception("No se pudo registrar el acceso de %s", cliente_id)
        return False
