// Estados que cuentan como "venta real" para KPIs: un pedido cancelado o
// todavía pendiente de aprobación no debe sumar en ventas ni en productos
// más vendidos.
const ESTADOS_VENTA_VALIDA = ['aprobado', 'pendiente_registro_wo', 'confirmado_en_wo']

export interface VentaPorVendedor {
  vendedorId: string
  vendedorNombre: string
  total: number
  pedidos: number
}

export interface ProductoMasVendido {
  codigo: string
  descripcion: string
  cantidad: number
}

export interface AlertaCartera {
  clienteNombre: string
  clienteIdentificacion: string
  saldoVencido: number
  diasAtraso: number
}

function inicioDeMes() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

export function useKpisGerenciales() {
  const client = useSupabaseClient()

  async function ventasPorVendedor(): Promise<VentaPorVendedor[]> {
    const { data: pedidos } = await client
      .from('pedidos')
      .select('vendedor_id, total')
      .in('estado', ESTADOS_VENTA_VALIDA)
      .gte('creado_at', inicioDeMes())

    if (!pedidos?.length) return []

    const vendedorIds = [...new Set(pedidos.map((p) => p.vendedor_id))]
    const { data: perfiles } = await client.from('perfiles').select('id, nombre').in('id', vendedorIds)
    const nombrePorId = new Map((perfiles ?? []).map((p) => [p.id, p.nombre]))

    const acumulado = new Map<string, { total: number; pedidos: number }>()
    for (const p of pedidos) {
      const actual = acumulado.get(p.vendedor_id) ?? { total: 0, pedidos: 0 }
      actual.total += Number(p.total)
      actual.pedidos += 1
      acumulado.set(p.vendedor_id, actual)
    }

    return [...acumulado.entries()]
      .map(([vendedorId, v]) => ({
        vendedorId,
        vendedorNombre: nombrePorId.get(vendedorId) ?? '—',
        total: v.total,
        pedidos: v.pedidos
      }))
      .sort((a, b) => b.total - a.total)
  }

  async function productosMasVendidos(limite = 10): Promise<ProductoMasVendido[]> {
    const { data: pedidos } = await client
      .from('pedidos')
      .select('id')
      .in('estado', ESTADOS_VENTA_VALIDA)
      .gte('creado_at', inicioDeMes())

    if (!pedidos?.length) return []

    const { data: lineas } = await client
      .from('pedido_lineas')
      .select('codigo_producto, descripcion, cantidad')
      .in('pedido_id', pedidos.map((p) => p.id))

    const acumulado = new Map<string, { descripcion: string; cantidad: number }>()
    for (const l of lineas ?? []) {
      const actual = acumulado.get(l.codigo_producto) ?? { descripcion: l.descripcion, cantidad: 0 }
      actual.cantidad += Number(l.cantidad)
      acumulado.set(l.codigo_producto, actual)
    }

    return [...acumulado.entries()]
      .map(([codigo, v]) => ({ codigo, descripcion: v.descripcion, cantidad: v.cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, limite)
  }

  async function carteraVencida(): Promise<AlertaCartera[]> {
    const [{ data: cartera }, { data: clientes }] = await Promise.all([
      client.from('wo_cartera').select('wo_identificacion_tercero, saldo_vencido, dias_atraso').gt('saldo_vencido', 0),
      client.from('clientes').select('nombre, identificacion')
    ])

    if (!cartera?.length || !clientes?.length) return []

    const clientePorIdentificacion = new Map(clientes.map((c) => [c.identificacion, c.nombre]))

    return cartera
      .filter((c) => clientePorIdentificacion.has(c.wo_identificacion_tercero))
      .map((c) => ({
        clienteNombre: clientePorIdentificacion.get(c.wo_identificacion_tercero)!,
        clienteIdentificacion: c.wo_identificacion_tercero,
        saldoVencido: Number(c.saldo_vencido),
        diasAtraso: c.dias_atraso
      }))
      .sort((a, b) => b.diasAtraso - a.diasAtraso)
  }

  return { ventasPorVendedor, productosMasVendidos, carteraVencida }
}
