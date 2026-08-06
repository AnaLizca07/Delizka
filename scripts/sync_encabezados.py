"""
Transforma filas de Vista_Tabla_Encabezados en wo_documentos_encabezados —
el universo de búsqueda que usa reconciliar_pedidos_nivel2() (migración
0021). No existe ningún CSV/export de referencia de esta vista en el repo
todavía, así que los nombres de columna de abajo son un mejor esfuerzo por
analogía con las demás vistas de World Office (Vista_Tabla_Inventarios,
Vista_Tabla_Terceros) — CONFIRMAR con --dry-run contra el servidor real y
ajustar los alias del SELECT si no coinciden. No se filtra por
tipo_documento aquí a propósito: ese filtro vive en el RPC de
reconciliación, para poder ajustarlo sin tener que re-sincronizar.
"""
import logging

from wo_common import a_float, dedup_por_clave, upsert_por_lotes

log = logging.getLogger(__name__)

# ASSUMPTION: nombres de columna por confirmar (ver docstring). Si la vista
# real usa otros nombres, agregar "AS <NombreEsperado>" a cada uno aquí.
SQL_ENCABEZADOS = """
SELECT
    IdAsientoContable,
    TipoDocumento,
    Prefijo,
    NumeroDocumento,
    Fecha,
    Identificacion AS WoIdentificacionTercero,
    NumeroDocumentoExterno,
    Total
FROM Vista_Tabla_Encabezados
"""


def sembrar_documentos_encabezados(filas, client) -> dict:
    log.info("Procesando encabezados de documentos…")
    candidatos = []
    for row in filas:
        id_asiento = (row.get("IdAsientoContable") or "").strip()
        tipo_documento = (row.get("TipoDocumento") or "").strip()
        numero_documento = (row.get("NumeroDocumento") or "").strip()
        fecha = row.get("Fecha")
        # id_asiento_contable, tipo_documento, numero_documento y fecha son
        # "not null" en el esquema (0007_integracion_wo.sql) — una fila sin
        # alguno de estos no es un documento válido para reconciliación.
        if not (id_asiento and tipo_documento and numero_documento and fecha):
            continue
        candidatos.append({
            "id_asiento_contable": id_asiento,
            "tipo_documento": tipo_documento,
            "prefijo": (row.get("Prefijo") or "").strip() or None,
            "numero_documento": numero_documento,
            "fecha": fecha,
            "wo_identificacion_tercero": (row.get("WoIdentificacionTercero") or "").strip() or None,
            "numero_documento_externo": (row.get("NumeroDocumentoExterno") or "").strip() or None,
            "total": a_float(row.get("Total"))
        })
    documentos = dedup_por_clave(candidatos, "id_asiento_contable")
    log.info("Subiendo %d documentos…", len(documentos))
    upsert_por_lotes(client, "wo_documentos_encabezados", documentos, on_conflict="id_asiento_contable")
    return {"wo_documentos_encabezados": len(documentos)}
