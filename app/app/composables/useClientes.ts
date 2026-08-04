export interface Cliente {
  id: string
  nombre: string
  identificacion: string
  telefono: string | null
  direccion: string | null
  email: string | null
  lat: number | null
  lng: number | null
  plazo_pago_id: string | null
  perfil_id: string | null
  password_temporal_expira_at: string | null
  requiere_cambio_password: boolean
  activo: boolean
  creado_at: string
}

export interface PlazoPago {
  id: string
  dias: number
  etiqueta: string
}

export interface NuevoCliente {
  nombre: string
  identificacion: string
  telefono?: string
  direccion?: string
  email?: string
  lat?: number | null
  lng?: number | null
  plazo_pago_id?: string | null
  zona_id: string
  vendedor_id: string
}

export function useClientes() {
  const client = useSupabaseClient()

  async function listar(): Promise<Cliente[]> {
    const { data } = await client
      .from('clientes')
      .select('*')
      .eq('activo', true)
      .order('nombre')
    return (data ?? []) as Cliente[]
  }

  async function obtener(id: string): Promise<Cliente | null> {
    const { data } = await client.from('clientes').select('*').eq('id', id).single()
    return (data as Cliente | null) ?? null
  }

  async function listarPlazos(): Promise<PlazoPago[]> {
    const { data } = await client
      .from('plazos_pago')
      .select('id, dias, etiqueta')
      .eq('activo', true)
      .order('dias')
    return (data ?? []) as PlazoPago[]
  }

  async function crear(payload: NuevoCliente) {
    return client.from('clientes').insert(payload).select('id').single()
  }

  return { listar, obtener, listarPlazos, crear }
}
