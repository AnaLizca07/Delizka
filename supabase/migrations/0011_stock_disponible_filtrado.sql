-- El catálogo tiene ~20.000 productos; la pantalla de catálogo/carrito del
-- vendedor (RF-09/RF-11/RF-12) solo necesita la disponibilidad de los productos
-- que aparecen en un resultado de búsqueda puntual, no la tabla completa cada
-- vez que alguien escribe en el buscador. Se reemplaza stock_disponible() por
-- una versión que acepta una lista opcional de inventario_id (null = todos,
-- para uso administrativo/reportes).
drop function if exists stock_disponible();

create or replace function stock_disponible(p_inventario_ids uuid[] default null) returns table (
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
  where p_inventario_ids is null or e.inventario_id = any (p_inventario_ids)
$$;

grant execute on function stock_disponible(uuid[]) to authenticated;
