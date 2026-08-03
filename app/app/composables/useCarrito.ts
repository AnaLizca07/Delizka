import type { ProductoCatalogo } from '~/composables/useCatalogo'
import { calcularIva, calcularSubtotal, calcularTotal, validarAgregarStock, validarActualizarCantidad } from '~/utils/pedidoCalculos'

export interface LineaCarrito {
  inventarioId: string
  codigo: string
  descripcion: string
  precioUnitario: number
  cantidad: number
  stockDisponible: number
}

export function useCarrito() {
  const clienteId = useState<string | null>('carrito-cliente', () => null)
  const lineas = useState<LineaCarrito[]>('carrito-lineas', () => [])
  const ivaTarifa = useState<number>('carrito-iva-tarifa', () => 0.19)
  const notas = useState<string>('carrito-notas', () => '')

  const client = useSupabaseClient()
  const { perfil } = usePerfil()
  const { registrarEvento } = useGeolocalizacion()

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
    clienteId.value = null
    lineas.value = []
    notas.value = ''
  }

  async function enviarPedido() {
    if (!clienteId.value) return { ok: false, mensaje: 'Selecciona un cliente.' }
    if (!lineas.value.length) return { ok: false, mensaje: 'Agrega al menos un producto.' }

    // client.auth.getUser() en vez de useSupabaseUser(): esa ref reactiva puede
    // quedar desactualizada tras un cambio de sesión (cerrar/abrir sesión) en la
    // misma pestaña, y aquí necesitamos el id real para que la RLS de `pedidos`
    // (vendedor_id = auth.uid()) no rechace el insert.
    const { data: userData } = await client.auth.getUser()
    if (!userData.user || !perfil.value?.zona_id) return { ok: false, mensaje: 'No se pudo identificar tu sesión.' }
    const userId = userData.user.id

    const { data: pedido, error: errorPedido } = await client
      .from('pedidos')
      .insert({
        cliente_id: clienteId.value,
        vendedor_id: userId,
        zona_id: perfil.value.zona_id,
        canal: 'vendedor',
        notas: notas.value.trim() || null
      })
      .select('id')
      .single()

    if (errorPedido || !pedido) {
      return { ok: false, mensaje: 'No se pudo crear el pedido. Intenta de nuevo.' }
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
      return { ok: false, mensaje: 'El pedido se creó pero hubo un error agregando los productos.' }
    }

    const { error: errorAprobar } = await client.rpc('aprobar_pedido', {
      p_pedido_id: pedido.id,
      p_aprobado_por: userId
    })

    if (errorAprobar) {
      return {
        ok: false,
        // no es un error del carrito: el pedido queda creado, pendiente de aprobar
        mensaje: `El pedido se creó pero no se pudo reservar el stock: ${errorAprobar.message}`,
        pedidoId: pedido.id
      }
    }

    // RF-16: no se espera esta llamada — el vendedor no debería notar demora
    // en la confirmación de su pedido por culpa del GPS.
    registrarEvento('envio_pedido', { clienteId: clienteId.value, pedidoId: pedido.id })

    limpiar()
    return { ok: true, pedidoId: pedido.id }
  }

  return {
    clienteId,
    lineas,
    notas,
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
