"""
Wrapper delgado sobre el RPC reconciliar_pedidos_nivel2() (migración 0021).
Toda la lógica de matching vive en Postgres — este módulo solo la invoca y
devuelve el resumen para el log del agente.
"""
import logging

log = logging.getLogger(__name__)


def ejecutar(client) -> dict:
    log.info("Corriendo reconciliación nivel 2…")
    resp = client.rpc("reconciliar_pedidos_nivel2", {}).execute()
    resultado = resp.data or {}
    log.info(
        "Reconciliación: %d confirmados automáticamente, %d marcados para revisión manual",
        resultado.get("auto_confirmados", 0), resultado.get("marcados_revision_manual", 0)
    )
    return resultado
