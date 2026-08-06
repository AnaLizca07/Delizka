<script setup lang="ts">
import type { UbicacionVendedor } from '~/composables/useMapaVendedores'
import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet'

const { ultimasUbicaciones } = useMapaVendedores()
const ubicaciones = ref<UbicacionVendedor[]>([])
const cargando = ref(true)
const mapaEl = ref<HTMLDivElement | null>(null)
const vendedorActivo = ref<string | null>(null)

// leaflet toca `window` al cargarse, así que el import es dinámico y solo
// ocurre en el cliente (onMounted), no al renderizar en el servidor.
let mapa: LeafletMap | null = null
const marcadores = new Map<string, LeafletMarker>()

function minutosDesde(fecha: string) {
  return Math.round((Date.now() - new Date(fecha).getTime()) / 60000)
}

function textoTranscurrido(fecha: string) {
  const min = minutosDesde(fecha)
  if (min < 1) return 'justo ahora'
  if (min < 60) return `hace ${min} min`
  const horas = Math.round(min / 60)
  if (horas < 24) return `hace ${horas} h`
  return `hace ${Math.round(horas / 24)} d`
}

function colorEstado(fecha: string) {
  const min = minutosDesde(fecha)
  if (min < 30) return 'bg-emerald-500'
  if (min < 120) return 'bg-amber-500'
  return 'bg-slate-400'
}

function centrarEn(u: UbicacionVendedor) {
  vendedorActivo.value = u.vendedorId
  mapa?.setView([u.lat, u.lng], 13)
  marcadores.get(u.vendedorId)?.openPopup()
}

const formatoFecha = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' })

onMounted(async () => {
  ubicaciones.value = await ultimasUbicaciones()
  cargando.value = false

  const L = (await import('leaflet')).default
  mapa = L.map(mapaEl.value as HTMLElement).setView([4.5, -74.3], 6)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(mapa)

  for (const u of ubicaciones.value) {
    const icono = L.divIcon({
      className: '',
      html: `<div style="width:16px;height:16px;border-radius:50%;background:#1E2A6E;border:2px solid white;box-shadow:0 0 0 1px #1E2A6E;"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    })
    const marcador = L.marker([u.lat, u.lng], { icon: icono })
      .addTo(mapa)
      .bindPopup(`<strong>${u.vendedorNombre}</strong><br>${u.tipo}<br>${formatoFecha.format(new Date(u.creadoAt))}`)
    marcadores.set(u.vendedorId, marcador)
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

    <div v-else class="grid gap-4 md:grid-cols-[280px_1fr]">
      <div class="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <p class="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500 border-b border-slate-100">
          {{ ubicaciones.length }} vendedor{{ ubicaciones.length === 1 ? '' : 'es' }} activo{{ ubicaciones.length === 1 ? '' : 's' }}
        </p>
        <ul class="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
          <li v-for="u in ubicaciones" :key="u.vendedorId">
            <button
              type="button"
              class="w-full text-left px-4 py-3 hover:bg-slate-50"
              :class="vendedorActivo === u.vendedorId ? 'bg-slate-50' : ''"
              @click="centrarEn(u)"
            >
              <p class="text-sm font-medium text-slate-900 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full shrink-0" :class="colorEstado(u.creadoAt)" />
                {{ u.vendedorNombre }}
              </p>
              <p class="text-xs text-slate-500 mt-0.5">{{ u.zonaNombre }}</p>
              <p class="text-xs text-slate-400">{{ textoTranscurrido(u.creadoAt) }} · {{ u.tipo.toLowerCase() }}</p>
            </button>
          </li>
        </ul>
      </div>
      <div ref="mapaEl" class="w-full rounded-lg border border-slate-200" style="height: 480px;" />
    </div>
  </div>
</template>
