-- Reemplaza el mecanismo de configuración de 0016: `alter database ... set
-- app.settings.*` requiere superusuario, y el rol que usa el SQL Editor de
-- Supabase hospedado no lo tiene (permission denied). En vez de un GUC, la
-- URL y el secreto del webhook se guardan en una tabla de una sola fila.

create table notificaciones_config (
  id boolean primary key default true,
  webhook_url text,
  webhook_secret text,
  constraint notificaciones_config_fila_unica check (id)
);

insert into notificaciones_config (id) values (true);

alter table notificaciones_config enable row level security;

-- Nadie necesita leer esto directo: la función que dispara el webhook es
-- security definer y la lee sin pasar por RLS. Solo admin puede escribirla.
create policy "notificaciones_config_write_admin" on notificaciones_config for all to authenticated
  using (auth_rol() = 'admin')
  with check (auth_rol() = 'admin');

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
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', coalesce(v_secret, '')),
    body := jsonb_build_object('rol', p_rol, 'title', p_title, 'body', p_body, 'url', p_url)
  );
end;
$$;
