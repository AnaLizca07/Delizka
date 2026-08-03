export interface Zona {
  id: string
  nombre: string
  descripcion: string | null
  municipios: string[]
  activo: boolean
}

export function useZonas() {
  const client = useSupabaseClient()

  async function listar(): Promise<Zona[]> {
    const { data } = await client
      .from('zonas')
      .select('id, nombre, descripcion, municipios, activo')
      .order('nombre')
    return (data ?? []) as Zona[]
  }

  async function crear(payload: { nombre: string; descripcion?: string; municipios: string[] }) {
    return client.from('zonas').insert(payload).select('id').single()
  }

  async function actualizarActivo(id: string, activo: boolean) {
    return client.from('zonas').update({ activo }).eq('id', id)
  }

  return { listar, crear, actualizarActivo }
}
