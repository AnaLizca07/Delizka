<script setup lang="ts">
import type { ProductoCatalogo } from '~/composables/useCatalogo'

const { buscar } = useCatalogo()
const { miCliente, cargarMiCliente } = useMiCliente()
const {
  lineas, subtotal, iva, total, ivaTarifa,
  cargarIvaTarifa, agregar, quitar, actualizarCantidad, enviarPedido
} = useAutoPedido()

const termino = ref('')
const resultados = ref<ProductoCatalogo[]>([])
const buscando = ref(false)
const cantidadesPorProducto = reactive<Record<string, number>>({})

const mensaje = ref<{ tipo: 'error' | 'ok'; texto: string } | null>(null)
const enviando = ref(false)

let debounce: ReturnType<typeof setTimeout> | undefined

watch(termino, (valor) => {
  clearTimeout(debounce)
  if (valor.trim().length < 2) {
    resultados.value = []
    return
  }
  debounce = setTimeout(async () => {
    buscando.value = true
    resultados.value = await buscar(valor)
    buscando.value = false
  }, 300)
})

function cantidadPara(id: string) {
  return cantidadesPorProducto[id] ?? 1
}

function agregarAlCarrito(producto: ProductoCatalogo) {
  const cantidad = cantidadPara(producto.id)
  const resultado = agregar(producto, cantidad)
  if (!resultado.ok) {
    mensaje.value = { tipo: 'error', texto: resultado.mensaje ?? 'No se pudo agregar el producto.' }
    return
  }
  mensaje.value = null
  cantidadesPorProducto[producto.id] = 1
}

function cambiarCantidadLinea(inventarioId: string, cantidad: number) {
  const resultado = actualizarCantidad(inventarioId, cantidad)
  if (!resultado.ok) {
    mensaje.value = { tipo: 'error', texto: resultado.mensaje ?? 'Cantidad no disponible.' }
  }
}

async function confirmarPedido() {
  mensaje.value = null
  enviando.value = true
  const resultado = await enviarPedido()
  enviando.value = false
  mensaje.value = resultado.ok
    ? { tipo: 'ok', texto: 'Tu pedido fue enviado. Tu vendedor lo revisará pronto.' }
    : { tipo: 'error', texto: resultado.mensaje ?? 'No se pudo enviar el pedido.' }
}

const formatoMoneda = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

onMounted(async () => {
  await Promise.all([cargarMiCliente(), cargarIvaTarifa()])
})
</script>

<template>
  <div class="grid gap-6 md:grid-cols-[1fr_360px]">
    <div>
      <h1 class="text-lg font-semibold text-slate-900 mb-1">Hacer un pedido</h1>
      <p v-if="miCliente" class="text-sm text-slate-500 mb-4">{{ miCliente.nombre }}</p>

      <label class="block text-sm font-medium text-slate-700 mb-1" for="buscar">Buscar producto</label>
      <input
        id="buscar" v-model="termino" type="text" placeholder="Código o descripción…"
        class="w-full mb-3 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2A6E]"
      >

      <p v-if="buscando" class="text-sm text-slate-400">Buscando…</p>
      <p v-else-if="termino.trim().length >= 2 && !resultados.length" class="text-sm text-slate-400">
        Sin resultados.
      </p>

      <ul class="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        <li v-for="p in resultados" :key="p.id" class="flex items-center gap-3 px-4 py-3">
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-slate-900 truncate">{{ p.descripcion }}</p>
            <p class="text-xs text-slate-500">{{ p.codigo }} · {{ formatoMoneda.format(p.precio) }} · disponible: {{ p.stockDisponible }}</p>
          </div>
          <input
            type="number" min="1" :max="p.stockDisponible" :value="cantidadPara(p.id)"
            class="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm text-right"
            @input="cantidadesPorProducto[p.id] = Number(($event.target as HTMLInputElement).value)"
          >
          <button
            type="button" :disabled="p.stockDisponible < 1"
            class="rounded-md bg-[#1E2A6E] text-white text-sm px-3 py-1.5 disabled:opacity-40"
            @click="agregarAlCarrito(p)"
          >
            Agregar
          </button>
        </li>
      </ul>
    </div>

    <aside class="rounded-lg border border-slate-200 bg-white p-4 h-fit">
      <h2 class="text-sm font-semibold text-slate-900 mb-3">Tu pedido</h2>

      <p v-if="!lineas.length" class="text-sm text-slate-400">Aún no has agregado productos.</p>

      <ul v-else class="space-y-3 mb-4">
        <li v-for="l in lineas" :key="l.inventarioId" class="text-sm">
          <div class="flex items-center justify-between gap-2">
            <span class="truncate text-slate-800">{{ l.descripcion }}</span>
            <button type="button" class="text-slate-400 hover:text-red-600" @click="quitar(l.inventarioId)">✕</button>
          </div>
          <div class="flex items-center justify-between text-xs text-slate-500 mt-1">
            <span>{{ formatoMoneda.format(l.precioUnitario) }} c/u</span>
            <input
              type="number" min="1" :max="l.stockDisponible" :value="l.cantidad"
              class="w-14 rounded-md border border-slate-300 px-2 py-0.5 text-right"
              @input="cambiarCantidadLinea(l.inventarioId, Number(($event.target as HTMLInputElement).value))"
            >
          </div>
        </li>
      </ul>

      <div class="border-t border-slate-200 pt-3 space-y-1 text-sm">
        <div class="flex justify-between text-slate-600">
          <span>Subtotal</span><span>{{ formatoMoneda.format(subtotal) }}</span>
        </div>
        <div class="flex justify-between text-slate-600">
          <span>IVA ({{ Math.round(ivaTarifa * 100) }}%)</span><span>{{ formatoMoneda.format(iva) }}</span>
        </div>
        <div class="flex justify-between font-semibold text-slate-900">
          <span>Total</span><span>{{ formatoMoneda.format(total) }}</span>
        </div>
      </div>

      <p
        v-if="mensaje" class="mt-3 text-sm"
        :class="mensaje.tipo === 'error' ? 'text-red-600' : 'text-emerald-600'"
      >
        {{ mensaje.texto }}
      </p>

      <button
        type="button" :disabled="enviando || !lineas.length"
        class="mt-4 w-full rounded-lg bg-[#1E2A6E] text-white text-sm font-medium py-2.5 disabled:opacity-40"
        @click="confirmarPedido"
      >
        {{ enviando ? 'Enviando…' : 'Enviar pedido' }}
      </button>
    </aside>
  </div>
</template>
