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
REPO_ROOT   = Path(__file__).resolve().parents[5]
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
SQL_QCART = """
SELECT pieza_id, quincena,
  receta_representativa AS rec,
  fecha_desde  AS fd, fecha_hasta  AS fh,
  carritos_walmart AS cw, carritos_chedraui AS cc, carritos_total AS ct,
  views_carrito AS vc, views_productos_nestle AS vpn,
  intencion_total_mxn AS itn, intencion_nestle_mxn AS inn,
  pct_penetracion_nestle AS pct,
  ticket_carrito_mxn AS tkt_c, ticket_producto_mxn AS tkt_p
FROM rpt_qcart ORDER BY pieza_id, quincena
"""

def build():
    print("Leyendo rpt_email ...")
    email_rows = tdx(SQL_EMAIL)
    print(f"  {len(email_rows)} filas")

    print("Leyendo rpt_whatsapp ...")
    wa_rows = tdx(SQL_WA)
    print(f"  {len(wa_rows)} filas")

    print("Leyendo rpt_qcart ...")
    qcart_rows = tdx(SQL_QCART)
    # _qc es un dict anidado {pieza_id: {quincena: {...data...}}} para filtrado por período
    qcart_map = {}
    for r in qcart_rows:
        pid = r.pop("pieza_id")
        q   = r.pop("quincena")
        qcart_map.setdefault(pid, {})[q] = r
    print(f"  {len(qcart_rows)} filas — {len(qcart_map)} piezas con Qcart")

    # Adjuntar _qc a filas de email Y WhatsApp
    for row in [*email_rows, *wa_rows]:
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
