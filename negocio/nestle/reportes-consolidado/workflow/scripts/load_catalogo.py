#!/usr/bin/env python3
"""
Recarga el catálogo y los insumos (WA, Qcart) desde GitHub a nmx_insumos en TD.
Corre desde TD Studio cuando el XLSX o los CSVs de insumos fueron actualizados en el repo.

Uso:
  uv run --with openpyxl /home/agent/work/2026-09-10_gp5b06/my/scripts/reload_catalog.py
"""
# /// script
# requires-python = ">=3.9"
# dependencies = ["openpyxl"]
# ///
import csv
import io
import subprocess
import sys
import urllib.request

REPO_RAW = "https://raw.githubusercontent.com/CRM-Omnicom-Clients/Dashboards-Nestle-MX/main"
REPO_BASE = "negocio/nestle/reportes-consolidado"
XLSX_URL  = f"{REPO_RAW}/{REPO_BASE}/catalogo/Catalogo-Nestle-MX.xlsx"

# Token leído del archivo (no se guarda en el repo)
_TOKEN_FILE = "/home/agent/work/2026-09-10_gp5b06/my/TOKEN DASHBOARDS 1.txt"
def _load_token() -> str:
    with open(_TOKEN_FILE, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line.startswith("github_pat_"):
                return line
    raise RuntimeError(f"Token no encontrado en {_TOKEN_FILE}")
GITHUB_TOKEN = _load_token()

# CSV insumos: (url_suffix, table, db)
CSV_INSUMOS = [
    (f"{REPO_BASE}/insumos/wa_envios.csv",           "land_wa_envios",          "nmx_insumos"),
    (f"{REPO_BASE}/insumos/qcart_carritos.csv",      "land_qcart_carritos",     "nmx_insumos"),
    (f"{REPO_BASE}/insumos/qcart_productos.csv",     "land_qcart_productos",    "nmx_insumos"),
]

SHEET_TABLE = {
    "Vocab_BU":          ("land_vocab_bu",               "nmx_insumos"),
    "Vocab_Marcas":      ("land_vocab_marcas",            "nmx_insumos"),
    "Vocab_Campanas":    ("land_vocab_campanas",          "nmx_insumos"),
    "Vocab_Objetivos":   ("land_vocab_objetivos",         "nmx_insumos"),
    "Vocab_Touchpoints": ("land_vocab_touchpoints_brief", "nmx_insumos"),
    "Vocab_Segmentos":   ("land_vocab_segmentos",         "nmx_insumos"),
    "Piezas":            ("land_piezas",                  "nmx_insumos"),
    "Pieza_Segmento":    ("land_pieza_segmento",          "nmx_insumos"),
    "Nombres":           ("land_nombres",                 "nmx_insumos"),
    "Shortlinks":        ("land_shortlinks",              "nmx_insumos"),
}


def tdx(sql: str):
    # Use stdin (-) to avoid "Argument list too long" for large queries
    result = subprocess.run(["tdx", "query", "-"],
                            input=sql, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  ERROR: {result.stderr[:400]}", file=sys.stderr)
        raise RuntimeError(f"tdx query falló: {result.stderr[:200]}")
    return result.stdout


def escape(v) -> str:
    if v is None or str(v).strip() == "":
        return "CAST(NULL AS VARCHAR)"
    s = str(v).replace("'", "''")
    return f"'{s}'"


def load_sheet(wb, sheet_name: str, table: str, db: str):
    if sheet_name not in wb.sheetnames:
        print(f"  AVISO: hoja '{sheet_name}' no encontrada, omitida.")
        return

    ws = wb[sheet_name]
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        print(f"  AVISO: hoja '{sheet_name}' vacía.")
        return

    headers = [str(h) if h is not None else f"col{i}" for i, h in enumerate(rows[0])]
    n_cols = len(headers)
    # Pad rows — openpyxl omits trailing None cells from short rows
    data_rows = [
        tuple(row) + (None,) * max(0, n_cols - len(row))
        for row in rows[1:]
        if any(c is not None and str(c).strip() != "" for c in row)
    ]

    if not data_rows:
        print(f"  AVISO: hoja '{sheet_name}' sin datos, omitida.")
        return

    print(f"  Cargando {db}.{table} ({len(data_rows)} filas, {n_cols} cols)...")
    tdx(f"DROP TABLE IF EXISTS {db}.{table}")

    # Single CTAS — no batching avoids INSERT column-count mismatch with TD's auto time column
    cols_sql   = ", ".join(headers)
    values_sql = ", ".join(
        f"({', '.join(escape(cell) for cell in row)})"
        for row in data_rows
    )
    tdx(
        f"CREATE TABLE {db}.{table} AS "
        f"SELECT * FROM (VALUES {values_sql}) AS t({cols_sql})"
    )
    print(f"  ✓ {table}: {len(data_rows)} filas")


def fetch_raw(path_suffix: str) -> bytes:
    url = f"{REPO_RAW}/{path_suffix}"
    req = urllib.request.Request(url, headers={"Authorization": f"token {GITHUB_TOKEN}"})
    with urllib.request.urlopen(req) as resp:
        return resp.read()


BATCH_SIZE = 800  # rows per INSERT batch (keeps SQL < 1M chars for wide tables)


def load_csv(url_suffix: str, table: str, db: str):
    print(f"  Descargando {url_suffix.split('/')[-1]}...")
    try:
        raw = fetch_raw(url_suffix)
    except Exception as e:
        print(f"  AVISO: no se pudo descargar {url_suffix} — {e}. Omitido.")
        return

    text = raw.decode("utf-8-sig")
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if len(rows) < 2:
        print(f"  AVISO: {url_suffix} vacío, omitido.")
        return

    headers = rows[0]
    # Sanitize headers for Presto: replace special chars with ASCII equivalents
    _replacements = str.maketrans('áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')
    headers = [h.translate(_replacements) for h in headers]
    data_rows = [r for r in rows[1:] if any(c.strip() for c in r)]
    n_cols = len(headers)
    padded = [
        tuple(row[i] if i < len(row) else None for i in range(n_cols))
        for row in data_rows
    ]

    print(f"  Cargando {db}.{table} ({len(padded)} filas, {n_cols} cols)...")
    tdx(f"DROP TABLE IF EXISTS {db}.{table}")

    cols_sql = ", ".join(headers)
    # Chunk into batches to stay under TD's 1M-char query limit
    for i in range(0, len(padded), BATCH_SIZE):
        batch = padded[i:i + BATCH_SIZE]
        values_sql = ", ".join(
            f"({', '.join(escape(cell) for cell in row)})"
            for row in batch
        )
        if i == 0:
            # First batch: CTAS — auto-creates table including TD's time column
            tdx(
                f"CREATE TABLE {db}.{table} AS "
                f"SELECT * FROM (VALUES {values_sql}) AS t({cols_sql})"
            )
        else:
            # Subsequent batches: INSERT using explicit column list
            tdx(
                f"INSERT INTO {db}.{table} ({cols_sql}) "
                f"SELECT {cols_sql} FROM (VALUES {values_sql}) AS t({cols_sql})"
            )
        print(f"    batch {i // BATCH_SIZE + 1}/{-(-len(padded) // BATCH_SIZE)}: {len(batch)} filas")

    print(f"  ✓ {table}: {len(padded)} filas")


def main():
    import openpyxl  # noqa (installed by uv)

    print(f"Descargando catálogo desde GitHub...")
    req = urllib.request.Request(XLSX_URL,
                                 headers={"Authorization": f"token {GITHUB_TOKEN}"})
    with urllib.request.urlopen(req) as resp:
        xlsx_bytes = resp.read()

    wb = openpyxl.load_workbook(io.BytesIO(xlsx_bytes), read_only=True, data_only=True)
    print(f"Hojas: {wb.sheetnames}\n")

    for sheet_name, (table, db) in SHEET_TABLE.items():
        load_sheet(wb, sheet_name, table, db)

    wb.close()

    print("\nCargando insumos CSV (WA, Qcart)...")
    for url_suffix, table, db in CSV_INSUMOS:
        load_csv(url_suffix, table, db)

    print("\n✓ Recarga completa. Corre nmx_crm_reporte.catalogo en TD para reconstruir nmx_catalogo.")


if __name__ == "__main__":
    main()
