"""XLSX → CSV converter — produce CSVs normalizados para TD Digdag.

Lee:
  catalogo/Catalogo-Nestle-MX.xlsx       → catalogo/_derived/*.csv (10 CSVs)
  insumos/*Whatsapp*.xlsx                → insumos/_derived/wa_envios.csv

Reusa la lógica de parsing WA probada en my/scripts/reload_catalog.py (en el
AI studio local). Es el mismo código, solo que el sink es CSV en vez de TD.

Qcart NO se procesa aquí — los CSVs raw ya están en insumos/ y se cargan
directo con td_load>.

Uso: python xlsx_to_csv.py --repo-root <ruta>
"""
from __future__ import annotations

import argparse
import csv
import datetime
import io
import os
import re
import sys
from pathlib import Path

try:
    import openpyxl  # type: ignore
except ImportError:
    print("FATAL: openpyxl no instalado. En GitHub Actions: pip install openpyxl", file=sys.stderr)
    sys.exit(2)


# ────────────────────────────────────────────────────────────
#  Catálogo: hojas → CSV (nombres de archivo alineados a tabla land_*)
# ────────────────────────────────────────────────────────────
SHEET_TO_CSV = {
    "Vocab_BU":          "vocab_bu.csv",
    "Vocab_Marcas":      "vocab_marcas.csv",
    "Vocab_Campanas":    "vocab_campanas.csv",
    "Vocab_Objetivos":   "vocab_objetivos.csv",
    "Vocab_Touchpoints": "vocab_touchpoints_brief.csv",
    "Vocab_Segmentos":   "vocab_segmentos.csv",
    "Piezas":            "piezas.csv",
    "Pieza_Segmento":    "pieza_segmento.csv",
    "Nombres":           "nombres.csv",
    "Shortlinks":        "shortlinks.csv",
}


def _cell_to_csv(v):
    if v is None:
        return ""
    if isinstance(v, datetime.datetime):
        return v.strftime("%Y-%m-%d %H:%M:%S") if (v.hour or v.minute or v.second) else v.strftime("%Y-%m-%d")
    if isinstance(v, datetime.date):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)


def _write_csv(path: Path, headers: list[str], rows: list):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, quoting=csv.QUOTE_MINIMAL)
        w.writerow(headers)
        for r in rows:
            w.writerow([_cell_to_csv(c) for c in r])


def convert_catalogo(xlsx_path: Path, out_dir: Path) -> list[Path]:
    wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
    produced: list[Path] = []
    for sheet_name, csv_name in SHEET_TO_CSV.items():
        if sheet_name not in wb.sheetnames:
            print(f"  AVISO catálogo: hoja '{sheet_name}' no encontrada")
            continue
        ws = wb[sheet_name]
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            continue
        headers = [str(h) if h is not None else f"col{i}" for i, h in enumerate(rows[0])]
        n_cols = len(headers)
        data = [
            tuple(r) + (None,) * max(0, n_cols - len(r))
            for r in rows[1:]
            if any(c is not None and str(c).strip() != "" for c in r)
        ]
        out = out_dir / csv_name
        _write_csv(out, headers, data)
        print(f"  ✓ {csv_name}: {len(data)} filas")
        produced.append(out)
    wb.close()
    return produced


# ────────────────────────────────────────────────────────────
#  WA: 3 parsers → 1 CSV consolidado (wa_envios.csv)
#  (lógica ported from reload_catalog.py, inchanged where it counts)
# ────────────────────────────────────────────────────────────
WA_CLICKS_OVERRIDE = {
    "WA-MUNDIAL-SEMIFINAL-A": "289",
    "WA-MUNDIAL-SEMIFINAL-B": "369",
    "WA-MUNDIAL-FINALES":     "616",
}
WA_SKIP_NOMBRES = {"WA-MUNDIAL-CRM-HIVE"}
_TRANS = str.maketrans("áéíóúüñÁÉÍÓÚÜÑ", "aeiouunAEIOUUN")


