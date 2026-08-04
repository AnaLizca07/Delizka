export interface MiCartera {
  saldo_total: number
  saldo_vencido: number
  dias_atraso: number
}

export function useMiCartera() {
  const client = useSupabaseClient()

  async function obtener(clienteId: string): Promise<MiCartera | null> {
    const { data } = await client
      .from('wo_cartera')
      .select('saldo_total, saldo_vencido, dias_atraso')
      .eq('cliente_id', clienteId)
      .maybeSingle()
    if (!data) return null
    return {
      saldo_total: Number(data.saldo_total),
      saldo_vencido: Number(data.saldo_vencido),
      dias_atraso: data.dias_atraso
    }
  }

  return { obtener }
}
