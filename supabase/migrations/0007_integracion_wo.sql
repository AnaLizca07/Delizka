-- RF-24 (DEC-11): configuración de la conexión ODBC y estado del agente.
-- La contraseña del usuario de solo lectura NUNCA se guarda aquí: vive como
-- variable de entorno del agente (o en Supabase Vault), fuera de esta tabla.
-- Fila única (singleton) para que el panel administrativo tenga un solo registro
-- que leer/editar.
create table wo_config (
  id int primary key default 1 check (id = 1),
  servidor text,
  puerto int,
  base_datos text,
  usuario text,
  credenciales_configuradas boolean not null default false,
  iva_tarifa numeric(5, 4) not null default 0.19,
  intervalo_sync_minutos int not null default 15,
  ultima_corrida_at timestamptz,
  proxima_corrida_at timestamptz,
  ultimo_error text,
  estado text
);

insert into wo_config (id, iva_tarifa) values (1, 0.19);

-- Mirror liviano de Vista_Tabla_Terceros, usado solo como apoyo de matching
-- (no hay flujo de negocio que dependa de él todavía).
create table wo_terceros (
  id_tercero text primary key,
  identificacion text,
  nombre text,
  sincronizado_at timestamptz not null default now()
);

-- RF-07: saldo y mora por cliente, alimentado por Vista_CuentasPorCobrar_Detallada.
create table wo_cartera (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes (id),
  wo_identificacion_tercero text not null,
  saldo_total numeric(14, 2) not null default 0,
  saldo_vencido numeric(14, 2) not null default 0,
  dias_atraso int not null default 0,
  sincronizado_at timestamptz not null default now()
);

create unique index on wo_cartera (wo_identificacion_tercero);
create index on wo_cartera (cliente_id);

-- RF-27 (DEC-06/DEC-07): mirror de Vista_Tabla_Encabezados usado como universo
-- de búsqueda para la reconciliación automática de respaldo (nivel 2).
create table wo_documentos_encabezados (
  id_asiento_contable text primary key,
  tipo_documento text not null,
  prefijo text,
  numero_documento text not null,
  fecha date not null,
  wo_identificacion_tercero text,
  numero_documento_externo text,
  total numeric(14, 2),
  sincronizado_at timestamptz not null default now()
);

create index on wo_documentos_encabezados (wo_identificacion_tercero, fecha);
create index on wo_documentos_encabezados (numero_documento_externo);

-- RF-24: historial de corridas del agente (última corrida, errores, próxima ejecución).
create table wo_sync_log (
  id uuid primary key default gen_random_uuid(),
  corrida_at timestamptz not null default now(),
  duracion_ms int,
  filas_actualizadas jsonb,
  exito boolean not null,
  error text
);

create index on wo_sync_log (corrida_at desc);
