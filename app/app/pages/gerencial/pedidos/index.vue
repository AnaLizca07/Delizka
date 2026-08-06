<script setup lang="ts">
import type { PedidoPendiente } from '~/composables/useBandejaPedidos'

const { listar, marcarComoRegistrado } = useBandejaPedidos()

const pedidos = ref<PedidoPendiente[]>([])
const cargando = ref(true)
const prefijoPorPedido = reactive<Record<string, string>>({})
const numeroPorPedido = reactive<Record<string, string>>({})
const enviandoPorPedido = reactive<Record<string, boolean>>({})
const errorPorPedido = reactive<Record<string, string | null>>({})

const formatoMoneda = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const formatoFecha = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' })

function horasDesde(fecha: string) {
  return (Date.now() - new Date(fecha).getTime()) / (1000 * 60 * 60)
}

async function cargar() {
  cargando.value = true
  pedidos.value = await listar()
  cargando.value = false
}

async function registrar(p: PedidoPendiente) {
  errorPorPedido[p.id] = null
  const prefijo = (prefijoPorPedido[p.id] ?? '').trim()
  const numero = (numeroPorPedido[p.id] ?? '').trim()
  if (!numero) {
    errorPorPedido[p.id] = 'Escribe el número de documento asignado por World Office.'
    return
  }
  enviandoPorPedido[p.id] = true
  const { error } = await marcarComoRegistrado(p.id, prefijo, numero)
  enviandoPorPedido[p.id] = false
  if (error) {
    errorPorPedido[p.id] = 'No se pudo registrar. Intenta de nuevo.'
    return
  }
  pedidos.value = pedidos.value.filter((x) => x.id !== p.id)
}

onMounted(cargar)
</script>

<template>
  <div class="max-w-3xl">
    <h1 class="text-lg font-semibold text-slate-900 mb-1">Bandeja de registro en World Office</h1>
    <p class="text-sm text-slate-500 mb-4">
      Pedidos aprobados, con stock reservado, esperando ser digitados en World Office Escritorio.
    </p>

    <p v-if="cargando" class="text-sm text-slate-400">Cargando…</p>
    <p v-else-if="!pedidos.length" class="text-sm text-slate-400">No hay pedidos pendientes de registrar.</p>

    <div v-else class="space-y-4">
      <div
        v-for="p in pedidos" :key="p.id"
        class="rounded-lg border bg-white p-4"
        :class="horasDesde(p.aprobado_at) > 48 ? 'border-amber-300' : 'border-slate-200'"
      >
        <div class="flex items-center justify-between mb-2">
          <div>
            <p class="text-sm font-medium text-slate-900">{{ p.clienteNombre }}</p>
            <p class="text-xs text-slate-500">{{ p.clienteIdentificacion }} · vendedor: {{ p.vendedorNombre }}</p>
          </div>
          <div class="text-right">
            <p class="text-sm font-semibold text-slate-900">{{ formatoMoneda.format(p.total) }}</p>
            <p class="text-xs" :class="horasDesde(p.aprobado_at) > 48 ? 'text-amber-700' : 'text-slate-500'">
              Aprobado {{ formatoFecha.format(new Date(p.aprobado_at)) }}
              <span v-if="horasDesde(p.aprobado_at) > 48"> · más de 48h esperando</span>
            </p>
          </div>
        </div>

        <table class="w-full text-sm mb-3">
          <thead>
            <tr class="text-left text-xs text-slate-500">
              <th class="font-normal py-1">Código</th>
              <th class="font-normal py-1">Descripción</th>
              <th class="font-normal py-1 text-right">Cant.</th>
              <th class="font-normal py-1 text-right">Precio</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(l, i) in p.lineas" :key="i" class="border-t border-slate-100">
              <td class="py-1 text-slate-700">{{ l.codigo_producto }}</td>
              <td class="py-1 text-slate-700">{{ l.descripcion }}</td>
              <td class="py-1 text-right text-slate-700">{{ l.cantidad }}</td>
              <td class="py-1 text-right text-slate-700">{{ formatoMoneda.format(l.precio_unitario) }}</td>
            </tr>
          </tbody>
        </table>

        <p v-if="p.notas" class="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900 mb-3">
          <span class="font-medium">Notas:</span> {{ p.notas }}
        </p>

        <div class="flex items-end gap-2 border-t border-slate-100 pt-3">
          <div>
            <label class="block text-xs text-slate-500 mb-1">Prefijo</label>
            <input
              v-model="prefijoPorPedido[p.id]" type="text" placeholder="FV"
              class="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
          </div>
          <div class="flex-1">
            <label class="block text-xs text-slate-500 mb-1">Número de documento en World Office</label>
            <input
              v-model="numeroPorPedido[p.id]" type="text"
              class="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
          </div>
          <button
            type="button" :disabled="enviandoPorPedido[p.id]"
            class="rounded-md bg-[#1E2A6E] text-white text-sm px-3 py-1.5 disabled:opacity-60"
            @click="registrar(p)"
          >
            {{ enviandoPorPedido[p.id] ? 'Guardando…' : 'Marcar como registrado' }}
          </button>
        </div>
        <p v-if="errorPorPedido[p.id]" class="text-sm text-red-600 mt-2">{{ errorPorPedido[p.id] }}</p>
      </div>
    </div>
  </div>
</template>
