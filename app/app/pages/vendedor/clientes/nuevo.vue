<script setup lang="ts">
import type { PlazoPago } from '~/composables/useClientes'

const client = useSupabaseClient()
const route = useRoute()
const { crear, listarPlazos } = useClientes()
const { perfil } = usePerfil()
const { clienteId: clienteIdCarrito } = useCarrito()

// Si el vendedor llegó aquí desde "Nuevo pedido" (para registrar un cliente
// sin perder lo que ya tenía en el carrito), al guardar lo devolvemos ahí con
// el cliente recién creado ya seleccionado, en vez de mandarlo a la ficha del
// cliente.
const vieneDePedido = route.query.volver === 'pedido'

const nombre = ref('')
const identificacion = ref('')
const telefono = ref('')
const direccion = ref('')
const plazoPagoId = ref<string | null>(null)
const plazos = ref<PlazoPago[]>([])

const enviando = ref(false)
const error = ref<string | null>(null)

onMounted(async () => {
  plazos.value = await listarPlazos()
})

async function guardar() {
  error.value = null
  if (!nombre.value.trim() || !identificacion.value.trim()) {
    error.value = 'Nombre e identificación son obligatorios.'
    return
  }
  if (!perfil.value?.zona_id) {
    error.value = 'No se pudo identificar tu zona.'
    return
  }
  // client.auth.getUser() en vez de useSupabaseUser(): ver nota en useCarrito.ts
  // sobre por qué la ref reactiva no es confiable para escrituras identificadas.
  const { data: userData } = await client.auth.getUser()
  if (!userData.user) {
    error.value = 'No se pudo identificar tu sesión.'
    return
  }

  enviando.value = true
  const { data, error: errorCrear } = await crear({
    nombre: nombre.value.trim(),
    identificacion: identificacion.value.trim(),
    telefono: telefono.value.trim() || undefined,
    direccion: direccion.value.trim() || undefined,
    plazo_pago_id: plazoPagoId.value,
    zona_id: perfil.value.zona_id,
    vendedor_id: userData.user.id
  })
  enviando.value = false

  if (errorCrear || !data) {
    error.value = errorCrear?.message.includes('duplicate')
      ? 'Ya existe un cliente con esa identificación.'
      : 'No se pudo crear el cliente. Intenta de nuevo.'
    return
  }

  if (vieneDePedido) {
    clienteIdCarrito.value = data.id
    await navigateTo('/vendedor/pedido-nuevo')
    return
  }
  await navigateTo(`/vendedor/clientes/${data.id}`)
}
</script>

<template>
  <div class="max-w-lg">
    <NuxtLink
      :to="vieneDePedido ? '/vendedor/pedido-nuevo' : '/vendedor/clientes'"
      class="text-sm text-[#1E2A6E] hover:underline"
    >
      ← Volver
    </NuxtLink>
    <h1 class="text-lg font-semibold text-slate-900 mt-1 mb-4">Nuevo cliente</h1>

    <form class="space-y-4" @submit.prevent="guardar">
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1" for="nombre">Nombre</label>
        <input
          id="nombre" v-model="nombre" type="text" required
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2A6E]"
        >
      </div>

      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1" for="identificacion">Identificación / NIT</label>
        <input
          id="identificacion" v-model="identificacion" type="text" required
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2A6E]"
        >
      </div>

      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1" for="telefono">Teléfono</label>
        <input
          id="telefono" v-model="telefono" type="text"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2A6E]"
        >
      </div>

      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1" for="direccion">Dirección</label>
        <input
          id="direccion" v-model="direccion" type="text"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2A6E]"
        >
      </div>

      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1" for="plazo">Plazo de pago</label>
        <select
          id="plazo" v-model="plazoPagoId"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2A6E]"
        >
          <option :value="null">Sin definir</option>
          <option v-for="p in plazos" :key="p.id" :value="p.id">{{ p.etiqueta }}</option>
        </select>
      </div>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <button
        type="submit" :disabled="enviando"
        class="w-full rounded-lg bg-[#1E2A6E] text-white text-sm font-medium py-2.5 disabled:opacity-60"
      >
        {{ enviando ? 'Guardando…' : 'Guardar cliente' }}
      </button>
    </form>
  </div>
</template>
