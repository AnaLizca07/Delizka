export interface UbicacionVendedor {
  vendedorId: string
  vendedorNombre: string
  zonaNombre: string
  tipo: string
  lat: number
  lng: number
  creadoAt: string
}

const ETIQUETA_EVENTO: Record<string, string> = {
  check_in: 'Inicio de jornada',
  inicio_visita: 'Inicio de visita',
  envio_pedido: 'Envío de pedido',
  check_out: 'Fin de jornada'
}

export function useMapaVendedores() {
  const client = useSupabaseClient()

  async function ultimasUbicaciones(): Promise<UbicacionVendedor[]> {
    const { data: perfiles } = await client.from('perfiles').select('id, nombre, zona_id').eq('rol', 'vendedor')
    if (!perfiles?.length) return []

    const zonaIds = [...new Set(perfiles.map((p) => p.zona_id).filter((z): z is string => !!z))]
    const { data: zonas } = zonaIds.length
      ? await client.from('zonas').select('id, nombre').in('id', zonaIds)
      : { data: [] as { id: string; nombre: string }[] }
    const zonaPorId = new Map((zonas ?? []).map((z) => [z.id, z.nombre]))

    // Sin vista de "último por grupo": se trae un lote reciente ordenado
    // desc y se toma la primera aparición de cada vendedor (ya es la más
    // reciente). Suficiente mientras el volumen de eventos sea manejable.
    const { data: eventos } = await client
      .from('eventos_geolocalizacion')
      .select('vendedor_id, tipo, lat, lng, creado_at')
      .order('creado_at', { ascending: false })
      .limit(500)

    const perfilPorId = new Map(perfiles.map((p) => [p.id, p]))
    const vistos = new Set<string>()
    const resultado: UbicacionVendedor[] = []

    for (const e of eventos ?? []) {
      if (vistos.has(e.vendedor_id)) continue
      vistos.add(e.vendedor_id)
      const perfil = perfilPorId.get(e.vendedor_id)
      resultado.push({
        vendedorId: e.vendedor_id,
        vendedorNombre: perfil?.nombre ?? '—',
        zonaNombre: perfil?.zona_id ? zonaPorId.get(perfil.zona_id) ?? '—' : '—',
        tipo: ETIQUETA_EVENTO[e.tipo] ?? e.tipo,
        lat: Number(e.lat),
        lng: Number(e.lng),
        creadoAt: e.creado_at
      })
    }
    return resultado
  }

  return { ultimasUbicaciones }
}
