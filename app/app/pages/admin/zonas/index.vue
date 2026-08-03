<script setup lang="ts">
import type { Zona } from '~/composables/useZonas'

const { listar, crear, actualizarActivo } = useZonas()

const zonas = ref<Zona[]>([])
const cargando = ref(true)

const nombre = ref('')
const municipiosTexto = ref('')
const enviando = ref(false)
const error = ref<string | null>(null)

async function cargar() {
  cargando.value = true
  zonas.value = await listar()
  cargando.value = false
}

async function guardar() {
  error.value = null
  if (!nombre.value.trim()) {
    error.value = 'El nombre de la zona es obligatorio.'
    return
  }
  enviando.value = true
  const municipios = municipiosTexto.value.split(',').map((m) => m.trim()).filter(Boolean)
  const { error: errorCrear } = await crear({ nombre: nombre.value.trim(), municipios })
  enviando.value = false
  if (errorCrear) {
    error.value = errorCrear.message.includes('duplicate') ? 'Ya existe una zona con ese nombre.' : 'No se pudo crear la zona.'
    return
  }
  nombre.value = ''
  municipiosTexto.value = ''
  await cargar()
}

async function alternarActivo(z: Zona) {
  await actualizarActivo(z.id, !z.activo)
  z.activo = !z.activo
}

onMounted(cargar)
</script>

<template>
  <div class="max-w-2xl">
    <h1 class="text-lg font-semibold text-slate-900 mb-4">Zonas comerciales</h1>

    <form class="rounded-lg border border-slate-200 bg-white p-4 mb-6 space-y-3" @submit.prevent="guardar">
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1" for="nombre">Nombre de la zona</label>
        <input
          id="nombre" v-model="nombre" type="text" required
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2A6E]"
        >
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1" for="municipios">Municipios (separados por coma)</label>
        <input
          id="municipios" v-model="municipiosTexto" type="text" placeholder="Armenia, Calarcá…"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2A6E]"
        >
      </div>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      <button
        type="submit" :disabled="enviando"
        class="rounded-lg bg-[#1E2A6E] text-white text-sm font-medium px-4 py-2 disabled:opacity-60"
      >
        {{ enviando ? 'Creando…' : 'Crear zona' }}
      </button>
    </form>

    <p v-if="cargando" class="text-sm text-slate-400">Cargando…</p>

    <ul v-else class="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      <li v-for="z in zonas" :key="z.id" class="flex items-center justify-between gap-3 px-4 py-3">
        <div class="min-w-0">
          <p class="text-sm font-medium text-slate-900">{{ z.nombre }}</p>
          <p v-if="z.municipios.length" class="text-xs text-slate-500">{{ z.municipios.join(', ') }}</p>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <span
            class="rounded-full px-2 py-0.5 text-xs"
            :class="z.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'"
          >
            {{ z.activo ? 'Activa' : 'Inactiva' }}
          </span>
          <button type="button" class="text-sm text-[#1E2A6E] hover:underline" @click="alternarActivo(z)">
            {{ z.activo ? 'Desactivar' : 'Reactivar' }}
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>
