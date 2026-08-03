-- Bug real encontrado probando el auto-pedido del cliente (RF-13): el trigger
-- recalcular_totales_pedido hace un UPDATE sobre `pedidos` desde un trigger en
-- `pedido_lineas`. Sin `security definer`, ese UPDATE corre con los permisos
-- de quien insertó la línea — y la policy de UPDATE de `pedidos`
-- (pedidos_update_borrador) no incluye al rol `cliente`, así que la
-- actualización se filtraba en silencio (0 filas afectadas, sin error) y el
-- pedido quedaba con subtotal/iva/total en 0 aunque la línea sí tuviera el
-- valor correcto. Mismo patrón que auth_rol()/auth_zona_id() en 0002: un
-- trigger que cruza a otra tabla con RLS propia debe ser security definer.
create or replace function calcular_subtotal_linea() returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.subtotal_linea := round(new.cantidad * new.precio_unitario, 2);
  return new;
end;
$$;

create or replace function recalcular_totales_pedido() returns trigger
language plpgsql
security definer set search_path = public
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
