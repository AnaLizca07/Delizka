<script setup lang="ts">
import type { PlazoPago } from '~/composables/usePlazosPago'

const { listar, crear, actualizar, actualizarActivo } = usePlazosPago()

const plazos = ref<PlazoPago[]>([])
const cargando = ref(true)

const dias = ref<number | null>(null)
const etiqueta = ref('')
const enviando = ref(false)
const error = ref<string | null>(null)

const editandoId = ref<string | null>(null)
const diasEdit = ref<number | null>(null)
const etiquetaEdit = ref('')
const guardandoEdicion = ref(false)
const errorEdicion = ref<string | null>(null)

async function cargar() {
  cargando.value = true
  plazos.value = await listar()
  cargando.value = false
}

async function guardar() {
  error.value = null
  if (dias.value === null || dias.value < 0) {
    error.value = 'Los días deben ser un número válido (0 o más).'
    return
  }
  if (!etiqueta.value.trim()) {
    error.value = 'La etiqueta es obligatoria.'
    return
  }
  enviando.value = true
  const { error: errorCrear } = await crear({ dias: dias.value, etiqueta: etiqueta.value.trim() })
  enviando.value = false
  if (errorCrear) {
    error.value = errorCrear.message.includes('duplicate') ? 'Ya existe un plazo con esos días.' : 'No se pudo crear el plazo.'
    return
  }
  dias.value = null
  etiqueta.value = ''
  await cargar()
}

function empezarEdicion(p: PlazoPago) {
  editandoId.value = p.id
  diasEdit.value = p.dias
  etiquetaEdit.value = p.etiqueta
  errorEdicion.value = null
}

function cancelarEdicion() {
  editandoId.value = null
  errorEdicion.value = null
}

async function guardarEdicion(id: string) {
  errorEdicion.value = null
  if (diasEdit.value === null || diasEdit.value < 0) {
    errorEdicion.value = 'Los días deben ser un número válido (0 o más).'
    return
  }
  if (!etiquetaEdit.value.trim()) {
    errorEdicion.value = 'La etiqueta es obligatoria.'
    return
  }
  guardandoEdicion.value = true
  const { error: errorActualizar } = await actualizar(id, { dias: diasEdit.value, etiqueta: etiquetaEdit.value.trim() })
  guardandoEdicion.value = false
  if (errorActualizar) {
    errorEdicion.value = errorActualizar.message.includes('duplicate') ? 'Ya existe un plazo con esos días.' : 'No se pudo guardar el cambio.'
    return
  }
  editandoId.value = null
  await cargar()
}

async function alternarActivo(p: PlazoPago) {
  await actualizarActivo(p.id, !p.activo)
  p.activo = !p.activo
}

onMounted(cargar)
</script>

<template>
  <div class="max-w-2xl">
    <h1 class="text-lg font-semibold text-slate-900 mb-1">Plazos de pago</h1>
    <p class="text-sm text-slate-500 mb-4">RF-22: crea o modifica las opciones de días de pago que ven vendedores al registrar un cliente, sin tocar código.</p>

    <form class="rounded-lg border border-slate-200 bg-white p-4 mb-6 flex items-end gap-3" @submit.prevent="guardar">
      <div class="w-28">
        <label class="block text-sm font-medium text-slate-700 mb-1" for="dias">Días</label>
        <input
          id="dias" v-model.number="dias" type="number" min="0" required
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2A6E]"
        >
      </div>
      <div class="flex-1">
        <label class="block text-sm font-medium text-slate-700 mb-1" for="etiqueta">Etiqueta</label>
        <input
          id="etiqueta" v-model="etiqueta" type="text" placeholder="Ej. 60 días" required
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2A6E]"
        >
      </div>
      <button
        type="submit" :disabled="enviando"
        class="rounded-lg bg-[#1E2A6E] text-white text-sm font-medium px-4 py-2 disabled:opacity-60"
      >
        {{ enviando ? 'Creando…' : 'Crear plazo' }}
      </button>
    </form>
    <p v-if="error" class="text-sm text-red-600 -mt-4 mb-4">{{ error }}</p>

    <p v-if="cargando" class="text-sm text-slate-400">Cargando…</p>

    <ul v-else class="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      <li v-for="p in plazos" :key="p.id" class="px-4 py-3">
        <div v-if="editandoId === p.id" class="flex items-end gap-3">
          <div class="w-24">
            <label class="block text-xs text-slate-500 mb-1">Días</label>
            <input v-model.number="diasEdit" type="number" min="0" class="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          </div>
          <div class="flex-1">
            <label class="block text-xs text-slate-500 mb-1">Etiqueta</label>
            <input v-model="etiquetaEdit" type="text" class="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          </div>
          <button
            type="button" :disabled="guardandoEdicion"
            class="rounded-md bg-[#1E2A6E] text-white text-sm px-3 py-1.5 disabled:opacity-60"
            @click="guardarEdicion(p.id)"
          >
            {{ guardandoEdicion ? 'Guardando…' : 'Guardar' }}
          </button>
          <button type="button" class="text-sm text-slate-500 px-2 py-1.5" @click="cancelarEdicion">
            Cancelar
          </button>
        </div>
        <div v-else class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-medium text-slate-900">{{ p.etiqueta }}</p>
            <p class="text-xs text-slate-500">{{ p.dias }} días</p>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <span
              class="rounded-full px-2 py-0.5 text-xs"
              :class="p.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'"
            >
              {{ p.activo ? 'Activo' : 'Inactivo' }}
            </span>
            <button type="button" class="text-sm text-[#1E2A6E] hover:underline" @click="empezarEdicion(p)">
              Editar
            </button>
            <button type="button" class="text-sm text-[#1E2A6E] hover:underline" @click="alternarActivo(p)">
              {{ p.activo ? 'Desactivar' : 'Reactivar' }}
            </button>
          </div>
        </div>
        <p v-if="editandoId === p.id && errorEdicion" class="text-sm text-red-600 mt-2">{{ errorEdicion }}</p>
      </li>
    </ul>
  </div>
</template>
