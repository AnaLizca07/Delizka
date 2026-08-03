export interface MiCliente {
  id: string
  nombre: string
  zona_id: string
  vendedor_id: string
  requiere_cambio_password: boolean
  password_temporal_expira_at: string | null
}

export function useMiCliente() {
  const client = useSupabaseClient()
  const miCliente = useState<MiCliente | null>('mi-cliente', () => null)

  async function cargarMiCliente() {
    const { data: userData } = await client.auth.getUser()
    if (!userData.user) {
      miCliente.value = null
      return
    }
    const { data, error } = await client
      .from('clientes')
      .select('id, nombre, zona_id, vendedor_id, requiere_cambio_password, password_temporal_expira_at')
      .eq('perfil_id', userData.user.id)
      .single()
    miCliente.value = error ? null : (data as MiCliente)
  }

  return { miCliente, cargarMiCliente }
}