def _wa_key(s: str) -> str:
    return re.sub(r"[^A-Z0-9]+", "-", s.strip().upper().translate(_TRANS)).strip("-")


def _parse_date(val):
    if val is None or val == "":
        return None
    if isinstance(val, datetime.datetime):
        return val.strftime("%Y-%m-%d")
    if isinstance(val, datetime.date):
        return val.strftime("%Y-%m-%d")
    s = str(val).strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y"):
        try:
            return datetime.datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None


def _quincena(val):
    d = _parse_date(val)
    if not d:
        return None
    yyyy, mm, dd = d.split("-")
    return f"{yyyy}-{mm}-Q1" if int(dd) <= 15 else f"{yyyy}-{mm}-Q2"


def _mes(val):
    d = _parse_date(val)
    return d[:7] if d else None


def _safe_int(v):
    if v is None or v == "":
        return None
    try:
        return int(float(str(v).replace(",", "").strip()))
    except (ValueError, TypeError):
        return None


def _hdr(header_row) -> dict:
    return {
        str(h).strip().lower().translate(_TRANS) if h else "": i
        for i, h in enumerate(header_row)
    }


def _get(row, hmap, *keys):
    for k in keys:
        if k in hmap:
            return row[hmap[k]]
    return None


def _parse_wa_hotcakes(ws):
    rows = list(ws.iter_rows(values_only=True))
    hmap = _hdr(rows[0])
    result = []
    for row in rows[1:]:
        seg = _get(row, hmap, "segmento")
        utm = _get(row, hmap, "utm_content")
        fecha = _get(row, hmap, "fecha de envio")
        sends = _safe_int(_get(row, hmap, "envios"))
        if not seg or not utm or sends is None:
            continue
        result.append({
            "nombre_wa": f"WA-HOTCAKES-{str(utm).strip().upper()}-{_wa_key(str(seg))}",
            "send_date": _parse_date(fecha),
            "quincena": _quincena(fecha),
            "mes": _mes(fecha),
            "sends": sends,
            "deliveries": _safe_int(_get(row, hmap, "entregas")),
            "opens_read": _safe_int(_get(row, hmap, "opens")),
            "clicks": _safe_int(_get(row, hmap, "clicks")),
            "errores": _safe_int(_get(row, hmap, "errores")),
            "no_entregados": None,
        })
    return result


def _parse_wa_mundial(ws):
    rows = list(ws.iter_rows(values_only=True))
    hmap = _hdr(rows[0])
    result = []
    for row in rows[1:]:
        journey = _get(row, hmap, "journey")
        sends = _safe_int(_get(row, hmap, "envios"))
        if not journey or str(journey).strip() in ("", "Journey", "Totales"):
            continue
        if sends is None:
            continue
        nombre_wa = f"WA-MUNDIAL-{_wa_key(str(journey))}"
        if nombre_wa in WA_SKIP_NOMBRES:
            continue
        result.append({
            "nombre_wa": nombre_wa,
            "send_date": None,
            "quincena": None,
            "mes": None,
            "sends": sends,
            "deliveries": _safe_int(_get(row, hmap, "entregados")),
            "opens_read": _safe_int(_get(row, hmap, "leidos")),
            "clicks": _safe_int(_get(row, hmap, "clicks")),
            "errores": None,
            "no_entregados": _safe_int(_get(row, hmap, "no entregados")),
        })
    return result


