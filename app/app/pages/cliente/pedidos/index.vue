<script setup lang="ts">
import type { PedidoCliente } from '~/composables/useMisPedidosCliente'
import { ETIQUETA_ESTADO } from '~/composables/useAuditoria'

const { miCliente, cargarMiCliente } = useMiCliente()
const { listar } = useMisPedidosCliente()

const pedidos = ref<PedidoCliente[]>([])
const cargando = ref(true)
const expandidoId = ref<string | null>(null)
const filtroEstado = ref<string>('todos')

const formatoMoneda = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const formatoFecha = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' })

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

const ACENTO: Record<string, string> = {
  pendiente_aprobacion: 'border-l-slate-400',
  aprobado: 'border-l-blue-500',
  pendiente_registro_wo: 'border-l-blue-500',
  confirmado_en_wo: 'border-l-emerald-500',
  revision_manual: 'border-l-amber-500',
  sin_match: 'border-l-amber-500',
  cancelado: 'border-l-slate-300',
  conflicto_stock: 'border-l-red-500'
}

const FILTROS = computed(() => [{ clave: 'todos', etiqueta: 'Todos' }, ...Object.entries(ETIQUETA_ESTADO).map(([clave, etiqueta]) => ({ clave, etiqueta }))])

const pedidosFiltrados = computed(() => {
  if (filtroEstado.value === 'todos') return pedidos.value
  return pedidos.value.filter((p) => p.estado === filtroEstado.value)
})

function alternarExpandido(id: string) {
  expandidoId.value = expandidoId.value === id ? null : id
}

onMounted(async () => {
  if (!miCliente.value) await cargarMiCliente()
  if (miCliente.value) pedidos.value = await listar(miCliente.value.id)
  cargando.value = false
})
</script>

<template>
  <div class="max-w-3xl">
    <h1 class="text-lg font-semibold text-slate-900 mb-1">Mis pedidos</h1>
    <p class="text-sm text-slate-500 mb-4">Seguimiento del estado de cada pedido que has hecho.</p>

    <div class="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-1 px-1">
      <button
        v-for="f in FILTROS" :key="f.clave"
        type="button"
        class="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap"
        :class="filtroEstado === f.clave ? 'bg-[#1E2A6E] text-white' : 'bg-slate-100 text-slate-600'"
        @click="filtroEstado = f.clave"
      >
        {{ f.etiqueta }}
      </button>
    </div>

    <p v-if="cargando" class="text-sm text-slate-400">Cargando…</p>
    <p v-else-if="!pedidosFiltrados.length" class="text-sm text-slate-400">No tienes pedidos todavía.</p>

    <ul v-else class="space-y-2 sm:space-y-0 sm:divide-y sm:divide-slate-200 sm:rounded-lg sm:border sm:border-slate-200 sm:bg-white">
      <li
        v-for="p in pedidosFiltrados" :key="p.id"
        class="rounded-lg border border-l-4 border-slate-200 bg-white sm:rounded-none sm:border-0 sm:border-l-4"
        :class="ACENTO[p.estado] ?? 'border-l-slate-300'"
      >
        <button type="button" class="w-full flex items-center justify-between gap-3 px-4 py-3 text-left" @click="alternarExpandido(p.id)">
          <p class="text-xs text-slate-500">{{ formatoFecha.format(new Date(p.creadoAt)) }}</p>
          <div class="text-right shrink-0">
            <p class="text-sm font-medium text-slate-900">{{ formatoMoneda.format(p.total) }}</p>
            <span class="rounded-full px-2 py-0.5 text-xs" :class="BADGE[p.estado] ?? 'bg-slate-100 text-slate-600'">
              {{ ETIQUETA_ESTADO[p.estado] ?? p.estado }}
            </span>
          </div>
        </button>

        <div v-if="expandidoId === p.id" class="px-4 pb-3 border-t border-slate-100">
          <p v-if="p.notas" class="mt-2 mb-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
            <span class="font-medium">Notas:</span> {{ p.notas }}
          </p>
          <table class="w-full text-sm mt-2">
            <thead>
              <tr class="text-left text-xs text-slate-500">
                <th class="font-normal py-1">Código</th>
                <th class="font-normal py-1">Descripción</th>
                <th class="font-normal py-1 text-right">Cant.</th>
                <th class="font-normal py-1 text-right">Precio</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="l in p.lineas" :key="l.id" class="border-t border-slate-100">
                <td class="py-1 text-slate-700">{{ l.codigo_producto }}</td>
                <td class="py-1 text-slate-700">{{ l.descripcion }}</td>
                <td class="py-1 text-right text-slate-700">{{ l.cantidad }}</td>
                <td class="py-1 text-right text-slate-700">{{ formatoMoneda.format(l.precio_unitario) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </li>
    </ul>
  </div>
</template>
