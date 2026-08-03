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
