import { randomBytes } from 'node:crypto'
import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'

function generarPassword() {
  return randomBytes(12).toString('base64url')
}

const ROLES_VALIDOS = ['admin', 'gerente', 'vendedor'] as const

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string; nombre?: string; rol?: string; zonaId?: string | null }>(event)
  const { email, nombre, rol, zonaId } = body ?? {}

  if (!email || !nombre || !rol || !(ROLES_VALIDOS as readonly string[]).includes(rol)) {
    throw createError({ statusCode: 400, statusMessage: 'email, nombre y rol (admin/gerente/vendedor) son requeridos' })
  }
  if (rol === 'vendedor' && !zonaId) {
    throw createError({ statusCode: 400, statusMessage: 'La zona es requerida para un vendedor' })
  }

  // Solo un admin puede crear cuentas de staff; se valida contra la sesión real
  // de quien llama, no contra lo que el formulario diga.
  const client = await serverSupabaseClient(event)
  const { data: userData, error: errorUser } = await client.auth.getUser()
  if (errorUser || !userData.user) {
    throw createError({ statusCode: 401, statusMessage: 'No autenticado' })
  }
  const { data: miPerfil } = await client.from('perfiles').select('rol').eq('id', userData.user.id).single()
  if (miPerfil?.rol !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Solo un administrador puede crear usuarios' })
  }

  const admin = serverSupabaseServiceRole(event)
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
    rol,
    nombre,
    zona_id: rol === 'vendedor' ? zonaId : null
  })
  if (errorPerfil) {
    await admin.auth.admin.deleteUser(nuevoUsuario.user.id)
    throw createError({ statusCode: 500, statusMessage: 'No se pudo crear el perfil' })
  }

  if (rol === 'vendedor') {
    const { error: errorVendedor } = await admin.from('vendedores').insert({ id: nuevoUsuario.user.id })
    if (errorVendedor) {
      await admin.from('perfiles').delete().eq('id', nuevoUsuario.user.id)
      await admin.auth.admin.deleteUser(nuevoUsuario.user.id)
      throw createError({ statusCode: 500, statusMessage: 'No se pudo crear el vendedor' })
    }
  }

  return { email, password }
})
