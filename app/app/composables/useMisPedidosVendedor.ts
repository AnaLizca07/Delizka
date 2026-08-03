export interface LineaPedidoVendedor {
  id: string
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
      client.from('pedido_lineas').select('id, pedido_id, codigo_producto, descripcion, cantidad, precio_unitario').in('pedido_id', pedidoIds),
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
          id: l.id,
          codigo_producto: l.codigo_producto,
          descripcion: l.descripcion,
          cantidad: Number(l.cantidad),
          precio_unitario: Number(l.precio_unitario)
        }))
    }))
  }

  // RF-14: el vendedor puede editar las líneas de un pedido de su cliente
  // mientras siga en pendiente_aprobacion (la RLS de pedido_lineas ya lo
  // permite en ese estado) antes de aprobarlo o cancelarlo.
  async function actualizarCantidadLinea(lineaId: string, cantidad: number) {
    return client.from('pedido_lineas').update({ cantidad }).eq('id', lineaId)
  }

  async function eliminarLinea(lineaId: string) {
    return client.from('pedido_lineas').delete().eq('id', lineaId)
  }

  async function aprobar(pedidoId: string) {
    const { data: userData } = await client.auth.getUser()
    if (!userData.user) return { error: { message: 'No se pudo identificar tu sesión.' } }
    return client.rpc('aprobar_pedido', { p_pedido_id: pedidoId, p_aprobado_por: userData.user.id })
  }

  async function cancelar(pedidoId: string, motivo: string) {
    const { data: userData } = await client.auth.getUser()
    if (!userData.user) return { error: { message: 'No se pudo identificar tu sesión.' } }
    return client.rpc('cancelar_pedido', { p_pedido_id: pedidoId, p_motivo: motivo, p_usuario: userData.user.id })
  }

  return { listar, actualizarCantidadLinea, eliminarLinea, aprobar, cancelar }
}
