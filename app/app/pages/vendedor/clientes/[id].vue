<script setup lang="ts">
import type { Cliente, PlazoPago } from '~/composables/useClientes'

const route = useRoute()
const client = useSupabaseClient()
const { obtener, listarPlazos } = useClientes()
const { registrarEvento } = useGeolocalizacion()
const { distanciaMetros } = useGeocodificacion()

// RF-17: por encima de esto se avisa que el check-in está lejos de la
// dirección registrada. Generoso a propósito — la dirección del cliente es
// geocodificada de forma aproximada (RF-17), no es un pin exacto, así que un
// umbral corto generaría falsos positivos constantes.
const UMBRAL_LEJOS_METROS = 2000
const avisoLejos = ref<{ metros: number } | null>(null)

const cliente = ref<Cliente | null>(null)
const plazos = ref<PlazoPago[]>([])
const cartera = ref<{ saldo_total: number; saldo_vencido: number; dias_atraso: number } | null>(null)
const pedidos = ref<{ id: string; estado: string; total: number; creado_at: string }[]>([])
const cargando = ref(true)

const generando = ref(false)
const credenciales = ref<{ email: string; password: string } | null>(null)
const errorCredenciales = ref<string | null>(null)

const plazoEtiqueta = computed(() => {
  if (!cliente.value?.plazo_pago_id) return 'Sin definir'
  return plazos.value.find((p) => p.id === cliente.value?.plazo_pago_id)?.etiqueta ?? 'Sin definir'
})

const ETIQUETA_ESTADO: Record<string, string> = {
  pendiente_aprobacion: 'Pendiente de aprobación',
  aprobado: 'Aprobado',
  pendiente_registro_wo: 'Pendiente de registro en WO',
  confirmado_en_wo: 'Confirmado en World Office',
  revision_manual: 'En revisión manual',
  sin_match: 'Sin coincidencia',
  cancelado: 'Cancelado',
  conflicto_stock: 'Conflicto de stock'
}

const formatoMoneda = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const formatoFecha = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' })

async function cargar() {
  const id = route.params.id as string
  const [c, p] = await Promise.all([obtener(id), listarPlazos()])
  cliente.value = c
  plazos.value = p

  const [{ data: carteraData }, { data: pedidosData }] = await Promise.all([
    client.from('wo_cartera').select('saldo_total, saldo_vencido, dias_atraso').eq('cliente_id', id).maybeSingle(),
    client.from('pedidos').select('id, estado, total, creado_at').eq('cliente_id', id).order('creado_at', { ascending: false })
  ])
  cartera.value = carteraData ?? null
  pedidos.value = pedidosData ?? []
  cargando.value = false

  // RF-16: abrir la ficha de un cliente es, en la práctica, el momento en que
  // el vendedor está iniciando una visita. Best-effort, no bloquea la carga.
  const posicion = await registrarEvento('inicio_visita', { clienteId: id })

  // RF-17: si el cliente tiene coordenadas geocodificadas, avisa si el
  // vendedor está lejos. Silencioso si no hay GPS o no hay coordenadas.
  if (posicion && cliente.value?.lat != null && cliente.value?.lng != null) {
    const metros = distanciaMetros(posicion, { lat: cliente.value.lat, lng: cliente.value.lng })
    if (metros > UMBRAL_LEJOS_METROS) {
      avisoLejos.value = { metros: Math.round(metros) }
    }
  }
}

onMounted(cargar)

async function generarCredenciales() {
  errorCredenciales.value = null
  generando.value = true
  try {
    const resp = await $fetch('/api/vendedor/generar-credenciales', {
      method: 'POST',
      body: { clienteId: cliente.value?.id }
    })
    credenciales.value = { email: resp.email, password: resp.password }
    if (cliente.value) cliente.value.perfil_id = 'pendiente' // solo para ocultar el botón; se refresca abajo
    await cargar()
  } catch (e: any) {
    errorCredenciales.value = e?.data?.statusMessage ?? 'No se pudieron generar las credenciales.'
  }
  generando.value = false
}
</script>

