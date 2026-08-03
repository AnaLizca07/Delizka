export interface ProductoCatalogo {
  id: string
  codigo: string
  descripcion: string
  precio: number
  stockDisponible: number
}

export function useCatalogo() {
  const client = useSupabaseClient()

  async function buscar(termino: string): Promise<ProductoCatalogo[]> {
    const texto = termino.trim()
    if (texto.length < 2) return []

    const { data: productos, error } = await client
      .from('catalogo_inventario')
      .select('id, codigo, descripcion, precio')
      .eq('activo', true)
      .or(`codigo.ilike.%${texto}%,descripcion.ilike.%${texto}%`)
      .limit(30)

    if (error || !productos?.length) return []

    const ids = productos.map((p) => p.id)
    const { data: disponibilidad } = await client.rpc('stock_disponible', { p_inventario_ids: ids })
    const disponiblePorId = new Map(
      (disponibilidad ?? []).map((d: { inventario_id: string; stock_disponible: number }) => [d.inventario_id, Number(d.stock_disponible)])
    )

    return productos.map((p) => ({
      id: p.id,
      codigo: p.codigo,
      descripcion: p.descripcion,
      precio: Number(p.precio),
      stockDisponible: disponiblePorId.get(p.id) ?? 0
    }))
  }

  return { buscar }
}
