# -*- coding: utf-8 -*-
"""
excel_datos.py — Lectura y limpieza de los Excel de clientes y productos
--------------------------------------------------------------------------
Lo usan importar_clientes.py e importar_productos.py. No toca la base.

(También se acepta .csv con las mismas columnas.)

Excel de CLIENTES (primera hoja, encabezados en la fila 1):
    Cod. Cliente | Cliente | Nit | Amb. Compra | Vendedor
Excel de PRODUCTOS (hoja "Hoja1", encabezados en la fila 1):
    LINEA | SUBCLASE | CODIGO | PRODUCTO - DESCRIPCION | STOCK | PRECIO UNIDAD
    (las columnas de imagen se ignoran: las imágenes se cargan a mano)

Los encabezados se reconocen sin importar mayúsculas, tildes ni puntos.
"""

from __future__ import annotations

from pathlib import Path

from db import limpiar_espacios, limpiar_nit, normalizar_nombre

# columna del Excel (normalizada) → campo en la base
COLS_CLIENTES = {
    "cod cliente": "codigo_cliente",
    "cliente":     "nombre",
    "nit":         "nit",
    "amb compra":  "ambito",
    "vendedor":    "vendedor",
}
COLS_PRODUCTOS = {
    "linea":                  "linea",
    "subclase":               "subclase",
    "codigo":                 "codigo",
    "producto descripcion":   "nombre",
    "stock":                  "stock",
    "precio unidad":          "precio",
}


# ─── Helpers ─────────────────────────────────────────────────────────────────
def _arreglar_codificacion(texto: str) -> str:
    """
    Repara texto con tildes/ñ "rotas" por una mala codificación
    (ej. 'PRACTIPAÃ‘AL' → 'PRACTIPAÑAL'). Si no hace falta, lo deja igual.
    """
    if "Ã" not in texto and "Â" not in texto:
        return texto
    try:
        return texto.encode("cp1252").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return texto


def _texto(valor) -> str:
    """Celda → texto limpio. Los números enteros no llevan '.0' (50024.0 → '50024')."""
    if valor is None:
        return ""
    if isinstance(valor, float) and valor.is_integer():
        valor = int(valor)
    return limpiar_espacios(_arreglar_codificacion(str(valor)))


def _hojas(ruta: Path, hoja: str | None):
    if ruta.suffix.lower() == ".csv":
        import csv
        texto = ruta.read_text(encoding="utf-8-sig", errors="replace")
        dialecto = csv.Sniffer().sniff(texto[:4096], delimiters=",;\t")
        return [fila for fila in csv.reader(texto.splitlines(), dialecto)]
    from openpyxl import load_workbook
    wb = load_workbook(ruta, read_only=True, data_only=True)
    ws = wb[hoja] if hoja else wb.worksheets[0]
    return [list(fila) for fila in ws.iter_rows(values_only=True)]


def _filas_como_dicts(ruta: Path, hoja: str | None, columnas: dict[str, str]):
    filas = _hojas(ruta, hoja)
    if not filas:
        raise SystemExit("El archivo está vacío.")
    encabezado = [normalizar_nombre(c if c is not None else "") for c in filas[0]]
    faltan = [c for c in columnas if c not in encabezado]
    if faltan:
        raise SystemExit(
            f"Faltan columnas en el Excel: {faltan}\nEncabezados leídos: {filas[0]}"
        )
    indices = {campo: encabezado.index(col) for col, campo in columnas.items()}
    for n, fila in enumerate(filas[1:], start=2):
        if not any(c not in (None, "") for c in fila):
            continue  # fila totalmente vacía
        yield n, {campo: (fila[i] if i < len(fila) else None) for campo, i in indices.items()}


def convertir_stock(valor) -> int | None:
    """
    El Excel trae los miles con punto y Excel los guardó como decimales:
    4.159 es en realidad 4159 unidades, y 348 es 348. Regla: un número
    con decimales se multiplica por 1000; un entero se deja igual.
    """
    if valor in (None, ""):
        return None
    try:
        n = float(str(valor).replace(",", "."))
    except ValueError:
        return None
    return round(n * 1000) if not n.is_integer() else int(n)


# ─── Clientes ────────────────────────────────────────────────────────────────
def leer_clientes(ruta: str | Path, hoja: str | None = None):
    """Devuelve (registros, avisos). Los repetidos por código se reportan y se usa el último."""
    registros: dict[str, dict] = {}
    avisos: list[str] = []
    for n, f in _filas_como_dicts(Path(ruta), hoja, COLS_CLIENTES):
        nombre = limpiar_espacios(_texto(f["nombre"]))
        nit    = limpiar_nit(_texto(f["nit"]))
        codigo = _texto(f["codigo_cliente"]).upper() or None
        if not nombre or not nit:
            avisos.append(f"fila {n}: falta nombre o NIT → se saltea ({list(f.values())})")
            continue
        if not codigo:
            avisos.append(f"fila {n}: «{nombre}» no tiene código de cliente → se saltea")
            continue
        if codigo in registros:
            avisos.append(f"fila {n}: código {codigo} repetido → se usa la última aparición")
        registros[codigo] = {
            "codigo_cliente": codigo,
            "nombre":   nombre,
            "nit":      nit,
            "ambito":   _texto(f["ambito"]).upper() or None,
            "vendedor": _texto(f["vendedor"]).upper() or None,
        }
    return list(registros.values()), avisos


# ─── Productos ───────────────────────────────────────────────────────────────
def leer_productos(ruta: str | Path, hoja: str | None = "Hoja1"):
    """Devuelve (registros, avisos)."""
    registros: dict[str, dict] = {}
    avisos: list[str] = []
    for n, f in _filas_como_dicts(Path(ruta), hoja, COLS_PRODUCTOS):
        nombre = _texto(f["nombre"])
        codigo = _texto(f["codigo"]) or None
        try:
            precio = round(float(f["precio"]), 2)
        except (TypeError, ValueError):
            precio = None
        if not nombre or not codigo or precio is None or precio < 0:
            avisos.append(f"fila {n}: falta nombre, código o precio válido → se saltea ({list(f.values())})")
            continue
        if codigo in registros:
            avisos.append(f"fila {n}: código {codigo} repetido → se usa la última aparición")
        linea    = _texto(f["linea"]) or None
        subclase = _texto(f["subclase"]) or None
        registros[codigo] = {
            "codigo":      codigo,
            "linea":       linea,
            "subclase":    subclase,
            "nombre":      nombre,
            # descripción inicial editable desde la app; una reimportación no la pisa
            "descripcion": " · ".join(x for x in (linea, subclase) if x),
            "precio":      precio,
            "stock":       convertir_stock(f["stock"]),
        }
    return list(registros.values()), avisos
