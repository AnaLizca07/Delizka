export type RolStaff = 'admin' | 'gerente' | 'vendedor'

export interface Usuario {
  id: string
  rol: RolStaff
  nombre: string
  zona_id: string | null
  activo: boolean
  creado_at: string
}

export interface NuevoUsuario {
  email: string
  nombre: string
  rol: RolStaff
  zonaId: string | null
}

export function useUsuarios() {
  const client = useSupabaseClient()

  async function listar(): Promise<Usuario[]> {
    const { data } = await client
      .from('perfiles')
      .select('id, rol, nombre, zona_id, activo, creado_at')
      .in('rol', ['admin', 'gerente', 'vendedor'])
      .order('nombre')
    return (data ?? []) as Usuario[]
  }

  async function crear(payload: NuevoUsuario) {
    return $fetch<{ email: string; password: string }>('/api/admin/crear-usuario', {
      method: 'POST',
      body: { email: payload.email, nombre: payload.nombre, rol: payload.rol, zonaId: payload.zonaId }
    })
  }

  async function actualizarActivo(id: string, activo: boolean) {
    return client.from('perfiles').update({ activo }).eq('id', id)
  }

  return { listar, crear, actualizarActivo }
}
