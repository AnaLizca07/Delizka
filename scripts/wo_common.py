"""
Helpers compartidos entre sembrar_wo.py (CSV, manual) y el agente real
(ODBC, agente.py). No saben de dónde vienen las filas — reciben dicts ya
armados, sin importar si el origen fue csv.DictReader o un cursor de pyodbc.
"""
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

BATCH_SIZE = 500

log = logging.getLogger(__name__)


def crear_cliente_supabase(env_dir: Path = None):
    load_dotenv((env_dir or Path(__file__).parent) / ".env")
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])


def a_float(valor, default=0.0):
    try:
        return float(valor)
    except (TypeError, ValueError):
        return default


def es_activo(valor):
    """World Office representa booleanos al estilo Access/VB: -1 = verdadero, 0 = falso.

    Acepta tanto el string que trae un export CSV ("-1", "0", "") como el
    valor nativo que puede devolver pyodbc para una columna bit/smallint
    (bool, int, None) — el agente ODBC llama a esta misma función.
    """
    if valor is None:
        return False
    if isinstance(valor, bool):
        return valor
    if isinstance(valor, (int, float)):
        return valor not in (0, 0.0)
    return (valor or "").strip() not in ("0", "", "0.0")


def normalizar_identificacion(valor):
    """Solo dígitos — para cruzar clientes.identificacion contra los valores
    de identificación de World Office (que pueden traer puntos, guiones o
    espacios). Debe coincidir exactamente con la normalización usada en el
    RPC reconciliar_pedidos_nivel2() (migración 0021)."""
    return "".join(c for c in (valor or "") if c.isdigit())


def lotes(items, tam=BATCH_SIZE):
    for i in range(0, len(items), tam):
        yield items[i:i + tam]


def upsert_por_lotes(client, tabla, filas, on_conflict, tam=BATCH_SIZE):
    total = 0
    for lote in lotes(filas, tam):
        client.table(tabla).upsert(lote, on_conflict=on_conflict).execute()
        total += len(lote)
        log.info("  %s: %d/%d", tabla, total, len(filas))
    return total


def dedup_por_clave(filas, clave):
    """Un mismo lote de upsert no puede tocar la misma fila dos veces, y hay
    vistas de World Office con claves naturales duplicadas (visto en datos
    reales de Vista_Tabla_Terceros). Se queda con la última ocurrencia."""
    por_clave = {}
    for fila in filas:
        k = fila.get(clave)
        if k:
            por_clave[k] = fila
    return list(por_clave.values())


def mapear_id_generado(client, tabla, columna_natural, columna_id="id", tam_pagina=1000):
    """Lee de vuelta una tabla ya sembrada, paginando, para construir un mapa
    clave_natural -> id generado por Postgres (necesario cuando otra tabla
    referencia ese id por FK en vez de la clave natural de World Office)."""
    mapa = {}
    pagina = 0
    while True:
        resp = (
            client.table(tabla)
            .select(f"{columna_id}, {columna_natural}")
            .range(pagina * tam_pagina, pagina * tam_pagina + tam_pagina - 1)
            .execute()
        )
        if not resp.data:
            break
        for r in resp.data:
            mapa[r[columna_natural]] = r[columna_id]
        if len(resp.data) < tam_pagina:
            break
        pagina += 1
    return mapa
