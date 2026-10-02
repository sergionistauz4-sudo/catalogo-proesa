# -*- coding: utf-8 -*-
"""
importar_clientes.py — Carga masiva de clientes desde el Excel
----------------------------------------------------------------
Uso:
  python importar_clientes.py clientes.xlsx --prueba    # solo muestra qué haría
  python importar_clientes.py clientes.xlsx             # importa

Columnas esperadas (fila 1): Cod. Cliente | Cliente | Nit | Amb. Compra | Vendedor

Si el código de cliente ya existe, se ACTUALIZAN nombre, NIT, ámbito y
vendedor (no se duplica, y no se toca si el cliente está activo o bloqueado).
Los clientes nuevos quedan activos. Varios clientes pueden compartir NIT.
"""

from __future__ import annotations

import sys

from db import supabase
from excel_datos import leer_clientes


def main() -> None:
    args   = [a for a in sys.argv[1:] if not a.startswith("--")]
    prueba = "--prueba" in sys.argv
    if not args:
        print(__doc__)
        sys.exit(1)

    registros, avisos = leer_clientes(args[0])
    print(f"Clientes válidos: {len(registros)}  ·  avisos: {len(avisos)}")
    for a in avisos:
        print("  ⚠", a)

    if prueba:
        for r in registros[:15]:
            print(f"  {r['codigo_cliente']}  {r['nit']:>13}  {r['nombre']}")
        print("Modo prueba: no se guardó nada.")
        return

    existentes = {
        f["codigo_cliente"]
        for f in (supabase.table("clientes").select("codigo_cliente").execute().data or [])
        if f.get("codigo_cliente")
    }
    for i in range(0, len(registros), 300):
        supabase.table("clientes").upsert(registros[i:i + 300], on_conflict="codigo_cliente").execute()

    nuevos = sum(1 for r in registros if r["codigo_cliente"] not in existentes)
    print(f"✓ {nuevos} clientes nuevos · {len(registros) - nuevos} actualizados.")


if __name__ == "__main__":
    main()
