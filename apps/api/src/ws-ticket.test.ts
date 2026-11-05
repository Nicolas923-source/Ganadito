import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import WebSocket from 'ws';
import { getPool, closePool, runInitialMigration } from './db.js';
import { getRedisSubscriber, closeRedis } from './redis.js';
import { SubastaWsHub } from './subastas/subastas.ws.js';
import { MAX_TICKETS_VIGENTES_POR_USUARIO, consumirTicketWs, permiteAccessTokenEnUrl } from './subastas/ws-tickets.js';
import { buildApp } from './app.js';
import { AuthService } from './auth/auth.service.js';

describe('Ticket efímero de un solo uso para el WebSocket de subastas', { concurrency: 1 }, () => {
  const pool = getPool();
  const redisSubscriber = getRedisSubscriber();
  const wsHub = new SubastaWsHub(redisSubscriber);
  const app = buildApp({ pool, redisSubscriber, wsHub });
  const authService = new AuthService(pool);
  let base: string;
  let token: string;
  let userId: string;
  let loteId: string;
  let otroLoteId: string;
  const lotes: string[] = [];

  async function crearLote(t: string) {
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/subastas',
      headers: { authorization: `Bearer ${t}` },
      payload: {
        codigo_lote: `WS-${crypto.randomUUID().slice(0, 12)}`,
        precio_base: 1000,
        incremento_minimo: 50,
        fecha_cierre: new Date(Date.now() + 3600_000).toISOString()
      }
    });
    assert.equal(r.statusCode, 201, r.body);
    lotes.push(r.json().id);
    return r.json().id as string;
  }

  async function pedirTicket(lote: string, t = token) {
    return app.inject({ method: 'POST', url: `/api/v1/subastas/${lote}/live/ticket`, headers: { authorization: `Bearer ${t}` } });
  }

  /** Abre el socket y devuelve 'SUSCRITO' o el motivo del cierre 1008. */
  async function conectar(lote: string, query: string): Promise<string> {
    const ws = new WebSocket(`${base}/api/v1/subastas/${lote}/live?${query}`);
    const resultado = await new Promise<string>((resolve, reject) => {
      ws.once('close', (codigo, motivo) => resolve(`${codigo}:${motivo.toString()}`));
      ws.once('error', reject);
      ws.once('open', async () => {
        for (let i = 0; i < 50; i++) {
          if (wsHub.getActiveSubscribersCount(lote) > 0) return resolve('SUSCRITO');
          await new Promise((r) => setTimeout(r, 20));
        }
      });
    });
    ws.close();
    for (let i = 0; i < 50 && wsHub.getActiveSubscribersCount(lote) > 0; i++) {
      await new Promise((r) => setTimeout(r, 20));
    }
    return resultado;
  }

  before(async () => {
    await runInitialMigration();
    await app.listen({ port: 0, host: '127.0.0.1' });
    base = `ws://127.0.0.1:${(app.server.address() as any).port}`;
    const email = `ws_ticket_${crypto.randomUUID().slice(0, 8)}@test.com`;
    const reg = await authService.register({ email, password: 'PasswordWs2026!', nombre: 'WS', organizacion_nombre: 'Org WS', rol_inicial: 'VENDEDOR' });
    userId = reg.user.id;
    token = (await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'PasswordWs2026!' } })).json().access_token;
    loteId = await crearLote(token);
    otroLoteId = await crearLote(token);
  });

  after(async () => {
    await pool.query('DELETE FROM lotes_subasta WHERE id = ANY($1::uuid[])', [lotes]);
    await app.close();
    await wsHub.close();
    await closeRedis();
    await closePool();
  });

  test('1. Con sesión se emite un ticket opaco de 30 s, sin caché, y solo se guarda su hash', async () => {
    const r = await pedirTicket(loteId);
    assert.equal(r.statusCode, 201, r.body);
    assert.equal(r.headers['cache-control'], 'no-store');
    const { ticket, expira_en_segundos } = r.json();
    assert.equal(expira_en_segundos, 30);
    assert.ok(ticket.length >= 40);
    const fila = await pool.query('SELECT hash FROM ws_tickets WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId]);
    assert.equal(fila.rows[0].hash, crypto.createHash('sha256').update(ticket).digest('hex'));
    const enClaro = await pool.query('SELECT 1 FROM ws_tickets WHERE hash = $1', [ticket]);
    assert.equal(enClaro.rowCount, 0);
  });

  test('2. Sin sesión no hay ticket (401) y un lote inexistente es 404', async () => {
    const sin = await app.inject({ method: 'POST', url: `/api/v1/subastas/${loteId}/live/ticket` });
    assert.equal(sin.statusCode, 401);
    assert.equal((await pedirTicket(crypto.randomUUID())).statusCode, 404);
    assert.equal((await pedirTicket('no-uuid')).statusCode, 404);
  });

  test('3. El ticket abre el WebSocket una sola vez', async () => {
    const { ticket } = (await pedirTicket(loteId)).json();
    assert.equal(await conectar(loteId, `ticket=${encodeURIComponent(ticket)}`), 'SUSCRITO');
    assert.match(await conectar(loteId, `ticket=${encodeURIComponent(ticket)}`), /^1008:Ticket inválido/);
  });

  test('4. Un ticket de otro lote, vencido o inventado no sirve', async () => {
    const { ticket } = (await pedirTicket(otroLoteId)).json();
    assert.match(await conectar(loteId, `ticket=${encodeURIComponent(ticket)}`), /^1008/);
    // Sigue sin usar: abre su propio lote.
    assert.equal(await conectar(otroLoteId, `ticket=${encodeURIComponent(ticket)}`), 'SUSCRITO');

    const vencido = (await pedirTicket(loteId)).json().ticket;
    await pool.query(
      `UPDATE ws_tickets SET expira_en = clock_timestamp() - interval '1 second' WHERE hash = $1`,
      [crypto.createHash('sha256').update(vencido).digest('hex')]
    );
    assert.match(await conectar(loteId, `ticket=${encodeURIComponent(vencido)}`), /^1008/);
    assert.match(await conectar(loteId, `ticket=${crypto.randomBytes(32).toString('base64url')}`), /^1008/);
  });

  test('5. Dos conexiones simultáneas con el mismo ticket: exactamente una entra', async () => {
    const { ticket } = (await pedirTicket(loteId)).json();
    const consumos = await Promise.all(Array.from({ length: 5 }, () => consumirTicketWs(pool, ticket, loteId)));
    assert.deepEqual(consumos.filter((u) => u !== null), [userId]);
  });

  test('6. Tope de tickets vigentes por usuario: 429 al superarlo', async () => {
    await pool.query('DELETE FROM ws_tickets WHERE user_id = $1', [userId]);
    for (let i = 0; i < MAX_TICKETS_VIGENTES_POR_USUARIO; i++) {
      assert.equal((await pedirTicket(loteId)).statusCode, 201);
    }
    const excedido = await pedirTicket(loteId);
    assert.equal(excedido.statusCode, 429);
    assert.equal(excedido.json().code, 'DEMASIADOS_TICKETS');
    await pool.query('DELETE FROM ws_tickets WHERE user_id = $1', [userId]);
  });

  test('7. ?access_token= (obsoleto) sigue fuera de producción y se rechaza si se desactiva', async () => {
    assert.equal(await conectar(loteId, `access_token=${encodeURIComponent(token)}`), 'SUSCRITO');
    const previo = process.env.WS_PERMITIR_ACCESS_TOKEN_EN_URL;
    process.env.WS_PERMITIR_ACCESS_TOKEN_EN_URL = 'false';
    try {
      assert.match(await conectar(loteId, `access_token=${encodeURIComponent(token)}`), /^1008:access_token en la URL/);
    } finally {
      if (previo === undefined) delete process.env.WS_PERMITIR_ACCESS_TOKEN_EN_URL;
      else process.env.WS_PERMITIR_ACCESS_TOKEN_EN_URL = previo;
    }
    assert.equal(permiteAccessTokenEnUrl({ NODE_ENV: 'production' }), false);
    assert.equal(permiteAccessTokenEnUrl({ NODE_ENV: 'production', WS_PERMITIR_ACCESS_TOKEN_EN_URL: 'true' }), true);
    assert.equal(permiteAccessTokenEnUrl({ NODE_ENV: 'development' }), true);
  });

  test('8. Sin ninguna credencial el socket se cierra con 1008', async () => {
    assert.match(await conectar(loteId, ''), /^1008:Sesión requerida/);
  });
});
