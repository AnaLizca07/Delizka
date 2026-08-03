export type RolUsuario = 'admin' | 'gerente' | 'vendedor' | 'cliente'

export interface Perfil {
  id: string
  rol: RolUsuario
  nombre: string
  zona_id: string | null
  activo: boolean
}

// Home de cada rol, según la redirección definida en el BPMN (RF-01/RF-02).
export const HOME_POR_ROL: Record<RolUsuario, string> = {
  admin: '/admin',
  gerente: '/gerencial',
  vendedor: '/vendedor',
  cliente: '/cliente'
}

export function usePerfil() {
  const client = useSupabaseClient()

  const perfil = useState<Perfil | null>('perfil', () => null)
  const cargando = useState<boolean>('perfil-cargando', () => false)

  async function cargarPerfil() {
    // auth.getUser() en vez de useSupabaseUser(): esa ref reactiva puede no
    // estar poblada todavía en el primer tick de SSR/hidratación (se llena
    // vía el listener onAuthStateChange, que corre después). getUser()
    // resuelve la sesión real de una vez, sin depender de ese timing.
    const { data } = await client.auth.getUser()
    if (!data.user) {
      perfil.value = null
      return
    }
    cargando.value = true
    const { data: fila, error } = await client
      .from('perfiles')
      .select('id, rol, nombre, zona_id, activo')
      .eq('id', data.user.id)
      .single()
    cargando.value = false
    if (error) {
      perfil.value = null
      return
    }
    perfil.value = fila as Perfil
  }

  return { perfil, cargando, cargarPerfil }
}
