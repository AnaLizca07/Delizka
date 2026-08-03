export interface PlazoPago {
  id: string
  dias: number
  etiqueta: string
  activo: boolean
}

export function usePlazosPago() {
  const client = useSupabaseClient()

  async function listar(): Promise<PlazoPago[]> {
    const { data } = await client
      .from('plazos_pago')
      .select('id, dias, etiqueta, activo')
      .order('dias')
    return (data ?? []) as PlazoPago[]
  }

  async function crear(payload: { dias: number; etiqueta: string }) {
    return client.from('plazos_pago').insert(payload).select('id').single()
  }

  async function actualizar(id: string, payload: { dias: number; etiqueta: string }) {
    return client.from('plazos_pago').update(payload).eq('id', id)
  }

  async function actualizarActivo(id: string, activo: boolean) {
    return client.from('plazos_pago').update({ activo }).eq('id', id)
  }

  return { listar, crear, actualizar, actualizarActivo }
}
