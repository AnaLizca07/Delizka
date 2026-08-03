/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// RF-21: el service worker es lo único que puede recibir un push del navegador
// aunque la pestaña de Delizka esté cerrada — por eso este handler vive aquí y
// no en un composable normal.
self.addEventListener('push', (event) => {
  let datos: { title?: string; body?: string; url?: string } = {}
  try {
    datos = event.data?.json() ?? {}
  } catch {
    datos = { body: event.data?.text() ?? '' }
  }

  const titulo = datos.title ?? 'Delizka'
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: datos.body ?? '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: datos.url ?? '/' }
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      const existente = lista.find((c) => 'focus' in c)
      if (existente) return (existente as WindowClient).focus()
      return self.clients.openWindow(url)
    })
  )
})
