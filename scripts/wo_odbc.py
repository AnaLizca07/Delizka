"""
Conexión ODBC de solo lectura a World Office (SQL Server on-premise). Este es
el único módulo que sabe hablar con World Office — sync_*.py no tienen idea
de si sus filas vinieron de aquí o de un CSV.
"""
import logging
from contextlib import contextmanager

import pyodbc

log = logging.getLogger(__name__)

TIMEOUT_SEGUNDOS = 10


def construir_cadena_conexion(cfg: dict) -> str:
    partes = [
        f"DRIVER={cfg['driver']}",
        f"SERVER={cfg['servidor']},{cfg['puerto']}",
        f"DATABASE={cfg['base_datos']}",
        f"UID={cfg['usuario']}",
        f"PWD={cfg['password']}",
    ]
    # ASSUMPTION: instalaciones on-premise de SQL Server suelen usar un
    # certificado autofirmado — si la conexión falla por TLS/certificado,
    # agregar aquí "TrustServerCertificate=yes" (confirmar en el --dry-run
    # contra el servidor real, ver agente.py).
    return ";".join(partes) + ";"


@contextmanager
def conectar(cfg: dict):
    cadena = construir_cadena_conexion(cfg)
    conn = pyodbc.connect(cadena, timeout=TIMEOUT_SEGUNDOS)
    try:
        yield conn
    finally:
        conn.close()


def ejecutar_query(conn, sql: str) -> list[dict]:
    """Corre un SELECT y devuelve una lista de dicts, una por fila, usando
    los nombres de columna reales que trae cursor.description. Las consultas
    en sync_*.py deben usar SELECT ... AS <NombreColumnaEsperado> si el
    nombre real de la vista no coincide con lo esperado (confirmar en
    --dry-run, cada consulta vive aislada en su propio módulo por esto)."""
    cursor = conn.cursor()
    cursor.execute(sql)
    columnas = [c[0] for c in cursor.description]
    filas = [dict(zip(columnas, fila)) for fila in cursor.fetchall()]
    log.info("  query devolvió %d filas", len(filas))
    return filas
