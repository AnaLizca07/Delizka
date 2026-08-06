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
const formatoMes = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' })

const totalMes = computed(() => ventas.value.reduce((acc, v) => acc + v.total, 0))
const pedidosMes = computed(() => ventas.value.reduce((acc, v) => acc + v.pedidos, 0))
const ticketPromedio = computed(() => (pedidosMes.value ? totalMes.value / pedidosMes.value : 0))
const totalCarteraVencida = computed(() => alertas.value.reduce((acc, a) => acc + a.saldoVencido, 0))
const maxVenta = computed(() => Math.max(...ventas.value.map((v) => v.total), 1))

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
  <div>
    <h1 class="text-lg font-semibold text-slate-900">Panel gerencial</h1>
    <p class="text-sm text-slate-500 mb-4 capitalize">{{ formatoMes.format(new Date()) }} · Zona nacional</p>

    <p v-if="cargando" class="text-sm text-slate-400">Cargando…</p>

    <div v-else class="space-y-6">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="rounded-lg border border-slate-200 bg-white p-4">
          <p class="text-xs uppercase tracking-wide text-slate-500">Ventas del mes</p>
          <p class="text-xl font-semibold text-slate-900 mt-1">{{ formatoMoneda.format(totalMes) }}</p>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white p-4">
          <p class="text-xs uppercase tracking-wide text-slate-500">Pedidos aprobados</p>
          <p class="text-xl font-semibold text-slate-900 mt-1">{{ pedidosMes }}</p>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white p-4">
          <p class="text-xs uppercase tracking-wide text-slate-500">Ticket promedio</p>
          <p class="text-xl font-semibold text-slate-900 mt-1">{{ formatoMoneda.format(ticketPromedio) }}</p>
        </div>
        <div class="rounded-lg border p-4" :class="totalCarteraVencida > 0 ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'">
          <p class="text-xs uppercase tracking-wide" :class="totalCarteraVencida > 0 ? 'text-amber-700' : 'text-slate-500'">Cartera vencida</p>
          <p class="text-xl font-semibold mt-1" :class="totalCarteraVencida > 0 ? 'text-amber-900' : 'text-slate-900'">
            {{ formatoMoneda.format(totalCarteraVencida) }}
          </p>
        </div>
      </div>

      <div class="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div class="space-y-6">
          <div class="rounded-lg border border-slate-200 bg-white p-4">
            <h2 class="text-sm font-semibold text-slate-900 mb-3">Ventas del mes por vendedor</h2>
            <p v-if="!ventas.length" class="text-sm text-slate-400">Sin ventas registradas este mes.</p>
            <ul v-else class="space-y-3">
              <li v-for="v in ventas" :key="v.vendedorId">
                <div class="flex items-center justify-between text-sm mb-1">
                  <span class="text-slate-700">{{ v.vendedorNombre }} <span class="text-slate-400">· {{ v.pedidos }} pedidos</span></span>
                  <span class="font-medium text-slate-900">{{ formatoMoneda.format(v.total) }}</span>
                </div>
                <div class="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div class="h-full bg-[#1E2A6E] rounded-full" :style="{ width: `${(v.total / maxVenta) * 100}%` }" />
                </div>
              </li>
            </ul>
          </div>

          <div class="rounded-lg border border-slate-200 bg-white p-4">
            <h2 class="text-sm font-semibold text-slate-900 mb-3">Productos más vendidos este mes</h2>
            <p v-if="!productos.length" class="text-sm text-slate-400">Sin datos todavía.</p>
            <ul v-else class="divide-y divide-slate-100">
              <li v-for="(p, i) in productos" :key="p.codigo" class="flex items-center justify-between py-2 text-sm">
                <span class="text-slate-700"><span class="text-slate-400">{{ i + 1 }}</span> {{ p.descripcion }} <span class="text-slate-400">· {{ p.codigo }}</span></span>
                <span class="font-medium text-slate-900">{{ p.cantidad }} u.</span>
              </li>
            </ul>
          </div>
        </div>

        <div class="space-y-6">
          <div class="rounded-lg border border-slate-200 bg-white p-4">
            <h2 class="text-sm font-semibold text-slate-900 mb-3">Alertas de cartera vencida</h2>
            <p v-if="!alertas.length" class="text-sm text-slate-400">Sin cartera vencida.</p>
            <ul v-else class="divide-y divide-slate-100">
              <li v-for="a in alertas" :key="a.clienteIdentificacion" class="py-2 text-sm">
                <p class="text-slate-700">{{ a.clienteNombre }}</p>
                <div class="flex items-center justify-between">
                  <span class="text-xs text-slate-400">{{ a.diasAtraso }} días</span>
                  <span class="font-medium text-red-600">{{ formatoMoneda.format(a.saldoVencido) }}</span>
                </div>
              </li>
            </ul>
          </div>

          <div v-if="pushSoportado" class="rounded-lg border border-slate-200 bg-white p-4">
            <h2 class="text-sm font-semibold text-slate-900 mb-1">Notificaciones de escritorio</h2>
            <p class="text-xs text-slate-500 mb-3">Recibe una alerta cuando se apruebe una venta o un vendedor inicie su jornada.</p>
            <div class="flex items-center gap-3 flex-wrap">
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
                {{ enviandoPrueba ? 'Enviando…' : 'Enviar prueba' }}
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
        </div>
      </div>
    </div>
  </div>
</template>
