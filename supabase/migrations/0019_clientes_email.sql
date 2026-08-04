-- Correo real del cliente, para enviarle el recibo del pedido por Brevo.
-- Distinto del correo sintético de `perfiles`/`auth.users` (ese es solo para
-- iniciar sesión en la PWA, no sirve para recibir nada). Opcional: muchos
-- clientes no lo tendrán al principio y el envío del recibo simplemente se
-- omite en ese caso.
alter table clientes add column email text;
