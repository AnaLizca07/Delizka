-- RF-21: dispara el push automático cuando (a) se aprueba una venta o (b) un
-- vendedor hace check-in de inicio de jornada. Llama al endpoint
-- /api/push/notificar de la app vía pg_net (HTTP asíncrono, no bloquea la
-- transacción que lo dispara).
--
-- Requiere, una sola vez, en el SQL Editor de Supabase (no lo puede hacer
-- esta migración porque el valor depende de dónde quede desplegada la app):
--   create extension if not exists pg_net;
--   alter database postgres set app.settings.push_webhook_url = 'https://<tu-dominio>/api/push/notificar';
--   alter database postgres set app.settings.push_webhook_secret = '<el mismo valor de PUSH_WEBHOOK_SECRET en app/.env>';
-- Sin esto, los triggers no fallan (net.http_post con url nula simplemente no
-- hace nada), pero tampoco envían nada — ver nota en memoria del proyecto.

create or replace function notificar_webhook_push(p_rol text, p_title text, p_body text, p_url text)
returns void
language plpgsql
security definer set search_path = public, net
as $$
declare
  v_url text := current_setting('app.settings.push_webhook_url', true);
  v_secret text := current_setting('app.settings.push_webhook_secret', true);
begin
  if v_url is null or v_url = '' then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', coalesce(v_secret, '')),
    body := jsonb_build_object('rol', p_rol, 'title', p_title, 'body', p_body, 'url', p_url)
  );
end;
$$;

create or replace function trg_notificar_venta_aprobada() returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_cliente_nombre text;
begin
  select nombre into v_cliente_nombre from clientes where id = new.cliente_id;
  perform notificar_webhook_push(
    'gerente',
    'Nueva venta aprobada',
    coalesce(v_cliente_nombre, 'Un cliente') || ' — ' || to_char(new.total, 'FM999,999,999') || ' COP',
    '/gerencial'
  );
  return new;
end;
$$;

create trigger notificar_venta_aprobada
  after update of estado on pedidos
  for each row
  when (new.estado = 'aprobado' and old.estado is distinct from 'aprobado')
  execute function trg_notificar_venta_aprobada();

create or replace function trg_notificar_inicio_jornada() returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_vendedor_nombre text;
begin
  select nombre into v_vendedor_nombre from perfiles where id = new.vendedor_id;
  perform notificar_webhook_push(
    'gerente',
    'Inicio de jornada',
    coalesce(v_vendedor_nombre, 'Un vendedor') || ' inició su jornada.',
    '/gerencial/mapa'
  );
  return new;
end;
$$;

create trigger notificar_inicio_jornada
  after insert on eventos_geolocalizacion
  for each row
  when (new.tipo = 'check_in')
  execute function trg_notificar_inicio_jornada();
