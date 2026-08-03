import webpush from 'web-push'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { H3Event } from 'h3'

export interface PayloadNotificacion {
  title: string
  body: string
  url?: string
}

interface SuscripcionFila {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

// RF-21: envía a cada suscripción registrada; si una ya no es válida (410/404
// — el navegador la revocó, perfil desinstaló la PWA, etc.) la borra en vez de
// reintentar para siempre.
export async function enviarPushASuscripciones(event: H3Event, suscripciones: SuscripcionFila[], payload: PayloadNotificacion) {
  const config = useRuntimeConfig()
  if (!config.vapidPrivateKey || !config.public.vapidPublicKey) {
    throw createError({ statusCode: 500, statusMessage: 'Faltan las llaves VAPID en el servidor' })
  }

  webpush.setVapidDetails(
    (config.vapidSubject as string) || 'mailto:soporte@delizka.com',
    config.public.vapidPublicKey as string,
    config.vapidPrivateKey as string
  )

  const admin = serverSupabaseServiceRole(event)
  const cuerpo = JSON.stringify(payload)

  const resultados = await Promise.allSettled(
    suscripciones.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        cuerpo
      )
    )
  )

  const vencidas: string[] = []
  resultados.forEach((r, i) => {
    if (r.status === 'rejected' && (r.reason?.statusCode === 404 || r.reason?.statusCode === 410)) {
      vencidas.push(suscripciones[i].id)
    }
  })
  if (vencidas.length) {
    await admin.from('push_subscripciones').delete().in('id', vencidas)
  }

  return {
    enviadas: resultados.filter((r) => r.status === 'fulfilled').length,
    fallidas: resultados.filter((r) => r.status === 'rejected').length
  }
}
