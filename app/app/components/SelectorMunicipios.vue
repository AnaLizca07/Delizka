<script setup lang="ts">
import municipiosPorDepartamento from '~/data/municipios-colombia.json'

const modelValue = defineModel<string[]>({ default: () => [] })

interface Opcion { municipio: string; departamento: string }

const TODAS_LAS_OPCIONES: Opcion[] = municipiosPorDepartamento.flatMap((d) =>
  d.ciudades.map((ciudad) => ({ municipio: ciudad, departamento: d.departamento }))
)

const busqueda = ref('')
const abierto = ref(false)
const contenedor = ref<HTMLDivElement | null>(null)

const sugerencias = computed(() => {
  const texto = busqueda.value.trim().toLowerCase()
  const disponibles = TODAS_LAS_OPCIONES.filter((o) => !modelValue.value.includes(o.municipio))
  if (!texto) return disponibles.slice(0, 30)
  return disponibles
    .filter((o) => o.municipio.toLowerCase().includes(texto) || o.departamento.toLowerCase().includes(texto))
    .slice(0, 30)
})

function agregar(opcion: Opcion) {
  modelValue.value = [...modelValue.value, opcion.municipio]
  busqueda.value = ''
}

function quitar(municipio: string) {
  modelValue.value = modelValue.value.filter((m) => m !== municipio)
}

function alCerrarFuera(e: MouseEvent) {
  if (contenedor.value && !contenedor.value.contains(e.target as Node)) abierto.value = false
}

onMounted(() => document.addEventListener('click', alCerrarFuera))
onUnmounted(() => document.removeEventListener('click', alCerrarFuera))
</script>

<template>
  <div ref="contenedor" class="relative">
    <div
      class="w-full min-h-[42px] rounded-lg border border-slate-300 px-2 py-1.5 flex flex-wrap items-center gap-1.5 focus-within:ring-2 focus-within:ring-[#1E2A6E]"
      @click="abierto = true"
    >
      <span
        v-for="m in modelValue" :key="m"
        class="inline-flex items-center gap-1 rounded-full bg-[#1E2A6E]/10 text-[#1E2A6E] text-xs font-medium pl-2.5 pr-1.5 py-1"
      >
        {{ m }}
        <button type="button" class="hover:text-red-600" @click.stop="quitar(m)">✕</button>
      </span>
      <input
        v-model="busqueda"
        type="text"
        :placeholder="modelValue.length ? '' : 'Buscar municipio…'"
        class="flex-1 min-w-[120px] text-sm outline-none py-1"
        @focus="abierto = true"
      >
    </div>

    <ul
      v-if="abierto"
      class="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg py-1"
    >
      <li v-if="!sugerencias.length" class="px-3 py-2 text-sm text-slate-400">Sin resultados.</li>
      <li
        v-for="o in sugerencias" :key="o.municipio"
        class="px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center justify-between gap-2"
        @click="agregar(o)"
      >
        <span>{{ o.municipio }}</span>
        <span class="text-xs text-slate-400 shrink-0">{{ o.departamento }}</span>
      </li>
    </ul>
  </div>
</template>
