import type { ProductoCatalogo } from '~/composables/useCatalogo'
import { calcularIva, calcularSubtotal, calcularTotal, validarAgregarStock, validarActualizarCantidad } from '~/utils/pedidoCalculos'

export interface LineaAutoPedido {
  inventarioId: string
  codigo: string
  descripcion: string
  precioUnitario: number
  cantidad: number
  stockDisponible: number
}

// Carrito del auto-pedido del cliente (RF-13). Estado separado del carrito del
// vendedor (useCarrito): son roles distintos que nunca coexisten en la misma
// sesión, pero mezclar sus claves de useState sería confuso de mantener.
export function useAutoPedido() {
  const lineas = useState<LineaAutoPedido[]>('auto-pedido-lineas', () => [])
  const ivaTarifa = useState<number>('auto-pedido-iva-tarifa', () => 0.19)

  const client = useSupabaseClient()
  const { miCliente } = useMiCliente()

  const subtotal = computed(() => calcularSubtotal(lineas.value))
  const iva = computed(() => calcularIva(subtotal.value, ivaTarifa.value))
  const total = computed(() => calcularTotal(subtotal.value, iva.value))

  async function cargarIvaTarifa() {
    const { data } = await client.rpc('iva_tarifa_vigente')
    if (typeof data === 'number') ivaTarifa.value = data
  }

  function agregar(producto: ProductoCatalogo, cantidad: number) {
    const existente = lineas.value.find((l) => l.inventarioId === producto.id)
    const cantidadPrevia = existente?.cantidad ?? 0
    const validacion = validarAgregarStock(cantidadPrevia, cantidad, producto.stockDisponible, producto.codigo)
    if (!validacion.ok) return validacion
    if (existente) {
      existente.cantidad += cantidad
    } else {
      lineas.value.push({
        inventarioId: producto.id,
        codigo: producto.codigo,
        descripcion: producto.descripcion,
        precioUnitario: producto.precio,
        cantidad,
        stockDisponible: producto.stockDisponible
      })
    }
    return { ok: true }
  }

  function quitar(inventarioId: string) {
    lineas.value = lineas.value.filter((l) => l.inventarioId !== inventarioId)
  }

  function actualizarCantidad(inventarioId: string, cantidad: number) {
    const linea = lineas.value.find((l) => l.inventarioId === inventarioId)
    if (!linea) return { ok: true }
    const validacion = validarActualizarCantidad(cantidad, linea.stockDisponible, linea.codigo)
    if (!validacion.ok) return validacion
    linea.cantidad = cantidad
    return { ok: true }
  }

  function limpiar() {
    lineas.value = []
  }

  async function enviarPedido() {
    if (!lineas.value.length) return { ok: false, mensaje: 'Agrega al menos un producto.' }
    if (!miCliente.value) return { ok: false, mensaje: 'No se pudo identificar tu cuenta.' }

    // RF-13: el auto-pedido del cliente NO se aprueba solo — queda pendiente
    // para que su vendedor lo revise (a diferencia del pedido que el vendedor
    // crea directamente, que sí se aprueba de inmediato).
    const { data: pedido, error: errorPedido } = await client
      .from('pedidos')
      .insert({
        cliente_id: miCliente.value.id,
        vendedor_id: miCliente.value.vendedor_id,
        zona_id: miCliente.value.zona_id,
        canal: 'cliente'
      })
      .select('id')
      .single()

    if (errorPedido || !pedido) {
      return { ok: false, mensaje: 'No se pudo enviar el pedido. Intenta de nuevo.' }
    }

    const { error: errorLineas } = await client.from('pedido_lineas').insert(
      lineas.value.map((l) => ({
        pedido_id: pedido.id,
        inventario_id: l.inventarioId,
        codigo_producto: l.codigo,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        precio_unitario: l.precioUnitario
      }))
    )

    if (errorLineas) {
      return { ok: false, mensaje: 'El pedido se envió pero hubo un error agregando los productos.' }
    }

    limpiar()
    return { ok: true, pedidoId: pedido.id }
  }

  return {
    lineas,
    subtotal,
    iva,
    total,
    ivaTarifa,
    cargarIvaTarifa,
    agregar,
    quitar,
    actualizarCantidad,
    limpiar,
    enviarPedido
  }
}
