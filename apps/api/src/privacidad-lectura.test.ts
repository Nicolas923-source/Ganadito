import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { getPool, closePool, runInitialMigration } from './db.js';
import { buildApp } from './app.js';
import { AuthService } from './auth/auth.service.js';

describe('N05: privacidad de ubicación en mapa y vista pública del pasaporte', { concurrency: 1 }, () => {
  const pool = getPool();
  const app = buildApp({ pool });
  const authService = new AuthService(pool);
  const password = 'PasswordPrivacidad2026!';

  // Punto aislado (selva de Loreto) para no mezclarse con otros datos de prueba.
  const BASE = { lat: -4.123456 - Math.random() * 0.5, lon: -75.654321 - Math.random() * 0.5 };
  let duenoToken: string;
  let ajenoToken: string;
  let establoId: string;
  let camalId: string;

  const auth = (t: string) => ({ authorization: `Bearer ${t}` });

  async function registrar(prefijo: string) {
    const s = crypto.randomUUID().slice(0, 8);
    const email = `${prefijo}_${s}@test.com`;
    await authService.register({ email, password, nombre: `${prefijo} ${s}`, organizacion_nombre: `${prefijo} ${s}`, rol_inicial: 'VENDEDOR' });
    const r = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password } });
    return r.json().access_token as string;
  }

  async function crear(token: string, tipo: string, dLat: number) {
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/establecimientos',
      headers: auth(token),
      payload: {
        nombre_comercial: `${tipo} privacidad ${crypto.randomUUID().slice(0, 6)}`,
        tipo,
        latitud: BASE.lat + dLat,
        longitud: BASE.lon,
        direccion_texto: 'Fundo La Esperanza km 12',
        ubigeo: '160101'
      }
    });
    assert.strictEqual(r.statusCode, 201, r.body);
    return r.json().id as string;
  }

  async function buscar(headers: Record<string, string> = {}) {
    const r = await app.inject({
      method: 'GET',
      url: `/api/v1/establecimientos/cercanos?lat=${BASE.lat}&lon=${BASE.lon}&radio_km=20&limit=100`,
      headers
    });
    assert.strictEqual(r.statusCode, 200);
    return r.json().establecimientos as any[];
  }

  before(async () => {
    await runInitialMigration();
    await app.ready();
    duenoToken = await registrar('priv_dueno');
    ajenoToken = await registrar('priv_ajeno');
    establoId = await crear(duenoToken, 'ESTABLO', 0.001234);
    camalId = await crear(duenoToken, 'CAMAL', 0.002345);
  });

  after(async () => {
    await pool.query('DELETE FROM establecimientos WHERE id = ANY($1::uuid[])', [[establoId, camalId]]).catch(() => {});
    await app.close();
    await closePool();
  });

  test('1. La organización dueña ve la ubicación exacta y la dirección de su establo', async () => {
    const e = (await buscar(auth(duenoToken))).find((x) => x.id === establoId);
    assert.ok(e);
    assert.strictEqual(e.ubicacion_aproximada, false);
    assert.ok(Math.abs(e.latitud - (BASE.lat + 0.001234)) < 1e-9);
    assert.strictEqual(e.direccion_texto, 'Fundo La Esperanza km 12');
  });

  test('2. Anónimos y otras organizaciones reciben ubicación aproximada (rejilla 0.01°) sin dirección', async () => {
    for (const headers of [{}, auth(ajenoToken)]) {
      const lista = await buscar(headers);
      const e = lista.find((x) => x.id === establoId);
      assert.ok(e, 'El establo sigue apareciendo en la búsqueda');
      assert.strictEqual(e.ubicacion_aproximada, true);
      assert.strictEqual(e.direccion_texto, null);
      assert.ok(Math.abs(e.latitud * 100 - Math.round(e.latitud * 100)) < 1e-6, `lat ${e.latitud} no está en la rejilla`);
      assert.ok(Math.abs(e.longitud * 100 - Math.round(e.longitud * 100)) < 1e-6);

      // Un establecimiento público (CAMAL) mantiene la ubicación exacta.
      const c = lista.find((x) => x.id === camalId);
      assert.strictEqual(c.ubicacion_aproximada, false);
      assert.ok(Math.abs(c.latitud - (BASE.lat + 0.002345)) < 1e-9);
    }
  });

  test('3. Un token inválido en la ruta pública responde 401 (no se degrada a anónimo)', async () => {
    const r = await app.inject({
      method: 'GET',
      url: `/api/v1/establecimientos/cercanos?lat=${BASE.lat}&lon=${BASE.lon}`,
      headers: { authorization: 'Bearer invalido' }
    });
    assert.strictEqual(r.statusCode, 401);
  });

  test('4. Pasaporte: vista pública sin autor ni metadata sensible; el dueño ve la vista completa; la integridad se mantiene', async () => {
    const bov = await app.inject({
      method: 'POST',
      url: '/api/v1/trazabilidad/bovinos',
      headers: auth(duenoToken),
      payload: { codigo_arete: `PE-PRIV-${crypto.randomUUID().slice(0, 10)}`, raza: 'Gyr', sexo: 'HEMBRA' }
    });
    assert.strictEqual(bov.statusCode, 201);
    const bovinoId = bov.json().bovino.id;

    const ev = await app.inject({
      method: 'POST',
      url: `/api/v1/trazabilidad/bovinos/${bovinoId}/eventos`,
      headers: auth(duenoToken),
      payload: { event_type: 'MOVILIZACION_CSTI', metadata: { gps: { lat: -4.1, lon: -75.6 }, destino: 'Feria Iquitos', dni_conductor: '12345678' } }
    });
    assert.strictEqual(ev.statusCode, 201);

    const publico = (await app.inject({ method: 'GET', url: `/api/v1/trazabilidad/bovinos/${bovinoId}/pasaporte` })).json();
    assert.strictEqual(publico.vista, 'PUBLICA');
    const mov = publico.eventos.find((e: any) => e.event_type === 'MOVILIZACION_CSTI');
    assert.strictEqual(mov.autor_id, null);
    assert.strictEqual(mov.metadata.gps, '[REDACTADO]');
    assert.strictEqual(mov.metadata.dni_conductor, '[REDACTADO]');
    assert.strictEqual(mov.metadata.destino, 'Feria Iquitos');

    const ajeno = (await app.inject({ method: 'GET', url: `/api/v1/trazabilidad/bovinos/${bovinoId}/pasaporte`, headers: auth(ajenoToken) })).json();
    assert.strictEqual(ajeno.vista, 'PUBLICA');

    const dueno = (await app.inject({ method: 'GET', url: `/api/v1/trazabilidad/bovinos/${bovinoId}/pasaporte`, headers: auth(duenoToken) })).json();
    assert.strictEqual(dueno.vista, 'COMPLETA');
    assert.deepStrictEqual(dueno.eventos.find((e: any) => e.event_type === 'MOVILIZACION_CSTI').metadata.gps, { lat: -4.1, lon: -75.6 });

    const verif = (await app.inject({ method: 'GET', url: `/api/v1/trazabilidad/bovinos/${bovinoId}/verificar` })).json();
    assert.strictEqual(verif.integro, true);
  });
});
