-- Bug real y grave: notificar_webhook_push() llamaba a net.http_post() sin
-- capturar errores. Si `pg_net` no está habilitado (schema "net" no existe)
-- o el webhook falla por cualquier razón, la excepción se propagaba hacia
-- arriba y abortaba TODA la transacción que disparó el trigger — es decir,
-- aprobar_pedido() revertía la reserva de stock completa, y el insert de
-- eventos_geolocalizacion también fallaba. Una función de "extra" (avisar al
-- gerente) nunca debe poder tumbar la operación principal (vender, registrar
-- GPS). Se envuelve la llamada en su propio bloque con manejo de excepción:
-- si falla, se ignora en silencio (no hay nada más que hacer del lado de la
-- app) y la transacción original sigue su curso normal.
create or replace function notificar_webhook_push(p_rol text, p_title text, p_body text, p_url text)
returns void
language plpgsql
security definer set search_path = public, net
as $$
declare
  v_url text;
  v_secret text;
begin
  select webhook_url, webhook_secret into v_url, v_secret from notificaciones_config where id = true;
  if v_url is null or v_url = '' then
    return;
  end if;

  begin
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', coalesce(v_secret, '')),
      body := jsonb_build_object('rol', p_rol, 'title', p_title, 'body', p_body, 'url', p_url)
    );
  exception when others then
    raise warning 'notificar_webhook_push: no se pudo enviar el webhook (%), se ignora — % / %', sqlerrm, p_title, p_body;
  end;
end;
$$;
