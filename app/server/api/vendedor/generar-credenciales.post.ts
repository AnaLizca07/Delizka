import { randomBytes } from 'node:crypto'
import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'

function generarPassword() {
  return randomBytes(12).toString('base64url')
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ clienteId?: string }>(event)
  const clienteId = body?.clienteId
  if (!clienteId) {
    throw createError({ statusCode: 400, statusMessage: 'clienteId es requerido' })
  }

  // Cliente con RLS activa: solo trae el registro si quien llama (vendedor/admin)
  // tiene permiso de verlo. Esto es lo que impide que cualquier vendedor genere
  // credenciales para clientes de otra zona.
  const client = await serverSupabaseClient(event)
  const { data: userData, error: errorUser } = await client.auth.getUser()
  if (errorUser || !userData.user) {
    throw createError({ statusCode: 401, statusMessage: 'No autenticado' })
  }

  const { data: cliente, error: errorCliente } = await client
    .from('clientes')
    .select('id, nombre, identificacion, zona_id, perfil_id')
    .eq('id', clienteId)
    .single()

  if (errorCliente || !cliente) {
    throw createError({ statusCode: 404, statusMessage: 'Cliente no encontrado' })
  }
  if (cliente.perfil_id) {
    throw createError({ statusCode: 409, statusMessage: 'Este cliente ya tiene credenciales generadas' })
  }

  const admin = serverSupabaseServiceRole(event)
  const email = `cliente-${cliente.identificacion}@clientes.delizka.internal`
  const password = generarPassword()

  const { data: nuevoUsuario, error: errorAuth } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  })
  if (errorAuth || !nuevoUsuario.user) {
    throw createError({ statusCode: 500, statusMessage: errorAuth?.message ?? 'No se pudo crear el usuario' })
  }

  const { error: errorPerfil } = await admin.from('perfiles').insert({
    id: nuevoUsuario.user.id,
    rol: 'cliente',
    nombre: cliente.nombre,
    zona_id: cliente.zona_id
  })
  if (errorPerfil) {
    await admin.auth.admin.deleteUser(nuevoUsuario.user.id)
    throw createError({ statusCode: 500, statusMessage: 'No se pudo crear el perfil del cliente' })
  }

  // DEC-08: la contraseña temporal vence a las 48h si no se usa, y se exige
  // cambio de contraseña en el primer login (la pantalla de login del cliente,
  // aún por construir en RF-13, es quien hace cumplir estas dos reglas).
  const expiraAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
  const { error: errorCliente2 } = await admin
    .from('clientes')
    .update({
      perfil_id: nuevoUsuario.user.id,
      password_temporal_expira_at: expiraAt,
      requiere_cambio_password: true
    })
    .eq('id', clienteId)
  if (errorCliente2) {
    throw createError({ statusCode: 500, statusMessage: 'Usuario creado pero no se pudo vincular al cliente' })
  }

  return { email, password, expiraAt }
})
