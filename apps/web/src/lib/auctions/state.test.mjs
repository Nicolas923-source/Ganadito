import test from 'node:test';
import assert from 'node:assert/strict';
const { bidAttempt, parseSnapshot, parseAuctionEvent } = await import(new URL('./state.ts', import.meta.url).href);

test('an uncertain bid reuses its key only for the same lot, amount and session', () => {
  const first = bidAttempt(null, 'lot-a', 150, 'session-a', () => 'key-a');
  assert.equal(bidAttempt(first, 'lot-a', 150, 'session-a', () => 'unexpected'), first);
  assert.equal(bidAttempt(first, 'lot-a', 160, 'session-a', () => 'key-b').key, 'key-b');
  assert.equal(bidAttempt(first, 'lot-b', 150, 'session-a', () => 'key-c').key, 'key-c');
  assert.equal(bidAttempt(first, 'lot-a', 150, 'session-b', () => 'key-d').key, 'key-d');
});

test('an unrelated or malformed snapshot never becomes the requested lot', () => {
  const snapshot = { id: 'lot-a', codigo_lote: 'A', estado: 'ACTIVO', precio_base: 100,
    precio_actual: 110, incremento_minimo: 10, proxima_puja_minima: 120,
    postor_ganador_id: null, postor_ganador_nombre: null, tiempo_restante_segundos: 40,
    fecha_cierre: '2026-11-05T12:00:00Z', secuencia_maxima: 1, version: 2, es_abierta: true };
  assert.equal(parseSnapshot(snapshot, 'lot-a').id, 'lot-a');
  assert.throws(() => parseSnapshot(snapshot, 'lot-b'), /respuesta/i);
  assert.throws(() => parseSnapshot({ ...snapshot, precio_actual: Infinity }, 'lot-a'), /respuesta/i);
  assert.throws(() => parseSnapshot({ ...snapshot, estado: 'INVENTADO' }, 'lot-a'), /respuesta/i);
});

test('only events for the requested lot with valid server identifiers are accepted', () => {
  const closure = { lote_id: 'lot-a', orden_id: 'order-a', comprador_id: 'buyer',
    organizacion_compradora_id: 'org-a', organizacion_vendedora_id: 'org-b',
    monto_adjudicado: 100, comision_plataforma: 1, total_a_pagar: 101, estado: 'PENDIENTE_PAGO' };
  assert.equal(parseAuctionEvent(closure, 'lot-a')?.kind, 'order');
  assert.equal(parseAuctionEvent(closure, 'lot-b'), null);
  assert.equal(parseAuctionEvent({ ...closure, orden_id: '' }, 'lot-a'), null);
  assert.equal(parseAuctionEvent({ ...closure, total_a_pagar: '101' }, 'lot-a'), null);
  assert.equal(parseAuctionEvent({ lote_id: 'lot-a', estado: 'PAGADO' }, 'lot-a'), null);
});
