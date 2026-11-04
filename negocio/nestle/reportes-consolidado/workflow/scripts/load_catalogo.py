#!/usr/bin/env python3
"""
Descarga Catalogo-Nestle-MX.xlsx de GitHub y carga cada hoja a nmx_insumos.
Corre como sh> task en Digdag. Requiere: openpyxl (pip install openpyxl).
"""
import csv
import os
import subprocess
import sys
import tempfile
import urllib.request

REPO_RAW = "https://raw.githubusercontent.com/CRM-Omnicom-Clients/Dashboards-Nestle-MX/main"
XLSX_PATH = "negocio/nestle/reportes-consolidado/catalogo/Catalogo-Nestle-MX.xlsx"
XLSX_URL  = f"{REPO_RAW}/{XLSX_PATH}"

SHEET_TABLE = {
    "Vocab_BU":          "land_vocab_bu",
    "Vocab_Marcas":      "land_vocab_marcas",
    "Vocab_Campanas":    "land_vocab_campanas",
    "Vocab_Objetivos":   "land_vocab_objetivos",
    "Vocab_Touchpoints": "land_vocab_touchpoints_brief",
    "Vocab_Segmentos":   "land_vocab_segmentos",
    "Piezas":            "land_piezas",
    "Pieza_Segmento":    "land_pieza_segmento",
    "Nombres":           "land_nombres",
    "Shortlinks":        "land_shortlinks",
}

DB = "nmx_insumos"
TD_ENDPOINT = os.environ.get("TD_ENDPOINT", "api.us01.treasuredata.com")
TD_API_KEY  = os.environ.get("TD_API_KEY", "")  # pre-configured by TD workflow env
GITHUB_TOKEN = os.environ["GITHUB_TOKEN"]


def install_openpyxl():
    subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", "openpyxl"],
                   check=True)


def download_xlsx(dest: str):
    req = urllib.request.Request(XLSX_URL, headers={"Authorization": f"token {GITHUB_TOKEN}"})
    with urllib.request.urlopen(req) as resp, open(dest, "wb") as f:
        f.write(resp.read())
    print(f"Descargado: {XLSX_URL}")


def sheet_to_csv(ws, dest: str):
    rows = list(ws.iter_rows(values_only=True))
    with open(dest, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, quoting=csv.QUOTE_MINIMAL)
        for row in rows:
            writer.writerow(["" if v is None else v for v in row])
    return len(rows) - 1  # minus header


def td_import(table: str, csv_path: str):
    """Loads CSV to TD using the td CLI (pre-installed in TD workflow env)."""
    result = subprocess.run(
        ["td", "table:import",
         "--format", "csv",
         "--column-header",
         "--quote", '"',
         "--null", "",
         DB, table, csv_path],
        capture_output=True, text=True,
        env={**os.environ, "TD_API_KEY": TD_API_KEY, "ENDPOINT": TD_ENDPOINT}
    )
    if result.returncode != 0:
        print(f"  STDERR: {result.stderr}", file=sys.stderr)
        raise RuntimeError(f"td table:import falló para {table}: {result.stdout}")
    print(f"  OK → {DB}.{table}")


def main():
    install_openpyxl()
    import openpyxl  # noqa: E402 (import after install)

    with tempfile.TemporaryDirectory() as tmp:
        xlsx_file = os.path.join(tmp, "catalogo.xlsx")
        download_xlsx(xlsx_file)

        wb = openpyxl.load_workbook(xlsx_file, read_only=True, data_only=True)

        for sheet_name, table_name in SHEET_TABLE.items():
            if sheet_name not in wb.sheetnames:
                print(f"  AVISO: hoja '{sheet_name}' no encontrada en el XLSX, se omite.")
                continue
            ws = wb[sheet_name]
            csv_file = os.path.join(tmp, f"{table_name}.csv")
            n_rows = sheet_to_csv(ws, csv_file)
            print(f"  {sheet_name} → {n_rows} filas")
            td_import(table_name, csv_file)

        wb.close()

    print("✓ Carga completa a nmx_insumos")


if __name__ == "__main__":
    main()
