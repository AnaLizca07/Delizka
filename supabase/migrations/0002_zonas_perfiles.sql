create table zonas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  descripcion text,
  municipios text[] not null default '{}',
  activo boolean not null default true,
  creado_at timestamptz not null default now()
);

-- Extiende auth.users; se crea junto con el usuario de Supabase Auth cuando
-- un admin/vendedor genera credenciales (no hay auto-registro en esta app).
create table perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  rol rol_usuario not null,
  nombre text not null,
  -- null para admin/gerente (ven todas las zonas); obligatorio para vendedor/cliente.
  zona_id uuid references zonas (id),
  activo boolean not null default true,
  creado_at timestamptz not null default now()
);

create index on perfiles (zona_id);

-- security definer a propósito: perfiles tiene RLS y su propia policy de
-- lectura invoca es_admin_o_gerente() / auth_rol(). Si esta función corriera
-- como el usuario que llama (security invoker, el default), esa lectura
-- volvería a evaluar la policy de perfiles, que vuelve a llamar a auth_rol(),
-- en una recursión infinita (stack depth exceeded). security definer sortea
-- la RLS de perfiles solo para esta lectura puntual del propio rol/zona.
create or replace function auth_zona_id() returns uuid
language sql stable
security definer set search_path = public
as $$
  select zona_id from perfiles where id = auth.uid()
$$;

create or replace function auth_rol() returns rol_usuario
language sql stable
security definer set search_path = public
as $$
  select rol from perfiles where id = auth.uid()
$$;

create or replace function es_admin_o_gerente() returns boolean
language sql stable
as $$
  select auth_rol() in ('admin', 'gerente')
$$;
