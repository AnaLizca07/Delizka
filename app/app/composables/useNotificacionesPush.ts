function base64UrlAUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export function useNotificacionesPush() {
  const client = useSupabaseClient()
  const config = useRuntimeConfig()

  const soportado = computed(() =>
    typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
  )

  async function suscripcionActual(): Promise<PushSubscription | null> {
    if (!soportado.value) return null
    const registro = await navigator.serviceWorker.ready
    return registro.pushManager.getSubscription()
  }

  // RF-21: el gerente activa esto una vez por navegador/dispositivo desde el
  // panel gerencial. Guarda la suscripción en Supabase para que el servidor
  // pueda enviarle push más adelante aunque no tenga la pestaña abierta.
  async function suscribir(): Promise<{ ok: boolean; mensaje?: string }> {
    if (!soportado.value) return { ok: false, mensaje: 'Este navegador no soporta notificaciones push.' }
    if (!config.public.vapidPublicKey) return { ok: false, mensaje: 'Falta configurar la llave VAPID en el servidor.' }

    const permiso = await Notification.requestPermission()
    if (permiso !== 'granted') return { ok: false, mensaje: 'Permiso de notificaciones denegado.' }

    const registro = await navigator.serviceWorker.ready
    let sub = await registro.pushManager.getSubscription()
    if (!sub) {
      sub = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlAUint8Array(config.public.vapidPublicKey as string)
      })
    }

    const { data: userData } = await client.auth.getUser()
    if (!userData.user) return { ok: false, mensaje: 'No se pudo identificar tu sesión.' }

    const json = sub.toJSON()
    const { error } = await client.from('push_subscripciones').upsert(
      {
        perfil_id: userData.user.id,
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? '',
        auth: json.keys?.auth ?? ''
      },
      { onConflict: 'endpoint' }
    )
    if (error) return { ok: false, mensaje: 'No se pudo guardar la suscripción.' }

    return { ok: true }
  }

  async function desuscribir(): Promise<void> {
    const sub = await suscripcionActual()
    if (!sub) return
    await client.from('push_subscripciones').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  }

  return { soportado, suscripcionActual, suscribir, desuscribir }
}
