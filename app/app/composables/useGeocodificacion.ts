export interface CoordenadasGeocodificadas {
  lat: number
  lng: number
}

export function useGeocodificacion() {
  // RF-17: convierte la dirección de texto libre del cliente en coordenadas
  // aproximadas, usando Nominatim (OpenStreetMap) — el mismo servicio ya usado
  // en el mapa de vendedores, gratis y sin llave. Se llama una sola vez por
  // cliente creado (volumen bajo), así que no hace falta un proxy propio.
  // Best-effort: si la dirección no se puede resolver (informal, incompleta,
  // rural), se guarda sin coordenadas en vez de bloquear la creación del cliente.
  async function geocodificarDireccion(direccion: string): Promise<CoordenadasGeocodificadas | null> {
    const texto = direccion.trim()
    if (!texto) return null
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=co&q=${encodeURIComponent(texto)}`
      const resp = await fetch(url, { headers: { 'Accept-Language': 'es' } })
      if (!resp.ok) return null
      const data = await resp.json()
      if (!Array.isArray(data) || !data.length) return null
      const lat = Number(data[0].lat)
      const lng = Number(data[0].lon)
      if (Number.isNaN(lat) || Number.isNaN(lng)) return null
      return { lat, lng }
    } catch {
      return null
    }
  }

  return { geocodificarDireccion }
}

// RF-17: distancia entre dos puntos GPS (fórmula de Haversine), en metros.
// Vive junto a la geocodificación porque ambas alimentan la misma validación
// de cercanía cliente↔vendedor.
export function distanciaMetros(a: CoordenadasGeocodificadas, b: CoordenadasGeocodificadas): number {
  const R = 6_371_000
  const rad = (deg: number) => (deg * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
