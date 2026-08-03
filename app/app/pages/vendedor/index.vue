<script setup lang="ts">
const { registrarEvento } = useGeolocalizacion()

// RF-16: "inicio de jornada" — se registra una sola vez por sesión de
// navegación, la primera vez que el vendedor llega a su home, no en cada
// visita a esta página.
const jornadaIniciada = useState('jornada-geo-iniciada', () => false)

onMounted(() => {
  if (jornadaIniciada.value) return
  jornadaIniciada.value = true
  registrarEvento('check_in')
})
</script>

<template>
  <div>
    <h1 class="text-lg font-semibold text-slate-900 mb-4">Vendedor</h1>
    <div class="flex gap-3">
      <NuxtLink
        to="/vendedor/pedido-nuevo"
        class="inline-flex items-center rounded-lg bg-[#1E2A6E] text-white text-sm font-medium px-4 py-2.5"
      >
        Nuevo pedido
      </NuxtLink>
      <NuxtLink
        to="/vendedor/pedidos"
        class="inline-flex items-center rounded-lg border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2.5"
      >
        Mis pedidos
      </NuxtLink>
      <NuxtLink
        to="/vendedor/clientes"
        class="inline-flex items-center rounded-lg border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2.5"
      >
        Clientes
      </NuxtLink>
    </div>
  </div>
</template>
