<template>
  <div>
    <h1 class="text-lg font-semibold text-slate-900 mb-4">Panel administrativo</h1>
    <div class="flex gap-3 flex-wrap">
      <NuxtLink
        to="/admin/pedidos"
        class="inline-flex items-center rounded-lg bg-[#1E2A6E] text-white text-sm font-medium px-4 py-2.5"
      >
        Bandeja de pedidos
      </NuxtLink>
      <NuxtLink
        to="/admin/usuarios"
        class="inline-flex items-center rounded-lg border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2.5"
      >
        Usuarios
      </NuxtLink>
      <NuxtLink
        to="/admin/zonas"
        class="inline-flex items-center rounded-lg border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2.5"
      >
        Zonas
      </NuxtLink>
      <NuxtLink
        to="/admin/plazos"
        class="inline-flex items-center rounded-lg border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2.5"
      >
        Plazos de pago
      </NuxtLink>
    </div>
    <p class="text-sm text-slate-500 mt-4">
      Configuración de la conexión ODBC (RF-24) va más adelante, junto con el agente de sincronización.
    </p>
  </div>
</template>
