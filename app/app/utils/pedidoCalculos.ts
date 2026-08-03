// Lógica de negocio del carrito (vendedor y auto-pedido del cliente), separada
// de los composables para que sea testable sin depender del runtime de Nuxt
// (useState/useSupabaseClient) — ver DEC-01 para la regla de IVA.

export interface LineaConCantidadYPrecio {
  cantidad: number
  precioUnitario: number
}

export interface ResultadoValidacion {
  ok: boolean
  mensaje?: string
}

export function calcularSubtotal(lineas: LineaConCantidadYPrecio[]): number {
  return lineas.reduce((acc, l) => acc + l.cantidad * l.precioUnitario, 0)
}

export function calcularIva(subtotal: number, tarifa: number): number {
  return Math.round(subtotal * tarifa * 100) / 100
}

export function calcularTotal(subtotal: number, iva: number): number {
  return subtotal + iva
}

// RF-15: no se puede agregar (ni acumular sobre lo ya agregado) más de lo que
// hay disponible.
export function validarAgregarStock(
  cantidadPrevia: number,
  cantidadAAgregar: number,
  stockDisponible: number,
  codigo: string
): ResultadoValidacion {
  if (cantidadPrevia + cantidadAAgregar > stockDisponible) {
    return { ok: false, mensaje: `Solo hay ${stockDisponible} unidades disponibles de ${codigo}.` }
  }
  return { ok: true }
}

export function validarActualizarCantidad(
  cantidadNueva: number,
  stockDisponible: number,
  codigo: string
): ResultadoValidacion {
  if (cantidadNueva > stockDisponible) {
    return { ok: false, mensaje: `Solo hay ${stockDisponible} unidades disponibles de ${codigo}.` }
  }
  return { ok: true }
}
