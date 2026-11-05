import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import crypto from 'node:crypto';
import { getPool, closePool, runInitialMigration } from './db.js';
import { buildApp } from './app.js';
import { AuthService } from './auth/auth.service.js';
import { AiClientService } from './integraciones/ai-client.service.js';
import { crearUsuarioConRol } from './test-helpers.js';

const VISTA = {
  puntos: { punta_hombro: [300, 400], punta_nalga: [1000, 400], cruz: [400, 250], pecho_inferior: [400, 600] },
  calibracion: { tipo: 'REFERENCIA', punto_a: [100, 700], punto_b: [600, 700], distancia_cm: 100 }
};

type Modo = 'ok' | 'rechazo' | 'caido' | 'vinculante';

describe('Estimaciones de peso por lote y pesajes de balanza', { concurrency: 1 }, () => {
  const pool = getPool();
  let modo: Modo = 'ok';
  let llamadas: Array<{ url: string; body: any }> = [];
  let satelite: http.Server;

  const aiClient = new AiClientService({ baseUrl: 'http://127.0.0.1:1', timeoutMs: 500, failureThreshold: 3 });
  const app = buildApp({ pool, aiClient });
  const authService = new AuthService(pool);

  let vendedor: { token: string; orgId: string };
  let otroVendedor: { token: string };
  let comprador: { token: string };
  let admin: { token: string };
  const lotesCreados: string[] = [];

  function respuestaSatelite(peso: number, nVistas: number) {
    const base = {
      peso_estimado_kg: peso,
      rango_min_kg: Math.round(peso * 0.82 * 10) / 10,
      rango_max_kg: Math.round(peso * 1.21 * 10) / 10,
      metodo: 'ZOOMETRIA_SCHAEFFER_V1',
      version_parametros: '2026-11-04-supuestos',
      es_vinculante: modo === 'vinculante',
      validado: false,
      advertencias: ['Estimación orientativa: no es un pesaje y puede equivocarse.'],
      incertidumbre: { nivel_confianza: 0.9, desviacion_log: 0.12, coeficiente_variacion: 0.12, n_simulaciones: 4000, semilla: 1, contribuciones: [] },
      estado: 'COMPLETADO'
    };
    const muestra = { largo_corporal_cm: 140, profundidad_pecho_cm: 70, perimetro_toracico_cm: 183.7 };
    const calidad = [{ codigo: 'PERFIL', estado: 'OK', valor: 0, umbral: '<= 20 grados', detalle: '' }];
    if (nVistas === 1) return { ...base, muestra, calidad };
    return { ...base, vistas: Array.from({ length: nVistas }, (_, i) => ({ indice: i, muestra, calidad })) };
  }

  async function registrar(rol: 'VENDEDOR' | 'COMPRADOR', etiqueta: string) {
    const email = `peso_${etiqueta}_${crypto.randomUUID().slice(0, 8)}@test.com`;
    const password = 'PasswordPeso2026!';
    const reg = await authService.register({ email, password, nombre: etiqueta, organizacion_nombre: `Org ${etiqueta}`, rol_inicial: rol });
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password } });
    return { token: login.json().access_token as string, orgId: reg.activeContext.organizacion_id };
  }

  async function crearLote(token: string, extra: Record<string, unknown> = {}) {
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/subastas',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        codigo_lote: `PESO-${crypto.randomUUID().slice(0, 12)}`,
        precio_base: 5000,
        incremento_minimo: 100,
        fecha_inicio: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        fecha_cierre: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        estado: 'ACTIVO',
        ...extra
      }
    });
    assert.equal(r.statusCode, 201, r.body);
    lotesCreados.push(r.json().id);
    return r.json().id as string;
  }

  function estimar(loteId: string, token: string, body: unknown, clave?: string) {
    return app.inject({
      method: 'POST',
      url: `/api/v1/subastas/${loteId}/estimaciones-peso`,
      headers: { authorization: `Bearer ${token}`, ...(clave ? { 'idempotency-key': clave } : {}) },
      payload: body as any
    });
  }

  async function contar(loteId: string) {
    const r = await pool.query('SELECT count(*)::int AS n FROM estimaciones_peso WHERE lote_id = $1', [loteId]);
    return r.rows[0].n as number;
  }

  before(async () => {
    await runInitialMigration();
    satelite = http.createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(Buffer.from(c));
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      llamadas.push({ url: req.url ?? '', body });
      res.setHeader('Content-Type', 'application/json');
      if (modo === 'caido') {
        res.writeHead(500);
        return res.end('{"detail":"boom"}');
      }
      if (modo === 'rechazo') {
        res.writeHead(422);
        return res.end(JSON.stringify({ detail: [{ loc: ['body', 'imagen_base64'], msg: 'inválido', input: 'A'.repeat(5000) }] }));
      }
      if (req.url === '/api/v1/peso/evaluar') {
        res.writeHead(200);
        return res.end(JSON.stringify({ metricas: { n: body.pares.length }, propuesta: { aplicado: false } }));
      }
      const nVistas = req.url === '/api/v1/peso/estimar-multivista' ? body.vistas.length : 1;
      res.writeHead(200);
      res.end(JSON.stringify(respuestaSatelite(436.3, nVistas)));
    });
    await new Promise<void>((ok) => satelite.listen(0, '127.0.0.1', () => ok()));
    aiClient.setBaseUrl(`http://127.0.0.1:${(satelite.address() as AddressInfo).port}`);
    await app.ready();

    vendedor = await registrar('VENDEDOR', 'vendedor');
    otroVendedor = await registrar('VENDEDOR', 'otro');
    comprador = await registrar('COMPRADOR', 'comprador');
    admin = await crearUsuarioConRol(app, authService, 'ADMIN', 'peso');
  });

  after(async () => {
    if (lotesCreados.length) await pool.query('DELETE FROM lotes_subasta WHERE id = ANY($1::uuid[])', [lotesCreados]);
    await app.close();
    await closePool();
    await new Promise<void>((ok) => satelite.close(() => ok()));
  });

  test('1. El vendedor guarda una estimación no vinculante y el resumen suma el lote', async () => {
    modo = 'ok';
    const lote = await crearLote(vendedor.token);
    const r1 = await estimar(lote, vendedor.token, { identificador_animal: 'PE-001', vistas: [VISTA] });
    assert.equal(r1.statusCode, 201, r1.body);
    const e1 = r1.json();
    assert.equal(e1.es_vinculante, false);
    assert.equal(e1.peso_estimado_kg, 436.3);
    assert.equal(e1.numero_vistas, 1);
    assert.equal(e1.tiene_pesaje, false);
    assert.equal(llamadas.at(-1)!.url, '/api/v1/peso/estimar');

    const r2 = await estimar(lote, vendedor.token, { identificador_animal: 'PE-002', vistas: [VISTA, VISTA] });
    assert.equal(r2.statusCode, 201, r2.body);
    assert.equal(llamadas.at(-1)!.url, '/api/v1/peso/estimar-multivista');
    assert.equal(r2.json().numero_vistas, 2);

    // La muestra se guarda (para calibrar), pero la imagen nunca.
    const fila = await pool.query('SELECT muestra FROM estimaciones_peso WHERE id = $1', [r2.json().id]);
    assert.equal(fila.rows[0].muestra.vistas.length, 2);
    assert.ok(!JSON.stringify(fila.rows[0].muestra).includes('imagen_base64'));

    const resumen = await app.inject({ method: 'GET', url: `/api/v1/subastas/${lote}/estimaciones-peso` });
    assert.equal(resumen.statusCode, 200);
    const d = resumen.json();
    assert.equal(d.numero_estimaciones, 2);
    assert.equal(d.peso_total_estimado_kg, 872.6);
    assert.deepEqual(d.rango_total_conservador_kg, [2 * e1.rango_min_kg, 2 * e1.rango_max_kg]);
    assert.equal(d.es_vinculante, false);
    assert.match(d.advertencia, /no es un pesaje/);
  });

  test('2. Idempotency-Key: reintento devuelve la misma estimación; otro cuerpo con la misma clave es 409', async () => {
    modo = 'ok';
    const lote = await crearLote(vendedor.token);
    const clave = crypto.randomUUID();
    const a = await estimar(lote, vendedor.token, { vistas: [VISTA] }, clave);
    const llamadasAntes = llamadas.length;
    const b = await estimar(lote, vendedor.token, { vistas: [VISTA] }, clave);
    assert.equal(a.statusCode, 201);
    assert.equal(b.statusCode, 200);
    assert.equal(b.headers['idempotent-replayed'], 'true');
    assert.equal(b.json().id, a.json().id);
    assert.equal(llamadas.length, llamadasAntes, 'el reintento no vuelve a llamar a la IA');

    const c = await estimar(lote, vendedor.token, { vistas: [VISTA, VISTA] }, clave);
    assert.equal(c.statusCode, 409);
    assert.equal(c.json().code, 'IDEMPOTENCIA_CONFLICTO');
    assert.equal(await contar(lote), 1);
  });

  test('3. Solo el vendedor dueño: otro vendedor 403, comprador 403, sin token 401', async () => {
    const lote = await crearLote(vendedor.token);
    assert.equal((await estimar(lote, otroVendedor.token, { vistas: [VISTA] })).json().code, 'LOTE_AJENO');
    assert.equal((await estimar(lote, comprador.token, { vistas: [VISTA] })).statusCode, 403);
    const sinToken = await app.inject({ method: 'POST', url: `/api/v1/subastas/${lote}/estimaciones-peso`, payload: { vistas: [VISTA] } });
    assert.equal(sinToken.statusCode, 401);
    assert.equal(await contar(lote), 0);
  });

  test('4. Con la subasta ya iniciada no se agregan estimaciones (información congelada)', async () => {
    modo = 'ok';
    const lote = await crearLote(vendedor.token, { fecha_inicio: new Date(Date.now() - 60 * 1000).toISOString() });
    const r = await estimar(lote, vendedor.token, { vistas: [VISTA] });
    assert.equal(r.statusCode, 409);
    assert.equal(r.json().code, 'LOTE_NO_EDITABLE');
    assert.equal(await contar(lote), 0);
  });

  test('5. Rechazo del satélite: 422 sin eco de la entrada y sin abrir el circuito', async () => {
    modo = 'rechazo';
    const lote = await crearLote(vendedor.token);
    for (let i = 0; i < 4; i++) {
      const r = await estimar(lote, vendedor.token, { vistas: [VISTA] });
      assert.equal(r.statusCode, 422);
      assert.equal(r.json().code, 'IA_RECHAZO');
      assert.ok(!r.body.includes('AAAAAAAAAA'), 'no se devuelve el input del satélite');
    }
    assert.equal(aiClient.getCircuitState(), 'CLOSED');
    assert.equal(await contar(lote), 0);
  });

  test('6. Satélite caído: 503 y nada guardado; nunca se inventa un peso', async () => {
    modo = 'caido';
    const lote = await crearLote(vendedor.token);
    const r = await estimar(lote, vendedor.token, { vistas: [VISTA] });
    assert.equal(r.statusCode, 503);
    assert.equal(r.json().code, 'IA_NO_DISPONIBLE');
    assert.equal(await contar(lote), 0);
    aiClient.resetCircuit();
  });

  test('7. Una respuesta "vinculante" del satélite se rechaza con 502 y la base también lo impide', async () => {
    modo = 'vinculante';
    const lote = await crearLote(vendedor.token);
    const r = await estimar(lote, vendedor.token, { vistas: [VISTA] });
    assert.equal(r.statusCode, 502);
    assert.equal(await contar(lote), 0);

    await assert.rejects(
      pool.query(
        `INSERT INTO estimaciones_peso (lote_id, organizacion_id, metodo, version_parametros, peso_estimado_kg,
           rango_min_kg, rango_max_kg, nivel_confianza, es_vinculante, muestra, incertidumbre, calidad)
         VALUES ($1, $2, 'X', 'v', 400, 350, 450, 0.9, TRUE, '{}', '{}', '[]')`,
        [lote, vendedor.orgId]
      ),
      /check constraint/i
    );
  });

  test('8. Entrada inválida (400) y animal duplicado en el lote (409)', async () => {
    modo = 'ok';
    const lote = await crearLote(vendedor.token);
    assert.equal((await estimar(lote, vendedor.token, { vistas: [] })).statusCode, 400);
    assert.equal((await estimar(lote, vendedor.token, { vistas: Array(5).fill(VISTA) })).statusCode, 400);
    assert.equal((await estimar(lote, vendedor.token, { vistas: [{ ...VISTA, puntos: { cruz: [1, 2] } }] })).statusCode, 400);
    assert.equal((await estimar(lote, vendedor.token, { identificador_animal: 'PE-9', vistas: [VISTA] })).statusCode, 201);
    const dup = await estimar(lote, vendedor.token, { identificador_animal: 'PE-9', vistas: [VISTA] });
    assert.equal(dup.statusCode, 409);
    assert.equal(dup.json().code, 'ANIMAL_DUPLICADO');
  });

  test('9. Pesaje de balanza: solo personal interno, uno por estimación, con error relativo', async () => {
    modo = 'ok';
    const lote = await crearLote(vendedor.token);
    const est = (await estimar(lote, vendedor.token, { vistas: [VISTA] })).json();
    const url = `/api/v1/estimaciones-peso/${est.id}/pesaje`;
    const cuerpo = { peso_real_kg: 410, perimetro_cinta_cm: 181, balanza_descripcion: 'Balanza camal piloto (calibrada)' };

    const delVendedor = await app.inject({ method: 'POST', url, headers: { authorization: `Bearer ${vendedor.token}` }, payload: cuerpo });
    assert.equal(delVendedor.statusCode, 403, 'el vendedor no pesa su propio ganado');

    const ok = await app.inject({ method: 'POST', url, headers: { authorization: `Bearer ${admin.token}` }, payload: cuerpo });
    assert.equal(ok.statusCode, 201, ok.body);
    assert.equal(ok.json().error_relativo, Math.round(((436.3 - 410) / 410) * 10000) / 10000);
    assert.equal(ok.json().dentro_del_rango, true);

    const dup = await app.inject({ method: 'POST', url, headers: { authorization: `Bearer ${admin.token}` }, payload: cuerpo });
    assert.equal(dup.statusCode, 409);

    const inexistente = await app.inject({
      method: 'POST',
      url: `/api/v1/estimaciones-peso/${crypto.randomUUID()}/pesaje`,
      headers: { authorization: `Bearer ${admin.token}` },
      payload: cuerpo
    });
    assert.equal(inexistente.statusCode, 404);
    const malId = await app.inject({ method: 'POST', url: '/api/v1/estimaciones-peso/no-uuid/pesaje', headers: { authorization: `Bearer ${admin.token}` }, payload: cuerpo });
    assert.equal(malId.statusCode, 404);

    const resumen = (await app.inject({ method: 'GET', url: `/api/v1/subastas/${lote}/estimaciones-peso` })).json();
    assert.equal(resumen.estimaciones[0].tiene_pesaje, true);
  });

  test('10. Evaluación: solo ADMIN/AUDITOR y reenvía los pares con medidas y cinta', async () => {
    modo = 'ok';
    const prohibido = await app.inject({ method: 'GET', url: '/api/v1/estimaciones-peso/evaluacion', headers: { authorization: `Bearer ${vendedor.token}` } });
    assert.equal(prohibido.statusCode, 403);

    const r = await app.inject({ method: 'GET', url: '/api/v1/estimaciones-peso/evaluacion', headers: { authorization: `Bearer ${admin.token}` } });
    assert.equal(r.statusCode, 200, r.body);
    const ultima = llamadas.at(-1)!;
    assert.equal(ultima.url, '/api/v1/peso/evaluar');
    const par = ultima.body.pares.find((p: any) => p.perimetro_cinta_cm === 181);
    assert.ok(par, 'incluye el pesaje del test 9');
    assert.equal(par.largo_corporal_cm, 140);
    assert.equal(par.profundidad_pecho_cm, 70);
    assert.equal(r.json().evaluacion.propuesta.aplicado, false);
  });
});
