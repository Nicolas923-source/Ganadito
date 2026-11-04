import { test, expect, type Page, type WebSocketRoute } from '@playwright/test';
import { installSession } from './fixtures';

const lotId = '1b647cf3-4204-437e-96ab-7a0eb96fab1d';
function snapshot(overrides: Record<string, unknown> = {}) {
  return { id: lotId, codigo_lote: 'LOTE-PRUEBA-101', estado: 'ACTIVO', precio_base: 100,
    precio_actual: 100, incremento_minimo: 10, proxima_puja_minima: 110,
    postor_ganador_id: null, postor_ganador_nombre: null, tiempo_restante_segundos: 3600,
    fecha_cierre: new Date(Date.now() + 3600_000).toISOString(), secuencia_maxima: 0,
    version: 1, es_abierta: true, ...overrides };
}

async function room(page: Page, official: () => Record<string, unknown>) {
  const sockets: WebSocketRoute[] = [];
  const requested: string[] = [];
  await page.route(`**/api/v1/subastas/${lotId}/snapshot`, async route => {
    requested.push(route.request().url());
    await route.fulfill({ json: official() });
  });
  await page.routeWebSocket(`**/api/v1/subastas/${lotId}/live`, socket => { sockets.push(socket); });
  await page.goto(`/subastas/${lotId}`);
  await expect(page.getByRole('heading', { name: 'Sala de subasta' })).toBeVisible();
  return { sockets, requested };
}

test('publication waits for the server and opens only the confirmed lot', async ({ page }) => {
  await installSession(page, { role: 'VENDEDOR', organizationId: 'org-b' });
  let submitted: Record<string, unknown> | undefined;
  let confirm: (() => Promise<void>) | undefined;
  await page.route('**/api/v1/subastas', async route => {
    submitted = route.request().postDataJSON();
    await new Promise<void>(resolve => { confirm = async () => { await route.fulfill({ status: 201, json: { id: lotId, codigo_lote: 'NUEVO-101', estado: 'ACTIVO' } }); resolve(); }; });
  });
  await page.goto('/subastas');
  await page.getByLabel('Código del lote (opcional)').fill('NUEVO-101');
  await page.getByLabel('Precio base (S/)').fill('100');
  await page.getByLabel('Incremento mínimo (S/)').fill('10');
  await page.getByLabel('Fecha y hora local de cierre').fill('2099-12-31T18:00');
  await page.getByRole('button', { name: 'Publicar lote' }).click();
  await expect(page.getByRole('button', { name: 'Esperando confirmación…' })).toBeDisabled();
  await expect(page.getByRole('link', { name: 'Abrir lote publicado' })).toHaveCount(0);
  await expect.poll(() => !!confirm).toBeTruthy();
  expect(submitted).toMatchObject({ codigo_lote: 'NUEVO-101', precio_base: 100, incremento_minimo: 10, estado: 'ACTIVO' });
  expect(submitted).not.toHaveProperty('organizacion_id');
  await confirm!();
  await expect(page.getByRole('link', { name: 'Abrir lote publicado' })).toHaveAttribute('href', `/subastas/${lotId}`);
});

test('the requested lot loads its official snapshot without demo substitutions', async ({ page }) => {
  const { requested } = await room(page, () => snapshot());
  await expect(page.getByRole('heading', { name: 'LOTE-PRUEBA-101' })).toBeVisible();
  await expect(page.getByLabel('Estado oficial del lote').getByText('S/ 100.00', { exact: true })).toHaveCount(2);
  expect(requested.length).toBeGreaterThan(0);
  expect(requested.every(url => new URL(url).pathname === `/api/v1/subastas/${lotId}/snapshot`)).toBeTruthy();
  await expect(page.getByRole('button', { name: 'Confirmar puja' })).toBeDisabled();
});

test('missing and incomplete lots expose errors and never display a sample lot', async ({ page }) => {
  await page.route('**/api/v1/subastas/missing/snapshot', route => route.fulfill({ status: 404, json: { message: 'Lote no encontrado.' } }));
  await page.routeWebSocket('**/api/v1/subastas/*/live', () => {});
  await page.goto('/subastas/missing');
  await expect(page.getByRole('alert')).toContainText('Lote no encontrado.');
  await expect(page.getByLabel('Estado oficial del lote')).toHaveCount(0);
  await room(page, () => ({}));
  await expect(page.getByRole('alert')).toContainText('respuesta de la API');
  await expect(page.getByLabel('Estado oficial del lote')).toHaveCount(0);
});

test('a rejected server bid is never presented as a successful bid', async ({ page }) => {
  await installSession(page);
  await page.route(`**/api/v1/subastas/${lotId}/pujas`, route => route.fulfill({ status: 409, json: { message: 'La puja fue superada por otro postor.' } }));
  await room(page, () => snapshot());
  await expect(page.getByRole('button', { name: 'Confirmar puja' })).toBeEnabled();
  await page.getByLabel('Importe de tu puja (S/)').fill('110');
  await page.getByRole('button', { name: 'Confirmar puja' }).click();
  await expect(page.getByRole('alert')).toContainText('superada');
  await expect(page.getByText(/El servidor confirmó tu puja/)).toHaveCount(0);
  await expect(page.getByLabel('Estado oficial del lote').getByText('S/ 100.00', { exact: true })).toHaveCount(2);
});

