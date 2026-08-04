<script setup lang="ts">
const { registrarEvento } = useGeolocalizacion()
const { perfil } = usePerfil()

// RF-16: antes se capturaba en silencio al entrar aquí; el mockup pide un
// botón explícito con retroalimentación visible, así que ahora es una acción
// del vendedor, no algo que pasa sin que se entere.
const jornadaIniciada = useState('jornada-geo-iniciada', () => false)
const iniciandoJornada = ref(false)
const estadoJornada = ref<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

async function iniciarJornada() {
  iniciandoJornada.value = true
  estadoJornada.value = null
  const posicion = await registrarEvento('check_in')
  iniciandoJornada.value = false
  if (posicion) {
    jornadaIniciada.value = true
    estadoJornada.value = { tipo: 'ok', texto: 'Ubicación registrada — buena jornada.' }
  } else {
    estadoJornada.value = { tipo: 'error', texto: 'No se pudo obtener tu ubicación. Revisa el permiso de GPS del navegador.' }
  }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <p class="text-sm text-slate-500">Buenos días,</p>
      <h1 class="text-lg font-semibold text-slate-900">{{ perfil?.nombre }}</h1>
    </div>

    <div class="relative overflow-hidden rounded-xl bg-[#0B1220] p-5 text-white">
      <div
        class="absolute inset-0 opacity-[0.07]"
        style="background-image: linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px); background-size: 20px 20px;"
      />
      <div class="relative">
        <p class="text-xs uppercase tracking-wide text-slate-400">Jornada de hoy</p>
        <p class="text-sm font-medium mt-1">
          {{ jornadaIniciada ? 'Jornada iniciada' : 'Registra tu ubicación GPS al comenzar el día' }}
        </p>
        <button
          type="button" :disabled="iniciandoJornada"
          class="mt-4 w-full rounded-lg bg-[#3B82F6] text-white text-sm font-medium py-2.5 disabled:opacity-60"
          @click="iniciarJornada"
        >
          {{ iniciandoJornada ? 'Ubicando…' : jornadaIniciada ? 'Actualizar ubicación' : 'Iniciar jornada' }}
        </button>
        <p
          v-if="estadoJornada"
          class="text-xs mt-2"
          :class="estadoJornada.tipo === 'error' ? 'text-red-300' : 'text-emerald-300'"
        >
          {{ estadoJornada.texto }}
        </p>
      </div>
    </div>

    <NuxtLink
      to="/vendedor/pedido-nuevo"
      class="flex items-center justify-center rounded-xl bg-[#1E2A6E] text-white text-sm font-medium py-3.5"
    >
      Nuevo pedido
    </NuxtLink>

    <div class="grid grid-cols-2 gap-3">
      <NuxtLink
        to="/vendedor/pedidos"
        class="rounded-xl border border-slate-200 bg-white p-4 text-center"
      >
        <span class="text-sm font-medium text-slate-900">Mis pedidos</span>
      </NuxtLink>
      <NuxtLink
        to="/vendedor/clientes"
        class="rounded-xl border border-slate-200 bg-white p-4 text-center"
      >
        <span class="text-sm font-medium text-slate-900">Clientes</span>
      </NuxtLink>
    </div>
  </div>
</template>
