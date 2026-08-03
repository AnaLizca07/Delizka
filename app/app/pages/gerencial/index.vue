<script setup lang="ts">
import type { VentaPorVendedor, ProductoMasVendido, AlertaCartera } from '~/composables/useKpisGerenciales'

const { ventasPorVendedor, productosMasVendidos, carteraVencida } = useKpisGerenciales()
const { soportado: pushSoportado, suscripcionActual, suscribir, desuscribir } = useNotificacionesPush()

const ventas = ref<VentaPorVendedor[]>([])
const productos = ref<ProductoMasVendido[]>([])
const alertas = ref<AlertaCartera[]>([])
const cargando = ref(true)

const pushActivo = ref(false)
const activandoPush = ref(false)
const mensajePush = ref<{ tipo: 'error' | 'ok'; texto: string } | null>(null)
const enviandoPrueba = ref(false)

const formatoMoneda = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

const totalMes = computed(() => ventas.value.reduce((acc, v) => acc + v.total, 0))

onMounted(async () => {
  const [v, p, a] = await Promise.all([ventasPorVendedor(), productosMasVendidos(), carteraVencida()])
  ventas.value = v
  productos.value = p
  alertas.value = a
  cargando.value = false

  if (pushSoportado.value) {
    pushActivo.value = !!(await suscripcionActual())
  }
})

async function alternarPush() {
  mensajePush.value = null
  activandoPush.value = true
  if (pushActivo.value) {
    await desuscribir()
    pushActivo.value = false
  } else {
    const resultado = await suscribir()
    if (!resultado.ok) {
      mensajePush.value = { tipo: 'error', texto: resultado.mensaje ?? 'No se pudo activar.' }
    } else {
      pushActivo.value = true
      mensajePush.value = { tipo: 'ok', texto: 'Notificaciones activadas en este navegador.' }
    }
  }
  activandoPush.value = false
}

async function enviarPrueba() {
  mensajePush.value = null
  enviandoPrueba.value = true
  try {
    await $fetch('/api/push/prueba', { method: 'POST' })
    mensajePush.value = { tipo: 'ok', texto: 'Notificación de prueba enviada.' }
  } catch (e) {
    mensajePush.value = { tipo: 'error', texto: mensajeDeError(e, 'No se pudo enviar la prueba.') }
  }
  enviandoPrueba.value = false
}
</script>

<template>
  <div class="max-w-3xl">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-lg font-semibold text-slate-900">Panel gerencial</h1>
      <div class="flex gap-3">
        <NuxtLink to="/gerencial/mapa" class="text-sm text-[#1E2A6E] hover:underline">Mapa de vendedores</NuxtLink>
        <NuxtLink to="/gerencial/auditoria" class="text-sm text-[#1E2A6E] hover:underline">Auditoría</NuxtLink>
      </div>
    </div>

    <p v-if="cargando" class="text-sm text-slate-400">Cargando…</p>

    <div v-else class="space-y-6">
      <div class="rounded-lg border border-slate-200 bg-white p-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-slate-900">Ventas del mes por vendedor</h2>
          <span class="text-sm font-semibold text-slate-900">{{ formatoMoneda.format(totalMes) }}</span>
        </div>
        <p v-if="!ventas.length" class="text-sm text-slate-400">Sin ventas registradas este mes.</p>
        <ul v-else class="divide-y divide-slate-100">
          <li v-for="v in ventas" :key="v.vendedorId" class="flex items-center justify-between py-2 text-sm">
            <span class="text-slate-700">{{ v.vendedorNombre }} <span class="text-slate-400">· {{ v.pedidos }} pedidos</span></span>
            <span class="font-medium text-slate-900">{{ formatoMoneda.format(v.total) }}</span>
          </li>
        </ul>
      </div>

      <div class="rounded-lg border border-slate-200 bg-white p-4">
        <h2 class="text-sm font-semibold text-slate-900 mb-3">Productos más vendidos este mes</h2>
        <p v-if="!productos.length" class="text-sm text-slate-400">Sin datos todavía.</p>
        <ul v-else class="divide-y divide-slate-100">
          <li v-for="p in productos" :key="p.codigo" class="flex items-center justify-between py-2 text-sm">
            <span class="text-slate-700">{{ p.descripcion }} <span class="text-slate-400">· {{ p.codigo }}</span></span>
            <span class="font-medium text-slate-900">{{ p.cantidad }} u.</span>
          </li>
        </ul>
      </div>

      <div v-if="pushSoportado" class="rounded-lg border border-slate-200 bg-white p-4">
        <h2 class="text-sm font-semibold text-slate-900 mb-1">Notificaciones de escritorio</h2>
        <p class="text-xs text-slate-500 mb-3">Recibe una alerta en este navegador cuando se apruebe una venta o un vendedor inicie su jornada.</p>
        <div class="flex items-center gap-3">
          <button
            type="button" :disabled="activandoPush"
            class="rounded-md text-sm px-3 py-1.5"
            :class="pushActivo ? 'border border-slate-300 text-slate-700' : 'bg-[#1E2A6E] text-white'"
            @click="alternarPush"
          >
            {{ pushActivo ? 'Desactivar' : 'Activar notificaciones' }}
          </button>
          <button
            v-if="pushActivo"
            type="button" :disabled="enviandoPrueba"
            class="text-sm text-[#1E2A6E] hover:underline"
            @click="enviarPrueba"
          >
            {{ enviandoPrueba ? 'Enviando…' : 'Enviar notificación de prueba' }}
          </button>
        </div>
        <p
          v-if="mensajePush"
          class="text-sm mt-2"
          :class="mensajePush.tipo === 'error' ? 'text-red-600' : 'text-emerald-600'"
        >
          {{ mensajePush.texto }}
        </p>
      </div>

      <div class="rounded-lg border border-slate-200 bg-white p-4">
        <h2 class="text-sm font-semibold text-slate-900 mb-3">Alertas de cartera vencida</h2>
        <p v-if="!alertas.length" class="text-sm text-slate-400">Sin cartera vencida.</p>
        <ul v-else class="divide-y divide-slate-100">
          <li v-for="a in alertas" :key="a.clienteIdentificacion" class="flex items-center justify-between py-2 text-sm">
            <span class="text-slate-700">{{ a.clienteNombre }} <span class="text-slate-400">· {{ a.diasAtraso }} días</span></span>
            <span class="font-medium text-red-600">{{ formatoMoneda.format(a.saldoVencido) }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
