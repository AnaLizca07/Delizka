<script setup lang="ts">
import type { Usuario } from '~/composables/useUsuarios'
import type { Zona } from '~/composables/useZonas'

const { listar, actualizarActivo } = useUsuarios()
const { listar: listarZonas } = useZonas()

const usuarios = ref<Usuario[]>([])
const zonas = ref<Zona[]>([])
const cargando = ref(true)

const ETIQUETA_ROL: Record<string, string> = { admin: 'Administrador', gerente: 'Gerente', vendedor: 'Vendedor' }

const zonaNombre = (id: string | null) => zonas.value.find((z) => z.id === id)?.nombre ?? '—'

async function cargar() {
  cargando.value = true
  const [u, z] = await Promise.all([listar(), listarZonas()])
  usuarios.value = u
  zonas.value = z
  cargando.value = false
}

async function alternarActivo(u: Usuario) {
  await actualizarActivo(u.id, !u.activo)
  u.activo = !u.activo
}

onMounted(cargar)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-lg font-semibold text-slate-900">Usuarios</h1>
      <NuxtLink
        to="/admin/usuarios/nuevo"
        class="inline-flex items-center rounded-lg bg-[#1E2A6E] text-white text-sm font-medium px-4 py-2.5"
      >
        Nuevo usuario
      </NuxtLink>
    </div>

    <p v-if="cargando" class="text-sm text-slate-400">Cargando…</p>

    <ul v-else class="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      <li v-for="u in usuarios" :key="u.id" class="flex items-center justify-between gap-3 px-4 py-3">
        <div class="min-w-0">
          <p class="text-sm font-medium text-slate-900 truncate">{{ u.nombre }}</p>
          <p class="text-xs text-slate-500">
            {{ ETIQUETA_ROL[u.rol] }}
            <span v-if="u.rol === 'vendedor'"> · {{ zonaNombre(u.zona_id) }}</span>
          </p>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <span
            class="rounded-full px-2 py-0.5 text-xs"
            :class="u.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'"
          >
            {{ u.activo ? 'Activo' : 'Suspendido' }}
          </span>
          <button
            type="button"
            class="text-sm text-[#1E2A6E] hover:underline"
            @click="alternarActivo(u)"
          >
            {{ u.activo ? 'Suspender' : 'Reactivar' }}
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>
