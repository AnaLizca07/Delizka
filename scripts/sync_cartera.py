"""
Transforma filas de Vista_CuentasPorCobrar / Vista_CuentasPorCobrar_Detallada
en wo_cartera — incluyendo el vínculo con clientes.id, que sembrar_wo.py
nunca hizo (por eso la cartera del cliente podía verse vacía: la RLS de
wo_cartera para el rol cliente filtra por cliente_id = auth_cliente_id()).
"""
import logging
from datetime import date, datetime

from wo_common import a_float, normalizar_identificacion, upsert_por_lotes

log = logging.getLogger(__name__)

SQL_CUENTAS_POR_COBRAR = "SELECT * FROM Vista_CuentasPorCobrar"
SQL_CUENTAS_POR_COBRAR_DETALLADA = "SELECT * FROM Vista_CuentasPorCobrar_Detallada"


def _mapa_cliente_id_por_identificacion(client) -> dict:
    resp = client.table("clientes").select("id, identificacion").execute()
    return {
        normalizar_identificacion(c["identificacion"]): c["id"]
        for c in (resp.data or [])
        if c.get("identificacion")
    }


def sembrar_cartera(filas_saldo, filas_detalle, client) -> dict:
    log.info("Procesando cartera…")
    saldo_total_por_id = {}
    for row in filas_saldo:
        identificacion = (row.get("Identificacion") or "").strip()
        if identificacion:
            saldo_total_por_id[identificacion] = a_float(row.get("Saldo"))

    hoy = date.today()
    vencido_por_id = {}
    dias_atraso_por_id = {}
    for row in filas_detalle:
        identificacion = (row.get("Identificacion") or "").strip()
        vencimiento_str = (row.get("Vencimiento") or "").strip()
        saldo_doc = a_float(row.get("Saldo"))
        if not identificacion or not vencimiento_str or saldo_doc <= 0:
            continue
        try:
            vencimiento = datetime.strptime(vencimiento_str[:10], "%Y-%m-%d").date()
        except ValueError:
            continue
        if vencimiento < hoy:
            dias = (hoy - vencimiento).days
            vencido_por_id[identificacion] = vencido_por_id.get(identificacion, 0.0) + saldo_doc
            dias_atraso_por_id[identificacion] = max(dias_atraso_por_id.get(identificacion, 0), dias)

    mapa_cliente_id = _mapa_cliente_id_por_identificacion(client)

    cartera = []
    vinculados = 0
    for identificacion, saldo_total in saldo_total_por_id.items():
        cliente_id = mapa_cliente_id.get(normalizar_identificacion(identificacion))
        if cliente_id:
            vinculados += 1
        cartera.append({
            "wo_identificacion_tercero": identificacion,
            "cliente_id": cliente_id,
            "saldo_total": saldo_total,
            "saldo_vencido": vencido_por_id.get(identificacion, 0.0),
            "dias_atraso": dias_atraso_por_id.get(identificacion, 0)
        })

    log.info(
        "Subiendo cartera de %d terceros (%d vinculados a un cliente)…",
        len(cartera), vinculados
    )
    upsert_por_lotes(client, "wo_cartera", cartera, on_conflict="wo_identificacion_tercero")

    return {"wo_cartera": len(cartera), "wo_cartera_vinculados": vinculados}
