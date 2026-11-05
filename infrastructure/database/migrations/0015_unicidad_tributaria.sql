-- Migración 0015: un comprobante vigente por orden y tipo, y un factoring vigente por
-- comprobante. Antes se podían emitir varias liquidaciones de compra por la misma orden
-- y ceder la misma factura varias veces (doble factoring). Los RECHAZADO no cuentan.

CREATE UNIQUE INDEX IF NOT EXISTS uq_comprobante_vigente_por_orden
  ON comprobantes_tributarios(orden_id, tipo_comprobante)
  WHERE estado_sunat <> 'RECHAZADO';

CREATE UNIQUE INDEX IF NOT EXISTS uq_factoring_vigente_por_comprobante
  ON factoring_cavali_solicitudes(comprobante_id)
  WHERE estado <> 'RECHAZADO';
