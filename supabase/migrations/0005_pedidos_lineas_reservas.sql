-- DEC-01: iva_tarifa vive aquí como parámetro configurable (no hardcodeado);
-- el valor operativo real se administra en wo_config (RF-24) y se copia a cada
-- pedido al calcular sus totales, para dejar registro de la tarifa vigente en
-- el momento de la venta.
create table pedidos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id),
  vendedor_id uuid not null references vendedores (id),
  zona_id uuid not null references zonas (id),
  canal canal_pedido not null,
  estado estado_pedido not null default 'pendiente_aprobacion',

  subtotal numeric(14, 2) not null default 0,
  iva_tarifa numeric(5, 4) not null default 0.19,
  iva numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,

  -- DEC-10: true si el pedido se creó sin conexión; no restringe la creación,
  -- solo documenta el origen para auditoría (RF-20).
  creado_offline boolean not null default false,
  creado_at timestamptz not null default now(),

  aprobado_at timestamptz,
  aprobado_por uuid references perfiles (id),

  cancelado_at timestamptz,
  cancelado_motivo text,

  -- DEC-06: mecanismo principal de cierre — contabilidad ingresa esto al digitar
  -- el pedido en World Office Escritorio.
  wo_prefijo text,
  wo_documento_numero text,
  confirmado_en_wo_at timestamptz,

  -- DEC-07: candidatos de la reconciliación automática cuando hay ambigüedad
  -- (más de un documento posible); ninguno se confirma solo en ese caso.
  match_nivel match_nivel,
  match_confianza numeric(3, 2),
  posibles_matches jsonb,
  diferencias jsonb,

  -- DEC-10: detalle de por qué una aprobación offline quedó en conflicto_stock.
  conflicto_stock_detalle jsonb,

  updated_at timestamptz not null default now()
);

create index on pedidos (zona_id);
create index on pedidos (cliente_id);
create index on pedidos (vendedor_id);
create index on pedidos (estado);

create table pedido_lineas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos (id) on delete cascade,
  inventario_id uuid not null references catalogo_inventario (id),
  codigo_producto text not null,
  descripcion text not null,
  cantidad numeric(12, 2) not null check (cantidad > 0),
  precio_unitario numeric(14, 2) not null,
  subtotal_linea numeric(14, 2) not null default 0
);

create index on pedido_lineas (pedido_id);
create index on pedido_lineas (inventario_id);

-- DEC-04: ledger transaccional, no un contador. Cada reserva activa representa
-- stock comprometido por un pedido aprobado que aún no se registra en World Office.
create table reservas_stock (
  id uuid primary key default gen_random_uuid(),
  pedido_linea_id uuid not null references pedido_lineas (id) on delete cascade,
  inventario_id uuid not null references catalogo_inventario (id),
  cantidad numeric(12, 2) not null check (cantidad > 0),
  estado estado_reserva not null default 'activa',
  creado_at timestamptz not null default now(),
  liberado_at timestamptz,
  motivo_liberacion text
);

create index on reservas_stock (inventario_id) where estado = 'activa';
create index on reservas_stock (pedido_linea_id);

-- DEC-04: la disponibilidad real siempre resta las reservas activas del stock
-- sincronizado; ninguna pantalla debe leer `existencias.cantidad` directamente.
-- Es una función `security definer` (no una vista plana) a propósito: RLS en
-- `reservas_stock` restringe su lectura directa a admin/gerente (0008), pero
-- vendedores y clientes igual necesitan ver la disponibilidad real y agregada
-- para no sobrevender. Una vista simple heredaría esa restricción de forma
-- implícita y dependiente de quién sea el owner de la tabla; esta función lo
-- hace explícito e independiente de esa ambigüedad.
create or replace function stock_disponible() returns table (
  inventario_id uuid,
  stock_sincronizado_wo numeric,
  stock_comprometido_local numeric,
  stock_disponible numeric
)
language sql stable
security definer set search_path = public
as $$
  select
    e.inventario_id,
    e.cantidad as stock_sincronizado_wo,
    coalesce(r.reservado, 0) as stock_comprometido_local,
    e.cantidad - coalesce(r.reservado, 0) as stock_disponible
  from existencias e
  left join (
    select inventario_id, sum(cantidad) as reservado
    from reservas_stock
    where estado = 'activa'
    group by inventario_id
  ) r on r.inventario_id = e.inventario_id
