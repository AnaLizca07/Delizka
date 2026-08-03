import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'

// DEC-08: tras cambiar la contraseña (auth.updateUser, hecho en el cliente),
// esta ruta apaga la bandera de "requiere cambio" y borra el vencimiento de
// 48h. Va por una ruta de servidor porque clientes no tiene policy de UPDATE
// para el rol cliente (a propósito: no queremos que un cliente pueda editar
// su propio zona_id/vendedor_id vía RLS); esta ruta solo toca esos dos campos.
export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event)
  const { data: userData, error: errorUser } = await client.auth.getUser()
  if (errorUser || !userData.user) {
    throw createError({ statusCode: 401, statusMessage: 'No autenticado' })
  }

  const admin = serverSupabaseServiceRole(event)
  const { error } = await admin
    .from('clientes')
    .update({ requiere_cambio_password: false, password_temporal_expira_at: null })
    .eq('perfil_id', userData.user.id)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'No se pudo actualizar el estado de la cuenta' })
  }

  return { ok: true }
})
