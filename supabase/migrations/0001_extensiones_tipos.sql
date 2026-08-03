create extension if not exists "pgcrypto";

create type rol_usuario as enum ('admin', 'gerente', 'vendedor', 'cliente');
create type canal_pedido as enum ('vendedor', 'cliente');

-- DEC-05: cancelado y conflicto_stock se agregan al flujo original.
create type estado_pedido as enum (
  'pendiente_aprobacion',
  'aprobado',
  'pendiente_registro_wo',
  'confirmado_en_wo',
  'revision_manual',
  'sin_match',
  'cancelado',
  'conflicto_stock'
);

create type estado_reserva as enum ('activa', 'liberada');
create type tipo_evento_geo as enum ('check_in', 'inicio_visita', 'envio_pedido', 'check_out');

-- DEC-06 / DEC-07: nivel_1_manual es el mecanismo principal (número de documento
-- ingresado por contabilidad); nivel_2_automatico es el respaldo por similitud.
create type match_nivel as enum ('nivel_1_manual', 'nivel_2_automatico');
