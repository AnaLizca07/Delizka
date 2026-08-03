export interface EventoAuditoria {
  estadoAnterior: string | null
  estadoNuevo: string
  usuarioNombre: string
  creadoAt: string
  detalle: Record<string, unknown> | null
}

export interface PedidoAuditoria {
  id: string
  estado: string
  canal: string
  total: number
  creadoAt: string
  clienteNombre: string
  vendedorNombre: string
  notas: string | null
  eventos: EventoAuditoria[]
}

export const ETIQUETA_ESTADO: Record<string, string> = {
  pendiente_aprobacion: 'Pendiente de aprobación',
  aprobado: 'Aprobado',
  pendiente_registro_wo: 'Pendiente de registro en WO',
  confirmado_en_wo: 'Confirmado en World Office',
  revision_manual: 'En revisión manual',
  sin_match: 'Sin coincidencia',
  cancelado: 'Cancelado',
  conflicto_stock: 'Conflicto de stock'
}

export function useAuditoria() {
  const client = useSupabaseClient()

  async function listar(limite = 100): Promise<PedidoAuditoria[]> {
    const { data: pedidos } = await client
      .from('pedidos')
      .select('id, estado, canal, total, creado_at, cliente_id, vendedor_id, notas')
      .order('creado_at', { ascending: false })
      .limit(limite)

    if (!pedidos?.length) return []

    const pedidoIds = pedidos.map((p) => p.id)
    const clienteIds = [...new Set(pedidos.map((p) => p.cliente_id))]
    const vendedorIds = [...new Set(pedidos.map((p) => p.vendedor_id))]

    const [{ data: clientes }, { data: vendedores }, { data: eventos }] = await Promise.all([
      client.from('clientes').select('id, nombre').in('id', clienteIds),
      client.from('perfiles').select('id, nombre').in('id', vendedorIds),
      client
        .from('auditoria_pedidos')
        .select('pedido_id, estado_anterior, estado_nuevo, usuario_id, creado_at, detalle')
        .in('pedido_id', pedidoIds)
        .order('creado_at', { ascending: true })
    ])

    const clientePorId = new Map((clientes ?? []).map((c) => [c.id, c.nombre]))
    const vendedorPorId = new Map((vendedores ?? []).map((v) => [v.id, v.nombre]))
    const usuarioIds = [...new Set((eventos ?? []).map((e) => e.usuario_id).filter(Boolean))]
    const { data: usuarios } = usuarioIds.length
      ? await client.from('perfiles').select('id, nombre').in('id', usuarioIds)
      : { data: [] as { id: string; nombre: string }[] }
    const usuarioPorId = new Map((usuarios ?? []).map((u) => [u.id, u.nombre]))

    return pedidos.map((p) => ({
      id: p.id,
      estado: p.estado,
      canal: p.canal,
      total: Number(p.total),
      creadoAt: p.creado_at,
      clienteNombre: clientePorId.get(p.cliente_id) ?? '—',
      vendedorNombre: vendedorPorId.get(p.vendedor_id) ?? '—',
      notas: p.notas,
      eventos: (eventos ?? [])
        .filter((e) => e.pedido_id === p.id)
        .map((e) => ({
          estadoAnterior: e.estado_anterior,
          estadoNuevo: e.estado_nuevo,
          usuarioNombre: e.usuario_id ? usuarioPorId.get(e.usuario_id) ?? '—' : 'Sistema',
          creadoAt: e.creado_at,
          detalle: e.detalle
        }))
    }))
  }

  return { listar }
}
