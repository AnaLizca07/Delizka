-- RF-21: notificaciones push de escritorio para el gerente. Cada suscripción
-- es específica de un navegador/dispositivo — un mismo perfil puede tener
-- varias (PC de la oficina, portátil, etc.), por eso el endpoint es la clave
-- natural, no el perfil_id.
create table push_subscripciones (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references perfiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  creado_at timestamptz not null default now()
);

create index on push_subscripciones (perfil_id);

alter table push_subscripciones enable row level security;

-- Cada quien administra sus propias suscripciones (activarlas/desactivarlas
-- desde su propio navegador). El envío real de push corre server-side con la
-- service_role key, así que no necesita una policy de select amplia aquí.
create policy "push_subscripciones_propias" on push_subscripciones for all to authenticated
  using (perfil_id = auth.uid())
  with check (perfil_id = auth.uid());
