export interface LineaPedidoCliente {
  id: string
  codigo_producto: string
  descripcion: string
  cantidad: number
  precio_unitario: number
}

export interface PedidoCliente {
  id: string
  estado: string
  total: number
  creadoAt: string
  notas: string | null
  lineas: LineaPedidoCliente[]
}

// Solo lectura: a diferencia de useMisPedidosVendedor, el cliente no puede
// editar ni aprobar sus propios auto-pedidos (RF-14 es del vendedor).
export function useMisPedidosCliente() {
  const client = useSupabaseClient()

  async function listar(clienteId: string, limite = 50): Promise<PedidoCliente[]> {
    const { data: pedidos } = await client
      .from('pedidos')
      .select('id, estado, total, creado_at, notas')
      .eq('cliente_id', clienteId)
      .order('creado_at', { ascending: false })
      .limit(limite)

    if (!pedidos?.length) return []

    const pedidoIds = pedidos.map((p) => p.id)
    const { data: lineas } = await client
      .from('pedido_lineas')
      .select('id, pedido_id, codigo_producto, descripcion, cantidad, precio_unitario')
      .in('pedido_id', pedidoIds)

    return pedidos.map((p) => ({
      id: p.id,
      estado: p.estado,
      total: Number(p.total),
      creadoAt: p.creado_at,
      notas: p.notas,
      lineas: (lineas ?? [])
        .filter((l) => l.pedido_id === p.id)
        .map((l) => ({
          id: l.id,
          codigo_producto: l.codigo_producto,
          descripcion: l.descripcion,
          cantidad: Number(l.cantidad),
          precio_unitario: Number(l.precio_unitario)
        }))
    }))
  }

  return { listar }
}
