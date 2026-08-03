<script setup lang="ts">
definePageMeta({ layout: false })

const client = useSupabaseClient()
const password = ref('')
const confirmar = ref('')
const enviando = ref(false)
const error = ref<string | null>(null)

async function guardar() {
  error.value = null
  if (password.value.length < 8) {
    error.value = 'La contraseña debe tener al menos 8 caracteres.'
    return
  }
  if (password.value !== confirmar.value) {
    error.value = 'Las contraseñas no coinciden.'
    return
  }

  enviando.value = true
  const { error: errorUpdate } = await client.auth.updateUser({ password: password.value })
  if (errorUpdate) {
    enviando.value = false
    error.value = 'No se pudo actualizar la contraseña. Intenta de nuevo.'
    return
  }

  try {
    await $fetch('/api/cliente/completar-cambio-password', { method: 'POST' })
  } catch {
    // la contraseña ya quedó cambiada en Supabase Auth; si esto falla, el
    // middleware lo volverá a pedir la próxima vez, no es un estado dañino.
  }

  enviando.value = false
  await navigateTo('/cliente')
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-50 px-4">
    <form class="w-full max-w-sm bg-white rounded-xl border border-slate-200 p-8 shadow-sm" @submit.prevent="guardar">
      <h1 class="text-xl font-semibold text-[#1E2A6E] mb-1">Delizka</h1>
      <p class="text-sm text-slate-500 mb-6">Por seguridad, define una contraseña nueva para tu cuenta.</p>

      <label class="block text-sm font-medium text-slate-700 mb-1" for="password">Contraseña nueva</label>
      <input
        id="password" v-model="password" type="password" required autocomplete="new-password"
        class="w-full mb-4 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2A6E]"
      >

      <label class="block text-sm font-medium text-slate-700 mb-1" for="confirmar">Confirmar contraseña</label>
      <input
        id="confirmar" v-model="confirmar" type="password" required autocomplete="new-password"
        class="w-full mb-4 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2A6E]"
      >

      <p v-if="error" class="text-sm text-red-600 mb-4">{{ error }}</p>

      <button
        type="submit" :disabled="enviando"
        class="w-full rounded-lg bg-[#1E2A6E] text-white text-sm font-medium py-2.5 disabled:opacity-60"
      >
        {{ enviando ? 'Guardando…' : 'Guardar y continuar' }}
      </button>
    </form>
  </div>
</template>
