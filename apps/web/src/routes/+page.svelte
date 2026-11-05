<script lang="ts">
  import { untrack } from 'svelte';
  import { apiRequest } from '#lib/api.ts';
  import { session } from '#lib/session.ts';
  import MapaInteractivo, { type MarcadorEstablecimiento } from '#lib/components/MapaInteractivo.svelte';
  import PizarraSpotTable, { type ItemCotizacionVisual } from '#lib/components/PizarraSpotTable.svelte';
  import PizarraInicio from '#lib/components/inicio/PizarraInicio.svelte';

  const accesos = [
    { href: '/subastas', titulo: 'Comprar en subasta', texto: 'Revisa los lotes abiertos y puja por el precio total del lote.' },
    { href: '/subastas#publicar', titulo: 'Vender un lote', texto: 'Publica cantidad, categoría, raza y precio base para tu organización.' },
    { href: '#mercado', titulo: 'Consultar el mercado', texto: 'Ubica establecimientos cercanos y compara las cotizaciones Spot vigentes.' },
    { href: '/trazabilidad', titulo: 'Verificar un animal', texto: 'Consulta el pasaporte bovino y su cadena de eventos registrados.' }
  ];

  let latitud = $state(-12.046);
  let longitud = $state(-77.042);
  let radioKm = $state(50);
  let tipo = $state('');
  let producto = $state('');
  let categoria = $state('');
  let calidad = $state('');
  let ubigeo = $state('');
  let establecimientos = $state<MarcadorEstablecimiento[]>([]);
  let cotizaciones = $state<ItemCotizacionVisual[]>([]);
  let errorMapa = $state('');
  let errorSpot = $state('');
  let cargandoMapa = $state(false);
  let cargandoSpot = $state(false);
  let selectedId = $state<string | null>(null);
  let offsetMapa = $state(0);
  let offsetSpot = $state(0);
  const limite = 50;
  let mapaComponente: { centrarEn: (lat: number, lon: number, ubicacionAproximada: boolean) => void } | undefined;
  let peticionMapa: AbortController | undefined;
  let peticionSpot: AbortController | undefined;

  function esObjeto(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
  function esNumero(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }
  function esEstablecimiento(value: unknown): value is MarcadorEstablecimiento {
    return esObjeto(value) && typeof value.id === 'string' && typeof value.nombre_comercial === 'string' &&
      typeof value.tipo === 'string' && esNumero(value.latitud) && value.latitud >= -90 && value.latitud <= 90 &&
      esNumero(value.longitud) && value.longitud >= -180 && value.longitud <= 180 &&
      typeof value.ubicacion_aproximada === 'boolean' &&
      (value.direccion_texto == null || typeof value.direccion_texto === 'string') &&
      (value.distancia_km == null || (esNumero(value.distancia_km) && value.distancia_km >= 0));
  }
  function esCotizacion(value: unknown): value is ItemCotizacionVisual {
    return esObjeto(value) && ['id', 'producto', 'categoria', 'calidad', 'moneda', 'unidad_medida', 'procedencia_ubigeo', 'vigencia_hasta'].every(key => typeof value[key] === 'string') &&
      esNumero(value.precio_unitario) && typeof value.verificado === 'boolean' && typeof value.ubicacion_aproximada === 'boolean' &&
      Number.isFinite(Date.parse(value.vigencia_hasta as string)) &&
      (value.establecimiento_id == null || typeof value.establecimiento_id === 'string') &&
      (value.establecimiento_nombre == null || typeof value.establecimiento_nombre === 'string') &&
      (value.latitud == null || (esNumero(value.latitud) && value.latitud >= -90 && value.latitud <= 90)) &&
      (value.longitud == null || (esNumero(value.longitud) && value.longitud >= -180 && value.longitud <= 180)) &&
      ((value.latitud == null) === (value.longitud == null));
  }

  async function consultarMapa() {
    peticionMapa?.abort();
    const controller = new AbortController();
    peticionMapa = controller;
    establecimientos = [];
    selectedId = null;
    errorMapa = '';
    cargandoMapa = true;
    try {
      const query = new URLSearchParams({ lat: String(latitud), lon: String(longitud), radio_km: String(radioKm), limit: String(limite), offset: String(offsetMapa) });
      if (tipo) query.set('tipo', tipo);
      const data = await apiRequest<unknown>(`/api/v1/establecimientos/cercanos?${query}`, { signal: controller.signal });
      if (!esObjeto(data) || !Array.isArray(data.establecimientos) || !data.establecimientos.every(esEstablecimiento) ||
          new Set(data.establecimientos.map(e => e.id)).size !== data.establecimientos.length) {
        throw new Error('La API no devolvió una lista de establecimientos válida.');
      }
      if (!controller.signal.aborted) establecimientos = data.establecimientos;
    } catch (error) {
      if (!controller.signal.aborted) errorMapa = error instanceof Error ? error.message : 'No se pudo consultar el mapa.';
    } finally {
      if (!controller.signal.aborted) cargandoMapa = false;
    }
  }

  async function consultarSpot() {
    peticionSpot?.abort();
    const controller = new AbortController();
    peticionSpot = controller;
    cotizaciones = [];
    errorSpot = '';
    cargandoSpot = true;
    try {
      const query = new URLSearchParams({ limit: String(limite), offset: String(offsetSpot) });
      if (producto) query.set('producto', producto);
      if (categoria.trim()) query.set('categoria', categoria.trim());
      if (calidad.trim()) query.set('calidad', calidad.trim());
      if (ubigeo.trim()) query.set('ubigeo', ubigeo.trim());
      const data = await apiRequest<unknown>(`/api/v1/cotizaciones/pizarra?${query}`, { signal: controller.signal });
      if (!esObjeto(data) || !Array.isArray(data.cotizaciones) || !data.cotizaciones.every(esCotizacion) ||
          new Set(data.cotizaciones.map(c => c.id)).size !== data.cotizaciones.length) {
        throw new Error('La API no devolvió una lista de cotizaciones válida.');
      }
      if (!controller.signal.aborted) cotizaciones = data.cotizaciones;
    } catch (error) {
      if (!controller.signal.aborted) errorSpot = error instanceof Error ? error.message : 'No se pudo consultar la pizarra.';
    } finally {
      if (!controller.signal.aborted) cargandoSpot = false;
    }
  }

  function consultar() {
    offsetMapa = 0;
    offsetSpot = 0;
    void consultarMapa();
    void consultarSpot();
  }

  $effect(() => {
    $session.organizationId;
    $session.token;
    untrack(consultar);
    return () => { peticionMapa?.abort(); peticionSpot?.abort(); };
  });

  function seleccionarCotizacion(cotizacion: ItemCotizacionVisual) {
    selectedId = cotizacion.establecimiento_id ?? null;
    if (Number.isFinite(cotizacion.latitud) && Number.isFinite(cotizacion.longitud)) {
      mapaComponente?.centrarEn(cotizacion.latitud!, cotizacion.longitud!, cotizacion.ubicacion_aproximada);
    }
  }
</script>

<svelte:head><title>Ganadito | Mercado ganadero del Perú</title></svelte:head>

<section class="portada" aria-labelledby="titulo-portada">
  <div class="portada-inner">
    <div class="portada-texto">
      <h1 id="titulo-portada">Ganado por lote, al mejor postor.</h1>
      <p>Publica tu lote, recibe pujas en vivo y cierra la venta con una orden registrada. Cada puja la confirma el servidor antes de mostrarse.</p>
      <div class="portada-acciones">
        <a class="button claro" href="/subastas">Ver lotes en subasta</a>
        <a class="button contorno" href="/subastas#publicar">Publicar un lote</a>
      </div>
      <p class="portada-nota">Los pagos todavía no están habilitados: la subasta termina en una orden pendiente de pago.</p>
    </div>
    <PizarraInicio />
  </div>
</section>

<section class="accesos" aria-labelledby="titulo-accesos">
  <h2 id="titulo-accesos">¿Qué quieres hacer hoy?</h2>
  <ul>
    {#each accesos as acceso (acceso.href)}
      <li><a href={acceso.href}><span class="acceso-titulo">{acceso.titulo}</span><span class="acceso-texto">{acceso.texto}</span></a></li>
    {/each}
  </ul>
</section>

<div id="mercado" class="max-w-7xl mx-auto w-full px-4 pb-12 space-y-6 scroll-mt-4">
  <div class="page-head">
    <h2 class="titulo-seccion">Mapa y Pizarra Spot</h2>
    <p>Establecimientos y cotizaciones que devuelve el servidor. La búsqueda por radio se aplica al mapa y los filtros comerciales, a la pizarra.</p>
  </div>

  <form onsubmit={(event) => { event.preventDefault(); consultar(); }} class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 bg-superficie border border-linea rounded-2xl p-5">
    <label class="text-sm text-tinta-2">Latitud del centro<input class="mt-1 w-full rounded-lg bg-superficie border border-linea p-2 text-tinta" type="number" min="-90" max="90" step="any" required bind:value={latitud} /></label>
    <label class="text-sm text-tinta-2">Longitud del centro<input class="mt-1 w-full rounded-lg bg-superficie border border-linea p-2 text-tinta" type="number" min="-180" max="180" step="any" required bind:value={longitud} /></label>
    <label class="text-sm text-tinta-2">Radio del mapa (km)<input class="mt-1 w-full rounded-lg bg-superficie border border-linea p-2 text-tinta" type="number" min="1" max="2000" required bind:value={radioKm} /></label>
    <label class="text-sm text-tinta-2">Tipo de establecimiento<select class="mt-1 w-full rounded-lg bg-superficie border border-linea p-2 text-tinta" bind:value={tipo}><option value="">Todos</option>{#each ['ESTABLO','CAMAL','CENTRO_BENEFICIO','FERIA_GANADERA','CENTRO_ACOPIO','ALMACEN_FRIGORIFICO','PUNTO_VENTA','OFICINA_ADMINISTRATIVA'] as valor}<option value={valor}>{valor.replaceAll('_', ' ')}</option>{/each}</select></label>
    <label class="text-sm text-tinta-2">Producto Spot<select class="mt-1 w-full rounded-lg bg-superficie border border-linea p-2 text-tinta" bind:value={producto}><option value="">Todos</option>{#each ['GANADO_EN_PIE','CARNE_EN_CANAL','CUARTO_COMPENSADO','CORTE_PORTION_CONTROL','QUINTO_CUARTO'] as valor}<option value={valor}>{valor.replaceAll('_', ' ')}</option>{/each}</select></label>
    <label class="text-sm text-tinta-2">Categoría Spot<input class="mt-1 w-full rounded-lg bg-superficie border border-linea p-2 text-tinta" placeholder="Ej. TORETE" bind:value={categoria} /></label>
    <label class="text-sm text-tinta-2">Calidad Spot<input class="mt-1 w-full rounded-lg bg-superficie border border-linea p-2 text-tinta" placeholder="Ej. PRIMERA" bind:value={calidad} /></label>
    <label class="text-sm text-tinta-2">Ubigeo Spot<input class="mt-1 w-full rounded-lg bg-superficie border border-linea p-2 text-tinta" pattern={'[0-9]{6}'} placeholder="6 dígitos" bind:value={ubigeo} /></label>
    <button type="submit" class="rounded-xl bg-pasto hover:bg-pasto-osc px-4 py-2 font-semibold text-white sm:col-span-2 lg:col-span-4">Consultar mercado</button>
  </form>

  <div class="grid lg:grid-cols-2 gap-6 items-start">
    <section class="space-y-3" aria-label="Mapa de establecimientos" aria-busy={cargandoMapa}>
      <h2 class="text-xl font-semibold text-tinta">Establecimientos cercanos</h2>
      {#if cargandoMapa}<p role="status" class="text-apagado">Consultando establecimientos…</p>
      {:else if errorMapa}<p role="alert" class="rounded-xl bg-alerta-fondo/40 border border-alerta-linea p-4 text-alerta">{errorMapa}</p>
      {:else if establecimientos.length === 0}<p role="status" class="rounded-xl bg-superficie p-4 text-apagado">No se encontraron establecimientos para esta consulta.</p>{/if}
      <div class="h-[440px]"><MapaInteractivo bind:this={mapaComponente} {establecimientos} {selectedId} centroDefecto={[latitud, longitud]} onSelectEstablecimiento={(establecimiento) => { selectedId = establecimiento.id; }} /></div>
      {#if establecimientos.length > 0}<ul class="divide-y divide-linea rounded-xl border border-linea">{#each establecimientos as establecimiento (establecimiento.id)}<li><button type="button" class="fila w-full p-3 text-left hover:bg-campo-2 rounded-xl" onclick={() => { selectedId = establecimiento.id; mapaComponente?.centrarEn(establecimiento.latitud, establecimiento.longitud, establecimiento.ubicacion_aproximada); }}><span class="font-medium text-tinta">{establecimiento.nombre_comercial}</span><span class="block text-xs text-apagado">{establecimiento.tipo} · {establecimiento.ubicacion_aproximada ? 'Ubicación aproximada' : 'Ubicación exacta'}</span><span class="block text-xs text-apagado">{establecimiento.distancia_km == null ? 'Distancia no informada' : (establecimiento.ubicacion_aproximada ? 'Distancia aproximada: ' : 'Distancia: ') + establecimiento.distancia_km.toFixed(1) + ' km'}</span></button></li>{/each}</ul>{/if}
      <div class="flex items-center justify-between text-sm"><button class="secondary text-sm disabled:opacity-40" type="button" disabled={offsetMapa === 0 || cargandoMapa} onclick={() => { offsetMapa = Math.max(0, offsetMapa - limite); void consultarMapa(); }}>Mapa anterior</button><span class="text-apagado">Página {Math.floor(offsetMapa / limite) + 1}</span><button class="secondary text-sm disabled:opacity-40" type="button" disabled={establecimientos.length < limite || cargandoMapa} onclick={() => { offsetMapa += limite; void consultarMapa(); }}>Mapa siguiente</button></div>
    </section>
    <section class="space-y-3" aria-label="Pizarra Spot" aria-busy={cargandoSpot}>
      <h2 class="text-xl font-semibold text-tinta">Cotizaciones vigentes</h2>
      {#if errorSpot}<p role="alert" class="rounded-xl bg-alerta-fondo/40 border border-alerta-linea p-4 text-alerta">{errorSpot}</p>{/if}
      <PizarraSpotTable {cotizaciones} isLoading={cargandoSpot} {selectedId} onSelectCotizacion={seleccionarCotizacion} />
      <div class="flex items-center justify-between text-sm"><button class="secondary text-sm disabled:opacity-40" type="button" disabled={offsetSpot === 0 || cargandoSpot} onclick={() => { offsetSpot = Math.max(0, offsetSpot - limite); void consultarSpot(); }}>Precios anteriores</button><span class="text-apagado">Página {Math.floor(offsetSpot / limite) + 1}</span><button class="secondary text-sm disabled:opacity-40" type="button" disabled={cotizaciones.length < limite || cargandoSpot} onclick={() => { offsetSpot += limite; void consultarSpot(); }}>Precios siguientes</button></div>
    </section>
  </div>
</div>

<style>
  .portada { background: var(--color-pasto-osc); color: #dce8df; }
  .portada-inner { width: min(100% - 2rem, 1200px); margin: 0 auto; padding: 3.5rem 0; display: grid; gap: 2.5rem; align-items: center; }
  .portada h1 { color: #fff; font-size: clamp(2.3rem, 5.2vw, 4.1rem); font-stretch: 122%; font-weight: 800; line-height: 1.02; letter-spacing: -0.02em; max-width: 13ch; margin: 0 0 1.25rem; }
  .portada-texto > p { max-width: 52ch; font-size: 1.1rem; margin: 0; }
  .portada-acciones { display: flex; flex-wrap: wrap; gap: .75rem; margin: 1.75rem 0 1.25rem; }
  .portada .button { padding: .8rem 1.25rem; }
  .portada .button.claro { background: #fff; border-color: #fff; color: var(--color-pasto-osc); }
  .portada .button.claro:hover { background: var(--color-pasto-claro); border-color: var(--color-pasto-claro); color: var(--color-pasto-osc); }
  .portada .button.contorno { background: transparent; border-color: #8fb39c; color: #fff; }
  .portada .button.contorno:hover { background: #1b5232; border-color: #fff; color: #fff; }
  .portada .portada-nota { font-size: .875rem; color: #a9c3b1; }
  @media (min-width: 960px) { .portada-inner { grid-template-columns: 1.1fr .9fr; padding: 4.5rem 0; } }

  .accesos { width: min(100% - 2rem, 1200px); margin: 2.75rem auto 3rem; }
  .accesos h2 { font-size: 1.5rem; margin-bottom: 1rem; }
  .accesos ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); }
  .accesos a { display: grid; gap: .4rem; align-content: start; height: 100%; padding: 1.25rem; background: var(--color-superficie); border: 1px solid var(--color-linea); border-left: 4px solid var(--color-pasto); border-radius: .625rem; text-decoration: none; color: var(--color-tinta-2); }
  .accesos a:hover { border-color: var(--color-pasto); background: #fbfcf9; }
  .acceso-titulo { font-weight: 720; font-stretch: 112%; font-size: 1.1rem; color: var(--color-tinta); }
  .acceso-texto { font-size: .925rem; }
  .titulo-seccion { font-size: 1.6rem; margin-bottom: .4rem; }
</style>
