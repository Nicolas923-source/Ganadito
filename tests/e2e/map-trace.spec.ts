import { test, expect, type Page } from '@playwright/test';
import { installSession } from './fixtures';

async function blockMapTiles(page: Page) {
  await page.route('https://*.tile.openstreetmap.org/**', route => route.abort());
}

test('los errores de mapa y Spot quedan visibles sin sustituirse por datos ficticios', async ({ page }) => {
  await blockMapTiles(page);
  await page.route('**/api/v1/establecimientos/cercanos?**', route => route.fulfill({ status: 503, json: { message: 'Mapa temporalmente no disponible' } }));
  await page.route('**/api/v1/cotizaciones/pizarra?**', route => route.fulfill({ status: 503, json: { message: 'Precios temporalmente no disponibles' } }));
  await page.goto('/');
  await expect(page.getByRole('alert').filter({ hasText: 'Mapa temporalmente no disponible' })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'Precios temporalmente no disponibles' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Mapa de establecimientos' }).getByRole('listitem')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Pizarra Spot' }).getByRole('listitem')).toHaveCount(0);
  await expect(page.getByText('Ganado Vacuno en Pie', { exact: true })).toHaveCount(0);
});

test('la consulta envía filtros geográficos y comerciales reales y conserva los resultados vacíos', async ({ page }) => {
  await blockMapTiles(page);
  await page.route('**/api/v1/establecimientos/cercanos?**', route => route.fulfill({ json: { total: 0, establecimientos: [] } }));
  await page.route('**/api/v1/cotizaciones/pizarra?**', route => route.fulfill({ json: { total: 0, cotizaciones: [] } }));
  await page.goto('/');
  await expect(page.getByText('No se encontraron establecimientos para esta consulta.')).toBeVisible();
  await expect(page.getByText('No hay cotizaciones disponibles para esta consulta.')).toBeVisible();
  await page.getByLabel('Latitud del centro').fill('-13.5');
  await page.getByLabel('Longitud del centro').fill('-72.1');
  await page.getByLabel('Radio del mapa (km)').fill('25');
  await page.getByLabel('Tipo de establecimiento').selectOption('ESTABLO');
  await page.getByLabel('Producto Spot').selectOption('CARNE_EN_CANAL');
  await page.getByLabel('Categoría Spot').fill('TORETE');
  await page.getByLabel('Calidad Spot').fill('PRIMERA');
  await page.getByLabel('Ubigeo Spot').fill('150101');
  const [mapa, spot] = await Promise.all([
    page.waitForRequest(request => request.url().includes('/establecimientos/cercanos?') && new URL(request.url()).searchParams.get('radio_km') === '25'),
    page.waitForRequest(request => request.url().includes('/cotizaciones/pizarra?') && new URL(request.url()).searchParams.get('producto') === 'CARNE_EN_CANAL'),
    page.getByRole('button', { name: 'Consultar mercado', exact: true }).click()
  ]);
  const geo = new URL(mapa.url()).searchParams;
  expect(Object.fromEntries(geo)).toEqual({ lat: '-13.5', lon: '-72.1', radio_km: '25', tipo: 'ESTABLO', limit: '50', offset: '0' });
  const comercial = new URL(spot.url()).searchParams;
  expect(Object.fromEntries(comercial)).toEqual({ producto: 'CARNE_EN_CANAL', categoria: 'TORETE', calidad: 'PRIMERA', ubigeo: '150101', limit: '50', offset: '0' });
  await expect(page.getByText('No se encontraron establecimientos para esta consulta.')).toBeVisible();
  await expect(page.getByText('No hay cotizaciones disponibles para esta consulta.')).toBeVisible();
});

