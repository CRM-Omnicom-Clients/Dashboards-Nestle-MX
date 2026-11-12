#!/usr/bin/env python3
"""
Recarga el catálogo y los insumos (WA, Qcart) desde GitHub a nmx_insumos en TD.

Rick sube los archivos raw a insumos/ en el repo (sin procesar).
Este script los normaliza y los carga a las tablas land_* en nmx_insumos.

Uso:
  uv run --with openpyxl /home/agent/work/2026-09-10_gp5b06/my/scripts/reload_catalog.py
"""
# /// script
# requires-python = ">=3.9"
# dependencies = ["openpyxl"]
# ///
import csv
import io
import json
import subprocess
import sys
import urllib.request
from urllib.parse import quote

OWNER    = "CRM-Omnicom-Clients"
REPO     = "Dashboards-Nestle-MX"
REPO_RAW = f"https://raw.githubusercontent.com/{OWNER}/{REPO}/main"
REPO_API = f"https://api.github.com/repos/{OWNER}/{REPO}"
REPO_BASE = "negocio/nestle/reportes-consolidado"

_TOKEN_FILE = "/home/agent/work/2026-09-10_gp5b06/my/TOKEN DASHBOARDS 1.txt"
def _load_token() -> str:
    with open(_TOKEN_FILE, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line.startswith("github_pat_"):
                return line
    raise RuntimeError(f"Token no encontrado en {_TOKEN_FILE}")
GITHUB_TOKEN = _load_token()

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

# ── Helpers ────────────────────────────────────────────────────────────────────

_TRANS = str.maketrans("áéíóúüñÁÉÍÓÚÜÑ", "aeiouunAEIOUUN")

def _wa_key(s: str) -> str:
    """Sanitize to ASCII uppercase for WA shortcode keys (WA-HOTCAKES-C1-SALUDABLES)."""
    return s.strip().upper().translate(_TRANS).replace(" ", "-")

def _quincena(date_val) -> str | None:
    if not date_val:
        return None
    s = str(date_val)[:10]
    try:
        day = int(s[8:10])
    except (ValueError, IndexError):
        return None
    return f"{s[:7]}-Q1" if day <= 15 else f"{s[:7]}-Q2"

def _mes(date_val) -> str | None:
    if not date_val:
        return None
    return str(date_val)[:7]

def _safe_int(v) -> int | None:
    if v is None:
        return None
    s = str(v).strip()
    if s in ("", "N/A", "-", "None", "#N/A", "nan"):
        return None
    try:
        return int(float(s.replace(",", ".").replace("%", "")))
    except (ValueError, TypeError):
        return None

def tdx(sql: str):
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

def fetch_raw(path_suffix: str) -> bytes:
    url = f"{REPO_RAW}/{path_suffix}"
    req = urllib.request.Request(url, headers={"Authorization": f"token {GITHUB_TOKEN}"})
    with urllib.request.urlopen(req) as resp:
        return resp.read()

def list_insumos() -> list:
    url = f"{REPO_API}/contents/{REPO_BASE}/insumos"
    req = urllib.request.Request(url, headers={
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
    })
    with urllib.request.urlopen(req) as r:
        return json.load(r)

BATCH_SIZE = 800

def _ctas_insert(table: str, db: str, headers: list, padded: list):
    cols_sql = ", ".join(headers)
    total_batches = -(-len(padded) // BATCH_SIZE)
    for i in range(0, len(padded), BATCH_SIZE):
        batch = padded[i : i + BATCH_SIZE]
        values_sql = ", ".join(
            f"({', '.join(escape(cell) for cell in row)})" for row in batch
        )
        if i == 0:
            tdx(f"CREATE TABLE {db}.{table} AS SELECT * FROM (VALUES {values_sql}) AS t({cols_sql})")
        else:
            tdx(f"INSERT INTO {db}.{table} ({cols_sql}) SELECT {cols_sql} FROM (VALUES {values_sql}) AS t({cols_sql})")
        print(f"    batch {i // BATCH_SIZE + 1}/{total_batches}: {len(batch)} filas")
    print(f"  ✓ {table}: {len(padded)} filas")

# ── Catálogo XLSX ──────────────────────────────────────────────────────────────

def load_sheet(wb, sheet_name: str, table: str, db: str):
    if sheet_name not in wb.sheetnames:
        print(f"  AVISO: hoja '{sheet_name}' no encontrada, omitida.")
        return
    ws = wb[sheet_name]
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return
    headers = [str(h) if h is not None else f"col{i}" for i, h in enumerate(rows[0])]
    n_cols = len(headers)
    data_rows = [
        tuple(row) + (None,) * max(0, n_cols - len(row))
        for row in rows[1:]
        if any(c is not None and str(c).strip() != "" for c in row)
    ]
    if not data_rows:
        print(f"  AVISO: hoja '{sheet_name}' sin datos.")
        return
    print(f"  Cargando {db}.{table} ({len(data_rows)} filas)...")
    tdx(f"DROP TABLE IF EXISTS {db}.{table}")
    cols_sql   = ", ".join(headers)
    values_sql = ", ".join(
        f"({', '.join(escape(cell) for cell in row)})" for row in data_rows
    )
    tdx(f"CREATE TABLE {db}.{table} AS SELECT * FROM (VALUES {values_sql}) AS t({cols_sql})")
    print(f"  ✓ {table}: {len(data_rows)} filas")

# ── WA XLSX — parsers por hoja ─────────────────────────────────────────────────

def _hdr(header_row) -> dict:
    """Map sanitized lowercase header → column index."""
    return {
        str(h).strip().lower().translate(_TRANS) if h else "": i
        for i, h in enumerate(header_row)
    }

def _get(row, hmap, *keys):
    """Return first matching column value from hmap."""
    for k in keys:
        if k in hmap:
            return row[hmap[k]]
    return None

def _parse_wa_hotcakes(ws) -> list:
    rows = list(ws.iter_rows(values_only=True))
    hmap = _hdr(rows[0])
    result = []
    for row in rows[1:]:
        segmento = _get(row, hmap, "segmento")
        utm      = _get(row, hmap, "utm_content")
        fecha    = _get(row, hmap, "fecha de envio")
        sends    = _safe_int(_get(row, hmap, "envios"))
        if not segmento or not utm or sends is None:
            continue
        result.append({
            "nombre_wa":    f"WA-HOTCAKES-{str(utm).strip().upper()}-{_wa_key(str(segmento))}",
            "send_date":    str(fecha)[:10] if fecha else None,
            "quincena":     _quincena(fecha),
            "mes":          _mes(fecha),
            "sends":        sends,
            "deliveries":   _safe_int(_get(row, hmap, "entregas")),
            "opens_read":   _safe_int(_get(row, hmap, "opens")),
            "clicks":       _safe_int(_get(row, hmap, "clicks")),
            "errores":      _safe_int(_get(row, hmap, "errores")),
            "no_entregados": None,
        })
    return result

def _parse_wa_mundial(ws) -> list:
    rows = list(ws.iter_rows(values_only=True))
    hmap = _hdr(rows[0])
    result = []
    for row in rows[1:]:
        journey = _get(row, hmap, "journey")
        sends   = _safe_int(_get(row, hmap, "envios"))
        if not journey or str(journey).strip() in ("", "Journey", "Totales"):
            continue
        if sends is None:
            continue
        result.append({
            "nombre_wa":    f"WA-MUNDIAL-{_wa_key(str(journey))}",
            "send_date":    None,
            "quincena":     None,
            "mes":          None,
            "sends":        sends,
            "deliveries":   _safe_int(_get(row, hmap, "entregados")),
            "opens_read":   _safe_int(_get(row, hmap, "leidos")),
            "clicks":       _safe_int(_get(row, hmap, "clicks")),
            "errores":      None,
            "no_entregados": _safe_int(_get(row, hmap, "no entregados")),
        })
    return result

def _parse_wa_sfmc(ws) -> list:
    """Sheets with full SFMC Journey Name (Tercer Tiempo, Maggi Liga MX, ICE)."""
    rows = list(ws.iter_rows(values_only=True))
    hmap = _hdr(rows[0])
    # Find column keys dynamically
    sends_key  = next((k for k in hmap if "total sent" in k and "rate" not in k), None)
    deliv_key  = next((k for k in hmap if "total received" in k and "rate" not in k), None)
    read_key   = next((k for k in hmap if k == "read"), None)
    clicks_key = next((k for k in hmap if k == "clicks" or "clicks realistas" in k), None)

    result = []
    for row in rows[1:]:
        journey_raw = _get(row, hmap, "journey name")
        if not journey_raw:
            continue
        # Take the first journey name when multiple are separated by newlines
        journey = str(journey_raw).split("\n")[0].strip()
        date_val = _get(row, hmap, "date")
        if not journey or str(date_val).strip().lower() in ("totales", "totals", "total"):
            continue
        sends = _safe_int(row[hmap[sends_key]] if sends_key else None)
        if sends is None:
            continue
        result.append({
            "nombre_wa":    journey,
            "send_date":    str(date_val)[:10] if date_val else None,
            "quincena":     _quincena(date_val),
            "mes":          _mes(date_val),
            "sends":        sends,
            "deliveries":   _safe_int(row[hmap[deliv_key]] if deliv_key else None),
            "opens_read":   _safe_int(row[hmap[read_key]] if read_key else None),
            "clicks":       _safe_int(row[hmap[clicks_key]] if clicks_key else None),
            "errores":      None,
            "no_entregados": None,
        })
    return result

_SKIP_SHEETS  = {"bau 2025 nescafe", "bau 2025 nescafe", "abuelita"}
_SFMC_SHEETS  = {"tercer tiempo", "maggi liga mx", "ice"}

def _parse_wa_xlsx(wb) -> list:
    all_rows = []
    for sheet_name in wb.sheetnames:
        key = sheet_name.strip().lower().translate(_TRANS)
        if key in _SKIP_SHEETS:
            print(f"  Saltando hoja '{sheet_name}'")
            continue
        ws = wb[sheet_name]
        if key == "hotcakes":
            rows = _parse_wa_hotcakes(ws)
        elif key == "maggi mundial":
            rows = _parse_wa_mundial(ws)
        elif key in _SFMC_SHEETS:
            rows = _parse_wa_sfmc(ws)
        else:
            print(f"  AVISO: hoja '{sheet_name}' sin handler, omitida.")
            continue
        print(f"    {sheet_name}: {len(rows)} filas")
        all_rows.extend(rows)
    return all_rows

def load_wa_xlsx(fname: str):
    import openpyxl
    print(f"\nCargando WA desde: {fname}")
    raw = fetch_raw(f"{REPO_BASE}/insumos/{quote(fname)}")
    wb = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
    rows = _parse_wa_xlsx(wb)
    wb.close()
    if not rows:
        print("  AVISO: sin datos WA, tabla no actualizada.")
        return
    headers = ["nombre_wa", "send_date", "quincena", "mes",
               "sends", "deliveries", "opens_read", "clicks", "errores", "no_entregados"]
    padded = [tuple(r.get(h) for h in headers) for r in rows]
    print(f"  Total WA: {len(padded)} filas")
    tdx("DROP TABLE IF EXISTS nmx_insumos.land_wa_envios")
    _ctas_insert("land_wa_envios", "nmx_insumos", headers, padded)

# ── Qcart CSVs ─────────────────────────────────────────────────────────────────

_QCART_RENAME = {
    "date":              "fecha_hora",
    "shortlink code":    "shortlink_code",
    "shortlink name":    "shortlink_name",
    "total shown price": "total_shown_price",
}

def _clean_decimal(v) -> str | None:
    """'545,32' or '"545,32"' → '545.32' (European decimal comma)."""
    if v is None:
        return None
    s = str(v).strip().strip('"').strip("'")
    if not s or s in ("-", "N/A", "None"):
        return None
    s = s.replace(",", ".")
    try:
        float(s)
        return s
    except (ValueError, TypeError):
        return None

def load_qcart_csv(fname: str, table: str):
    print(f"\nCargando {table} desde: {fname}")
    raw = fetch_raw(f"{REPO_BASE}/insumos/{quote(fname)}")
    text = raw.decode("utf-8-sig")
    reader = csv.reader(io.StringIO(text), delimiter=";")
    rows = list(reader)
    if len(rows) < 2:
        print(f"  AVISO: {fname} vacío.")
        return
    raw_headers = rows[0]
    headers = [
        _QCART_RENAME.get(h.strip().lower(),
                          h.strip().lower().replace(" ", "_").translate(_TRANS))
        for h in raw_headers
    ]
    data_rows = [r for r in rows[1:] if any(c.strip() for c in r)]
    n_cols = len(headers)
    tsp_idx = headers.index("total_shown_price") if "total_shown_price" in headers else None

    padded = []
    for row in data_rows:
        r = [row[i] if i < len(row) else None for i in range(n_cols)]
        if tsp_idx is not None:
            r[tsp_idx] = _clean_decimal(r[tsp_idx])
        padded.append(tuple(r))

    print(f"  {len(padded)} filas, {n_cols} cols")
    tdx(f"DROP TABLE IF EXISTS nmx_insumos.{table}")
    _ctas_insert(table, "nmx_insumos", headers, padded)

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    import openpyxl  # noqa

    # 1. Catalog XLSX
    print("Descargando catálogo...")
    raw = fetch_raw(f"{REPO_BASE}/catalogo/Catalogo-Nestle-MX.xlsx")
    wb = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
    print(f"Hojas: {wb.sheetnames}\n")
    for sheet_name, (table, db) in SHEET_TABLE.items():
        load_sheet(wb, sheet_name, table, db)
    wb.close()

    # 2. Discover insumos/ files dynamically
    insumos = list_insumos()
    names = [f["name"] for f in insumos]
    print(f"\nInsumos en repo: {names}")

    # WA XLSX: any .xlsx with 'whatsapp' in name (case-insensitive)
    wa_file = next(
        (n for n in names if "whatsapp" in n.lower() and n.endswith(".xlsx")), None
    )
    if wa_file:
        load_wa_xlsx(wa_file)
    else:
        print("\nAVISO: no se encontró archivo WA .xlsx en insumos/.")

    # Qcart CSVs: detected by 'carts-raw' / 'products-raw' in filename
    carts_file = next((n for n in names if "carts-raw" in n.lower() and n.endswith(".csv")), None)
    prods_file = next((n for n in names if "products-raw" in n.lower() and n.endswith(".csv")), None)

    if carts_file:
        load_qcart_csv(carts_file, "land_qcart_carritos")
    else:
        print("\nAVISO: no se encontró archivo qcart carts en insumos/.")

    if prods_file:
        load_qcart_csv(prods_file, "land_qcart_productos")
    else:
        print("\nAVISO: no se encontró archivo qcart products en insumos/.")

    print("\n✓ Recarga completa. Corre nmx_crm_reporte en TD para reconstruir nmx_catalogo + hechos.")


if __name__ == "__main__":
    main()
