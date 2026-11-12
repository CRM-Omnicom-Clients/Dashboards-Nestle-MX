#!/usr/bin/env python3
"""
build_dashboard_data.py — genera dashboards/reporte-datos.js desde nmx_reporte en TD.

Lee rpt_email, rpt_whatsapp y rpt_qcart, construye los arrays AON/OS/WA
y los escribe en reporte-datos.js. El HTML del dashboard nunca se toca.

Uso:
  uv run --with pytd workflow/scripts/build_dashboard_data.py

Variables de entorno requeridas (o perfil tdx configurado):
  TD_API_KEY  — se lee del perfil tdx si no está en el entorno
"""
# /// script
# requires-python = ">=3.9"
# dependencies = ["pytd"]
# ///
import datetime
import json
import os
import subprocess
import sys
from pathlib import Path

# ── rutas ──────────────────────────────────────────────────────────────────
REPO_ROOT   = Path(__file__).resolve().parents[4]
DATOS_JS    = REPO_ROOT / "dashboards" / "reporte-datos.js"

# ── helpers TD ──────────────────────────────────────────────────────────────
def tdx(sql, db="nmx_reporte"):
    """Ejecuta una query en TD via CLI tdx y devuelve lista de dicts."""
    result = subprocess.run(
        ["tdx", "query", "--database", db, "--jsonl", sql],
        capture_output=True, text=True, check=True
    )
    rows = []
    for line in result.stdout.strip().splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return rows

# ── queries ──────────────────────────────────────────────────────────────────
SQL_EMAIL = "SELECT * FROM rpt_email ORDER BY tipo_envio, marca, campana, pieza_id"
SQL_WA    = "SELECT * FROM rpt_whatsapp ORDER BY marca, campana, pieza_id"
SQL_QCART = "SELECT pieza_id, rec, fd, fh, cw, cc, ct, vc, vpn, itn, inn, pct, tkt_c, tkt_p FROM rpt_qcart"

def build():
    print("Leyendo rpt_email ...")
    email_rows = tdx(SQL_EMAIL)
    print(f"  {len(email_rows)} filas")

    print("Leyendo rpt_whatsapp ...")
    wa_rows = tdx(SQL_WA)
    print(f"  {len(wa_rows)} filas")

    print("Leyendo rpt_qcart ...")
    qcart_rows = tdx(SQL_QCART)
    qcart_map = {r["pieza_id"]: {k: v for k, v in r.items() if k != "pieza_id"}
                 for r in qcart_rows}
    print(f"  {len(qcart_rows)} filas")

    # Adjuntar _qc a cada fila de email
    for row in email_rows:
        row["_qc"] = qcart_map.get(row.get("pieza_id"))

    # Separar AON vs OS
    aon = [r for r in email_rows if r.get("tipo_envio") == "always-on"]
    os_ = [r for r in email_rows if r.get("tipo_envio") != "always-on"]

    print(f"\nAON: {len(aon)} · OS: {len(os_)} · WA: {len(wa_rows)}")

    # Escribir JS
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    js = (
        f"// reporte-datos.js — generado {ts} por build_dashboard_data.py\n"
        f"// NO EDITAR A MANO. Correr: uv run workflow/scripts/build_dashboard_data.py\n"
        f"const AON = {json.dumps(aon, ensure_ascii=False, default=str)};\n"
        f"const OS = {json.dumps(os_, ensure_ascii=False, default=str)};\n"
        f"const WA = {json.dumps(wa_rows, ensure_ascii=False, default=str)};\n"
    )
    DATOS_JS.write_text(js, encoding="utf-8")
    print(f"\nEscrito: {DATOS_JS}  ({len(js):,} bytes)")

if __name__ == "__main__":
    build()
