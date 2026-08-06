-- RF-27 (DEC-06/DEC-07): reconciliación automática de respaldo (nivel 2).
-- El mecanismo principal sigue siendo confirmar_registro_wo (nivel 1: contabilidad
-- digita el número de documento). Esta función es la red de seguridad para los
-- pedidos que nadie cerró a mano: busca en wo_documentos_encabezados (espejo de
-- Vista_Tabla_Encabezados) un documento del mismo cliente, con fecha cercana a
-- aprobado_at (±3 días) y monto igual (con una tolerancia chica por redondeo).
--
-- Si hay un único candidato, se confirma solo (match_nivel = 'nivel_2_automatico').
-- Si hay más de uno, no se confirma nada: el pedido queda en revision_manual con
-- los candidatos guardados en posibles_matches, y se reintenta en cada corrida
-- (normalmente se autorresuelve cuando el candidato sobrante deja de calificar,
-- por ejemplo porque alguien cerró el otro pedido a mano).
--
-- Esta función la llama el agente de sincronización con la service_role key, o
-- un humano desde el SQL Editor para depurar un caso puntual — nunca la app.
-- Por eso NO se otorga a `authenticated`: a diferencia de las demás RPC de
-- pedidos, no tiene sentido un chequeo de rol tipo es_admin_o_gerente() aquí,
-- porque bajo la service_role key no hay auth.uid() ni fila en `perfiles`.

create or replace function reconciliar_pedidos_nivel2() returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_pedido record;
  v_candidatos jsonb;
  v_num_candidatos int;
  v_prefijo text;
  v_numero_documento text;
  v_id_asiento text;
  v_total_wo numeric(14, 2);
  v_tolerancia constant numeric(14, 2) := 5.00;
  v_tipo_documento constant text := 'FV';
  v_confirmados int := 0;
  v_marcados_revision int := 0;
begin
  for v_pedido in
    select p.id, p.estado, p.aprobado_at, p.total, p.posibles_matches,
           c.identificacion as cliente_identificacion
    from pedidos p
    join clientes c on c.id = p.cliente_id
    where p.estado in ('aprobado', 'revision_manual')
      and p.aprobado_at is not null
  loop
    select
      count(*),
      jsonb_agg(
        jsonb_build_object(
          'id_asiento_contable', d.id_asiento_contable,
          'prefijo', d.prefijo,
          'numero_documento', d.numero_documento,
          'fecha', d.fecha,
          'total', d.total
        )
        order by d.id_asiento_contable
      )
      into v_num_candidatos, v_candidatos
      from wo_documentos_encabezados d
      where d.tipo_documento = v_tipo_documento
        and regexp_replace(coalesce(v_pedido.cliente_identificacion, ''), '[^0-9]', '', 'g') <> ''
        and regexp_replace(coalesce(d.wo_identificacion_tercero, ''), '[^0-9]', '', 'g')
              = regexp_replace(v_pedido.cliente_identificacion, '[^0-9]', '', 'g')
        and d.fecha between (v_pedido.aprobado_at::date - 3) and (v_pedido.aprobado_at::date + 3)
        and abs(d.total - v_pedido.total) <= v_tolerancia
        and not exists (
          select 1 from pedidos p2
          where p2.estado = 'confirmado_en_wo'
            and p2.wo_documento_numero = d.numero_documento
            and p2.wo_prefijo is not distinct from d.prefijo
        );

    if v_num_candidatos is null or v_num_candidatos = 0 then
      -- sin match: no se toca nada, queda para la próxima corrida o cierre manual.
      continue;

    elsif v_num_candidatos = 1 then
      v_id_asiento := v_candidatos->0->>'id_asiento_contable';
      v_prefijo := v_candidatos->0->>'prefijo';
      v_numero_documento := v_candidatos->0->>'numero_documento';
      v_total_wo := (v_candidatos->0->>'total')::numeric;

      update reservas_stock
        set estado = 'liberada', liberado_at = now(),
            motivo_liberacion = 'confirmado por reconciliación automática (nivel 2)'
        where estado = 'activa'
          and pedido_linea_id in (select id from pedido_lineas where pedido_id = v_pedido.id);

      update pedidos
        set estado = 'confirmado_en_wo',
            wo_prefijo = v_prefijo,
            wo_documento_numero = v_numero_documento,
            confirmado_en_wo_at = now(),
            match_nivel = 'nivel_2_automatico',
            match_confianza = 1.00,
            posibles_matches = null,
            diferencias = jsonb_build_object('diferencia_monto', v_total_wo - v_pedido.total),
            updated_at = now()
        where id = v_pedido.id;

      insert into auditoria_pedidos (pedido_id, estado_anterior, estado_nuevo, usuario_id, detalle)
      values (v_pedido.id, v_pedido.estado, 'confirmado_en_wo', null,
              jsonb_build_object('mecanismo', 'reconciliacion_nivel_2', 'id_asiento_contable', v_id_asiento));

      v_confirmados := v_confirmados + 1;

    else
      -- más de un candidato: no se auto-confirma nada. Si ya estaba en
      -- revision_manual con exactamente este mismo conjunto de candidatos, no
      -- se repite la actualización ni se duplica el registro de auditoría.
      if v_pedido.estado = 'revision_manual' and v_pedido.posibles_matches = v_candidatos then
        continue;
      end if;

      update pedidos
        set estado = 'revision_manual',
            posibles_matches = v_candidatos,
            updated_at = now()
        where id = v_pedido.id;

      insert into auditoria_pedidos (pedido_id, estado_anterior, estado_nuevo, usuario_id, detalle)
      values (v_pedido.id, v_pedido.estado, 'revision_manual', null,
              jsonb_build_object('mecanismo', 'reconciliacion_nivel_2', 'candidatos', v_num_candidatos));

      v_marcados_revision := v_marcados_revision + 1;
    end if;
  end loop;

  return jsonb_build_object('auto_confirmados', v_confirmados, 'marcados_revision_manual', v_marcados_revision);
end;
$$;

revoke execute on function reconciliar_pedidos_nivel2() from public;
