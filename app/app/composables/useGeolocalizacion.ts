export type TipoEventoGeo = 'check_in' | 'inicio_visita' | 'envio_pedido' | 'check_out'

export interface PosicionGeo {
  lat: number
  lng: number
}

export function useGeolocalizacion() {
  const client = useSupabaseClient()

  function obtenerPosicion(): Promise<PosicionGeo | null> {
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve(null)
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 8000, maximumAge: 60_000 }
      )
    })
  }

  // RF-16: captura automática de GPS en inicio de jornada, inicio de visita y
  // envío de pedido. Siempre "best-effort" — si el navegador no tiene permiso
  // o el GPS falla, se resuelve en silencio y nunca bloquea la acción real
  // del vendedor (nadie debería quedarse sin poder enviar un pedido porque
  // el GPS no respondió).
  async function registrarEvento(tipo: TipoEventoGeo, opts: { clienteId?: string; pedidoId?: string } = {}) {
    const posicion = await obtenerPosicion()
    if (!posicion) return null
    const { data: userData } = await client.auth.getUser()
    if (!userData.user) return null
    await client.from('eventos_geolocalizacion').insert({
      vendedor_id: userData.user.id,
      tipo,
      lat: posicion.lat,
      lng: posicion.lng,
      cliente_id: opts.clienteId ?? null,
      pedido_id: opts.pedidoId ?? null
    })
    return posicion
  }

  return { obtenerPosicion, registrarEvento }
}
