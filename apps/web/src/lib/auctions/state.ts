import type { EstadoLote } from '@ganadito/contracts';

// Transporte observado en subastas.types.ts de dde293b. No modifica el contrato compartido.
export interface AuctionSnapshot {
  id: string;
  codigo_lote: string;
  estado: EstadoLote;
  precio_base: number;
  precio_actual: number;
  incremento_minimo: number;
  proxima_puja_minima: number;
  postor_ganador_id: string | null;
  postor_ganador_nombre: string | null;
  tiempo_restante_segundos: number;
  fecha_cierre: string;
  secuencia_maxima: number;
  version: number;
  es_abierta: boolean;
}

export interface AcceptedBid {
  puja_id: string;
  lote_id: string;
  monto: number;
  secuencia: number;
  nueva_version: number;
  nuevo_precio_actual: number;
  extension_aplicada: boolean;
  nueva_fecha_cierre: string;
  idempotency_key: string;
  created_at: string;
}

export interface OrderEvent {
  lote_id: string;
  orden_id: string;
  comprador_id: string;
  organizacion_compradora_id: string;
  organizacion_vendedora_id: string;
  monto_adjudicado: number;
  comision_plataforma: number;
  total_a_pagar: number;
  estado: 'PENDIENTE_PAGO';
}

export interface BidAttempt { lotId: string; amount: number; sessionKey: string; key: string }

export function bidAttempt(
  previous: BidAttempt | null, lotId: string, amount: number, sessionKey: string,
  makeKey: () => string = () => crypto.randomUUID()
): BidAttempt {
  if (previous?.lotId === lotId && previous.amount === amount && previous.sessionKey === sessionKey) return previous;
  return { lotId, amount, sessionKey, key: makeKey() };
}

const states: readonly string[] = ['BORRADOR', 'PUBLICADO', 'ACTIVO', 'CERRADO', 'ADJUDICADO', 'DESIERTO', 'CANCELADO'];
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

export function parseSnapshot(value: unknown, lotId: string): AuctionSnapshot {
  if (!record(value) || value.id !== lotId || !nonempty(value.codigo_lote) ||
    !states.includes(String(value.estado)) || typeof value.es_abierta !== 'boolean' ||
    !['precio_base', 'precio_actual', 'incremento_minimo', 'proxima_puja_minima', 'tiempo_restante_segundos', 'secuencia_maxima', 'version'].every(key => finite(value[key])) ||
    !nonempty(value.fecha_cierre) || !Number.isFinite(Date.parse(value.fecha_cierre)) ||
    !(value.postor_ganador_id === null || nonempty(value.postor_ganador_id)) ||
    !(value.postor_ganador_nombre === null || typeof value.postor_ganador_nombre === 'string')) {
    throw new Error('La respuesta de la API no corresponde al lote solicitado o está incompleta.');
  }
  return value as unknown as AuctionSnapshot;
}

export type AuctionEvent = { kind: 'bid'; data: AcceptedBid } | { kind: 'order'; data: OrderEvent } | { kind: 'refresh' };

export function parseAuctionEvent(value: unknown, lotId: string): AuctionEvent | null {
  if (!record(value) || value.lote_id !== lotId) return null;
  if (nonempty(value.puja_id) && ['monto', 'secuencia', 'nueva_version', 'nuevo_precio_actual'].every(key => finite(value[key])) &&
    nonempty(value.created_at) && nonempty(value.nueva_fecha_cierre)) {
    return { kind: 'bid', data: value as unknown as AcceptedBid };
  }
  if (nonempty(value.orden_id) && nonempty(value.comprador_id) && nonempty(value.organizacion_compradora_id) &&
    nonempty(value.organizacion_vendedora_id) && value.estado === 'PENDIENTE_PAGO' &&
    ['monto_adjudicado', 'comision_plataforma', 'total_a_pagar'].every(key => finite(value[key]))) {
    return { kind: 'order', data: value as unknown as OrderEvent };
  }
  if (value.estado === 'DESIERTO') return { kind: 'refresh' };
  return null;
}
