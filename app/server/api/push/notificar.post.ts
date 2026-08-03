import { serverSupabaseServiceRole } from '#supabase/server'
import { enviarPushASuscripciones } from '../../utils/enviarPush'

interface CuerpoNotificar {
  rol: 'gerente' | 'admin'
  title: string
  body: string
  url?: string
}

// RF-21: este endpoint NO usa la sesión del navegador — lo llama el Database
// Webhook de Supabase (trigger en `pedidos` al aprobarse y en
// `eventos_geolocalizacion` en cada check_in), que no tiene cookie de sesión.
// Se protege con un secreto compartido en vez de auth de usuario.
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const secreto = getHeader(event, 'x-webhook-secret')
  if (!config.pushWebhookSecret || secreto !== config.pushWebhookSecret) {
    throw createError({ statusCode: 401, statusMessage: 'No autorizado' })
  }

  const body = await readBody<CuerpoNotificar>(event)
  if (!body?.rol || !body?.title || !body?.body) {
    throw createError({ statusCode: 400, statusMessage: 'rol, title y body son requeridos' })
  }

  const admin = serverSupabaseServiceRole(event)
  const { data: perfiles } = await admin.from('perfiles').select('id').eq('rol', body.rol).eq('activo', true)
  const perfilIds = (perfiles ?? []).map((p) => p.id)
  if (!perfilIds.length) return { enviadas: 0, fallidas: 0 }

  const { data: suscripciones } = await admin
    .from('push_subscripciones')
    .select('id, endpoint, p256dh, auth')
    .in('perfil_id', perfilIds)

  if (!suscripciones?.length) return { enviadas: 0, fallidas: 0 }

  return enviarPushASuscripciones(event, suscripciones, {
    title: body.title,
    body: body.body,
    url: body.url ?? '/gerencial'
  })
})
