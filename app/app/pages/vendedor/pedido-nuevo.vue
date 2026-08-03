<script setup lang="ts">
import type { ProductoCatalogo } from '~/composables/useCatalogo'

const client = useSupabaseClient()
const route = useRoute()
const { buscar } = useCatalogo()
const {
  clienteId, lineas, notas, subtotal, iva, total, ivaTarifa,
  cargarIvaTarifa, agregar, quitar, actualizarCantidad, enviarPedido
} = useCarrito()

interface ClienteOpcion { id: string; nombre: string; identificacion: string }
const clientes = ref<ClienteOpcion[]>([])

// Buscador de cliente en vez de un <select> plano: con muchos clientes, un
// desplegable se vuelve imposible de recorrer. `clienteId` (del carrito) sigue
// siendo la fuente de verdad; esto solo controla qué se ve en el buscador.
const terminoCliente = ref('')
const mostrarListaClientes = ref(false)

const clientesFiltrados = computed(() => {
  const texto = terminoCliente.value.trim().toLowerCase()
  const base = texto
    ? clientes.value.filter((c) => c.nombre.toLowerCase().includes(texto) || c.identificacion.includes(texto))
    : clientes.value
  return base.slice(0, 20)
})

function etiquetaCliente(c: ClienteOpcion) {
  return `${c.nombre} — ${c.identificacion}`
}

function seleccionarCliente(c: ClienteOpcion) {
  clienteId.value = c.id
  terminoCliente.value = etiquetaCliente(c)
  mostrarListaClientes.value = false
}

function quitarCliente() {
  clienteId.value = null
  terminoCliente.value = ''
}

function ocultarListaConRetraso() {
  // sin el retraso, el blur del input se dispara antes que el click sobre un
  // ítem de la lista y el click nunca llega a registrarse
  setTimeout(() => { mostrarListaClientes.value = false }, 150)
}

const termino = ref('')
const resultados = ref<ProductoCatalogo[]>([])
const buscando = ref(false)
const cantidadesPorProducto = reactive<Record<string, number>>({})

const mensaje = ref<{ tipo: 'error' | 'ok'; texto: string } | null>(null)
const avisoStock = ref<string | null>(null)
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
    avisoStock.value = resultado.mensaje ?? 'No se pudo agregar el producto.'
    return
  }
  cantidadesPorProducto[producto.id] = 1
}

function cambiarCantidadLinea(inventarioId: string, cantidad: number) {
  const resultado = actualizarCantidad(inventarioId, cantidad)
  if (!resultado.ok) {
    avisoStock.value = resultado.mensaje ?? 'Cantidad no disponible.'
  }
}

async function confirmarPedido() {
  mensaje.value = null
  enviando.value = true
  const resultado = await enviarPedido()
  enviando.value = false
  mensaje.value = resultado.ok
    ? { tipo: 'ok', texto: 'Pedido creado y aprobado.' }
    : { tipo: 'error', texto: resultado.mensaje ?? 'No se pudo enviar el pedido.' }
}

const formatoMoneda = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

onMounted(async () => {
  await cargarIvaTarifa()
  const { data } = await client
    .from('clientes')
    .select('id, nombre, identificacion')
    .eq('activo', true)
    .order('nombre')
  clientes.value = data ?? []

  // Preselección del cliente: por query (botón "Hacer pedido" en su ficha) o,
  // si no vino por query, porque ya había uno elegido en el carrito (p.ej. al
  // volver del flujo de "+ Nuevo cliente").
  const clienteQuery = route.query.clienteId as string | undefined
  const idAPreseleccionar = clienteQuery ?? clienteId.value
  const c = idAPreseleccionar ? clientes.value.find((x) => x.id === idAPreseleccionar) : undefined
  if (c) seleccionarCliente(c)
})
</script>

