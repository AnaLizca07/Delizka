import { describe, expect, it } from 'vitest'
import {
  calcularIva,
  calcularSubtotal,
  calcularTotal,
  validarActualizarCantidad,
  validarAgregarStock
} from './pedidoCalculos'

describe('calcularSubtotal', () => {
  it('suma cantidad × precio de cada línea', () => {
    const subtotal = calcularSubtotal([
      { cantidad: 8, precioUnitario: 8500 },
      { cantidad: 5, precioUnitario: 7000 },
      { cantidad: 1, precioUnitario: 9000 }
    ])
    expect(subtotal).toBe(8 * 8500 + 5 * 7000 + 1 * 9000)
  })

  it('devuelve 0 con el carrito vacío', () => {
    expect(calcularSubtotal([])).toBe(0)
  })
})

describe('calcularIva', () => {
  it('aplica la tarifa configurable (DEC-01), no un 19% fijo en código', () => {
    expect(calcularIva(100_000, 0.19)).toBe(19_000)
    expect(calcularIva(100_000, 0.05)).toBe(5_000)
  })

  it('redondea a 2 decimales', () => {
    expect(calcularIva(33.33, 0.19)).toBe(6.33)
  })
})

describe('calcularTotal', () => {
  it('es subtotal + iva', () => {
    expect(calcularTotal(100_000, 19_000)).toBe(119_000)
  })
})

describe('flujo completo del carrito (caso real de la vendedora)', () => {
  it('reproduce el ejemplo verificado en vivo: 8+5+1 unidades → total $8.985 en IVA', () => {
    const lineas = [
      { cantidad: 8, precioUnitario: 8500 },
      { cantidad: 5, precioUnitario: 7000 },
      { cantidad: 1, precioUnitario: 9000 }
    ]
    const subtotal = calcularSubtotal(lineas)
    const iva = calcularIva(subtotal, 0.19)
    const total = calcularTotal(subtotal, iva)
    expect(subtotal).toBe(112_000)
    expect(iva).toBe(21_280)
    expect(total).toBe(133_280)
  })
})

describe('validarAgregarStock (RF-15)', () => {
  it('permite agregar hasta llenar exactamente el stock disponible', () => {
    expect(validarAgregarStock(0, 20, 20, 'AL7820CR')).toEqual({ ok: true })
  })

  it('rechaza si lo ya agregado + lo nuevo supera el disponible', () => {
    const resultado = validarAgregarStock(15, 10, 20, 'AL7820CR')
    expect(resultado.ok).toBe(false)
    expect(resultado.mensaje).toBe('Solo hay 20 unidades disponibles de AL7820CR.')
  })

  it('rechaza un primer agregado que ya se pasa del disponible', () => {
    expect(validarAgregarStock(0, 100, 19, 'AL7810BJ').ok).toBe(false)
  })
})

describe('validarActualizarCantidad (RF-15)', () => {
  it('permite igualar el disponible', () => {
    expect(validarActualizarCantidad(19, 19, 'AL7810BJ')).toEqual({ ok: true })
  })

  it('rechaza superar el disponible', () => {
    const resultado = validarActualizarCantidad(20, 19, 'AL7810BJ')
    expect(resultado.ok).toBe(false)
    expect(resultado.mensaje).toContain('19 unidades disponibles')
  })
})