def _parse_wa_sfmc(ws):
    rows = list(ws.iter_rows(values_only=True))
    hmap = _hdr(rows[0])
    sends_key = next((k for k in hmap if "total sent" in k and "rate" not in k), None)
    deliv_key = next((k for k in hmap if "total received" in k and "rate" not in k), None)
    read_key = next((k for k in hmap if k == "read"), None)
    clicks_key = next((k for k in hmap if k == "clicks" or "clicks realistas" in k), None)
    result = []
    for row in rows[1:]:
        journey_raw = _get(row, hmap, "journey name")
        if not journey_raw:
            continue
        journey = str(journey_raw).split("\n")[0].strip()
        if journey.strip().upper() in ("TOTAL", "TOTALES", "TOTALS"):
            continue
        date_val = _get(row, hmap, "date")
        if not journey or str(date_val).strip().lower() in ("totales", "totals", "total"):
            continue
        sends = _safe_int(row[hmap[sends_key]] if sends_key else None)
        if sends is None:
            continue
        result.append({
            "nombre_wa": journey,
            "send_date": _parse_date(date_val),
            "quincena": _quincena(date_val),
            "mes": _mes(date_val),
            "sends": sends,
            "deliveries": _safe_int(row[hmap[deliv_key]] if deliv_key else None),
            "opens_read": _safe_int(row[hmap[read_key]] if read_key else None),
            "clicks": _safe_int(row[hmap[clicks_key]] if clicks_key else None),
            "errores": None,
            "no_entregados": None,
        })
    return result


_SKIP_SHEETS = {"bau 2025 nescafe", "abuelita"}
_SFMC_SHEETS = {"tercer tiempo", "maggi liga mx", "ice"}


def convert_wa(xlsx_path: Path, out_dir: Path) -> Path | None:
    wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
    all_rows = []
    for sheet_name in wb.sheetnames:
        key = sheet_name.strip().lower().translate(_TRANS)
        if key in _SKIP_SHEETS:
            continue
        ws = wb[sheet_name]
        if key == "hotcakes":
            parsed = _parse_wa_hotcakes(ws)
        elif key == "maggi mundial":
            parsed = _parse_wa_mundial(ws)
        elif key in _SFMC_SHEETS:
            parsed = _parse_wa_sfmc(ws)
        else:
            continue
        all_rows.extend(parsed)
    wb.close()

    for r in all_rows:
        if r["nombre_wa"] in WA_CLICKS_OVERRIDE and not r.get("clicks"):
            r["clicks"] = int(WA_CLICKS_OVERRIDE[r["nombre_wa"]])

    if not all_rows:
        print("  AVISO WA: XLSX sin filas parseables")
        return None

    headers = ["nombre_wa", "send_date", "quincena", "mes",
               "sends", "deliveries", "opens_read", "clicks", "errores", "no_entregados"]
    rows_tup = [tuple(r.get(h) for h in headers) for r in all_rows]
    out = out_dir / "wa_envios.csv"
    _write_csv(out, headers, rows_tup)
    print(f"  ✓ wa_envios.csv: {len(rows_tup)} filas")
    return out


# ────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo-root", type=Path, default=Path.cwd(),
                    help="Raíz del repo (default: cwd)")
    args = ap.parse_args()

    repo = args.repo_root
    base = repo / "negocio/nestle/reportes-consolidado"
    cat_in  = base / "catalogo"
    cat_out = cat_in / "_derived"
    ins_in  = base / "insumos"
    ins_out = ins_in / "_derived"

    produced: list[Path] = []

    # Catálogo
    cat_xlsx = cat_in / "Catalogo-Nestle-MX.xlsx"
    if cat_xlsx.exists():
        print(f"\n=== Catálogo: {cat_xlsx.name} ===")
        produced.extend(convert_catalogo(cat_xlsx, cat_out))
    else:
        print(f"AVISO: {cat_xlsx} no existe")

    # WA — todos los XLSX con 'whatsapp' en el nombre (case-insensitive)
    if ins_in.exists():
        for p in sorted(ins_in.glob("*.xlsx")):
            if p.name.startswith("~$"):
                continue
            if "whatsapp" in p.name.lower() or "wa-" in p.name.lower() or "_wa_" in p.name.lower():
                print(f"\n=== WA: {p.name} ===")
                out = convert_wa(p, ins_out)
                if out:
                    produced.append(out)

    print(f"\n=== Producidos {len(produced)} CSVs ===")
    for p in produced:
        rel = p.relative_to(repo)
        size = p.stat().st_size
        print(f"  {rel} ({size:,} bytes)")


if __name__ == "__main__":
    main()
