<script setup lang="ts">
defineProps<{
  items: { to: string; etiqueta: string; icono: string }[]
  activo: (to: string) => boolean
}>()

// Set mínimo de íconos en línea (sin depender de una librería) para la barra
// inferior móvil de vendedor/cliente.
const ICONOS: Record<string, string> = {
  inicio: 'M3 11.5 12 4l9 7.5M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9',
  pedido: 'M12 5v14M5 12h14',
  pedidos: 'M4 5h16M4 5v14a1 1 0 0 0 1 1h9M4 5V4a1 1 0 0 1 1-1h6l2 2h6a1 1 0 0 1 1 1v7M15 19l2.5 2.5L22 16.5',
  clientes: 'M17 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 5 18.5V20M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM21 20v-1.5a3 3 0 0 0-2.2-2.9M15.5 4.2a3 3 0 0 1 0 5.6',
  cuenta: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20a8 8 0 0 1 16 0'
}
</script>

<template>
  <nav
    class="sm:hidden fixed bottom-0 inset-x-0 z-30 flex items-stretch bg-[#0B1220] border-t border-white/10"
    style="padding-bottom: env(safe-area-inset-bottom)"
  >
    <NuxtLink
      v-for="item in items" :key="item.to" :to="item.to"
      class="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[11px]"
      :class="activo(item.to) ? 'text-[#60A5FA]' : 'text-slate-400'"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
        <path :d="ICONOS[item.icono]" />
      </svg>
      {{ item.etiqueta }}
    </NuxtLink>
  </nav>
</template>
