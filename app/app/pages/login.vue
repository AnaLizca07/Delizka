<script setup lang="ts">
definePageMeta({ layout: false })

const client = useSupabaseClient()
const route = useRoute()
const email = ref('')
const password = ref('')
const enviando = ref(false)
const MENSAJES_ERROR: Record<string, string> = {
  credenciales_expiradas: 'Tu contraseña temporal venció. Pide una nueva a tu vendedor.',
  cuenta_suspendida: 'Tu cuenta fue suspendida. Contacta a un administrador.'
}
// computed (no un ref fijado una sola vez): si ya existía una instancia de esta
// página y el middleware solo cambia el query de /login, un ref leído una vez
// en el setup no se entera del nuevo valor.
const errorQuery = computed(() => MENSAJES_ERROR[route.query.error as string] ?? null)
const error = ref<string | null>(null)
watch(errorQuery, (v) => { if (v) error.value = v }, { immediate: true })

async function ingresar() {
  error.value = null
  enviando.value = true
  const { error: signInError } = await client.auth.signInWithPassword({
    email: email.value,
    password: password.value
  })
  enviando.value = false
  if (signInError) {
    error.value = 'Correo o contraseña incorrectos.'
    return
  }
  await navigateTo('/')
}
</script>

<template>
  <div class="relative min-h-screen flex items-center justify-center bg-[#0B1220] px-4 overflow-hidden">
    <div
      class="absolute inset-0 opacity-[0.07]"
      style="background-image: linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px); background-size: 24px 24px;"
    />
    <div class="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[#3B82F6]/20 blur-3xl" />
    <div class="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-[#1E2A6E]/40 blur-3xl" />

    <div class="relative w-full max-w-sm">
      <div class="flex items-center gap-2 justify-center mb-6">
        <div class="w-9 h-9 rounded-lg bg-[#3B82F6] flex items-center justify-center text-white font-semibold text-sm">D</div>
        <span class="text-white font-semibold text-lg tracking-tight">Delizka</span>
      </div>

      <form class="w-full bg-white rounded-2xl p-8 shadow-2xl shadow-black/40" @submit.prevent="ingresar">
        <h1 class="text-lg font-semibold text-slate-900 mb-1">Iniciar sesión</h1>
        <p class="text-sm text-slate-500 mb-6">Ingresa con tu correo y contraseña.</p>

        <label class="block text-sm font-medium text-slate-700 mb-1" for="email">Correo</label>
        <div class="relative mb-4">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            autocomplete="username"
            placeholder="tucorreo@ejemplo.com"
            class="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2A6E] focus:border-transparent"
          >
        </div>

        <label class="block text-sm font-medium text-slate-700 mb-1" for="password">Contraseña</label>
        <div class="relative mb-4">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v4h8z" /></svg>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            placeholder="••••••••"
            class="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2A6E] focus:border-transparent"
          >
        </div>

        <p v-if="error" class="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
          <span>{{ error }}</span>
        </p>

        <button
          type="submit"
          :disabled="enviando"
          class="w-full rounded-lg bg-[#1E2A6E] text-white text-sm font-medium py-2.5 disabled:opacity-60 transition hover:bg-[#16205a]"
        >
          {{ enviando ? 'Ingresando…' : 'Ingresar' }}
        </button>
      </form>

      <p class="text-center text-xs text-slate-500 mt-6">Sistema de gestión Delizka</p>
    </div>
  </div>
</template>
