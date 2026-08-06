"""
Transforma filas de Vista_Tabla_Inventarios / Vista_ExistenciasPorBodegas en
catalogo_inventario / existencias. No sabe si las filas vinieron de un CSV
(sembrar_wo.py) o de un cursor ODBC (agente.py) — recibe listas de dict ya
armadas con los nombres de columna de las vistas de World Office.
"""
import logging

from wo_common import a_float, es_activo, mapear_id_generado, upsert_por_lotes

log = logging.getLogger(__name__)

# Nombres de columna esperados (iguales a los headers de los CSV ya usados
# por sembrar_wo.py). Si la vista real de World Office trae otros nombres,
# el SELECT en agente.py debe aliasearlos con AS a estos mismos nombres.
SQL_INVENTARIOS = "SELECT * FROM Vista_Tabla_Inventarios"
SQL_EXISTENCIAS = "SELECT * FROM Vista_ExistenciasPorBodegas"

BODEGA_PRINCIPAL = "Uno"  # DEC-02: única bodega real; "Dos"/"Mayor" se ignora.


def sembrar_catalogo_y_existencias(filas_inventario, filas_existencias, client) -> dict:
    log.info("Procesando inventario…")
    productos_por_wo_id = {}
    for row in filas_inventario:
        if not es_activo(row.get("Activo")):
            continue
        wo_id = (row.get("IdInventario") or "").strip()
        codigo = (row.get("CodigoInventario") or "").strip()
        if not wo_id or not codigo:
            continue
        productos_por_wo_id[wo_id] = {
            "wo_id_inventario": wo_id,
            "codigo": codigo,
            "descripcion": (row.get("Descripcion") or "").strip() or codigo,
            "precio": a_float(row.get("Precio1")),
            "activo": True
        }
    productos = list(productos_por_wo_id.values())

    log.info("%d productos activos. Subiendo a catalogo_inventario…", len(productos))
    upsert_por_lotes(client, "catalogo_inventario", productos, on_conflict="wo_id_inventario")

    log.info("Mapeando wo_id_inventario -> id…")
    mapa_id = mapear_id_generado(client, "catalogo_inventario", "wo_id_inventario")

    log.info("Procesando existencias (solo bodega %s)…", BODEGA_PRINCIPAL)
    existencia_por_wo_id = {}
    for row in filas_existencias:
        if (row.get("Codigo_Bodega") or "").strip() != BODEGA_PRINCIPAL:
            continue
        wo_id = (row.get("IdInventario") or "").strip()
        if wo_id:
            existencia_por_wo_id[wo_id] = a_float(row.get("Existencia"))

    existencias = [
        {"inventario_id": inventario_id, "cantidad": existencia_por_wo_id.get(wo_id, 0.0)}
        for wo_id, inventario_id in mapa_id.items()
    ]

    log.info("Subiendo existencias de %d productos…", len(existencias))
    upsert_por_lotes(client, "existencias", existencias, on_conflict="inventario_id")

    return {"catalogo_inventario": len(productos), "existencias": len(existencias)}
