-- RF-17: coordenadas aproximadas del cliente (geocodificadas desde su
-- dirección de texto libre) para poder avisar si el vendedor hace check-in
-- lejos de donde debería estar. Nulas hasta que se geocodifique con éxito;
-- nunca bloquea la creación del cliente si la geocodificación falla.
alter table clientes add column lat double precision;
alter table clientes add column lng double precision;
