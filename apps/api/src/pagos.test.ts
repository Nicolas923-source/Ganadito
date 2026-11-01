import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { getPool, closePool, runInitialMigration } from './db.js';
import { buildApp } from './app.js';
import { AuthService } from './auth/auth.service.js';
import { SubastasCloserService } from './subastas/subastas-closer.service.js';
import { generateHmacSignature } from './pagos/pagos.service.js';

describe('Módulo de Pagos, Webhooks HMAC e Idempotencia Financiera', { concurrency: 1 }, () => {
  const pool = getPool();
  const app = buildApp({ pool });
  const authService = new AuthService(pool);
  const closerService = new SubastasCloserService(pool);

  const webhookSecret =
    process.env.WEBHOOK_SECRET ?? 'ganadito_webhook_secret_dev_32_bytes_min';

  let vendedorToken: string;
  let compradorToken: string;
  let compradorUserId: string;

  let ordenId: string;
  let transaccionId: string;
  let referenciaExterna: string;
  const montoOrden = 4545.0; // 4500 adjudicado + 45 comision (1%)

  before(async () => {
    await runInitialMigration();
    await app.ready();

    // 1. Crear Vendedor
    const vRes = await authService.register({
      email: `vendedor_pagos_${Date.now()}@test.com`,
      password: 'PasswordPagos2026!',
      nombre: 'Ganadería La Pradera SAC',
      organizacion_nombre: `La Pradera SAC ${Date.now()}`,
      rol_inicial: 'VENDEDOR'
    });
    const vLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: vRes.user.email, password: 'PasswordPagos2026!' }
    });
    vendedorToken = vLogin.json().access_token;

    // 2. Crear Comprador
    const cRes = await authService.register({
      email: `comprador_pagos_${Date.now()}@test.com`,
      password: 'PasswordPagos2026!',
      nombre: 'Distribuidora San Jorge EIRL',
      organizacion_nombre: `San Jorge EIRL ${Date.now()}`,
      rol_inicial: 'COMPRADOR'
    });
    compradorUserId = cRes.user.id;
    const cLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: cRes.user.email, password: 'PasswordPagos2026!' }
    });
    compradorToken = cLogin.json().access_token;

    // 3. Crear lote de subasta, emitir puja y liquidar para obtener orden_compra
    const loteRes = await app.inject({
      method: 'POST',
      url: '/api/v1/subastas',
      headers: { authorization: `Bearer ${vendedorToken}` },
      payload: {
        titulo: 'Lote Nelore para Pago Test',
        precio_base: 4000,
        incremento_minimo: 100,
        fecha_cierre: new Date(Date.now() + 600000).toISOString()
      }
    });
    const loteId = loteRes.json().id;

    // Puja ganadora
    await app.inject({
      method: 'POST',
      url: `/api/v1/subastas/${loteId}/pujas`,
      headers: {
        authorization: `Bearer ${compradorToken}`,
        'idempotency-key': `bid-pay-${Date.now()}`
      },
      payload: { monto: 4500 }
    });

    // Expirar fecha de cierre y liquidar
    await pool.query(
      `UPDATE lotes_subasta SET fecha_cierre = NOW() - INTERVAL '5 seconds' WHERE id = $1`,
      [loteId]
    );
    await closerService.cerrarLotesExpirados(100);

    // Obtener la orden de compra generada
    const ordenRes = await pool.query<{ id: string; total_a_pagar: string | number; estado: string }>(
      `SELECT id, total_a_pagar, estado FROM ordenes_compra WHERE lote_id = $1`,
      [loteId]
    );
    assert.strictEqual(ordenRes.rows.length, 1);
    ordenId = ordenRes.rows[0]!.id;
    assert.strictEqual(ordenRes.rows[0]!.estado, 'PENDIENTE_PAGO');
  });

  after(async () => {
    await app.close();
    await closePool();
  });

  test('1. Iniciar checkout (POST /api/v1/pagos/checkout) genera URL y transacción en estado INICIADO', async () => {
    // 1.1 Rechazo sin autenticación
    const unauthRes = await app.inject({
      method: 'POST',
      url: '/api/v1/pagos/checkout',
      payload: { orden_id: ordenId }
    });
    assert.strictEqual(unauthRes.statusCode, 401);

    // 1.2 Checkout autorizado por el comprador
    const checkoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/pagos/checkout',
      headers: { authorization: `Bearer ${compradorToken}` },
      payload: {
        orden_id: ordenId,
        proveedor: 'NIUBIZ'
      }
    });

    assert.strictEqual(checkoutRes.statusCode, 201);
    const body = checkoutRes.json();

    assert.ok(body.transaccion_id, 'Debe generar transaccion_id UUID');
    assert.ok(body.referencia_externa, 'Debe generar referencia_externa única');
    assert.ok(body.checkout_url.startsWith('https://checkout.ganadito.com/pay/'));
    assert.strictEqual(body.estado, 'INICIADO');
    assert.strictEqual(body.proveedor, 'NIUBIZ');
    assert.strictEqual(Number(body.monto), montoOrden);

    transaccionId = body.transaccion_id;
    referenciaExterna = body.referencia_externa;

    // Verificar inserción en base de datos
    const txCheck = await pool.query<{ estado: string; monto: string | number }>(
      `SELECT estado, monto FROM pagos_transacciones WHERE id = $1`,
      [transaccionId]
    );
    assert.strictEqual(txCheck.rows[0]?.estado, 'INICIADO');
  });

  test('2. Rechazo HTTP 401 si el webhook no incluye la firma HMAC o la firma es inválida', async () => {
    const payload = {
      evento: 'pago.confirmado',
      referencia_externa: referenciaExterna,
      transaccion_id: transaccionId,
      monto: montoOrden,
      moneda: 'PEN',
      estado: 'CONFIRMADO',
      timestamp: Date.now()
    };
    const rawBody = JSON.stringify(payload);

    // 2.1 Sin cabecera x-signature
    const noSigRes = await app.inject({
      method: 'POST',
      url: '/api/v1/pagos/webhook',
      headers: {
        'content-type': 'application/json',
        'x-timestamp': String(payload.timestamp)
      },
      payload: rawBody
    });
    assert.strictEqual(noSigRes.statusCode, 401);
    assert.match(noSigRes.json().message, /Firma HMAC requerida/);

    // 2.2 Con firma HMAC falsa / adulterada
    const badSigRes = await app.inject({
      method: 'POST',
      url: '/api/v1/pagos/webhook',
      headers: {
        'content-type': 'application/json',
        'x-signature': '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        'x-timestamp': String(payload.timestamp)
      },
      payload: rawBody
    });
    assert.strictEqual(badSigRes.statusCode, 401);
    assert.match(badSigRes.json().message, /Firma HMAC inválida/);
  });

  test('3. Rechazo HTTP 401 si el timestamp del webhook está expirado (Anti-Replay > 5 minutos)', async () => {
    // Timestamp de hace 10 minutos (600,000 ms en el pasado)
    const timestampExpirado = Date.now() - 10 * 60 * 1000;
    const payload = {
      evento: 'pago.confirmado',
      referencia_externa: referenciaExterna,
      transaccion_id: transaccionId,
      monto: montoOrden,
      moneda: 'PEN',
      estado: 'CONFIRMADO',
      timestamp: timestampExpirado
    };
    const rawBody = JSON.stringify(payload);
    const signature = generateHmacSignature(rawBody, webhookSecret, timestampExpirado);

    const expiredRes = await app.inject({
      method: 'POST',
      url: '/api/v1/pagos/webhook',
      headers: {
        'content-type': 'application/json',
        'x-signature': signature,
        'x-timestamp': String(timestampExpirado)
      },
      payload: rawBody
    });

    assert.strictEqual(expiredRes.statusCode, 401);
    assert.match(expiredRes.json().message, /Timestamp expirado/);
  });

  test('4. Procesamiento exitoso de webhook con firma válida: actualiza transacción a CONFIRMADO, orden a PAGADO y emite Outbox', async () => {
    const timestampValido = Date.now();
    const payload = {
      evento: 'pago.confirmado',
      referencia_externa: referenciaExterna,
      transaccion_id: transaccionId,
      monto: montoOrden,
      moneda: 'PEN',
      estado: 'CONFIRMADO',
      timestamp: timestampValido
    };
    const rawBody = JSON.stringify(payload);
    const signature = generateHmacSignature(rawBody, webhookSecret, timestampValido);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/pagos/webhook',
      headers: {
        'content-type': 'application/json',
        'x-signature': signature,
        'x-timestamp': String(timestampValido)
      },
      payload: rawBody
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.status, 'success');
    assert.strictEqual(body.estado, 'CONFIRMADO');
    assert.strictEqual(body.idempotente, false);

    // 4.1 Verificar que pagos_transacciones cambió a CONFIRMADO
    const txCheck = await pool.query<{ estado: string; raw_webhook: any }>(
      `SELECT estado, raw_webhook FROM pagos_transacciones WHERE id = $1`,
      [transaccionId]
    );
    assert.strictEqual(txCheck.rows[0]?.estado, 'CONFIRMADO');
    assert.ok(txCheck.rows[0]?.raw_webhook);

    // 4.2 Verificar que ordenes_compra cambió a PAGADO
    const ordenCheck = await pool.query<{ estado: string }>(
      `SELECT estado FROM ordenes_compra WHERE id = $1`,
      [ordenId]
    );
    assert.strictEqual(ordenCheck.rows[0]?.estado, 'PAGADO');

    // 4.3 Verificar evento ORDEN_PAGADA en outbox_events
    const outboxCheck = await pool.query<{ event_type: string; payload: any }>(
      `SELECT event_type, payload
       FROM outbox_events
       WHERE aggregate_id = $1 AND event_type = 'ORDEN_PAGADA'`,
      [ordenId]
    );
    assert.strictEqual(outboxCheck.rows.length, 1);
    assert.strictEqual(outboxCheck.rows[0]!.event_type, 'ORDEN_PAGADA');
    assert.strictEqual(outboxCheck.rows[0]!.payload.orden_id, ordenId);
    assert.strictEqual(outboxCheck.rows[0]!.payload.transaccion_id, transaccionId);
    assert.strictEqual(Number(outboxCheck.rows[0]!.payload.monto), montoOrden);
  });

  test('5. Idempotencia Financiera: envío duplicado del webhook responde HTTP 200 sin duplicar registros ni emitir eventos Outbox adicionales', async () => {
    // Contar eventos previos en outbox_events para esta orden
    const countBeforeRes = await pool.query<{ count: string }>(
      `SELECT count(*) FROM outbox_events WHERE aggregate_id = $1 AND event_type = 'ORDEN_PAGADA'`,
      [ordenId]
    );
    const eventosPrevios = Number(countBeforeRes.rows[0]!.count);
    assert.strictEqual(eventosPrevios, 1, 'Debe haber exactamente 1 evento previo');

    // Reenviar exactamente el mismo webhook válido
    const timestampValido = Date.now();
    const payload = {
      evento: 'pago.confirmado',
      referencia_externa: referenciaExterna,
      transaccion_id: transaccionId,
      monto: montoOrden,
      moneda: 'PEN',
      estado: 'CONFIRMADO',
      timestamp: timestampValido
    };
    const rawBody = JSON.stringify(payload);
    const signature = generateHmacSignature(rawBody, webhookSecret, timestampValido);

    const dupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/pagos/webhook',
      headers: {
        'content-type': 'application/json',
        'x-signature': signature,
        'x-timestamp': String(timestampValido)
      },
      payload: rawBody
    });

    assert.strictEqual(dupRes.statusCode, 200);
    const body = dupRes.json();
    assert.strictEqual(body.status, 'success');
    assert.strictEqual(body.estado, 'CONFIRMADO');
    assert.strictEqual(body.idempotente, true, 'Debe marcar la respuesta como idempotente');

    // Verificar que NO se crearon eventos adicionales en outbox_events
    const countAfterRes = await pool.query<{ count: string }>(
      `SELECT count(*) FROM outbox_events WHERE aggregate_id = $1 AND event_type = 'ORDEN_PAGADA'`,
      [ordenId]
    );
    const eventosPosteriores = Number(countAfterRes.rows[0]!.count);
    assert.strictEqual(
      eventosPosteriores,
      1,
      'El número de eventos en Outbox debe mantenerse inalterado (estrictamente 1)'
    );

    // Verificar que no se duplicaron transacciones
    const txCountRes = await pool.query<{ count: string }>(
      `SELECT count(*) FROM pagos_transacciones WHERE referencia_externa = $1`,
      [referenciaExterna]
    );
    assert.strictEqual(Number(txCountRes.rows[0]!.count), 1);
  });
});
