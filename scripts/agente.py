"""
Agente de sincronización ODBC con World Office. Una corrida por invocación —
se programa externamente (cron / Programador de tareas de Windows) cada
wo_config.intervalo_sync_minutos, no hay loop propio (ver plan del agente).

Uso:
    cd scripts
    pip install -r requirements.txt
    cp .env.example .env   # completar WO_* y SUPABASE_SERVICE_ROLE_KEY

    python agente.py                          # corrida completa real
    python agente.py --dry-run                # solo conecta y muestra conteos, cero escrituras
    python agente.py --pasos=inventario        # corrida real de un subconjunto de pasos
    python agente.py --pasos=terceros,cartera
"""
import argparse
import logging
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv

import reconciliar_pedidos
import sync_cartera
import sync_encabezados
import sync_inventario
import sync_terceros
import wo_odbc
from wo_common import crear_cliente_supabase

log = logging.getLogger("agente")

PASOS_DISPONIBLES = ["inventario", "terceros", "cartera", "encabezados"]


def leer_config(client) -> dict:
    """servidor/puerto/base_datos/usuario: wo_config es la fuente de verdad;
    .env solo es el fallback de arranque (primera vez que corre el agente).
    La contraseña SIEMPRE viene de .env, nunca de wo_config."""
    resp = client.table("wo_config").select("*").eq("id", 1).maybe_single().execute()
    fila = resp.data or {}

    cfg = {
        "driver": os.environ.get("WO_ODBC_DRIVER", "{ODBC Driver 17 for SQL Server}"),
        "servidor": fila.get("servidor") or os.environ.get("WO_SERVIDOR"),
        "puerto": fila.get("puerto") or int(os.environ.get("WO_PUERTO", "1433")),
        "base_datos": fila.get("base_datos") or os.environ.get("WO_BASE_DATOS"),
        "usuario": fila.get("usuario") or os.environ.get("WO_USUARIO"),
        "password": os.environ["WO_PASSWORD"],
        "intervalo_sync_minutos": fila.get("intervalo_sync_minutos") or 15,
        "_wo_config_vacio": not fila.get("servidor"),
    }
    faltantes = [k for k in ("servidor", "base_datos", "usuario") if not cfg[k]]
    if faltantes:
        raise RuntimeError(f"Faltan datos de conexión a World Office: {', '.join(faltantes)}")
    return cfg


def autocompletar_wo_config(client, cfg: dict):
    """Si wo_config estaba vacía y se usó el fallback de .env, la deja
    sembrada para que ediciones futuras (vía la UI de admin cuando exista)
    tomen efecto sin volver a desplegar el agente."""
    if not cfg["_wo_config_vacio"]:
        return
    client.table("wo_config").update({
        "servidor": cfg["servidor"],
        "puerto": cfg["puerto"],
        "base_datos": cfg["base_datos"],
        "usuario": cfg["usuario"],
        "credenciales_configuradas": True,
    }).eq("id", 1).execute()


def modo_dry_run(conn):
    consultas = {
        "inventario": [sync_inventario.SQL_INVENTARIOS, sync_inventario.SQL_EXISTENCIAS],
        "terceros": [sync_terceros.SQL_TERCEROS],
        "cartera": [sync_cartera.SQL_CUENTAS_POR_COBRAR, sync_cartera.SQL_CUENTAS_POR_COBRAR_DETALLADA],
        "encabezados": [sync_encabezados.SQL_ENCABEZADOS],
    }
    for paso, sqls in consultas.items():
        log.info("--- dry-run: %s ---", paso)
        for sql in sqls:
            filas = wo_odbc.ejecutar_query(conn, sql)
            columnas = list(filas[0].keys()) if filas else []
            log.info("  %d filas. Columnas: %s", len(filas), columnas)
            if filas:
                log.info("  primera fila: %s", filas[0])


