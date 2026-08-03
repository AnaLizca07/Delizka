"""
Siembra las tablas espejo de Supabase (catalogo_inventario, existencias,
wo_terceros, wo_cartera) a partir del export CSV de las vistas de World Office
(vistas_export/). Es un reemplazo del agente de sincronización automático
mientras ese agente no exista todavía (ver roadmap: PWA primero, sync al final).

Requiere SUPABASE_SERVICE_ROLE_KEY en scripts/.env (no el anon key), porque
estas tablas no tienen policy de escritura para roles normales.

Uso:
    cd scripts
    pip install -r requirements.txt
    cp .env.example .env   # y completa SUPABASE_SERVICE_ROLE_KEY
    python sembrar_wo.py
"""
import csv
import os
from datetime import date, datetime
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
VISTAS_DIR = Path(os.environ.get("VISTAS_EXPORT_DIR", "/Users/anita/Downloads/vistas_export"))

BATCH_SIZE = 500

client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def leer_csv(nombre):
    with open(VISTAS_DIR / nombre, encoding="utf-8-sig", newline="") as f:
        yield from csv.DictReader(f)


def a_float(valor, default=0.0):
    try:
        return float(valor)
    except (TypeError, ValueError):
        return default


def es_activo(valor):
    # World Office representa booleanos al estilo Access/VB: -1 = verdadero, 0 = falso.
    return (valor or "").strip() not in ("0", "", "0.0")


def lotes(items, tam=BATCH_SIZE):
    for i in range(0, len(items), tam):
        yield items[i:i + tam]


def upsert_por_lotes(tabla, filas, on_conflict):
    total = 0
    for lote in lotes(filas):
        client.table(tabla).upsert(lote, on_conflict=on_conflict).execute()
        total += len(lote)
        print(f"  {tabla}: {total}/{len(filas)}")
    return total


def sembrar_catalogo_y_existencias():
    print("Leyendo Vista_Tabla_Inventarios.csv…")
    productos_por_wo_id = {}
    for row in leer_csv("Vista_Tabla_Inventarios.csv"):
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

    print(f"{len(productos)} productos activos encontrados. Subiendo a catalogo_inventario…")
    upsert_por_lotes("catalogo_inventario", productos, on_conflict="wo_id_inventario")

    print("Leyendo de vuelta catalogo_inventario para mapear wo_id_inventario -> id…")
    mapa_id = {}
    pagina = 0
    while True:
        resp = client.table("catalogo_inventario").select("id, wo_id_inventario").range(pagina * 1000, pagina * 1000 + 999).execute()
        if not resp.data:
            break
        for r in resp.data:
            mapa_id[r["wo_id_inventario"]] = r["id"]
        if len(resp.data) < 1000:
            break
        pagina += 1

    print("Leyendo Vista_ExistenciasPorBodegas.csv (solo bodega Principal/Uno)…")
    existencia_por_wo_id = {}
    for row in leer_csv("Vista_ExistenciasPorBodegas.csv"):
        if (row.get("Codigo_Bodega") or "").strip() != "Uno":
            continue
        wo_id = (row.get("IdInventario") or "").strip()
        if wo_id:
            existencia_por_wo_id[wo_id] = a_float(row.get("Existencia"))

    existencias = []
    for wo_id, inventario_id in mapa_id.items():
        existencias.append({
            "inventario_id": inventario_id,
            "cantidad": existencia_por_wo_id.get(wo_id, 0.0)
        })

    print(f"Subiendo existencias de {len(existencias)} productos…")
    upsert_por_lotes("existencias", existencias, on_conflict="inventario_id")


def sembrar_terceros():
    print("Leyendo Vista_Tabla_Terceros.csv…")
    # dict keyed por id_tercero: la vista trae algún IdTercero duplicado (visto en
    # datos reales), y un mismo lote de upsert no puede tocar la misma fila dos veces.
    terceros_por_id = {}
    for row in leer_csv("Vista_Tabla_Terceros.csv"):
        id_tercero = (row.get("IdTercero") or "").strip()
        if not id_tercero:
            continue
        terceros_por_id[id_tercero] = {
            "id_tercero": id_tercero,
            "identificacion": (row.get("Identificacion") or "").strip(),
            "nombre": (row.get("Nombre") or "").strip()
        }
    terceros = list(terceros_por_id.values())
    print(f"Subiendo {len(terceros)} terceros…")
    upsert_por_lotes("wo_terceros", terceros, on_conflict="id_tercero")


def sembrar_cartera():
    print("Leyendo Vista_CuentasPorCobrar.csv (saldo total por tercero)…")
    saldo_total_por_id = {}
    for row in leer_csv("Vista_CuentasPorCobrar.csv"):
        identificacion = (row.get("Identificacion") or "").strip()
        if identificacion:
            saldo_total_por_id[identificacion] = a_float(row.get("Saldo"))

    print("Leyendo Vista_CuentasPorCobrar_Detallada.csv (mora por documento)…")
    hoy = date.today()
    vencido_por_id = {}
    dias_atraso_por_id = {}
    for row in leer_csv("Vista_CuentasPorCobrar_Detallada.csv"):
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

    cartera = []
    for identificacion, saldo_total in saldo_total_por_id.items():
        cartera.append({
            "wo_identificacion_tercero": identificacion,
            "saldo_total": saldo_total,
            "saldo_vencido": vencido_por_id.get(identificacion, 0.0),
            "dias_atraso": dias_atraso_por_id.get(identificacion, 0)
        })

    print(f"Subiendo cartera de {len(cartera)} terceros…")
    upsert_por_lotes("wo_cartera", cartera, on_conflict="wo_identificacion_tercero")


if __name__ == "__main__":
    sembrar_catalogo_y_existencias()
    sembrar_terceros()
    sembrar_cartera()
    print("Listo.")