<template>
  <div v-if="cargando" class="text-sm text-slate-400">Cargando…</div>

  <div v-else-if="cliente" class="max-w-2xl space-y-6">
    <p v-if="avisoLejos" class="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
      ⚠️ Estás a unos {{ Math.round(avisoLejos.metros / 100) / 10 }} km de la dirección registrada de este cliente.
    </p>

    <div class="flex items-start justify-between gap-3">
      <div>
        <NuxtLink to="/vendedor/clientes" class="text-sm text-[#1E2A6E] hover:underline">← Volver a clientes</NuxtLink>
        <h1 class="text-lg font-semibold text-slate-900 mt-1">{{ cliente.nombre }}</h1>
        <p class="text-sm text-slate-500">{{ cliente.identificacion }}</p>
      </div>
      <NuxtLink
        :to="`/vendedor/pedido-nuevo?clienteId=${cliente.id}`"
        class="shrink-0 rounded-lg bg-[#1E2A6E] text-white text-sm font-medium px-4 py-2.5"
      >
        Hacer pedido
      </NuxtLink>
    </div>

    <div class="rounded-lg border border-slate-200 bg-white p-4 grid grid-cols-2 gap-4 text-sm">
      <div>
        <p class="text-slate-500">Teléfono</p>
        <p class="text-slate-900">{{ cliente.telefono || '—' }}</p>
      </div>
      <div>
        <p class="text-slate-500">Dirección</p>
        <p class="text-slate-900">{{ cliente.direccion || '—' }}</p>
      </div>
      <div>
        <p class="text-slate-500">Plazo de pago</p>
        <p class="text-slate-900">{{ plazoEtiqueta }}</p>
      </div>
      <div>
        <p class="text-slate-500">Cliente desde</p>
        <p class="text-slate-900">{{ formatoFecha.format(new Date(cliente.creado_at)) }}</p>
      </div>
    </div>

    <div class="rounded-lg border border-slate-200 bg-white p-4">
      <h2 class="text-sm font-semibold text-slate-900 mb-2">Cartera</h2>
      <div v-if="cartera" class="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p class="text-slate-500">Saldo total</p>
          <p class="text-slate-900">{{ formatoMoneda.format(cartera.saldo_total) }}</p>
        </div>
        <div>
          <p class="text-slate-500">Vencido</p>
          <p :class="cartera.saldo_vencido > 0 ? 'text-red-600' : 'text-slate-900'">
            {{ formatoMoneda.format(cartera.saldo_vencido) }}
          </p>
        </div>
        <div>
          <p class="text-slate-500">Días de atraso</p>
          <p :class="cartera.dias_atraso > 0 ? 'text-red-600' : 'text-slate-900'">{{ cartera.dias_atraso }}</p>
        </div>
      </div>
      <p v-else class="text-sm text-slate-400">Sin cartera registrada.</p>
    </div>

    <div class="rounded-lg border border-slate-200 bg-white p-4">
      <h2 class="text-sm font-semibold text-slate-900 mb-2">Acceso a la app</h2>

      <div v-if="credenciales" class="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm mb-3">
        <p class="font-medium text-amber-900 mb-1">Guarda estos datos, no se volverán a mostrar:</p>
        <p class="text-amber-900">Correo: <span class="font-mono">{{ credenciales.email }}</span></p>
        <p class="text-amber-900">Contraseña temporal: <span class="font-mono">{{ credenciales.password }}</span></p>
        <p class="text-amber-700 text-xs mt-1">Vence en 48 horas si no se usa; el cliente deberá cambiarla en su primer ingreso.</p>
      </div>

      <p v-if="cliente.perfil_id && !credenciales" class="text-sm text-slate-500">Este cliente ya tiene acceso a la app.</p>

      <button
        v-else-if="!cliente.perfil_id"
        type="button" :disabled="generando"
        class="rounded-lg bg-[#1E2A6E] text-white text-sm font-medium px-4 py-2 disabled:opacity-60"
        @click="generarCredenciales"
      >
        {{ generando ? 'Generando…' : 'Generar credenciales' }}
      </button>

      <p v-if="errorCredenciales" class="text-sm text-red-600 mt-2">{{ errorCredenciales }}</p>
    </div>

    <div class="rounded-lg border border-slate-200 bg-white p-4">
      <h2 class="text-sm font-semibold text-slate-900 mb-2">Historial de pedidos</h2>
      <p v-if="!pedidos.length" class="text-sm text-slate-400">Sin pedidos todavía.</p>
      <ul v-else class="divide-y divide-slate-200">
        <li v-for="p in pedidos" :key="p.id" class="py-2 flex items-center justify-between text-sm">
          <div>
            <p class="text-slate-900">{{ formatoFecha.format(new Date(p.creado_at)) }}</p>
            <p class="text-slate-500">{{ ETIQUETA_ESTADO[p.estado] ?? p.estado }}</p>
          </div>
          <p class="font-medium text-slate-900">{{ formatoMoneda.format(p.total) }}</p>
        </li>
      </ul>
    </div>
  </div>

  <p v-else class="text-sm text-red-600">No se encontró el cliente.</p>
</template>
