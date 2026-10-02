# -*- coding: utf-8 -*-
"""
importar_productos.py — Carga masiva de productos desde el Excel del catálogo
-------------------------------------------------------------------------------
Uso:
  python importar_productos.py catalogo.xlsx --prueba   # solo muestra qué haría
  python importar_productos.py catalogo.xlsx            # importa

Hoja "Hoja1", columnas (fila 1):
  LINEA | SUBCLASE | CODIGO | PRODUCTO - DESCRIPCION | STOCK | PRECIO UNIDAD
Las columnas de imagen se ignoran: las imágenes se suben a mano desde la app.

Sirve también para ACTUALIZAR: si el código ya existe, se actualizan nombre,
línea, subclase, precio y stock. NO se tocan la descripción, la imagen ni si
el producto está visible u oculto — así no se pierde lo que editaste en la app.
Los productos nuevos quedan visibles.
"""

from __future__ import annotations

import sys

from db import supabase
from excel_datos import leer_productos

CAMPOS_ACTUALIZABLES = ("linea", "subclase", "nombre", "precio", "stock")


def main() -> None:
    args   = [a for a in sys.argv[1:] if not a.startswith("--")]
    prueba = "--prueba" in sys.argv
    if not args:
        print(__doc__)
        sys.exit(1)

    registros, avisos = leer_productos(args[0])
    print(f"Productos válidos: {len(registros)}  ·  avisos: {len(avisos)}")
    for a in avisos:
        print("  ⚠", a)

    if prueba:
        for r in registros[:15]:
            print(f"  {r['codigo']:>7}  Bs {r['precio']:>8.2f}  stock {r['stock']!s:>6}  {r['nombre']}")
        print("Modo prueba: no se guardó nada.")
        return

    existentes = {
        f["codigo"]: f["id"]
        for f in (supabase.table("productos").select("id, codigo").execute().data or [])
        if f.get("codigo")
    }

    nuevos = [r for r in registros if r["codigo"] not in existentes]
    for i in range(0, len(nuevos), 300):
        supabase.table("productos").insert(nuevos[i:i + 300]).execute()

    actualizados = [r for r in registros if r["codigo"] in existentes]
    for r in actualizados:
        cambios = {c: r[c] for c in CAMPOS_ACTUALIZABLES}
        supabase.table("productos").update(cambios).eq("id", existentes[r["codigo"]]).execute()

    print(f"✓ {len(nuevos)} productos nuevos · {len(actualizados)} actualizados.")


if __name__ == "__main__":
    main()
