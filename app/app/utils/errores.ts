// Los errores de $fetch (ofetch) traen el cuerpo de la respuesta del server
// en `.data`, con el `statusMessage` que le pusimos vía `createError(...)` en
// las rutas de servidor. No hay un tipo exportado para esto, así que se
// verifica la forma en vez de usar `any`.
export function mensajeDeError(e: unknown, mensajePorDefecto: string): string {
  if (
    typeof e === 'object' &&
    e !== null &&
    'data' in e &&
    typeof (e as { data?: unknown }).data === 'object' &&
    (e as { data?: { statusMessage?: unknown } }).data !== null
  ) {
    const statusMessage = (e as { data?: { statusMessage?: unknown } }).data?.statusMessage
    if (typeof statusMessage === 'string') return statusMessage
  }
  return mensajePorDefecto
}