$$;

grant execute on function stock_disponible() to authenticated;

-- Calcula la línea a partir de cantidad x precio; nunca confía en un subtotal
-- enviado por el cliente.
create or replace function calcular_subtotal_linea() returns trigger
language plpgsql
as $$
begin
  new.subtotal_linea := round(new.cantidad * new.precio_unitario, 2);
  return new;
end;
$$;

create trigger trg_calcular_subtotal_linea
before insert or update on pedido_lineas
for each row execute function calcular_subtotal_linea();

-- DEC-01: recalcula subtotal/iva/total del pedido cada vez que cambian sus líneas,
-- tomando la tarifa vigente de wo_config (no hardcodeada).
create or replace function recalcular_totales_pedido() returns trigger
language plpgsql
as $$
declare
  v_pedido_id uuid;
  v_subtotal numeric(14, 2);
  v_iva_tarifa numeric(5, 4);
begin
  v_pedido_id := coalesce(new.pedido_id, old.pedido_id);
  select coalesce(sum(subtotal_linea), 0) into v_subtotal
    from pedido_lineas where pedido_id = v_pedido_id;
  select iva_tarifa into v_iva_tarifa from wo_config where id = 1;
  v_iva_tarifa := coalesce(v_iva_tarifa, 0.19);

  update pedidos
    set subtotal = v_subtotal,
        iva_tarifa = v_iva_tarifa,
        iva = round(v_subtotal * v_iva_tarifa, 2),
        total = v_subtotal + round(v_subtotal * v_iva_tarifa, 2),
        updated_at = now()
    where id = v_pedido_id;
  return null;
end;
$$;

create trigger trg_recalcular_totales
after insert or update or delete on pedido_lineas
for each row execute function recalcular_totales_pedido();

-- RF-14/RF-15: aprueba un pedido reservando stock de forma atómica. Bloquea las
-- filas de existencias involucradas (`for update`) para que dos aprobaciones
-- simultáneas de distintos vendedores no puedan leer el mismo disponible y
-- sobrevender (DEC-04).
create or replace function aprobar_pedido(p_pedido_id uuid, p_aprobado_por uuid) returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_linea record;
  v_disponible numeric;
  v_zona_id uuid;
begin
  select zona_id into v_zona_id from pedidos where id = p_pedido_id;
  if v_zona_id is null then
    raise exception 'pedido % no existe', p_pedido_id;
  end if;
  if not (es_admin_o_gerente() or (auth_rol() = 'vendedor' and v_zona_id = auth_zona_id())) then
    raise exception 'no autorizado para aprobar este pedido';
  end if;

  perform 1 from existencias e
    join pedido_lineas pl on pl.inventario_id = e.inventario_id
    where pl.pedido_id = p_pedido_id
    for update;

  for v_linea in select * from pedido_lineas where pedido_id = p_pedido_id loop
    select (e.cantidad - coalesce(sum(r.cantidad), 0))
      into v_disponible
      from existencias e
      left join reservas_stock r
        on r.inventario_id = e.inventario_id and r.estado = 'activa'
      where e.inventario_id = v_linea.inventario_id
      group by e.cantidad;

    if v_disponible is null or v_disponible < v_linea.cantidad then
      raise exception 'stock insuficiente para % (disponible %, solicitado %)',
        v_linea.codigo_producto, coalesce(v_disponible, 0), v_linea.cantidad
        using errcode = 'P0001';
    end if;

    insert into reservas_stock (pedido_linea_id, inventario_id, cantidad)
    values (v_linea.id, v_linea.inventario_id, v_linea.cantidad);
  end loop;

  update pedidos
    set estado = 'aprobado', aprobado_at = now(), aprobado_por = p_aprobado_por, updated_at = now()
    where id = p_pedido_id;

  insert into auditoria_pedidos (pedido_id, estado_anterior, estado_nuevo, usuario_id, detalle)
  values (p_pedido_id, 'pendiente_aprobacion', 'aprobado', p_aprobado_por,
          jsonb_build_object('mecanismo', 'aprobar_pedido'));
