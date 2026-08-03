-- security definer por la misma razón que auth_rol()/auth_zona_id() (ver 0002):
-- esta función se usa dentro de policies de pedidos/pedido_lineas, y clientes
-- también tiene RLS propia — evita cualquier recursión al evaluarse en cadena.
create or replace function auth_cliente_id() returns uuid
language sql stable
security definer set search_path = public
as $$
  select id from clientes where perfil_id = auth.uid()
$$;

alter table zonas enable row level security;
alter table perfiles enable row level security;
alter table vendedores enable row level security;
alter table plazos_pago enable row level security;
alter table clientes enable row level security;
alter table catalogo_inventario enable row level security;
alter table existencias enable row level security;
alter table pedidos enable row level security;
alter table pedido_lineas enable row level security;
alter table reservas_stock enable row level security;
alter table eventos_geolocalizacion enable row level security;
alter table auditoria_pedidos enable row level security;
alter table wo_config enable row level security;
alter table wo_terceros enable row level security;
alter table wo_cartera enable row level security;
alter table wo_documentos_encabezados enable row level security;
alter table wo_sync_log enable row level security;

-- zonas: cualquier usuario autenticado necesita leerlas (selectores, filtros);
-- solo admin las crea/edita.
create policy "zonas_select" on zonas for select to authenticated using (true);
create policy "zonas_write" on zonas for all to authenticated
  using (auth_rol() = 'admin') with check (auth_rol() = 'admin');

-- perfiles: cada quien ve su propio perfil; admin/gerente ven todos.
create policy "perfiles_select_propio" on perfiles for select to authenticated
  using (id = auth.uid() or es_admin_o_gerente());
create policy "perfiles_write_admin" on perfiles for all to authenticated
  using (auth_rol() = 'admin') with check (auth_rol() = 'admin');

-- vendedores: cada vendedor ve su propia fila; admin/gerente ven todas.
create policy "vendedores_select" on vendedores for select to authenticated
  using (id = auth.uid() or es_admin_o_gerente());
create policy "vendedores_write_admin" on vendedores for all to authenticated
  using (auth_rol() = 'admin') with check (auth_rol() = 'admin');

-- plazos_pago: catálogo visible para todos, editable solo por admin (RF-22).
create policy "plazos_pago_select" on plazos_pago for select to authenticated using (true);
create policy "plazos_pago_write" on plazos_pago for all to authenticated
  using (auth_rol() = 'admin') with check (auth_rol() = 'admin');

-- clientes (RF-02): vendedor ve solo los de su zona; cliente ve solo su propia fila.
create policy "clientes_select" on clientes for select to authenticated
  using (
    es_admin_o_gerente()
    or (auth_rol() = 'vendedor' and zona_id = auth_zona_id())
    or (auth_rol() = 'cliente' and perfil_id = auth.uid())
  );
create policy "clientes_insert_vendedor" on clientes for insert to authenticated
  with check (
    es_admin_o_gerente()
    or (auth_rol() = 'vendedor' and zona_id = auth_zona_id() and vendedor_id = auth.uid())
  );
create policy "clientes_update" on clientes for update to authenticated
  using (
    es_admin_o_gerente()
    or (auth_rol() = 'vendedor' and zona_id = auth_zona_id())
  )
  with check (
    es_admin_o_gerente()
    or (auth_rol() = 'vendedor' and zona_id = auth_zona_id())
  );

-- catálogo y stock (DEC-02): lectura para todos los roles autenticados; la
-- escritura la hace el agente de sincronización con la service role key
-- (bypasa RLS), por eso no hay policy de insert/update/delete aquí.
create policy "catalogo_select" on catalogo_inventario for select to authenticated using (true);
create policy "existencias_select" on existencias for select to authenticated using (true);

-- pedidos (RF-02/RF-12/RF-13): vendedor ve su zona; cliente ve solo los suyos.
create policy "pedidos_select" on pedidos for select to authenticated
  using (
    es_admin_o_gerente()
    or (auth_rol() = 'vendedor' and zona_id = auth_zona_id())
    or (auth_rol() = 'cliente' and cliente_id = auth_cliente_id())
  );
create policy "pedidos_insert" on pedidos for insert to authenticated
  with check (
    estado = 'pendiente_aprobacion'
    and (
      (auth_rol() = 'vendedor' and zona_id = auth_zona_id() and vendedor_id = auth.uid())
      or (auth_rol() = 'cliente' and cliente_id = auth_cliente_id())
    )
  );
