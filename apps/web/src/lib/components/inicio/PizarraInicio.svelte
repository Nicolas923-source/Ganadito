<script lang="ts">
  import { apiRequest } from '#lib/api.ts';
  import { session } from '#lib/session.ts';
  import type { CatalogoLotesResponse, LoteCatalogo } from '@ganadito/contracts';

  // Pizarra de los próximos cierres: lotes reales del servidor, sin datos de ejemplo.
  let lotes = $state<LoteCatalogo[]>([]);
  let cargando = $state(true);
  let error = $state('');

  $effect(() => {
    if ($session.status === 'checking') return;
    const controller = new AbortController();
    cargando = true;
    error = '';
    apiRequest<CatalogoLotesResponse>('/api/v1/subastas?limit=4', { signal: controller.signal, auth: $session.status === 'authenticated' })
      .then((data) => {
        if (!data || !Array.isArray(data.data)) throw new Error('La API devolvió un catálogo no válido.');
        lotes = data.data.filter((l) => typeof l.id === 'string' && typeof l.precio_actual === 'number');
      })
      .catch((cause) => { if (!controller.signal.aborted) error = cause instanceof Error ? cause.message : 'No se pudo cargar la pizarra.'; })
      .finally(() => { if (!controller.signal.aborted) cargando = false; });
    return () => controller.abort();
  });

  const soles = (n: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }).format(n);
  const cierre = (s: string) => new Date(s).toLocaleString('es-PE', { timeZone: 'America/Lima', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const detalle = (l: LoteCatalogo) => [l.cantidad_animales ? `${l.cantidad_animales} animales` : null, l.categoria, l.raza].filter(Boolean).join(', ');
</script>

<section class="pizarra" aria-label="Próximos cierres de subasta" aria-busy={cargando}>
  <header>
    <h2>Próximos cierres</h2>
    <span class="vivo"><span class="punto" aria-hidden="true"></span>Precio actual por lote</span>
  </header>
  {#if error}
    <p class="estado">No se pudo cargar la pizarra: {error}</p>
  {:else if cargando}
    <p class="estado">Consultando lotes abiertos…</p>
  {:else if lotes.length === 0}
    <p class="estado">No hay lotes abiertos ahora. <a href="/subastas#publicar">Publica el primero.</a></p>
  {:else}
    <ol>
      {#each lotes as lote (lote.id)}
        <li>
          <a href={`/subastas/${encodeURIComponent(lote.id)}`}>
            <span class="lote">
              <span class="codigo">{lote.codigo_lote}</span>
              <span class="detalle">{detalle(lote) || 'Detalle no informado'}</span>
            </span>
            <span class="precio cifra">{soles(lote.precio_actual)}</span>
            <span class="cierre">Cierra {cierre(lote.fecha_cierre)}<br />{lote.total_pujas} {lote.total_pujas === 1 ? 'puja' : 'pujas'}</span>
          </a>
        </li>
      {/each}
    </ol>
  {/if}
  <footer><a href="/subastas">Ver el catálogo completo</a></footer>
</section>

<style>
  .pizarra { background: #0f3320; border: 1px solid #2c5c3e; border-radius: .875rem; color: #e8f0ea; overflow: hidden; }
  header { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; padding: 1rem 1.25rem .75rem; border-bottom: 1px solid #2c5c3e; }
  h2 { color: #fff; margin: 0; font-size: 1.05rem; }
  .vivo { display: inline-flex; align-items: center; gap: .45rem; font-size: .8rem; color: #b9cfc0; }
  .punto { width: .5rem; height: .5rem; border-radius: 50%; background: var(--color-maiz); }
  ol { list-style: none; margin: 0; padding: 0; }
  li + li { border-top: 1px solid #22492f; }
  li a { display: grid; grid-template-columns: 1fr auto; gap: .2rem 1rem; padding: .85rem 1.25rem; color: inherit; text-decoration: none; }
  li a:hover { background: #14402a; }
  .lote { display: grid; min-width: 0; }
  .codigo { font-weight: 680; font-stretch: 110%; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .detalle { font-size: .85rem; color: #b9cfc0; }
  .precio { font-size: 1.35rem; color: var(--color-maiz); text-align: right; align-self: center; }
  .cierre { grid-column: 1 / -1; font-size: .78rem; color: #9db8a6; }
  .cierre br { display: none; }
  .estado { padding: 1.25rem; margin: 0; color: #cfe0d4; }
  .estado a, footer a { color: #fff; }
  footer { padding: .8rem 1.25rem; border-top: 1px solid #2c5c3e; font-size: .9rem; }
  @media (min-width: 520px) {
    li a { grid-template-columns: 1fr auto auto; align-items: center; }
    .cierre { grid-column: auto; text-align: right; order: 2; }
    .precio { order: 3; min-width: 7.5rem; }
    .cierre br { display: inline; }
  }
</style>
