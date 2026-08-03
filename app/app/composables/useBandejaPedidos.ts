export interface LineaPendiente {
  codigo_producto: string
  descripcion: string
  cantidad: number
  precio_unitario: number
}

export interface PedidoPendiente {
  id: string
  total: number
  aprobado_at: string
  clienteNombre: string
  clienteIdentificacion: string
  vendedorNombre: string
  notas: string | null
  lineas: LineaPendiente[]
}

export function useBandejaPedidos() {
  const client = useSupabaseClient()

  async function listar(): Promise<PedidoPendiente[]> {
    const { data: pedidos } = await client
      .from('pedidos')
      .select('id, total, aprobado_at, cliente_id, vendedor_id, notas')
      .eq('estado', 'aprobado')
      .order('aprobado_at', { ascending: true })

    if (!pedidos?.length) return []

    const pedidoIds = pedidos.map((p) => p.id)
    const clienteIds = [...new Set(pedidos.map((p) => p.cliente_id))]
    const vendedorIds = [...new Set(pedidos.map((p) => p.vendedor_id))]

    const [{ data: lineas }, { data: clientes }, { data: vendedores }] = await Promise.all([
      client.from('pedido_lineas').select('pedido_id, codigo_producto, descripcion, cantidad, precio_unitario').in('pedido_id', pedidoIds),
      client.from('clientes').select('id, nombre, identificacion').in('id', clienteIds),
      client.from('perfiles').select('id, nombre').in('id', vendedorIds)
    ])

    const clientePorId = new Map((clientes ?? []).map((c) => [c.id, c]))
    const vendedorPorId = new Map((vendedores ?? []).map((v) => [v.id, v.nombre]))

    return pedidos.map((p) => ({
      id: p.id,
      total: Number(p.total),
      aprobado_at: p.aprobado_at,
      clienteNombre: clientePorId.get(p.cliente_id)?.nombre ?? '—',
      clienteIdentificacion: clientePorId.get(p.cliente_id)?.identificacion ?? '',
      vendedorNombre: vendedorPorId.get(p.vendedor_id) ?? '—',
      notas: p.notas,
      lineas: (lineas ?? [])
        .filter((l) => l.pedido_id === p.id)
        .map((l) => ({
          codigo_producto: l.codigo_producto,
          descripcion: l.descripcion,
          cantidad: Number(l.cantidad),
          precio_unitario: Number(l.precio_unitario)
        }))
    }))
  }

  async function marcarComoRegistrado(pedidoId: string, woPrefijo: string, woDocumentoNumero: string) {
    const { data: userData } = await client.auth.getUser()
    if (!userData.user) return { error: { message: 'No autenticado' } }
    return client.rpc('confirmar_registro_wo', {
      p_pedido_id: pedidoId,
      p_wo_prefijo: woPrefijo,
      p_wo_documento_numero: woDocumentoNumero,
      p_usuario: userData.user.id
    })
  }

  return { listar, marcarComoRegistrado }
}
