"""
Transforma filas de Vista_Tabla_Terceros en wo_terceros. Mirror liviano usado
como apoyo de matching (además del cruce directo que hace sync_cartera.py).
"""
import logging

from wo_common import dedup_por_clave, upsert_por_lotes

log = logging.getLogger(__name__)

SQL_TERCEROS = "SELECT * FROM Vista_Tabla_Terceros"


def sembrar_terceros(filas, client) -> dict:
    log.info("Procesando terceros…")
    terceros = dedup_por_clave(
        [
            {
                "id_tercero": (row.get("IdTercero") or "").strip(),
                "identificacion": (row.get("Identificacion") or "").strip(),
                "nombre": (row.get("Nombre") or "").strip()
            }
            for row in filas
            if (row.get("IdTercero") or "").strip()
        ],
        "id_tercero"
    )
    log.info("Subiendo %d terceros…", len(terceros))
    upsert_por_lotes(client, "wo_terceros", terceros, on_conflict="id_tercero")
    return {"wo_terceros": len(terceros)}
