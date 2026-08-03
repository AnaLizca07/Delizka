-- RF-06 / RF-22: catálogo editable de plazos de pago, sin tocar código.
create table plazos_pago (
  id uuid primary key default gen_random_uuid(),
  dias int not null unique,
  etiqueta text not null,
  activo boolean not null default true
);

-- Tabla de extensión 1:1 sobre perfiles (comparte el id con auth.users).
create table vendedores (
  id uuid primary key references perfiles (id) on delete cascade,
  telefono text,
  activo boolean not null default true,
  creado_at timestamptz not null default now()
);

-- RF-05: el cliente puede existir sin perfil de acceso (perfil_id null) hasta que
-- el vendedor le genere credenciales (RF-08); por eso zona_id se guarda aquí y no
-- se depende de perfiles.zona_id.
create table clientes (
  id uuid primary key default gen_random_uuid(),
  zona_id uuid not null references zonas (id),
  vendedor_id uuid not null references vendedores (id),
  perfil_id uuid unique references perfiles (id),
  nombre text not null,
  identificacion text not null,
  telefono text,
  direccion text,
  plazo_pago_id uuid references plazos_pago (id),
  -- DEC-08: contraseña temporal vence a las 48h y exige cambio en el primer login.
  password_temporal_expira_at timestamptz,
  requiere_cambio_password boolean not null default true,
  -- referencia opcional al tercero de World Office, si llega a mapearse.
  wo_id_tercero text,
  activo boolean not null default true,
  creado_at timestamptz not null default now()
);

create index on clientes (zona_id);
create index on clientes (vendedor_id);
create unique index on clientes (identificacion);
