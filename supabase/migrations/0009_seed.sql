-- RF-06: opciones de plazo de pago con las que arranca el negocio; el admin
-- puede agregar/editar desde el panel (RF-22) sin tocar código.
insert into plazos_pago (dias, etiqueta) values
  (0, 'Contado'),
  (8, '8 días'),
  (15, '15 días'),
  (30, '30 días'),
  (45, '45 días');

-- zonas, vendedores y clientes reales los carga el negocio desde el panel
-- administrativo (RF-23); no se siembran datos de ejemplo aquí.
