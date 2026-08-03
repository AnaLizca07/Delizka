-- Tablas espejo (solo lectura desde la app; las escribe el agente de sincronización
-- con la service role key, que no pasa por RLS).

-- DEC-02: una sola lista de precios. `precio` proviene de Precio1 de World Office
-- (confirmado contra datos reales: Precio1 es el único campo con valores consistentes
-- en Vista_Tabla_Inventarios / Vista_Auxiliar_Movimientos_Inventario), siempre sin IVA.
create table catalogo_inventario (
  id uuid primary key default gen_random_uuid(),
  wo_id_inventario text not null unique,
  codigo text not null,
  descripcion text not null,
  precio numeric(14, 2) not null default 0,
  activo boolean not null default true,
  sincronizado_at timestamptz not null default now()
);

create index on catalogo_inventario (codigo);

-- DEC-02: Delizka opera con una sola bodega real ("Principal" / código "Uno").
-- La bodega "Mayor" (código "Dos") se confirmó vestigial (existencia neta negativa,
-- sin uso operativo) y se ignora deliberadamente: no se mirroriza ni se sincroniza.
create table existencias (
  inventario_id uuid primary key references catalogo_inventario (id),
  cantidad numeric(12, 2) not null default 0,
  sincronizado_at timestamptz not null default now()
);