def correr_pasos(conn, client, pasos: list[str]) -> dict:
    resultados = {}

    if "inventario" in pasos:
        try:
            filas_inv = wo_odbc.ejecutar_query(conn, sync_inventario.SQL_INVENTARIOS)
            filas_exi = wo_odbc.ejecutar_query(conn, sync_inventario.SQL_EXISTENCIAS)
            resultados["inventario"] = {"ok": True, **sync_inventario.sembrar_catalogo_y_existencias(filas_inv, filas_exi, client)}
        except Exception as e:
            log.exception("Falló sync de inventario")
            resultados["inventario"] = {"ok": False, "error": str(e)}

    if "terceros" in pasos:
        try:
            filas = wo_odbc.ejecutar_query(conn, sync_terceros.SQL_TERCEROS)
            resultados["terceros"] = {"ok": True, **sync_terceros.sembrar_terceros(filas, client)}
        except Exception as e:
            log.exception("Falló sync de terceros")
            resultados["terceros"] = {"ok": False, "error": str(e)}

    if "cartera" in pasos:
        try:
            filas_saldo = wo_odbc.ejecutar_query(conn, sync_cartera.SQL_CUENTAS_POR_COBRAR)
            filas_detalle = wo_odbc.ejecutar_query(conn, sync_cartera.SQL_CUENTAS_POR_COBRAR_DETALLADA)
            resultados["cartera"] = {"ok": True, **sync_cartera.sembrar_cartera(filas_saldo, filas_detalle, client)}
        except Exception as e:
            log.exception("Falló sync de cartera")
            resultados["cartera"] = {"ok": False, "error": str(e)}

    if "encabezados" in pasos:
        try:
            filas = wo_odbc.ejecutar_query(conn, sync_encabezados.SQL_ENCABEZADOS)
            resultados["encabezados"] = {"ok": True, **sync_encabezados.sembrar_documentos_encabezados(filas, client)}
        except Exception as e:
            log.exception("Falló sync de encabezados")
            resultados["encabezados"] = {"ok": False, "error": str(e)}

    return resultados


def registrar_corrida(client, duracion_ms: int, resultados: dict, reconciliacion: dict | None, intervalo_minutos: int):
    exito = all(r.get("ok") for r in resultados.values()) if resultados else True
    errores = [f"{paso}: {r['error']}" for paso, r in resultados.items() if not r.get("ok")]
    error_texto = "; ".join(errores) or None

    try:
        client.table("wo_sync_log").insert({
            "duracion_ms": duracion_ms,
            "filas_actualizadas": {**resultados, "reconciliacion": reconciliacion},
            "exito": exito,
            "error": error_texto,
        }).execute()
    except Exception:
        log.exception("No se pudo escribir wo_sync_log")

    ahora = datetime.now(timezone.utc)
    try:
        client.table("wo_config").update({
            "ultima_corrida_at": ahora.isoformat(),
            "proxima_corrida_at": (ahora + timedelta(minutes=intervalo_minutos)).isoformat(),
            "ultimo_error": error_texto,
            "estado": "ok" if exito else ("parcial" if any(r.get("ok") for r in resultados.values()) else "error"),
        }).eq("id", 1).execute()
    except Exception:
        log.exception("No se pudo actualizar wo_config")

    return exito


def main():
    parser = argparse.ArgumentParser(description="Agente de sincronización ODBC con World Office")
    parser.add_argument("--dry-run", action="store_true", help="Solo conecta y muestra conteos/columnas, cero escrituras")
    parser.add_argument("--pasos", type=str, default=",".join(PASOS_DISPONIBLES), help="Subconjunto de pasos a correr, separados por coma")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    load_dotenv(Path(__file__).parent / ".env")
    pasos = [p.strip() for p in args.pasos.split(",") if p.strip()]
    desconocidos = set(pasos) - set(PASOS_DISPONIBLES)
    if desconocidos:
        parser.error(f"Pasos desconocidos: {', '.join(desconocidos)}. Disponibles: {', '.join(PASOS_DISPONIBLES)}")

    client = crear_cliente_supabase()
    inicio = time.monotonic()

    try:
        cfg = leer_config(client)
    except Exception:
        log.exception("No se pudo leer la configuración de conexión")
        sys.exit(1)

    try:
        with wo_odbc.conectar(cfg) as conn:
            if args.dry_run:
                modo_dry_run(conn)
                log.info("Dry-run terminado, no se escribió nada.")
                return

            resultados = correr_pasos(conn, client, pasos)
            autocompletar_wo_config(client, cfg)
    except Exception:
        log.exception("No se pudo conectar a World Office — se registra el fallo, no se intenta la reconciliación")
        duracion_ms = int((time.monotonic() - inicio) * 1000)
        exito = registrar_corrida(client, duracion_ms, {}, None, cfg["intervalo_sync_minutos"])
        sys.exit(0 if exito else 1)

    try:
        reconciliacion = reconciliar_pedidos.ejecutar(client)
    except Exception:
        log.exception("Falló la reconciliación nivel 2")
        reconciliacion = {"error": "ver logs"}

    duracion_ms = int((time.monotonic() - inicio) * 1000)
    exito = registrar_corrida(client, duracion_ms, resultados, reconciliacion, cfg["intervalo_sync_minutos"])
    sys.exit(0 if exito else 1)


if __name__ == "__main__":
    main()