test('an uncertain bid retries the same amount and key; a new intention gets a new key', async ({ page }) => {
  await installSession(page);
  let price = 100;
  let sequence = 0;
  const attempts: { amount: number; key: string }[] = [];
  await page.route(`**/api/v1/subastas/${lotId}/pujas`, async route => {
    const body = route.request().postDataJSON();
    attempts.push({ amount: body.monto, key: route.request().headers()['idempotency-key'] });
    if (attempts.length === 1) return route.abort('failed');
    price = body.monto;
    sequence += 1;
    await route.fulfill({ status: 201, json: { puja_id: `bid-${sequence}`, lote_id: lotId,
      monto: body.monto, secuencia: sequence, nueva_version: sequence + 1,
      nuevo_precio_actual: price, extension_aplicada: false,
      nueva_fecha_cierre: new Date(Date.now() + 3600_000).toISOString(),
      idempotency_key: body.idempotency_key, created_at: new Date().toISOString() } });
  });
  await room(page, () => snapshot({ precio_actual: price, proxima_puja_minima: price + 10, secuencia_maxima: sequence, version: sequence + 1 }));
  await page.getByLabel('Importe de tu puja (S/)').fill('110');
  await page.getByRole('button', { name: 'Confirmar puja' }).click();
  await expect(page.getByRole('button', { name: 'Reintentar la misma puja' })).toBeVisible();
  await page.getByRole('button', { name: 'Reintentar la misma puja' }).click();
  await expect(page.getByText(/El servidor confirmó tu puja de S\/ 110.00/)).toBeVisible();
  expect(attempts[1]).toEqual(attempts[0]);
  await expect(page.getByLabel('Estado oficial del lote').getByText('S/ 110.00', { exact: true })).toBeVisible();
  await page.getByLabel('Importe de tu puja (S/)').fill('120');
  await page.getByRole('button', { name: 'Confirmar puja' }).click();
  await expect(page.getByText(/El servidor confirmó tu puja de S\/ 120.00/)).toBeVisible();
  expect(attempts[2].key).not.toBe(attempts[0].key);
  expect(attempts[2].amount).toBe(120);
});

test('reconnection restores the official snapshot; the local clock does not adjudicate', async ({ page }) => {
  await installSession(page);
  let official = snapshot({ tiempo_restante_segundos: 0, es_abierta: false });
  const { sockets, requested } = await room(page, () => official);
  await expect(page.getByText('Esperando la confirmación del cierre por el servidor.')).toBeVisible();
  await expect(page.getByLabel('Estado oficial del lote').getByText('ACTIVO', { exact: true })).toBeVisible();
  await expect(page.getByText('ADJUDICADO', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'En Vivo' })).toBeVisible();
  await expect.poll(() => sockets.length).toBeGreaterThanOrEqual(1);
  const baseline = sockets.length;
  const currentSocket = sockets.at(-1)!;
  const before = requested.length;
  official = snapshot({ precio_actual: 140, proxima_puja_minima: 150, version: 5, secuencia_maxima: 4 });
  await currentSocket.close({ code: 1012, reason: 'Prueba de reconexión' });
  await expect.poll(() => sockets.length, { timeout: 10000 }).toBeGreaterThan(baseline);
  await expect(page.getByLabel('Estado oficial del lote').getByText('S/ 140.00', { exact: true })).toBeVisible();
  expect(requested.length).toBeGreaterThan(before);
  official = snapshot({ estado: 'ADJUDICADO', tiempo_restante_segundos: 0, es_abierta: false });
  sockets.at(-1)!.send(JSON.stringify({ lote_id: lotId, orden_id: 'order-confirmed-a', comprador_id: 'buyer-a',
    organizacion_compradora_id: 'org-a', organizacion_vendedora_id: 'org-b',
    monto_adjudicado: 140, comision_plataforma: 1.4, total_a_pagar: 141.4, estado: 'PENDIENTE_PAGO' }));
  await expect(page.getByLabel('Estado oficial del lote').getByText('ADJUDICADO', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Consultar información de órdenes' }).click();
  await expect(page.getByRole('heading', { name: 'Órdenes de compra' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pago no disponible' })).toBeDisabled();
  await expect(page.getByText('order-confirmed-a', { exact: true })).toBeVisible();
  await expect(page.getByText(/Falta consultar la orden/)).toBeVisible();
});

test('polling lets a slow official query finish instead of cancelling it every ten seconds', async ({ page }) => {
  await page.clock.install();
  let requests = 0;
  let failedQueries = 0;
  let release: (() => void) | undefined;
  let hold = true;
  page.on('requestfailed', request => { if (request.url().endsWith(`/subastas/${lotId}/snapshot`)) failedQueries += 1; });
  await page.route(`**/api/v1/subastas/${lotId}/snapshot`, async route => {
    requests += 1;
    if (hold) await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ json: snapshot() });
  });
  await page.routeWebSocket(`**/api/v1/subastas/${lotId}/live`, () => {});
  await page.goto(`/subastas/${lotId}`);
  await expect.poll(() => requests).toBe(1);
  await page.clock.runFor(11000);
  expect(requests).toBe(1);
  expect(failedQueries).toBe(0);
  hold = false;
  release!();
  await expect(page.getByRole('heading', { name: 'LOTE-PRUEBA-101' })).toBeVisible();
});
