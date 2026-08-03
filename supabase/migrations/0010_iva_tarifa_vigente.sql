-- wo_config es de solo lectura para admin (0008); vendedores y clientes necesitan
-- la tarifa de IVA vigente para previsualizar el total del carrito (RF-12) antes
-- de crear el pedido, sin poder leer el resto de wo_config (servidor, credenciales).
create or replace function iva_tarifa_vigente() returns numeric
language sql stable
security definer set search_path = public
as $$
  select iva_tarifa from wo_config where id = 1
$$;

grant execute on function iva_tarifa_vigente() to authenticated;
