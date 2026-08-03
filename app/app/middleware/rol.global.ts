import { usePerfil, HOME_POR_ROL, type RolUsuario } from '~/composables/usePerfil'
import { useMiCliente } from '~/composables/useMiCliente'

const PREFIJO_POR_ROL: Record<RolUsuario, string> = {
  admin: '/admin',
  gerente: '/gerencial',
  vendedor: '/vendedor',
  cliente: '/cliente'
}

const RUTAS_EXCLUIDAS = ['/login', '/confirmar', '/cliente/cambiar-password']

export default defineNuxtRouteMiddleware(async (to) => {
  if (RUTAS_EXCLUIDAS.includes(to.path)) return

  // useSupabaseUser() puede no estar poblado todavía en el primer tick de SSR/
  // hidratación (se actualiza vía el listener onAuthStateChange, que corre
  // después). auth.getUser() es la llamada autoritativa: siempre resuelve la
  // sesión real a partir de la cookie, sin depender de ese timing.
  const client = useSupabaseClient()
  const { data } = await client.auth.getUser()
  if (!data.user) return // sin sesión; el módulo de Supabase ya manda a /login

  const { perfil, cargarPerfil } = usePerfil()
  if (!perfil.value) await cargarPerfil()
  if (!perfil.value) return // perfil aún no aprovisionado; nada más que hacer aquí

  // RF-23: "suspender" debe cerrar el acceso de verdad, no solo guardar la
  // bandera para que se vea en el listado del admin.
  if (!perfil.value.activo) {
    perfil.value = null
    await client.auth.signOut()
    return navigateTo('/login?error=cuenta_suspendida')
  }

  const home = HOME_POR_ROL[perfil.value.rol]

  // DEC-08: la contraseña temporal del cliente vence a las 48h y exige cambio
  // en el primer login; es un gate de acceso, así que vive aquí y no en la
  // pantalla de auto-pedido.
  if (perfil.value.rol === 'cliente') {
    const { miCliente, cargarMiCliente } = useMiCliente()
    if (!miCliente.value) await cargarMiCliente()
    if (miCliente.value?.requiere_cambio_password) {
      const expirada = miCliente.value.password_temporal_expira_at
        ? new Date(miCliente.value.password_temporal_expira_at) < new Date()
        : false
      if (expirada) {
        await client.auth.signOut()
        return navigateTo('/login?error=credenciales_expiradas')
      }
      return navigateTo('/cliente/cambiar-password')
    }
  }

  if (to.path === '/') {
    return navigateTo(home)
  }

  const prefijoDeLaRuta = Object.values(PREFIJO_POR_ROL).find((p) => to.path.startsWith(p))
  if (prefijoDeLaRuta && prefijoDeLaRuta !== home) {
    return navigateTo(home)
  }
})
