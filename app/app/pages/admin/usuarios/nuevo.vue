<script setup lang="ts">
import type { RolStaff } from '~/composables/useUsuarios'
import type { Zona } from '~/composables/useZonas'

const { crear } = useUsuarios()
const { listar: listarZonas } = useZonas()

const nombre = ref('')
const email = ref('')
const rol = ref<RolStaff>('vendedor')
const zonaId = ref<string | null>(null)
const zonas = ref<Zona[]>([])

const enviando = ref(false)
const error = ref<string | null>(null)
const credenciales = ref<{ email: string; password: string } | null>(null)

onMounted(async () => {
  zonas.value = await listarZonas()
})

async function guardar() {
  error.value = null
  if (!nombre.value.trim() || !email.value.trim()) {
    error.value = 'Nombre y correo son obligatorios.'
    return
  }
  if (rol.value === 'vendedor' && !zonaId.value) {
    error.value = 'Selecciona una zona para el vendedor.'
    return
  }

  enviando.value = true
  try {
    const resp = await crear({
      nombre: nombre.value.trim(),
      email: email.value.trim(),
      rol: rol.value,
      zonaId: rol.value === 'vendedor' ? zonaId.value : null
    })
    credenciales.value = resp
  } catch (e) {
    error.value = mensajeDeError(e, 'No se pudo crear el usuario.')
  }
  enviando.value = false
}
</script>

<template>
  <div class="max-w-lg">
    <h1 class="text-lg font-semibold text-slate-900 mb-4">Nuevo usuario</h1>

    <div v-if="credenciales" class="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm mb-4">
      <p class="font-medium text-amber-900 mb-1">Guarda estos datos, no se volverán a mostrar:</p>
      <p class="text-amber-900">Correo: <span class="font-mono">{{ credenciales.email }}</span></p>
      <p class="text-amber-900">Contraseña temporal: <span class="font-mono">{{ credenciales.password }}</span></p>
      <NuxtLink to="/admin/usuarios" class="inline-block mt-2 text-[#1E2A6E] hover:underline">Volver al listado</NuxtLink>
    </div>

    <form v-else class="space-y-4" @submit.prevent="guardar">
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1" for="nombre">Nombre</label>
        <input
          id="nombre" v-model="nombre" type="text" required
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2A6E]"
        >
      </div>

      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1" for="email">Correo</label>
        <input
          id="email" v-model="email" type="email" required
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2A6E]"
        >
      </div>

      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1" for="rol">Rol</label>
        <select
          id="rol" v-model="rol"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2A6E]"
        >
          <option value="vendedor">Vendedor</option>
          <option value="gerente">Gerente</option>
          <option value="admin">Administrador</option>
        </select>
      </div>

      <div v-if="rol === 'vendedor'">
        <label class="block text-sm font-medium text-slate-700 mb-1" for="zona">Zona</label>
        <select
          id="zona" v-model="zonaId"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2A6E]"
        >
          <option :value="null" disabled>Selecciona una zona</option>
          <option v-for="z in zonas" :key="z.id" :value="z.id">{{ z.nombre }}</option>
        </select>
      </div>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <button
        type="submit" :disabled="enviando"
        class="w-full rounded-lg bg-[#1E2A6E] text-white text-sm font-medium py-2.5 disabled:opacity-60"
      >
        {{ enviando ? 'Creando…' : 'Crear usuario' }}
      </button>
    </form>
  </div>
</template>
