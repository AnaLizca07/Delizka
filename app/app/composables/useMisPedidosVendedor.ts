export interface LineaPedidoVendedor {
  codigo_producto: string
  descripcion: string
  cantidad: number
  precio_unitario: number
}

export interface PedidoVendedor {
  id: string
  estado: string
  canal: string
  total: number
  creadoAt: string
  clienteNombre: string
  clienteIdentificacion: string
  notas: string | null
  lineas: LineaPedidoVendedor[]
}

export function useMisPedidosVendedor() {
  const client = useSupabaseClient()

  async function listar(limite = 100): Promise<PedidoVendedor[]> {
    const { data: userData } = await client.auth.getUser()
    if (!userData.user) return []

    const { data: pedidos } = await client
      .from('pedidos')
      .select('id, estado, canal, total, creado_at, cliente_id, notas')
      .eq('vendedor_id', userData.user.id)
      .order('creado_at', { ascending: false })
      .limit(limite)

    if (!pedidos?.length) return []

    const pedidoIds = pedidos.map((p) => p.id)
    const clienteIds = [...new Set(pedidos.map((p) => p.cliente_id))]

    const [{ data: lineas }, { data: clientes }] = await Promise.all([
      client.from('pedido_lineas').select('pedido_id, codigo_producto, descripcion, cantidad, precio_unitario').in('pedido_id', pedidoIds),
      client.from('clientes').select('id, nombre, identificacion').in('id', clienteIds)
    ])

    const clientePorId = new Map((clientes ?? []).map((c) => [c.id, c]))

    return pedidos.map((p) => ({
      id: p.id,
      estado: p.estado,
      canal: p.canal,
      total: Number(p.total),
      creadoAt: p.creado_at,
      clienteNombre: clientePorId.get(p.cliente_id)?.nombre ?? '—',
      clienteIdentificacion: clientePorId.get(p.cliente_id)?.identificacion ?? '',
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

  return { listar }
}
