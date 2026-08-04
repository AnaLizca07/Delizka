import { serverSupabaseClient } from '#supabase/server'

interface LineaRecibo {
  codigo_producto: string
  descripcion: string
  cantidad: number
  precio_unitario: number
}

const formatoMoneda = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

// Error de $fetch (ofetch) al llamar la API de Brevo: el cuerpo de la
// respuesta llega en `.data.message`. No hay un tipo exportado para esto,
// así que se verifica la forma en vez de usar `any` (mismo patrón que
// app/utils/errores.ts, pero este archivo vive en server/ y no comparte los
// auto-imports de la app).
function mensajeBrevo(e: unknown): string | undefined {
  if (typeof e !== 'object' || e === null) return undefined
  const data = (e as { data?: unknown }).data
  if (typeof data === 'object' && data !== null) {
    const message = (data as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  const message = (e as { message?: unknown }).message
  return typeof message === 'string' ? message : undefined
}

function armarHtml(clienteNombre: string, pedidoId: string, lineas: LineaRecibo[], subtotal: number, iva: number, total: number, notas: string | null) {
  const filas = lineas
    .map(
      (l) => `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${l.descripcion} <span style="color:#64748b;">(${l.codigo_producto})</span></td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${l.cantidad}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatoMoneda.format(l.precio_unitario)}</td>
      </tr>`
    )
    .join('')

  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#0f172a;">
    <h2 style="color:#1E2A6E;">Delizka</h2>
    <p>Hola ${clienteNombre}, este es el resumen de tu pedido <strong>#${pedidoId.slice(0, 8)}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
      <thead>
        <tr style="text-align:left;color:#64748b;font-size:12px;">
          <th style="padding:6px 8px;">Producto</th>
          <th style="padding:6px 8px;text-align:right;">Cant.</th>
          <th style="padding:6px 8px;text-align:right;">Precio</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
    <table style="width:100%;font-size:14px;margin-bottom:16px;">
      <tr><td>Subtotal</td><td style="text-align:right;">${formatoMoneda.format(subtotal)}</td></tr>
      <tr><td>IVA</td><td style="text-align:right;">${formatoMoneda.format(iva)}</td></tr>
      <tr style="font-weight:bold;"><td>Total</td><td style="text-align:right;">${formatoMoneda.format(total)}</td></tr>
    </table>
    ${notas ? `<p style="background:#fffbeb;border:1px solid #fde68a;padding:8px 12px;border-radius:6px;font-size:13px;"><strong>Notas:</strong> ${notas}</p>` : ''}
    <p style="color:#64748b;font-size:12px;margin-top:24px;">Este correo se generó automáticamente, no respondas a este mensaje.</p>
  </div>`
}

// RF (Brevo): recibo del pedido por correo al cliente. Se llama desde el
// cliente (composable) SIN esperar el resultado — igual que la captura de
// GPS, esto es un "extra" y nunca debe demorar ni romper el flujo real de
// crear/aprobar un pedido. Si el cliente no tiene correo registrado, se
// omite en silencio (no es un error).
export default defineEventHandler(async (event) => {
  const body = await readBody<{ pedidoId?: string }>(event)
  const pedidoId = body?.pedidoId
  if (!pedidoId) {
    throw createError({ statusCode: 400, statusMessage: 'pedidoId es requerido' })
  }

  // Cliente con RLS activa: si quien llama no tiene acceso a este pedido
  // (otra zona, etc.), la consulta simplemente no trae filas.
  const client = await serverSupabaseClient(event)
  const { data: userData, error: errorUser } = await client.auth.getUser()
  if (errorUser || !userData.user) {
    throw createError({ statusCode: 401, statusMessage: 'No autenticado' })
  }

  const { data: pedido } = await client
    .from('pedidos')
    .select('id, cliente_id, subtotal, iva, total, notas')
    .eq('id', pedidoId)
    .single()
  if (!pedido) {
    return { enviado: false, motivo: 'pedido_no_encontrado' }
  }

  const { data: cliente } = await client.from('clientes').select('nombre, email').eq('id', pedido.cliente_id).single()
  if (!cliente?.email) {
    return { enviado: false, motivo: 'sin_correo' }
  }

  const { data: lineas } = await client
    .from('pedido_lineas')
    .select('codigo_producto, descripcion, cantidad, precio_unitario')
    .eq('pedido_id', pedidoId)

  const config = useRuntimeConfig()
  if (!config.brevoApiKey || !config.brevoSenderEmail) {
    return { enviado: false, motivo: 'brevo_no_configurado' }
  }

  try {
    const resp = await $fetch.raw('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': config.brevoApiKey as string, 'Content-Type': 'application/json' },
      body: {
        sender: { name: config.brevoSenderNombre, email: config.brevoSenderEmail },
        to: [{ email: cliente.email, name: cliente.nombre }],
        subject: `Tu pedido en Delizka — ${formatoMoneda.format(Number(pedido.total))}`,
        htmlContent: armarHtml(
          cliente.nombre,
          pedido.id,
          (lineas ?? []) as LineaRecibo[],
          Number(pedido.subtotal),
          Number(pedido.iva),
          Number(pedido.total),
          pedido.notas
        )
      }
    })
    return { enviado: resp.status >= 200 && resp.status < 300 }
  } catch (e) {
    // No relanzamos: quien llama no espera esta ruta, un fallo aquí no debe
    // aparecer como error al vendedor.
    return { enviado: false, motivo: 'error_brevo', detalle: mensajeBrevo(e) }
  }
})