test('el pasaporte usa el identificador solicitado y la auditoría refleja el resultado de la API', async ({ page }) => {
  await installSession(page);
  const ids: string[] = [];
  await page.route('**/api/v1/trazabilidad/bovinos/*/pasaporte', route => {
    const id = new URL(route.request().url()).pathname.split('/').at(-2)!;
    ids.push(id);
    return route.fulfill({ json: {
      bovino: { id, codigo_arete: 'ARETE-' + id, organizacion_id: 'org-a', raza: null, sexo: 'MACHO', fecha_nacimiento: null, estado: 'VIVO' },
      eventos: []
    } });
  });
  await page.route('**/api/v1/trazabilidad/bovinos/cow-17/verificar', route => route.fulfill({ json: { integro: false, total_eventos: 2, secuencia_corrupta: 2, detalle: 'La secuencia 2 no coincide.' } }));
  await page.goto('/trazabilidad/cow-17');
  await expect(page.getByRole('heading', { name: 'ARETE-cow-17', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Verificar cadena', exact: true }).click();
  await expect(page.getByText('El servidor detectó una inconsistencia en la cadena.')).toBeVisible();
  await expect(page.getByText('La secuencia 2 no coincide.')).toBeVisible();
  await page.goto('/trazabilidad/cow-18');
  await expect(page.getByRole('heading', { name: 'ARETE-cow-18', exact: true })).toBeVisible();
  await expect(page.getByText('ARETE-cow-17', { exact: true })).toHaveCount(0);
  expect(ids).toContain('cow-17');
  expect(ids).toContain('cow-18');
});

test('un rechazo de trazabilidad no muestra el pasaporte y la vista pública no consulta datos privados', async ({ page }) => {
  await installSession(page);
  let consultas = 0;
  await page.route('**/api/v1/trazabilidad/bovinos/*/pasaporte', route => {
    consultas++;
    return route.fulfill({ status: 403, json: { message: 'Bovino de otra organización.' } });
  });
  await page.goto('/trazabilidad/ajeno');
  await expect(page.getByRole('alert').filter({ hasText: 'Acceso denegado' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Verificar cadena', exact: true })).toHaveCount(0);
  await page.goto('/trazabilidad/ajeno/publico');
  await expect(page.getByRole('heading', { name: 'Consulta pública no disponible' })).toBeVisible();
  expect(consultas).toBe(1);
});

test('los nombres del mapa se muestran como texto y no ejecutan HTML recibido por la API', async ({ page }) => {
  await blockMapTiles(page);
  const nombre = '<img src=x onerror="window.__mapXss=1">';
  await page.route('**/api/v1/establecimientos/cercanos?**', route => route.fulfill({ json: { total: 1, establecimientos: [
    { id: 'est-safe', nombre_comercial: nombre, tipo: 'ESTABLO', latitud: -12.04, longitud: -77.03, direccion_texto: '<script>window.__mapXss=2</script>', distancia_km: 1.5 }
  ] } }));
  await page.route('**/api/v1/cotizaciones/pizarra?**', route => route.fulfill({ json: { total: 0, cotizaciones: [] } }));
  await page.goto('/');
  await page.getByRole('button').filter({ hasText: nombre }).click();
  const popup = page.locator('.leaflet-popup-content');
  await expect(popup).toContainText(nombre);
  await expect(popup.locator('img,script')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __mapXss?: number }).__mapXss)).toBeUndefined();
});

test('las respuestas malformadas se rechazan con un error visible sin romper el navegador', async ({ page }) => {
  const erroresDelNavegador: string[] = [];
  page.on('pageerror', error => erroresDelNavegador.push(error.message));
  await blockMapTiles(page);
  await installSession(page);
  await page.route('**/api/v1/establecimientos/cercanos?**', route => route.fulfill({ json: { establecimientos: [null] } }));
  await page.route('**/api/v1/cotizaciones/pizarra?**', route => route.fulfill({ json: { cotizaciones: [{ id: 'invalid-price', producto: null }] } }));
  await page.goto('/');
  await expect(page.getByRole('alert').filter({ hasText: 'La API no devolvió una lista de establecimientos válida.' })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'La API no devolvió una lista de cotizaciones válida.' })).toBeVisible();
  await page.route('**/api/v1/trazabilidad/bovinos/cow-invalid/pasaporte', route => route.fulfill({ json: {
    bovino: { id: 'cow-invalid', codigo_arete: 'ARETE-INVALIDO', organizacion_id: 'org-a', raza: null, sexo: 'MACHO', fecha_nacimiento: null, estado: 'VIVO' },
    eventos: [{ bovino_id: 'cow-invalid', secuencia: 1, event_type: 'PESAJE', metadata: {} }]
  } }));
  await page.goto('/trazabilidad/cow-invalid');
  await expect(page.getByRole('alert').filter({ hasText: 'La API no devolvió un pasaporte válido' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ARETE-INVALIDO', exact: true })).toHaveCount(0);
  expect(erroresDelNavegador).toEqual([]);
});
