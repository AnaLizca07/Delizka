// Nombre distinto al `PlazoPago` de useClientes.ts (mismo concepto, pero ese
// no trae `activo` — evita que el auto-import de Nuxt tenga que desempatar
// dos interfaces con el mismo nombre y distinto shape.
export interface PlazoPagoAdmin {
  id: string
  dias: number
  etiqueta: string
  activo: boolean
}

export function usePlazosPago() {
  const client = useSupabaseClient()

  async function listar(): Promise<PlazoPagoAdmin[]> {
    const { data } = await client
      .from('plazos_pago')
      .select('id, dias, etiqueta, activo')
      .order('dias')
    return (data ?? []) as PlazoPagoAdmin[]
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
