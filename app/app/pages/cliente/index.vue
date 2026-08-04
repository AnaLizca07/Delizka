<script setup lang="ts">
import type { MiCartera } from '~/composables/useMiCartera'
import type { PedidoCliente } from '~/composables/useMisPedidosCliente'
import { ETIQUETA_ESTADO } from '~/composables/useAuditoria'

const { miCliente, cargarMiCliente } = useMiCliente()
const { obtener: obtenerCartera } = useMiCartera()
const { listar: listarPedidos } = useMisPedidosCliente()

const cartera = ref<MiCartera | null>(null)
const ultimosPedidos = ref<PedidoCliente[]>([])
const cargando = ref(true)

const formatoMoneda = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const formatoFecha = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' })

const BADGE: Record<string, string> = {
  pendiente_aprobacion: 'bg-slate-100 text-slate-600',
  aprobado: 'bg-blue-50 text-blue-700',
  pendiente_registro_wo: 'bg-blue-50 text-blue-700',
  confirmado_en_wo: 'bg-emerald-50 text-emerald-700',
  revision_manual: 'bg-amber-50 text-amber-700',
  sin_match: 'bg-amber-50 text-amber-700',
  cancelado: 'bg-slate-100 text-slate-500',
  conflicto_stock: 'bg-red-50 text-red-700'
}

onMounted(async () => {
  if (!miCliente.value) await cargarMiCliente()
  if (miCliente.value) {
    const [c, p] = await Promise.all([obtenerCartera(miCliente.value.id), listarPedidos(miCliente.value.id, 3)])
    cartera.value = c
    ultimosPedidos.value = p
  }
  cargando.value = false
})
</script>

<template>
  <div class="space-y-4">
    <div>
      <p class="text-sm text-slate-500">Hola,</p>
      <h1 class="text-lg font-semibold text-slate-900">{{ miCliente?.nombre }}</h1>
    </div>

    <p v-if="cargando" class="text-sm text-slate-400">Cargando…</p>

    <template v-else>
      <div class="relative overflow-hidden rounded-xl bg-[#0B1220] p-5 text-white">
        <div
          class="absolute inset-0 opacity-[0.07]"
          style="background-image: linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px); background-size: 20px 20px;"
        />
        <div class="relative">
          <p class="text-xs uppercase tracking-wide text-slate-400">Estado de cartera</p>
          <p class="text-2xl font-semibold mt-1">{{ formatoMoneda.format(cartera?.saldo_total ?? 0) }}</p>
          <p v-if="cartera && cartera.saldo_vencido > 0" class="text-sm text-red-300 mt-1">
            {{ formatoMoneda.format(cartera.saldo_vencido) }} vencido · {{ cartera.dias_atraso }} días
          </p>
          <p v-else class="text-sm text-emerald-300 mt-1">Sin saldo vencido</p>
          <NuxtLink to="/cliente/pedidos" class="inline-block text-sm text-[#93C5FD] mt-3 hover:underline">
            Ir a mis pedidos →
          </NuxtLink>
        </div>
      </div>

      <NuxtLink
        to="/cliente/pedido-nuevo"
        class="flex items-center justify-center rounded-xl bg-[#1E2A6E] text-white text-sm font-medium py-3.5"
      >
        Hacer un pedido
      </NuxtLink>

      <div class="rounded-xl border border-slate-200 bg-white p-4">
        <h2 class="text-sm font-semibold text-slate-900 mb-3">Últimos pedidos</h2>
        <p v-if="!ultimosPedidos.length" class="text-sm text-slate-400">Aún no has hecho pedidos.</p>
        <ul v-else class="divide-y divide-slate-100">
          <li v-for="p in ultimosPedidos" :key="p.id" class="py-2 flex items-center justify-between gap-2 text-sm">
            <div class="min-w-0">
              <p class="text-slate-900">{{ formatoFecha.format(new Date(p.creadoAt)) }}</p>
              <p class="font-medium text-slate-900">{{ formatoMoneda.format(p.total) }}</p>
            </div>
            <span class="shrink-0 rounded-full px-2 py-0.5 text-xs" :class="BADGE[p.estado] ?? 'bg-slate-100 text-slate-600'">
              {{ ETIQUETA_ESTADO[p.estado] ?? p.estado }}
            </span>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
