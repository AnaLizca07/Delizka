<script setup lang="ts">
import { usePerfil, type RolUsuario } from '~/composables/usePerfil'
import { useMiCliente } from '~/composables/useMiCliente'
import { useCarrito } from '~/composables/useCarrito'
import { useAutoPedido } from '~/composables/useAutoPedido'

const client = useSupabaseClient()
const route = useRoute()
const { perfil, cargarPerfil } = usePerfil()

if (!perfil.value) await cargarPerfil()

const ETIQUETA_ROL: Record<RolUsuario, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  vendedor: 'Vendedor',
  cliente: 'Cliente'
}

const NAV_POR_ROL: Record<RolUsuario, { to: string; etiqueta: string; icono?: string }[]> = {
  admin: [
    { to: '/admin', etiqueta: 'Inicio' },
    { to: '/admin/pedidos', etiqueta: 'Bandeja de pedidos' },
    { to: '/admin/usuarios', etiqueta: 'Usuarios' },
    { to: '/admin/zonas', etiqueta: 'Zonas' },
    { to: '/admin/plazos', etiqueta: 'Plazos de pago' }
  ],
  gerente: [
    { to: '/gerencial', etiqueta: 'Inicio' },
    { to: '/gerencial/mapa', etiqueta: 'Mapa de vendedores' },
    { to: '/gerencial/auditoria', etiqueta: 'Auditoría' }
  ],
  vendedor: [
    { to: '/vendedor', etiqueta: 'Inicio', icono: 'inicio' },
    { to: '/vendedor/pedido-nuevo', etiqueta: 'Pedido', icono: 'pedido' },
    { to: '/vendedor/pedidos', etiqueta: 'Pedidos', icono: 'pedidos' },
    { to: '/vendedor/clientes', etiqueta: 'Clientes', icono: 'clientes' }
  ],
  cliente: [
    { to: '/cliente', etiqueta: 'Inicio', icono: 'inicio' },
    { to: '/cliente/pedido-nuevo', etiqueta: 'Pedido', icono: 'pedido' },
    { to: '/cliente/pedidos', etiqueta: 'Pedidos', icono: 'pedidos' }
  ]
}

const nav = computed(() => (perfil.value ? NAV_POR_ROL[perfil.value.rol] : []))

function esRutaActiva(to: string) {
  return to === route.path || (to !== '/' && route.path.startsWith(to) && !nav.value.some((n) => n.to !== to && n.to.length > to.length && route.path.startsWith(n.to)))
}

async function salir() {
  // Todo este estado vive en useState (memoria del cliente, no se limpia solo
  // al navegar): si no se resetea aquí, el siguiente inicio de sesión en la
  // misma pestaña (otro rol u otro usuario) hereda datos del usuario anterior
  // — así se reprodujo el bug de "entro como gerente y me manda a vendedor".
  perfil.value = null
  useMiCliente().miCliente.value = null
  useCarrito().limpiar()
  useAutoPedido().limpiar()
  useState('jornada-geo-iniciada', () => false).value = false
  await client.auth.signOut()
  await navigateTo('/login')
}

const usaNavInferior = computed(() => perfil.value?.rol === 'vendedor' || perfil.value?.rol === 'cliente')
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-6">
          <span class="font-semibold text-[#1E2A6E]">Delizka</span>
          <nav v-if="nav.length" class="hidden sm:flex items-center gap-4">
            <NuxtLink
              v-for="n in nav" :key="n.to" :to="n.to"
              class="text-sm"
              :class="esRutaActiva(n.to) ? 'text-[#1E2A6E] font-medium' : 'text-slate-500 hover:text-slate-700'"
            >
              {{ n.etiqueta }}
            </NuxtLink>
          </nav>
        </div>
        <div v-if="perfil" class="flex items-center gap-3 text-sm text-slate-600">
          <span class="hidden sm:inline">{{ perfil.nombre }}</span>
          <span class="hidden sm:inline rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{{ ETIQUETA_ROL[perfil.rol] }}</span>
          <button class="text-[#1E2A6E] hover:underline" @click="salir">Salir</button>
        </div>
      </div>
      <nav v-if="nav.length && !usaNavInferior" class="sm:hidden flex items-center gap-4 px-4 pb-3 overflow-x-auto">
        <NuxtLink
          v-for="n in nav" :key="n.to" :to="n.to"
          class="text-sm whitespace-nowrap"
          :class="esRutaActiva(n.to) ? 'text-[#1E2A6E] font-medium' : 'text-slate-500'"
        >
          {{ n.etiqueta }}
        </NuxtLink>
      </nav>
    </header>
    <main class="mx-auto max-w-5xl px-4 py-6" :class="{ 'pb-24 sm:pb-6': usaNavInferior }">
      <slot />
    </main>
    <NavInferior v-if="usaNavInferior" :items="nav" :activo="esRutaActiva" />
  </div>
</template>
