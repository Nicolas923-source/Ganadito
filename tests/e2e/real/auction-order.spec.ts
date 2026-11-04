import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { assertIsolatedRealEnvironment } from './environment.mjs';

assertIsolatedRealEnvironment(process.env);

const api = 'http://127.0.0.1:4181/api/v1';
const authorization = (token: string) => ({ Authorization: `Bearer ${token}` });
const money = (amount: number) => new Intl.NumberFormat('es-PE', {
  minimumFractionDigits: 2, maximumFractionDigits: 2
}).format(amount);

async function registerBuyer(request: APIRequestContext, suffix: string) {
  const account = {
    email: `${suffix}-${randomUUID()}@example.test`, password: `${randomUUID()}-fixture`,
    nombre: `Persona ficticia ${suffix}`, organizacion_nombre: `Organización ficticia ${suffix}`,
    rol_inicial: 'COMPRADOR'
  };
  const response = await request.post(`${api}/auth/register`, { data: account });
  expect(response.status()).toBe(201);
  const session = await response.json();
  expect(session.active_context.rol).toBe('COMPRADOR');
  return { ...account, token: session.access_token as string, organizationId: session.active_context.organizacion_id as string };
}

test('registro y publicación web, puja persistida, cierre automático y orden autorizada real', async ({ page, request }) => {
  const run = randomUUID();
  const seller = {
    email: `seller-${run}@example.test`, password: `${randomUUID()}-fixture`,
    name: 'Vendedora ficticia de integración', organization: `Establo ficticio ${run.slice(0, 8)}`
  };
  const socketUrls: string[] = [];
  page.on('websocket', socket => socketUrls.push(socket.url()));

  const health = await request.get('http://127.0.0.1:4181/health');
  expect(health.status()).toBe(200);
  expect((await health.json()).db).toBe('ok');

  await page.goto('/acceso');
  await page.getByRole('button', { name: 'Crear una cuenta', exact: true }).click();
  await page.getByLabel('Nombre', { exact: true }).fill(seller.name);
  await page.getByLabel('Nombre de la organización', { exact: true }).fill(seller.organization);
  await page.getByRole('combobox', { name: 'Quiero operar como', exact: true }).selectOption('VENDEDOR');
  await page.getByLabel('Correo electrónico').fill(seller.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(seller.password);
  const registered = page.waitForResponse(response => response.url().endsWith('/api/v1/auth/register') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  const registration = await registered;
  expect(registration.status()).toBe(201);
  const sellerSession = await registration.json();
  expect(sellerSession.active_context.rol).toBe('VENDEDOR');
  await expect(page).toHaveURL(/\/contexto$/);
  await expect(page.getByText('Organización activa:')).toContainText(seller.organization);
  await expect(page.getByText('Rol activo:')).toContainText('VENDEDOR');

  await page.getByRole('link', { name: 'Ir a subastas' }).click();
  const uiCode = `WEB-${run.slice(0, 8)}`;
  await page.getByLabel('Código del lote (opcional)').fill(uiCode);
  await page.getByLabel('Precio base (S/)').fill('4200');
  await page.getByLabel('Incremento mínimo (S/)').fill('100');
  await page.getByLabel('Fecha y hora local de cierre').fill(new Date(Date.now() + 10 * 60_000).toISOString().slice(0, 16));
  const published = page.waitForResponse(response => response.url().endsWith('/api/v1/subastas') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Publicar lote', exact: true }).click();
  const publication = await published;
  expect(publication.status()).toBe(201);
  const uiLot = await publication.json();
  expect(uiLot.vendedor_id).toBe(sellerSession.active_context.organizacion_id);
  await expect(page.getByRole('status')).toContainText(`El servidor confirmó el lote ${uiCode}`);
  await page.getByRole('link', { name: 'Abrir lote publicado' }).click();
  await expect(page.getByRole('region', { name: 'Estado oficial del lote' })).toContainText(uiCode);
  const uiSnapshot = await request.get(`${api}/subastas/${uiLot.id}/snapshot`);
  expect(uiSnapshot.status()).toBe(200);
  expect((await uiSnapshot.json()).precio_actual).toBe(4200);

  const buyer = await registerBuyer(request, 'comprador');
  const outsider = await registerBuyer(request, 'ajeno');
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await page.goto('/acceso');
  await page.getByLabel('Correo electrónico').fill(buyer.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(buyer.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/contexto$/);
  await expect(page.getByText('Rol activo:')).toContainText('COMPRADOR');
  const shortCode = `CIERRE-${run.slice(0, 8)}`;
  const shortPublication = await request.post(`${api}/subastas`, {
    headers: authorization(sellerSession.access_token),
    data: {
      codigo_lote: shortCode, precio_base: 4500, incremento_minimo: 100,
      fecha_inicio: new Date(Date.now() - 1_000).toISOString(),
      fecha_cierre: new Date(Date.now() + 30_000).toISOString(),
      anti_sniping_seconds: 0, anti_sniping_extension: 0, estado: 'ACTIVO'
    }
  });
  expect(shortPublication.status()).toBe(201);
  const lot = await shortPublication.json();
  const initialResponse = await request.get(`${api}/subastas/${lot.id}/snapshot`);
  expect(initialResponse.status()).toBe(200);
  const initial = await initialResponse.json();
  expect(initial.es_abierta).toBe(true);
  await page.goto(`/subastas/${lot.id}`);
  await expect(page.getByText('Actualización periódica', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar puja', exact: true })).toBeEnabled();
  await page.getByLabel('Importe de tu puja (S/)').fill(String(initial.proxima_puja_minima));
  const bidResponse = page.waitForResponse(response => response.url().endsWith(`/subastas/${lot.id}/pujas`) && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Confirmar puja', exact: true }).click();
  const accepted = await bidResponse;
  expect(accepted.status()).toBe(201);
  const receipt = await accepted.json();
  await expect(page.getByRole('status').filter({ hasText: 'El servidor confirmó tu puja' })).toBeVisible();
  const key = accepted.request().headers()['idempotency-key'];
  expect(typeof key).toBe('string');
  expect(receipt.idempotency_key).toBe(key);
  const bidOptions = {
    headers: { ...authorization(buyer.token), 'Idempotency-Key': key },
    data: { monto: initial.proxima_puja_minima }
  };
  expect(receipt.monto).toBe(initial.proxima_puja_minima);
  expect(receipt.extension_aplicada).toBe(false);
  const retried = await request.post(`${api}/subastas/${lot.id}/pujas`, bidOptions);
  expect(retried.status()).toBe(201);
  expect(await retried.json()).toEqual(receipt);
  const afterBid = await request.get(`${api}/subastas/${lot.id}/snapshot`);
  expect(afterBid.status()).toBe(200);
  const officialBid = await afterBid.json();
  expect(officialBid.precio_actual).toBe(receipt.nuevo_precio_actual);
  expect(officialBid.secuencia_maxima).toBe(receipt.secuencia);

  // Wait for the real worker and PostgreSQL transaction. No browser timer or test SQL closes the lot.
  await expect.poll(async () => {
    const response = await request.get(`${api}/subastas/${lot.id}/snapshot`);
    expect(response.status()).toBe(200);
    return (await response.json()).estado;
  }, { timeout: 45_000, intervals: [500, 1_000] }).toBe('ADJUDICADO');
  const listingResponse = await request.get(`${api}/ordenes?rol=comprador&limit=20`, { headers: authorization(buyer.token) });
  expect(listingResponse.status()).toBe(200);
  const listing = await listingResponse.json();
  const matching = listing.data.filter((order: { lote_id: string }) => order.lote_id === lot.id);
  expect(matching).toHaveLength(1);
  const order = matching[0];
  expect(order.estado).toBe('PENDIENTE_PAGO');
  expect(order.organizacion_compradora_id).toBe(buyer.organizationId);
  expect(order.organizacion_vendedora_id).toBe(sellerSession.active_context.organizacion_id);
  expect(order.monto_adjudicado).toBe(receipt.monto);
  for (const amount of [order.monto_adjudicado, order.comision_plataforma, order.total_a_pagar]) {
    expect(typeof amount).toBe('number');
    expect(Number.isFinite(amount)).toBe(true);
  }
  const detail = await request.get(`${api}/ordenes/${order.id}`, { headers: authorization(buyer.token) });
  expect(detail.status()).toBe(200);
  expect(await detail.json()).toEqual(order);
  const forbidden = await request.get(`${api}/ordenes/${order.id}`, { headers: authorization(outsider.token) });
  const nonexistent = await request.get(`${api}/ordenes/${randomUUID()}`, { headers: authorization(outsider.token) });
  expect(forbidden.status()).toBe(404);
  expect(nonexistent.status()).toBe(404);
  expect(await forbidden.json()).toEqual(await nonexistent.json());

  const checkout = await request.post(`${api}/pagos/checkout`);
  expect(checkout.status()).toBe(503);
  expect((await checkout.json()).error).toBe('PagosDeshabilitados');

  await expect(page.getByRole('region', { name: 'Estado oficial del lote' })).toContainText('ADJUDICADO', { timeout: 15_000 });
  await page.getByRole('link', { name: 'Consultar información de órdenes', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/ordenes\\?lote_id=${lot.id}$`));
  const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: shortCode, exact: true }) });
  await expect(card).toContainText('PENDIENTE_PAGO');
  await expect(card).toContainText(money(order.total_a_pagar));
  await expect(page.getByRole('button', { name: 'Pago no disponible', exact: true })).toBeDisabled();
  await card.getByRole('link', { name: `Ver orden ${shortCode}`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/ordenes/${order.id}$`));
  for (const [label, value] of [
    ['Monto adjudicado', order.monto_adjudicado],
    ['Comisión de plataforma', order.comision_plataforma],
    ['Total a pagar', order.total_a_pagar]
  ] as const) {
    await expect(page.locator('dl div').filter({ has: page.getByText(label, { exact: true }) }).locator('dd')).toHaveText(money(value));
  }
  await expect(page.getByRole('button', { name: 'Pago no disponible', exact: true })).toBeDisabled();
  // HTTP mode must not expose a JWT in a WebSocket URL while the backend fix is pending.
  expect(socketUrls.some(url => /\/api\/v1\/subastas\//.test(url))).toBe(false);
});
