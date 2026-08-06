"""
Siembra las tablas espejo de Supabase (catalogo_inventario, existencias,
wo_terceros, wo_cartera) a partir del export CSV de las vistas de World Office
(vistas_export/). Es un reemplazo manual del agente de sincronización
(agente.py) para desarrollo/pruebas sin conexión ODBC — llama a la misma
lógica de transformación que usa el agente real, solo cambia de dónde vienen
las filas (CSV en vez de un cursor ODBC).

Requiere SUPABASE_SERVICE_ROLE_KEY en scripts/.env (no el anon key), porque
estas tablas no tienen policy de escritura para roles normales.

Uso:
    cd scripts
    pip install -r requirements.txt
    cp .env.example .env   # y completa SUPABASE_SERVICE_ROLE_KEY
    python sembrar_wo.py
"""
import csv
import logging
import os
from pathlib import Path

import sync_cartera
import sync_inventario
import sync_terceros
from wo_common import crear_cliente_supabase

log = logging.getLogger("sembrar_wo")

VISTAS_DIR = Path(os.environ.get("VISTAS_EXPORT_DIR", "/Users/anita/Downloads/vistas_export"))


def leer_csv(nombre):
    with open(VISTAS_DIR / nombre, encoding="utf-8-sig", newline="") as f:
        yield from csv.DictReader(f)


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    client = crear_cliente_supabase()

    sync_inventario.sembrar_catalogo_y_existencias(
        leer_csv("Vista_Tabla_Inventarios.csv"),
        leer_csv("Vista_ExistenciasPorBodegas.csv"),
        client
    )
    sync_terceros.sembrar_terceros(leer_csv("Vista_Tabla_Terceros.csv"), client)
    sync_cartera.sembrar_cartera(
        leer_csv("Vista_CuentasPorCobrar.csv"),
        leer_csv("Vista_CuentasPorCobrar_Detallada.csv"),
        client
    )
    log.info("Listo.")


if __name__ == "__main__":
    main()
