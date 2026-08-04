-- Gap real: wo_cartera_select (0008) solo cubría admin/gerente/vendedor de la
-- zona. El rol cliente no tenía ninguna policy de select sobre su propia
-- cartera, así que la pantalla de "Inicio y cartera" del cliente (portal
-- móvil) no podía leer nada — RLS lo bloqueaba en silencio (0 filas, sin error).
create policy "wo_cartera_select_cliente" on wo_cartera for select to authenticated
  using (auth_rol() = 'cliente' and cliente_id = auth_cliente_id());