end;
$$;

-- DEC-10: variante para aprobaciones offline sincronizadas después. Si el stock
-- ya no alcanza, el pedido no se descarta ni se confirma en silencio: pasa a
-- conflicto_stock para revisión manual.
create or replace function confirmar_aprobacion_offline(p_pedido_id uuid, p_aprobado_por uuid)
returns estado_pedido
language plpgsql
security definer set search_path = public
as $$
begin
  perform aprobar_pedido(p_pedido_id, p_aprobado_por);
  return 'aprobado';
exception when sqlstate 'P0001' then
  update pedidos set estado = 'conflicto_stock', updated_at = now() where id = p_pedido_id;
  insert into auditoria_pedidos (pedido_id, estado_anterior, estado_nuevo, usuario_id, detalle)
  values (p_pedido_id, 'pendiente_aprobacion', 'conflicto_stock', p_aprobado_por,
          jsonb_build_object('motivo', 'stock insuficiente al sincronizar'));
  return 'conflicto_stock';
end;
$$;

-- DEC-05: cancelar libera de inmediato la reserva de stock asociada.
create or replace function cancelar_pedido(p_pedido_id uuid, p_motivo text, p_usuario uuid) returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_zona_id uuid;
begin
  select zona_id into v_zona_id from pedidos where id = p_pedido_id;
  if v_zona_id is null then
    raise exception 'pedido % no existe', p_pedido_id;
  end if;
  if not (es_admin_o_gerente() or (auth_rol() = 'vendedor' and v_zona_id = auth_zona_id())) then
    raise exception 'no autorizado para cancelar este pedido';
  end if;

  update reservas_stock
    set estado = 'liberada', liberado_at = now(), motivo_liberacion = 'pedido cancelado'
    where estado = 'activa'
      and pedido_linea_id in (select id from pedido_lineas where pedido_id = p_pedido_id);

  update pedidos
    set estado = 'cancelado', cancelado_at = now(), cancelado_motivo = p_motivo, updated_at = now()
    where id = p_pedido_id;

  insert into auditoria_pedidos (pedido_id, estado_anterior, estado_nuevo, usuario_id, detalle)
  values (p_pedido_id, null, 'cancelado', p_usuario, jsonb_build_object('motivo', p_motivo));
end;
$$;

-- RF-26 (DEC-06): cierre manual — contabilidad ingresa el número de documento de
-- World Office al digitarlo, liberando la reserva y confirmando el pedido de inmediato.
create or replace function confirmar_registro_wo(
  p_pedido_id uuid, p_wo_prefijo text, p_wo_documento_numero text, p_usuario uuid
) returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not es_admin_o_gerente() then
    raise exception 'solo un administrador puede cerrar un pedido desde la bandeja de registro';
  end if;

  update reservas_stock
    set estado = 'liberada', liberado_at = now(), motivo_liberacion = 'confirmado en world office'
    where estado = 'activa'
      and pedido_linea_id in (select id from pedido_lineas where pedido_id = p_pedido_id);

  update pedidos
    set estado = 'confirmado_en_wo',
        wo_prefijo = p_wo_prefijo,
        wo_documento_numero = p_wo_documento_numero,
        confirmado_en_wo_at = now(),
        match_nivel = 'nivel_1_manual',
        updated_at = now()
    where id = p_pedido_id;

  insert into auditoria_pedidos (pedido_id, estado_anterior, estado_nuevo, usuario_id, detalle)
  values (p_pedido_id, 'pendiente_registro_wo', 'confirmado_en_wo', p_usuario,
          jsonb_build_object('wo_prefijo', p_wo_prefijo, 'wo_documento_numero', p_wo_documento_numero));
end;
$$;
