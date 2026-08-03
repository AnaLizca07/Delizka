<script setup lang="ts">
import type { UbicacionVendedor } from '~/composables/useMapaVendedores'

const { ultimasUbicaciones } = useMapaVendedores()
const ubicaciones = ref<UbicacionVendedor[]>([])
const cargando = ref(true)
const mapaEl = ref<HTMLDivElement | null>(null)

const formatoFecha = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' })

onMounted(async () => {
  ubicaciones.value = await ultimasUbicaciones()
  cargando.value = false

  const L = (await import('leaflet')).default

  const mapa = L.map(mapaEl.value as HTMLElement).setView([4.5, -74.3], 6)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(mapa)

  const icono = L.divIcon({
    className: '',
    html: '<div style="width:16px;height:16px;border-radius:50%;background:#1E2A6E;border:2px solid white;box-shadow:0 0 0 1px #1E2A6E;"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  })

  for (const u of ubicaciones.value) {
    L.marker([u.lat, u.lng], { icon: icono })
      .addTo(mapa)
      .bindPopup(`<strong>${u.vendedorNombre}</strong><br>${u.tipo}<br>${formatoFecha.format(new Date(u.creadoAt))}`)
  }

  if (ubicaciones.value.length) {
    const bounds = L.latLngBounds(ubicaciones.value.map((u) => [u.lat, u.lng] as [number, number]))
    mapa.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 })
  }
})
</script>

<template>
  <div>
    <h1 class="text-lg font-semibold text-slate-900 mb-1">Mapa de vendedores</h1>
    <p class="text-sm text-slate-500 mb-4">Última posición registrada por eventos de check-in, visita o pedido.</p>

    <p v-if="!cargando && !ubicaciones.length" class="text-sm text-slate-400 mb-3">
      Todavía no hay eventos de geolocalización registrados.
    </p>

    <div ref="mapaEl" class="w-full rounded-lg border border-slate-200" style="height: 480px;" />
  </div>
</template>
