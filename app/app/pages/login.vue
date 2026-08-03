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
  <div class="min-h-screen flex items-center justify-center bg-slate-50 px-4">
    <form class="w-full max-w-sm bg-white rounded-xl border border-slate-200 p-8 shadow-sm" @submit.prevent="ingresar">
      <h1 class="text-xl font-semibold text-[#1E2A6E] mb-1">Delizka</h1>
      <p class="text-sm text-slate-500 mb-6">Ingresa con tu correo y contraseña.</p>

      <label class="block text-sm font-medium text-slate-700 mb-1" for="email">Correo</label>
      <input
        id="email"
        v-model="email"
        type="email"
        required
        autocomplete="username"
        class="w-full mb-4 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2A6E]"
      >

      <label class="block text-sm font-medium text-slate-700 mb-1" for="password">Contraseña</label>
      <input
        id="password"
        v-model="password"
        type="password"
        required
        autocomplete="current-password"
        class="w-full mb-4 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2A6E]"
      >

      <p v-if="error" class="text-sm text-red-600 mb-4">{{ error }}</p>

      <button
        type="submit"
        :disabled="enviando"
        class="w-full rounded-lg bg-[#1E2A6E] text-white text-sm font-medium py-2.5 disabled:opacity-60"
      >
        {{ enviando ? 'Ingresando…' : 'Ingresar' }}
      </button>
    </form>
  </div>
</template>
