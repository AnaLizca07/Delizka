// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  css: ['leaflet/dist/leaflet.css'],

  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxtjs/supabase',
    '@vite-pwa/nuxt'
  ],

  supabase: {
    redirectOptions: {
      login: '/login',
      callback: '/confirmar',
      // El middleware de rol (middleware/rol.global.ts) hace el resto del control de
      // acceso; este módulo solo se encarga de exigir sesión iniciada.
      exclude: ['/login']
    },
    cookieOptions: {
      // El módulo pone `secure: true` por default. En dev servimos por http (no
      // https); algunos navegadores (Safari en particular) son estrictos y
      // simplemente no guardan esa cookie — la sesión "sobrevive" al login
      // (ya está en memoria) pero desaparece al recargar, porque la cookie
      // nunca quedó escrita para empezar. En producción sí debe ir sobre https.
      secure: process.env.NODE_ENV === 'production'
    }
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Delizka',
      short_name: 'Delizka',
      description: 'Gestión de ventas y logística Delizka',
      theme_color: '#1E2A6E',
      background_color: '#FAFAF8',
      display: 'standalone',
      start_url: '/',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,svg,ico}']
    },
    client: {
      installPrompt: true
    },
    devOptions: {
      // El service worker de desarrollo interceptaba peticiones y las dejaba
      // colgadas en silencio en Safari justo después del login (sin error,
      // sin siguiente petición de red — se vio en el .har). El service worker
      // es una funcionalidad de producción; no debe activarse en dev.
      enabled: false,
      type: 'module'
    }
  }
})
