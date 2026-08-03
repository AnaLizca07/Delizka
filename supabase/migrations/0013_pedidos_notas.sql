-- Campo libre para que el vendedor registre novedades del pedido (p.ej.
-- instrucciones de entrega, acuerdos verbales con el cliente). Puramente
-- informativo, no participa en ninguna regla de negocio.
alter table pedidos add column notas text;