<template>
  <div class="grid gap-6 items-start md:grid-cols-[1fr_360px]">
    <div>
      <NuxtLink to="/vendedor" class="text-sm text-[#1E2A6E] hover:underline">← Volver</NuxtLink>
      <h1 class="text-lg font-semibold text-slate-900 mt-1 mb-4">Nuevo pedido</h1>

      <div class="flex items-end gap-2 mb-5">
        <div class="flex-1 relative">
          <label class="block text-sm font-medium text-slate-700 mb-1" for="cliente">Cliente</label>
          <div class="relative">
            <input
              id="cliente"
              v-model="terminoCliente"
              type="text"
              autocomplete="off"
              placeholder="Busca por nombre o identificación…"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2A6E]"
              @focus="mostrarListaClientes = true"
              @focusout="ocultarListaConRetraso"
            >
            <button
              v-if="clienteId"
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-600"
              @click="quitarCliente"
            >
              ✕
            </button>
          </div>
          <ul
            v-if="mostrarListaClientes && clientesFiltrados.length"
            class="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
          >
            <li v-for="c in clientesFiltrados" :key="c.id">
              <button
                type="button"
                class="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                @click="seleccionarCliente(c)"
              >
                {{ c.nombre }} — {{ c.identificacion }}
              </button>
            </li>
          </ul>
          <p
            v-else-if="mostrarListaClientes && terminoCliente.trim()"
            class="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg px-3 py-2 text-sm text-slate-400"
          >
            Sin resultados.
          </p>
        </div>
        <NuxtLink
          to="/vendedor/clientes/nuevo?volver=pedido"
          class="whitespace-nowrap rounded-lg border border-slate-300 text-slate-700 text-sm font-medium px-3 py-2 h-fit"
        >
          + Nuevo cliente
        </NuxtLink>
      </div>

      <label class="block text-sm font-medium text-slate-700 mb-1" for="buscar">Buscar producto</label>
      <input
        id="buscar"
        v-model="termino"
        type="text"
        placeholder="Código o descripción…"
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
            type="number"
            min="1"
            :max="p.stockDisponible"
            :value="cantidadPara(p.id)"
            class="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm text-right"
            @input="cantidadesPorProducto[p.id] = Number(($event.target as HTMLInputElement).value)"
          >
          <button
            type="button"
            :disabled="p.stockDisponible < 1"
            class="rounded-md bg-[#1E2A6E] text-white text-sm px-3 py-1.5 disabled:opacity-40"
            @click="agregarAlCarrito(p)"
          >
            Agregar
          </button>
        </li>
      </ul>
    </div>

    <aside class="rounded-lg border border-slate-200 bg-white p-4 h-fit sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
      <h2 class="text-sm font-semibold text-slate-900 mb-3">Carrito</h2>

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
              type="number"
              min="1"
              :max="l.stockDisponible"
              :value="l.cantidad"
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

      <label class="block text-xs font-medium text-slate-700 mt-3 mb-1" for="notas">Notas del pedido</label>
      <textarea
        id="notas"
        v-model="notas"
        rows="2"
        placeholder="Novedades para este pedido (opcional)…"
        class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2A6E]"
      />

      <p
        v-if="mensaje"
        class="mt-3 text-sm"
        :class="mensaje.tipo === 'error' ? 'text-red-600' : 'text-emerald-600'"
      >
        {{ mensaje.texto }}
      </p>

      <button
        type="button"
        :disabled="enviando || !lineas.length || !clienteId"
        class="mt-4 w-full rounded-lg bg-[#1E2A6E] text-white text-sm font-medium py-2.5 disabled:opacity-40"
        @click="confirmarPedido"
      >
        {{ enviando ? 'Enviando…' : 'Enviar pedido' }}
      </button>
    </aside>

    <div
      v-if="avisoStock"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4"
      @click.self="avisoStock = null"
    >
      <div class="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-xl">
        <p class="text-4xl mb-3">⚠️</p>
        <p class="text-sm font-medium text-slate-900 mb-4">{{ avisoStock }}</p>
        <button
          type="button"
          class="w-full rounded-lg bg-[#1E2A6E] text-white text-sm font-medium py-2.5"
          @click="avisoStock = null"
        >
          Entendido
        </button>
      </div>
    </div>
  </div>
</template>
