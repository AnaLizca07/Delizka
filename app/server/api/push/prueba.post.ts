import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { enviarPushASuscripciones } from '../../utils/enviarPush'

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event)
  const { data: userData, error: errorUser } = await client.auth.getUser()
  if (errorUser || !userData.user) {
    throw createError({ statusCode: 401, statusMessage: 'No autenticado' })
  }

  const admin = serverSupabaseServiceRole(event)
  const { data: suscripciones } = await admin
    .from('push_subscripciones')
    .select('id, endpoint, p256dh, auth')
    .eq('perfil_id', userData.user.id)

  if (!suscripciones?.length) {
    throw createError({ statusCode: 404, statusMessage: 'No tienes notificaciones activadas en este navegador' })
  }

  return enviarPushASuscripciones(event, suscripciones, {
    title: 'Delizka',
    body: 'Notificación de prueba — si ves esto, las alertas están funcionando.',
    url: '/gerencial'
  })
})
