<script setup lang="ts">
import type { Cliente } from '~/composables/useClientes'

const { listar } = useClientes()
const clientes = ref<Cliente[]>([])
const cargando = ref(true)
const busqueda = ref('')

const filtrados = computed(() => {
  const texto = busqueda.value.trim().toLowerCase()
  if (!texto) return clientes.value
  return clientes.value.filter((c) =>
    c.nombre.toLowerCase().includes(texto) || c.identificacion.includes(texto)
  )
})

onMounted(async () => {
  clientes.value = await listar()
  cargando.value = false
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-lg font-semibold text-slate-900">Clientes</h1>
      <NuxtLink
        to="/vendedor/clientes/nuevo"
        class="inline-flex items-center rounded-lg bg-[#1E2A6E] text-white text-sm font-medium px-4 py-2.5"
      >
        Nuevo cliente
      </NuxtLink>
    </div>

    <input
      v-model="busqueda"
      type="text"
      placeholder="Buscar por nombre o identificación…"
      class="w-full mb-4 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2A6E]"
    >

    <p v-if="cargando" class="text-sm text-slate-400">Cargando…</p>
    <p v-else-if="!filtrados.length" class="text-sm text-slate-400">No hay clientes todavía.</p>

    <ul v-else class="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      <li v-for="c in filtrados" :key="c.id">
        <NuxtLink :to="`/vendedor/clientes/${c.id}`" class="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
          <span class="shrink-0 w-9 h-9 rounded-full bg-[#1E2A6E]/10 text-[#1E2A6E] text-sm font-semibold flex items-center justify-center">
            {{ c.nombre.charAt(0).toUpperCase() }}
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-slate-900 truncate">{{ c.nombre }}</p>
            <p class="text-xs text-slate-500">{{ c.identificacion }}<span v-if="c.telefono"> · {{ c.telefono }}</span></p>
          </div>
          <span
            class="shrink-0 rounded-full px-2 py-0.5 text-xs"
            :class="c.perfil_id ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'"
          >
            {{ c.perfil_id ? 'Con acceso' : 'Sin acceso' }}
          </span>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
