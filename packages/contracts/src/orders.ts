/**
 * Contratos y máquina de estados del ciclo comercial de Órdenes de Compra.
 *
 * Módulo de Adjudicación y Liquidación Comercial de Subastas en Ganadito.
 */

export const ESTADOS_ORDEN_COMPRA = [
  'PENDIENTE_PAGO',
  'PAGADO',
  'EN_CUSTODIA',
  'ENTREGADO',
  'LIQUIDADO',
  'CANCELADO'
] as const;

export type EstadoOrdenCompra = (typeof ESTADOS_ORDEN_COMPRA)[number];

/**
 * Tasa fija oficial de comisión de la plataforma Ganadito (1.00%).
 */
export const COMISION_PLATAFORMA_PORCENTAJE = 0.01;

/**
 * Entidad Orden de Compra Comercial generada tras la adjudicación de un lote en subasta.
 */
export interface OrdenCompra {
  id: string;
  lote_id: string;
  comprador_id: string;
  organizacion_compradora_id?: string | null;
  vendedor_id?: string | null;
  organizacion_vendedora_id: string;
  monto_adjudicado: number;
  comision_plataforma: number;
  total_a_pagar: number;
  estado: EstadoOrdenCompra;
  created_at: string;
  updated_at: string;
}

/**
 * Resultado financiero del cálculo de liquidación comercial de una subasta.
 */
export interface LiquidacionSubastaCalculo {
  montoAdjudicado: number;
  comisionPlataforma: number;
  totalAPagar: number;
}

/**
 * Calcula con precisión decimal la comisión de la plataforma (1%) y el total a pagar.
 * Redondea estrictamente a 2 decimales para integridad financiera en Soles (PEN).
 */
export function calcularLiquidacionSubasta(
  montoAdjudicado: number,
  tasaComision: number = COMISION_PLATAFORMA_PORCENTAJE
): LiquidacionSubastaCalculo {
  if (typeof montoAdjudicado !== 'number' || isNaN(montoAdjudicado) || montoAdjudicado <= 0) {
    throw new Error('El monto adjudicado debe ser un número positivo.');
  }

  const comisionPlataforma = Math.round(montoAdjudicado * tasaComision * 100) / 100;
  const totalAPagar = Math.round((montoAdjudicado + comisionPlataforma) * 100) / 100;

  return {
    montoAdjudicado,
    comisionPlataforma,
    totalAPagar
  };
}
