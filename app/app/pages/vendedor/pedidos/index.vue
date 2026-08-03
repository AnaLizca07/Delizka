<script setup lang="ts">
import type { PedidoVendedor } from '~/composables/useMisPedidosVendedor'
import { ETIQUETA_ESTADO } from '~/composables/useAuditoria'

const { listar, actualizarCantidadLinea, eliminarLinea, aprobar, cancelar } = useMisPedidosVendedor()
const pedidos = ref<PedidoVendedor[]>([])
const cargando = ref(true)
const expandidoId = ref<string | null>(null)
const filtroEstado = ref<string>('todos')

const accionando = reactive<Record<string, boolean>>({})
const errorPorPedido = reactive<Record<string, string | null>>({})
const mostrarCancelar = reactive<Record<string, boolean>>({})
const motivoPorPedido = reactive<Record<string, string>>({})

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
  if (filtroEstado.value === 'todos') return pedidos.value
  return pedidos.value.filter((p) => p.estado === filtroEstado.value)
})

function alternarExpandido(id: string) {
  expandidoId.value = expandidoId.value === id ? null : id
}

async function cargar() {
  pedidos.value = await listar()
}

onMounted(async () => {
  await cargar()
  cargando.value = false
})

async function cambiarCantidad(pedidoId: string, lineaId: string, cantidad: number) {
  if (cantidad < 1) return
  errorPorPedido[pedidoId] = null
  const { error } = await actualizarCantidadLinea(lineaId, cantidad)
  if (error) {
    errorPorPedido[pedidoId] = 'No se pudo actualizar la cantidad.'
    return
  }
  await cargar()
}

async function quitarLinea(pedidoId: string, lineaId: string) {
  errorPorPedido[pedidoId] = null
  const { error } = await eliminarLinea(lineaId)
  if (error) {
    errorPorPedido[pedidoId] = 'No se pudo quitar el producto.'
    return
  }
  await cargar()
}

async function aprobarPedido(pedidoId: string) {
  errorPorPedido[pedidoId] = null
  accionando[pedidoId] = true
  const { error } = await aprobar(pedidoId)
  accionando[pedidoId] = false
  if (error) {
    errorPorPedido[pedidoId] = error.message.includes('stock')
      ? 'Ya no hay stock suficiente para aprobar este pedido tal como está. Ajusta las cantidades e intenta de nuevo.'
      : 'No se pudo aprobar el pedido.'
    return
  }
  await cargar()
}

async function confirmarCancelacion(pedidoId: string) {
  const motivo = (motivoPorPedido[pedidoId] ?? '').trim()
  if (!motivo) {
    errorPorPedido[pedidoId] = 'Escribe un motivo para cancelar el pedido.'
    return
  }
  errorPorPedido[pedidoId] = null
  accionando[pedidoId] = true
  const { error } = await cancelar(pedidoId, motivo)
  accionando[pedidoId] = false
  if (error) {
    errorPorPedido[pedidoId] = 'No se pudo cancelar el pedido.'
    return
  }
  mostrarCancelar[pedidoId] = false
  await cargar()
}
</script>

<template>
  <div class="max-w-3xl">
    <h1 class="text-lg font-semibold text-slate-900 mb-1">Mis pedidos</h1>
    <p class="text-sm text-slate-500 mb-4">
      Pedidos que has creado y auto-pedidos de tus clientes. Los que están pendientes de aprobación puedes editarlos, aprobarlos o cancelarlos aquí.
    </p>

    <select
      v-model="filtroEstado"
      class="mb-4 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2A6E]"
    >
      <option value="todos">Todos los estados</option>
      <option v-for="(etiqueta, clave) in ETIQUETA_ESTADO" :key="clave" :value="clave">{{ etiqueta }}</option>
    </select>

    <p v-if="cargando" class="text-sm text-slate-400">Cargando…</p>
    <p v-else-if="!pedidosFiltrados.length" class="text-sm text-slate-400">No tienes pedidos todavía.</p>

    <ul v-else class="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      <li v-for="p in pedidosFiltrados" :key="p.id">
        <button type="button" class="w-full flex items-center justify-between gap-3 px-4 py-3 text-left" @click="alternarExpandido(p.id)">
          <div class="min-w-0">
            <p class="text-sm font-medium text-slate-900 truncate">{{ p.clienteNombre }} <span class="text-slate-400 font-normal">· {{ p.clienteIdentificacion }}</span></p>
            <p class="text-xs text-slate-500">{{ formatoFecha.format(new Date(p.creadoAt)) }} · {{ p.canal === 'vendedor' ? 'creado por ti' : 'auto-pedido del cliente' }}</p>
          </div>
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
                <th v-if="p.estado === 'pendiente_aprobacion'" class="font-normal py-1 w-6" />
              </tr>
            </thead>
            <tbody>
              <tr v-for="l in p.lineas" :key="l.id" class="border-t border-slate-100">
                <td class="py-1 text-slate-700">{{ l.codigo_producto }}</td>
                <td class="py-1 text-slate-700">{{ l.descripcion }}</td>
                <td class="py-1 text-right text-slate-700">
                  <input
                    v-if="p.estado === 'pendiente_aprobacion'"
                    type="number" min="1" :value="l.cantidad"
                    class="w-16 rounded-md border border-slate-300 px-2 py-0.5 text-right"
                    @change="cambiarCantidad(p.id, l.id, Number(($event.target as HTMLInputElement).value))"
                  >
                  <span v-else>{{ l.cantidad }}</span>
                </td>
                <td class="py-1 text-right text-slate-700">{{ formatoMoneda.format(l.precio_unitario) }}</td>
                <td v-if="p.estado === 'pendiente_aprobacion'" class="py-1 text-right">
                  <button type="button" class="text-slate-400 hover:text-red-600" @click="quitarLinea(p.id, l.id)">✕</button>
                </td>
              </tr>
            </tbody>
          </table>

          <div v-if="p.estado === 'pendiente_aprobacion'" class="mt-3 pt-3 border-t border-slate-100">
            <div v-if="mostrarCancelar[p.id]" class="flex items-end gap-2">
              <div class="flex-1">
                <label class="block text-xs text-slate-500 mb-1">Motivo de cancelación</label>
                <input
                  v-model="motivoPorPedido[p.id]" type="text"
                  class="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                >
              </div>
              <button
                type="button" :disabled="accionando[p.id]"
                class="rounded-md bg-red-600 text-white text-sm px-3 py-1.5 disabled:opacity-60"
                @click="confirmarCancelacion(p.id)"
              >
                Confirmar cancelación
              </button>
              <button type="button" class="text-sm text-slate-500 px-2 py-1.5" @click="mostrarCancelar[p.id] = false">
                Volver
              </button>
            </div>
            <div v-else class="flex items-center gap-2">
              <button
                type="button" :disabled="accionando[p.id] || !p.lineas.length"
                class="rounded-md bg-[#1E2A6E] text-white text-sm px-3 py-1.5 disabled:opacity-60"
                @click="aprobarPedido(p.id)"
              >
                {{ accionando[p.id] ? 'Aprobando…' : 'Aprobar pedido' }}
              </button>
              <button
                type="button" :disabled="accionando[p.id]"
                class="rounded-md border border-slate-300 text-slate-700 text-sm px-3 py-1.5"
                @click="mostrarCancelar[p.id] = true"
              >
                Cancelar pedido
              </button>
            </div>
            <p v-if="errorPorPedido[p.id]" class="text-sm text-red-600 mt-2">{{ errorPorPedido[p.id] }}</p>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
