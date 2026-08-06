<script setup lang="ts">
import type { PedidoAuditoria } from '~/composables/useAuditoria'
import { ETIQUETA_ESTADO } from '~/composables/useAuditoria'

const { listar } = useAuditoria()
const pedidos = ref<PedidoAuditoria[]>([])
const cargando = ref(true)
const expandidoId = ref<string | null>(null)
const filtroEstado = ref<string>('todos')
const busqueda = ref('')

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

const pedidosFiltrados = computed(() => {
  const texto = busqueda.value.trim().toLowerCase()
  return pedidos.value.filter((p) => {
    if (filtroEstado.value !== 'todos' && p.estado !== filtroEstado.value) return false
    if (!texto) return true
    return p.clienteNombre.toLowerCase().includes(texto) || p.vendedorNombre.toLowerCase().includes(texto)
  })
})

function alternarExpandido(id: string) {
  expandidoId.value = expandidoId.value === id ? null : id
}

function exportarCsv() {
  const encabezados = ['Cliente', 'Vendedor', 'Fecha', 'Origen', 'Total', 'Estado']
  const filas = pedidosFiltrados.value.map((p) => [
    p.clienteNombre,
    p.vendedorNombre,
    formatoFecha.format(new Date(p.creadoAt)),
    p.canal === 'vendedor' ? 'Creado por vendedor' : 'Auto-pedido',
    p.total,
    ETIQUETA_ESTADO[p.estado] ?? p.estado
  ])
  const csv = [encabezados, ...filas]
    .map((fila) => fila.map((valor) => `"${String(valor).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  // BOM al inicio para que Excel detecte UTF-8 y no rompa los acentos.
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `auditoria-pedidos-${new Date().toISOString().slice(0, 10)}.csv`
  enlace.click()
  URL.revokeObjectURL(url)
}

onMounted(async () => {
  pedidos.value = await listar()
  cargando.value = false
})
</script>

<template>
  <div>
    <h1 class="text-lg font-semibold text-slate-900 mb-1">Auditoría de pedidos</h1>
    <p class="text-sm text-slate-500 mb-4">Trazabilidad completa: quién subió cada pedido y su estado de reconciliación con World Office.</p>

    <div class="flex flex-wrap items-center gap-3 mb-4">
      <input
        v-model="busqueda"
        type="text"
        placeholder="Buscar por cliente o vendedor…"
        class="flex-1 min-w-[220px] rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2A6E]"
      >
      <select
        v-model="filtroEstado"
        class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2A6E]"
      >
        <option value="todos">Todos los estados</option>
        <option v-for="(etiqueta, clave) in ETIQUETA_ESTADO" :key="clave" :value="clave">{{ etiqueta }}</option>
      </select>
      <button
        type="button"
        :disabled="!pedidosFiltrados.length"
        class="rounded-lg border border-slate-300 text-slate-700 text-sm font-medium px-3 py-2 disabled:opacity-40"
        @click="exportarCsv"
      >
        ↓ Exportar
      </button>
    </div>

    <p v-if="cargando" class="text-sm text-slate-400">Cargando…</p>
    <p v-else-if="!pedidosFiltrados.length" class="text-sm text-slate-400">Sin pedidos para este filtro.</p>

    <div v-else class="rounded-lg border border-slate-200 bg-white overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs text-slate-500 border-b border-slate-200">
            <th class="font-medium py-2 px-4">Cliente</th>
            <th class="font-medium py-2 px-4">Vendedor</th>
            <th class="font-medium py-2 px-4">Fecha</th>
            <th class="font-medium py-2 px-4">Origen</th>
            <th class="font-medium py-2 px-4 text-right">Total</th>
            <th class="font-medium py-2 px-4">Estado</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="p in pedidosFiltrados" :key="p.id">
            <tr
              class="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer"
              @click="alternarExpandido(p.id)"
            >
              <td class="py-2 px-4 text-slate-900 font-medium whitespace-nowrap">{{ p.clienteNombre }}</td>
              <td class="py-2 px-4 text-slate-700 whitespace-nowrap">{{ p.vendedorNombre }}</td>
              <td class="py-2 px-4 text-slate-500 whitespace-nowrap">{{ formatoFecha.format(new Date(p.creadoAt)) }}</td>
              <td class="py-2 px-4 text-slate-500 whitespace-nowrap">{{ p.canal === 'vendedor' ? 'Creado por vendedor' : 'Auto-pedido' }}</td>
              <td class="py-2 px-4 text-slate-900 text-right font-medium whitespace-nowrap">{{ formatoMoneda.format(p.total) }}</td>
              <td class="py-2 px-4">
                <span class="rounded-full px-2 py-0.5 text-xs whitespace-nowrap" :class="BADGE[p.estado] ?? 'bg-slate-100 text-slate-600'">
                  {{ ETIQUETA_ESTADO[p.estado] ?? p.estado }}
                </span>
              </td>
            </tr>
            <tr v-if="expandidoId === p.id" class="border-b border-slate-100 bg-slate-50">
              <td colspan="6" class="px-4 py-3">
                <p v-if="p.notas" class="mb-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
                  <span class="font-medium">Notas:</span> {{ p.notas }}
                </p>
                <p class="text-xs font-medium text-slate-500 mb-1">Historial</p>
                <ul class="space-y-1">
                  <li v-for="(e, i) in p.eventos" :key="i" class="text-xs text-slate-600">
                    {{ formatoFecha.format(new Date(e.creadoAt)) }} — {{ e.usuarioNombre }}:
                    <span v-if="e.estadoAnterior">{{ ETIQUETA_ESTADO[e.estadoAnterior] ?? e.estadoAnterior }} →</span>
                    {{ ETIQUETA_ESTADO[e.estadoNuevo] ?? e.estadoNuevo }}
                  </li>
                </ul>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
