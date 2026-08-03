"""
Bootstrap de una zona + un vendedor + un cliente de prueba, mientras el panel
administrativo (RF-23) todavía no existe para hacerlo desde la interfaz.
No genera contraseña visible en ningún lado salvo esta única corrida en
consola: el vendedor debe cambiarla luego (no hay pantalla de "cambiar
contraseña" todavía, se puede hacer desde el dashboard de Supabase mientras
tanto).

Uso:
    python bootstrap_vendedor.py
"""
import os
import secrets
import string
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).parent / ".env")
client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

NOMBRE_VENDEDOR = "Gineth Acero Barco"
CORREO_VENDEDOR = "analucellylizcanoacero@gmail.com"
NOMBRE_ZONA = "Córdoba - Magdalena Medio - Santanderes"
CLIENTE_NOMBRE = "Juanita Alcachofa"
CLIENTE_IDENTIFICACION = "1094891247"


def generar_password():
    alfabeto = string.ascii_letters + string.digits
    return "".join(secrets.choice(alfabeto) for _ in range(16))


def obtener_o_crear_usuario(email):
    pagina = 1
    while True:
        resp = client.auth.admin.list_users(page=pagina, per_page=200)
        usuarios = resp if isinstance(resp, list) else getattr(resp, "users", [])
        if not usuarios:
            break
        for u in usuarios:
            if u.email == email:
                print("Ya existía un usuario de auth con ese correo, lo reutilizo.")
                return u.id, None
        if len(usuarios) < 200:
            break
        pagina += 1

    password = generar_password()
    creado = client.auth.admin.create_user({
        "email": email,
        "password": password,
        "email_confirm": True
    })
    return creado.user.id, password


zona = client.table("zonas").upsert({"nombre": NOMBRE_ZONA}, on_conflict="nombre").execute().data[0]
print("Zona:", zona["id"])

user_id, password = obtener_o_crear_usuario(CORREO_VENDEDOR)
print("Usuario de auth:", user_id)

client.table("perfiles").upsert(
    {"id": user_id, "rol": "vendedor", "nombre": NOMBRE_VENDEDOR, "zona_id": zona["id"]},
    on_conflict="id"
).execute()
client.table("vendedores").upsert({"id": user_id}, on_conflict="id").execute()
print("Perfil y vendedor listos.")

cliente = client.table("clientes").upsert(
    {
        "zona_id": zona["id"],
        "vendedor_id": user_id,
        "nombre": CLIENTE_NOMBRE,
        "identificacion": CLIENTE_IDENTIFICACION
    },
    on_conflict="identificacion"
).execute().data[0]
print("Cliente de prueba:", cliente["id"])

print()
print("Listo. Datos para iniciar sesión:")
print("  Correo:", CORREO_VENDEDOR)
if password:
    print("  Contraseña temporal:", password)
else:
    print("  (el usuario ya existía; usa la contraseña que ya tenías)")
