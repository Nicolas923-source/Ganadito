<script lang="ts">
  import { apiRequest } from '#lib/api.ts';
  import { session } from '#lib/session.ts';
  import type { CatalogoLotesResponse, LoteCatalogo } from '@ganadito/contracts';

  // Catálogo del servidor: nada de datos de ejemplo si la API falla.
  let vista = $state<'publicos' | 'mios'>('publicos');
  let lotes = $state<LoteCatalogo[]>([]);
  let cursor = $state<string | null>(null);
  let cargando = $state(false);
  let error = $state('');
  let peticion: AbortController | undefined;
  const contextKey = $derived(`${$session.token ?? ''}:${$session.organizationId ?? ''}`);
  const puedeVerMios = $derived($session.status === 'authenticated' && !!$session.organizationId);

  function esLote(v: unknown): v is LoteCatalogo {
    if (!v || typeof v !== 'object') return false;
    const l = v as Record<string, unknown>;
    return typeof l.id === 'string' && typeof l.codigo_lote === 'string' && typeof l.estado === 'string' &&
      typeof l.precio_actual === 'number' && typeof l.fecha_cierre === 'string' && typeof l.es_abierta === 'boolean' &&
      (l.origen === null || (typeof l.origen === 'object' && typeof (l.origen as Record<string, unknown>).ubicacion_aproximada === 'boolean'));
  }

  async function cargar(reiniciar: boolean) {
    peticion?.abort();
    const controller = new AbortController();
    peticion = controller;
    const key = contextKey;
    cargando = true;
    error = '';
    if (reiniciar) { lotes = []; cursor = null; }
    const params = new URLSearchParams({ limit: '12' });
    if (vista === 'mios') params.set('mios', 'true');
    if (!reiniciar && cursor) params.set('cursor', cursor);
    try {
      const data = await apiRequest<CatalogoLotesResponse>(`/api/v1/subastas?${params}`, { signal: controller.signal, auth: vista === 'mios' || $session.status === 'authenticated' });
      if (controller.signal.aborted || key !== contextKey) return;
      if (!data || !Array.isArray(data.data) || !data.data.every(esLote)) throw new Error('La API devolvió un catálogo no válido.');
      lotes = reiniciar ? data.data : [...lotes, ...data.data.filter((l) => !lotes.some((x) => x.id === l.id))];
      cursor = typeof data.next_cursor === 'string' ? data.next_cursor : null;
    } catch (cause) {
      if (!controller.signal.aborted) error = cause instanceof Error ? cause.message : 'No se pudo consultar el catálogo.';
    } finally {
      if (!controller.signal.aborted) cargando = false;
    }
  }

  $effect(() => {
    vista;
    contextKey;
    if ($session.status === 'checking') return;
    if (vista === 'mios' && !puedeVerMios) { vista = 'publicos'; return; }
    void cargar(true);
    return () => peticion?.abort();
  });

  const fmt = (n: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(n);
  const fecha = (s: string) => new Date(s).toLocaleString('es-PE', { timeZone: 'America/Lima', dateStyle: 'medium', timeStyle: 'short' });
</script>

<section class="catalogo space-y-4" aria-label="Catálogo de lotes">
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div>
      <h2 class="titulo">Catálogo de lotes</h2>
      <p class="text-sm text-apagado m-0">La puja es por el <strong class="text-tinta">precio total del lote</strong>; no se liquida por kilo. El peso estimado por IA es orientativo y no vinculante.</p>
    </div>
    <div class="segmentos" role="group" aria-label="Filtrar catálogo">
      <button type="button" aria-pressed={vista === 'publicos'} onclick={() => (vista = 'publicos')}>Lotes activos</button>
      {#if puedeVerMios}<button type="button" aria-pressed={vista === 'mios'} onclick={() => (vista = 'mios')}>Mis lotes</button>{/if}
    </div>
  </div>
  {#if error}<p role="alert" class="error">{error} <button type="button" class="secondary ml-2 px-3 py-1 text-sm" onclick={() => void cargar(true)}>Reintentar</button></p>{/if}
  {#if !cargando && !error && lotes.length === 0}<p role="status" class="vacio">{vista === 'mios' ? 'Tu organización todavía no publicó lotes.' : 'No hay lotes activos en este momento.'} <a href="#publicar">Publicar un lote</a></p>{/if}
  <ul class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 m-0 p-0 list-none">
    {#each lotes as lote (lote.id)}
      <li class="tarjeta">
        <div class="flex items-start justify-between gap-2">
          <a class="codigo break-all" href={`/subastas/${encodeURIComponent(lote.id)}`}>{lote.codigo_lote}</a>
          <span class="estado" data-abierta={lote.es_abierta}>{lote.es_abierta ? 'Abierta' : lote.estado.toLowerCase()}</span>
        </div>
        <p class="text-sm text-tinta-2 m-0">{[lote.cantidad_animales ? `${lote.cantidad_animales} animales` : null, lote.categoria, lote.raza].filter(Boolean).join(' · ') || 'Sin detalle del lote'}</p>
        {#if lote.descripcion}<p class="text-sm text-apagado m-0">{lote.descripcion}</p>{/if}
        <div class="precio"><span class="text-xs text-apagado">Precio actual del lote</span><span class="cifra text-2xl text-tinta">{fmt(lote.precio_actual)}</span></div>
        <dl class="datos">
          <div><dt>Pujas</dt><dd class="cifra">{lote.total_pujas}</dd></div>
          <div><dt>Cierre</dt><dd>{fecha(lote.fecha_cierre)}</dd></div>
          {#if lote.peso_estimado_total_kg !== null}<div><dt>Peso estimado (IA, orientativo)</dt><dd class="cifra">{Math.round(lote.peso_estimado_total_kg)} kg</dd></div>{/if}
          {#if lote.origen}<div><dt>Origen</dt><dd>Ubigeo {lote.origen.ubigeo}{lote.origen.ubicacion_aproximada ? ', ubicación aproximada' : ''}</dd></div>{/if}
        </dl>
      </li>
    {/each}
  </ul>
  {#if cargando}<p role="status" class="text-apagado">Consultando lotes…</p>{/if}
  {#if cursor && !cargando}<button type="button" class="secondary" onclick={() => void cargar(false)}>Ver más lotes</button>{/if}
</section>

<style>
  .titulo { font-size: 1.5rem; margin: 0 0 .35rem; }
  .segmentos { display: inline-flex; padding: .2rem; background: var(--color-campo-2); border-radius: .6rem; gap: .2rem; }
  .segmentos button { background: transparent; border-color: transparent; color: var(--color-tinta-2); padding: .4rem .9rem; font-size: .9rem; border-radius: .45rem; }
  .segmentos button:hover:not(:disabled) { background: #d9e1d4; border-color: transparent; color: var(--color-tinta); }
  .segmentos button[aria-pressed='true'] { background: var(--color-superficie); color: var(--color-pasto-osc); box-shadow: 0 1px 2px rgba(20, 34, 25, .12); }
  .vacio { padding: 1.25rem; border: 1px dashed #b9c4b4; border-radius: .75rem; color: var(--color-apagado); margin: 0; }
  .tarjeta { display: grid; gap: .6rem; align-content: start; background: var(--color-superficie); border: 1px solid var(--color-linea); border-radius: .75rem; padding: 1.1rem 1.15rem; }
  .codigo { font-weight: 720; font-stretch: 110%; color: var(--color-tinta); text-decoration: none; }
  .codigo:hover { color: var(--color-pasto); text-decoration: underline; }
  .estado { flex: none; font-size: .75rem; font-weight: 620; padding: .15rem .55rem; border-radius: 999px; background: var(--color-campo-2); color: var(--color-apagado); }
  .estado[data-abierta='true'] { background: var(--color-pasto-claro); color: var(--color-pasto-osc); }
  .precio { display: grid; padding-top: .55rem; border-top: 1px solid var(--color-linea); }
  .datos { display: grid; grid-template-columns: 1fr 1fr; gap: .5rem 1rem; margin: 0; font-size: .875rem; }
  .datos dt { color: var(--color-apagado); font-size: .78rem; }
  .datos dd { margin: 0; color: var(--color-tinta-2); }
</style>