-- Edición directa solo mientras el pedido no se ha aprobado; las transiciones de
-- estado (aprobar / cancelar / confirmar en WO) pasan por las funciones RPC
-- `security definer`, no por UPDATE directo.
create policy "pedidos_update_borrador" on pedidos for update to authenticated
  using (
    estado = 'pendiente_aprobacion'
    and (
      es_admin_o_gerente()
      or (auth_rol() = 'vendedor' and zona_id = auth_zona_id())
    )
  )
  with check (estado = 'pendiente_aprobacion');

-- pedido_lineas: mismo alcance que el pedido al que pertenecen.
create policy "pedido_lineas_select" on pedido_lineas for select to authenticated
  using (
    exists (
      select 1 from pedidos p
      where p.id = pedido_lineas.pedido_id
        and (
          es_admin_o_gerente()
          or (auth_rol() = 'vendedor' and p.zona_id = auth_zona_id())
          or (auth_rol() = 'cliente' and p.cliente_id = auth_cliente_id())
        )
    )
  );
create policy "pedido_lineas_write" on pedido_lineas for all to authenticated
  using (
    exists (
      select 1 from pedidos p
      where p.id = pedido_lineas.pedido_id
        and p.estado = 'pendiente_aprobacion'
        and (
          es_admin_o_gerente()
          or (auth_rol() = 'vendedor' and p.zona_id = auth_zona_id())
          or (auth_rol() = 'cliente' and p.cliente_id = auth_cliente_id())
        )
    )
  )
  with check (
    exists (
      select 1 from pedidos p
      where p.id = pedido_lineas.pedido_id and p.estado = 'pendiente_aprobacion'
    )
  );

-- reservas_stock: sin acceso de escritura para usuarios finales (solo las
-- funciones RPC `security definer` las tocan); lectura restringida a
-- administración/gerencia para poder auditar reservas activas.
create policy "reservas_stock_select" on reservas_stock for select to authenticated
  using (es_admin_o_gerente());

-- eventos_geolocalizacion (RF-16): el propio vendedor registra sus eventos;
-- admin/gerente ven todos (mapa de monitoreo, RF-19).
create policy "eventos_geo_select" on eventos_geolocalizacion for select to authenticated
  using (es_admin_o_gerente() or vendedor_id = auth.uid());
create policy "eventos_geo_insert" on eventos_geolocalizacion for insert to authenticated
  with check (vendedor_id = auth.uid());

-- auditoria_pedidos (RF-20): visible para admin/gerente y para el vendedor de esa zona.
create policy "auditoria_select" on auditoria_pedidos for select to authenticated
  using (
    es_admin_o_gerente()
    or exists (
      select 1 from pedidos p
      where p.id = auditoria_pedidos.pedido_id and p.zona_id = auth_zona_id()
    )
  );

-- Integración con World Office: superficie administrativa/gerencial únicamente.
create policy "wo_config_admin" on wo_config for select to authenticated
  using (auth_rol() = 'admin');
create policy "wo_terceros_admin" on wo_terceros for select to authenticated
  using (es_admin_o_gerente());
create policy "wo_documentos_admin" on wo_documentos_encabezados for select to authenticated
  using (es_admin_o_gerente());
create policy "wo_sync_log_admin" on wo_sync_log for select to authenticated
  using (auth_rol() = 'admin');

-- wo_cartera (RF-07): vendedor ve la cartera de sus propios clientes.
create policy "wo_cartera_select" on wo_cartera for select to authenticated
  using (
    es_admin_o_gerente()
    or exists (
      select 1 from clientes c
      where c.id = wo_cartera.cliente_id and c.zona_id = auth_zona_id()
    )
  );

-- Las funciones RPC son `security definer` y validan permisos por sí mismas
-- (ver 0005); aquí solo se controla quién puede invocarlas en absoluto.
revoke execute on function aprobar_pedido(uuid, uuid) from public;
revoke execute on function confirmar_aprobacion_offline(uuid, uuid) from public;
revoke execute on function cancelar_pedido(uuid, text, uuid) from public;
revoke execute on function confirmar_registro_wo(uuid, text, text, uuid) from public;

grant execute on function aprobar_pedido(uuid, uuid) to authenticated;
grant execute on function confirmar_aprobacion_offline(uuid, uuid) to authenticated;
grant execute on function cancelar_pedido(uuid, text, uuid) to authenticated;
grant execute on function confirmar_registro_wo(uuid, text, text, uuid) to authenticated;
