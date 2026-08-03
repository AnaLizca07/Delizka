-- RF-16/RF-17: eventos puntuales, no rastreo continuo.
create table eventos_geolocalizacion (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references vendedores (id),
  tipo tipo_evento_geo not null,
  lat double precision not null,
  lng double precision not null,
  cliente_id uuid references clientes (id),
  pedido_id uuid references pedidos (id),
  creado_at timestamptz not null default now()
);

create index on eventos_geolocalizacion (vendedor_id, creado_at desc);

-- RF-20: historial de estados de cada pedido, con quién y cuándo.
create table auditoria_pedidos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos (id) on delete cascade,
  estado_anterior estado_pedido,
  estado_nuevo estado_pedido not null,
  usuario_id uuid references perfiles (id),
  detalle jsonb,
  creado_at timestamptz not null default now()
);

create index on auditoria_pedidos (pedido_id, creado_at);
