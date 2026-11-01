<script lang="ts">
  import type {
    ProductoGmx,
    OrderbookGmxResponse,
    NivelPrecioOrderbook,
    CrearOrdenGmxResponse
  } from '@ganadito/contracts';
  import NuevaOrdenGmxModal from './NuevaOrdenGmxModal.svelte';

  interface Props {
    apiBaseUrl?: string;
    authToken?: string | null;
    productoInicial?: ProductoGmx;
  }

  let {
    apiBaseUrl = 'http://localhost:3000',
    authToken = null,
    productoInicial = 'MEDIA_CANAL'
  }: Props = $props();

  let producto = $state<ProductoGmx>('MEDIA_CANAL');
  let orderbook = $state<OrderbookGmxResponse | null>(null);
  let isLoading = $state(false);
  let errorMessage = $state<string | null>(null);
  let modalAbierto = $state(false);
  let autoRefresh = $state(true);
  let lastUpdated = $state<string | null>(null);
  let intervalId: any = null;

  let initialized = false;
  $effect(() => {
    if (!initialized && productoInicial) {
      producto = productoInicial;
      initialized = true;
    }
  });

  // Consultar Orderbook desde API
  async function cargarOrderbook(showLoading = true) {
    if (showLoading) isLoading = true;
    errorMessage = null;

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/gmx/orderbook?producto=${producto}`);
      if (!res.ok) {
        throw new Error(`Error ${res.status}: no se pudo cargar el libro de órdenes.`);
      }
      const data = (await res.json()) as OrderbookGmxResponse;
      orderbook = data;
      lastUpdated = new Date().toLocaleTimeString('es-PE', { hour12: false });
    } catch (err: any) {
      errorMessage = err.message || 'Error de conexión con la Bolsa GMX.';
    } finally {
      if (showLoading) isLoading = false;
    }
  }

  // Carga inicial y reactiva al cambiar de producto
  $effect(() => {
    cargarOrderbook(true);
  });

  // Efecto para auto-refresco
  $effect(() => {
    if (autoRefresh) {
      intervalId = setInterval(() => {
        cargarOrderbook(false);
      }, 5000);
    } else if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
  });

  function handleOrdenCreada(resultado: CrearOrdenGmxResponse) {
    cargarOrderbook(false);
  }

  // Cálculo de profundidad acumulada para renderizar barras visuales de liquidez
  let maxVolumenCompras = $derived(
    orderbook?.compras.reduce((max, n) => Math.max(max, n.volumen_total_kg), 0) || 1
  );
  let maxVolumenVentas = $derived(
    orderbook?.ventas.reduce((max, n) => Math.max(max, n.volumen_total_kg), 0) || 1
  );
  let totalVolumenCompras = $derived(
    orderbook?.compras.reduce((sum, n) => sum + n.volumen_total_kg, 0) || 0
  );
  let totalVolumenVentas = $derived(
    orderbook?.ventas.reduce((sum, n) => sum + n.volumen_total_kg, 0) || 0
  );

  const PRODUCTOS: { id: ProductoGmx; nombre: string; etiqueta: string }[] = [
    { id: 'MEDIA_CANAL', nombre: 'Media Canal Bovina', etiqueta: 'Estándar' },
    { id: 'CUARTO_DELANTERO', nombre: 'Cuarto Delantero', etiqueta: '10 Cortes' },
    { id: 'CUARTO_TRASERO', nombre: 'Cuarto Trasero', etiqueta: '8 Cortes Nobles' },
    { id: 'CORTES_CALIBRADOS', nombre: 'Cortes Calibrados', etiqueta: 'NTP 201.055' }
  ];
</script>

<div class="space-y-6">
  <!-- Barra de Control del Orderbook -->
  <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
      <!-- Título y selector de producto -->
      <div>
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
            Libro L2
          </span>
          <h2 class="text-xl font-bold text-white tracking-tight">Libro de Órdenes Cárnico (GMX)</h2>
        </div>
        <p class="text-xs text-slate-400 mt-1">
          Profundidad de mercado agregada en tiempo real por niveles de precio (S/ por kg).
        </p>
      </div>

      <!-- Acciones de control -->
      <div class="flex flex-wrap items-center gap-3">
        <!-- Switch de Auto-refresco -->
        <label class="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
          <input
            type="checkbox"
            bind:checked={autoRefresh}
            class="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900 w-3.5 h-3.5"
          />
          <span>Auto-refresco (5s)</span>
        </label>

        <!-- Botón de Refresco Manual -->
        <button
          type="button"
          onclick={() => cargarOrderbook(true)}
          disabled={isLoading}
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50"
          title="Actualizar libro de órdenes"
        >
          <span class={isLoading ? 'animate-spin' : ''}>🔄</span>
          <span>{isLoading ? 'Actualizando...' : 'Actualizar'}</span>
        </button>

        <!-- Botón Nueva Orden -->
        <button
          type="button"
          onclick={() => (modalAbierto = true)}
          class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/20 transition-all hover:scale-102"
        >
          <span>+ Nueva Orden Límite</span>
        </button>
      </div>
    </div>

    <!-- Pestañas de Selección de Producto Cárnico -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {#each PRODUCTOS as p}
        <button
          type="button"
          onclick={() => (producto = p.id)}
          class="p-3 rounded-xl border text-left transition-all {producto === p.id
            ? 'bg-emerald-500/10 border-emerald-500/40 text-white shadow-lg'
            : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800/50'}"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold">{p.nombre}</span>
            <span class="text-[10px] px-1.5 py-0.2 rounded font-semibold {producto === p.id ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}">
              {p.etiqueta}
            </span>
          </div>
          <span class="text-[10px] font-mono text-slate-500 block mt-1">{p.id}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- Barra de Spread y Estado de Mercado -->
  {#if orderbook}
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <!-- Spread Actual -->
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
        <div>
          <div class="text-xs text-slate-400">Spread Compra/Venta</div>
          <div class="text-xl font-black font-mono text-white mt-1">
            {#if orderbook.spread_pen !== null}
              S/ {orderbook.spread_pen.toFixed(2)} / kg
            {:else}
              <span class="text-slate-500 text-base font-normal">Sin cruce bid/ask</span>
            {/if}
          </div>
        </div>
        <div class="text-right">
          <span class="text-[10px] px-2 py-0.5 rounded font-mono font-bold {orderbook.spread_pen !== null && orderbook.spread_pen < 1.0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}">
            {orderbook.spread_pen !== null ? 'SPREAD ACTIVO' : 'SIN LIQUIDEZ'}
          </span>
        </div>
      </div>

      <!-- Liquidez Acumulada Compras -->
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
        <div>
          <div class="text-xs text-slate-400">Demanda Total (Bids)</div>
          <div class="text-xl font-black font-mono text-emerald-400 mt-1">
            {totalVolumenCompras.toLocaleString('es-PE')} <span class="text-xs text-slate-400">kg</span>
          </div>
        </div>
        <div class="text-right text-xs font-mono text-slate-500">
          {orderbook.compras.length} niveles
        </div>
      </div>

      <!-- Liquidez Acumulada Ventas -->
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
        <div>
          <div class="text-xs text-slate-400">Oferta Total (Asks)</div>
          <div class="text-xl font-black font-mono text-rose-400 mt-1">
            {totalVolumenVentas.toLocaleString('es-PE')} <span class="text-xs text-slate-400">kg</span>
          </div>
        </div>
        <div class="text-right text-xs font-mono text-slate-500">
          {orderbook.ventas.length} niveles
        </div>
      </div>
    </div>
  {/if}

  <!-- Mensajes de Error si ocurren -->
  {#if errorMessage}
    <div class="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
      <span>{errorMessage}</span>
      <button
        type="button"
        onclick={() => cargarOrderbook(true)}
        class="text-xs underline font-semibold text-rose-400 hover:text-rose-200"
      >
        Reintentar
      </button>
    </div>
  {/if}

  <!-- Panel Dividido del Libro de Órdenes: Bids (Compras) vs Asks (Ventas) -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Panel de Compras (Bids) -->
    <div class="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col">
      <div class="bg-slate-950/80 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
          <h3 class="text-sm font-bold text-emerald-400 tracking-tight uppercase">
            Puntas de Compra (Bids)
          </h3>
        </div>
        <span class="text-xs font-mono text-slate-400">
          Total: {totalVolumenCompras.toLocaleString('es-PE')} kg
        </span>
      </div>

      <div class="overflow-x-auto flex-1">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="bg-slate-950/40 border-b border-slate-800/80 text-[11px] font-bold text-slate-400 uppercase font-mono">
              <th class="py-2.5 px-4">Precio (S/ kg)</th>
              <th class="py-2.5 px-3 text-right">Volumen (kg)</th>
              <th class="py-2.5 px-4 text-right">Total (S/)</th>
              <th class="py-2.5 px-3 text-right">Órdenes</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/40">
            {#if isLoading && !orderbook}
              <!-- Skeletons -->
              {#each [1, 2, 3, 4, 5] as _}
                <tr class="animate-pulse">
                  <td class="py-3 px-4"><div class="h-4 bg-slate-800 rounded w-20"></div></td>
                  <td class="py-3 px-3"><div class="h-4 bg-slate-800 rounded w-16 ml-auto"></div></td>
                  <td class="py-3 px-4"><div class="h-4 bg-slate-800 rounded w-24 ml-auto"></div></td>
                  <td class="py-3 px-3"><div class="h-4 bg-slate-800 rounded w-8 ml-auto"></div></td>
                </tr>
              {/each}
            {:else if orderbook && orderbook.compras.length > 0}
              {#each orderbook.compras as bid}
                {@const pctBarra = Math.min(100, Math.round((bid.volumen_total_kg / maxVolumenCompras) * 100))}
                <tr class="relative hover:bg-emerald-500/5 transition-colors font-mono">
                  <!-- Barra horizontal de profundidad acumulada en el fondo -->
                  <td class="py-2.5 px-4 font-bold text-emerald-400 relative z-10">
                    <div
                      class="absolute inset-y-0 left-0 bg-emerald-500/10 pointer-events-none"
                      style="width: {pctBarra}%;"
                    ></div>
                    S/ {bid.precio_kilo.toFixed(2)}
                  </td>
                  <td class="py-2.5 px-3 text-right font-semibold text-white relative z-10">
                    {bid.volumen_total_kg.toLocaleString('es-PE')}
                  </td>
                  <td class="py-2.5 px-4 text-right text-slate-300 relative z-10">
                    S/ {(bid.precio_kilo * bid.volumen_total_kg).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </td>
                  <td class="py-2.5 px-3 text-right text-slate-400 relative z-10">
                    {bid.ordenes_count}
                  </td>
                </tr>
              {/each}
            {:else}
              <tr>
                <td colspan="4" class="py-12 text-center text-slate-500 text-xs">
                  No hay posturas de compra activas en este momento.
                </td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Panel de Ventas (Asks) -->
    <div class="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col">
      <div class="bg-slate-950/80 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-rose-400"></span>
          <h3 class="text-sm font-bold text-rose-400 tracking-tight uppercase">
            Puntas de Venta (Asks)
          </h3>
        </div>
        <span class="text-xs font-mono text-slate-400">
          Total: {totalVolumenVentas.toLocaleString('es-PE')} kg
        </span>
      </div>

      <div class="overflow-x-auto flex-1">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="bg-slate-950/40 border-b border-slate-800/80 text-[11px] font-bold text-slate-400 uppercase font-mono">
              <th class="py-2.5 px-4">Precio (S/ kg)</th>
              <th class="py-2.5 px-3 text-right">Volumen (kg)</th>
              <th class="py-2.5 px-4 text-right">Total (S/)</th>
              <th class="py-2.5 px-3 text-right">Órdenes</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/40">
            {#if isLoading && !orderbook}
              <!-- Skeletons -->
              {#each [1, 2, 3, 4, 5] as _}
                <tr class="animate-pulse">
                  <td class="py-3 px-4"><div class="h-4 bg-slate-800 rounded w-20"></div></td>
                  <td class="py-3 px-3"><div class="h-4 bg-slate-800 rounded w-16 ml-auto"></div></td>
                  <td class="py-3 px-4"><div class="h-4 bg-slate-800 rounded w-24 ml-auto"></div></td>
                  <td class="py-3 px-3"><div class="h-4 bg-slate-800 rounded w-8 ml-auto"></div></td>
                </tr>
              {/each}
            {:else if orderbook && orderbook.ventas.length > 0}
              {#each orderbook.ventas as ask}
                {@const pctBarra = Math.min(100, Math.round((ask.volumen_total_kg / maxVolumenVentas) * 100))}
                <tr class="relative hover:bg-rose-500/5 transition-colors font-mono">
                  <!-- Barra horizontal de profundidad acumulada en el fondo -->
                  <td class="py-2.5 px-4 font-bold text-rose-400 relative z-10">
                    <div
                      class="absolute inset-y-0 left-0 bg-rose-500/10 pointer-events-none"
                      style="width: {pctBarra}%;"
                    ></div>
                    S/ {ask.precio_kilo.toFixed(2)}
                  </td>
                  <td class="py-2.5 px-3 text-right font-semibold text-white relative z-10">
                    {ask.volumen_total_kg.toLocaleString('es-PE')}
                  </td>
                  <td class="py-2.5 px-4 text-right text-slate-300 relative z-10">
                    S/ {(ask.precio_kilo * ask.volumen_total_kg).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </td>
                  <td class="py-2.5 px-3 text-right text-slate-400 relative z-10">
                    {ask.ordenes_count}
                  </td>
                </tr>
              {/each}
            {:else}
              <tr>
                <td colspan="4" class="py-12 text-center text-slate-500 text-xs">
                  No hay posturas de venta activas en este momento.
                </td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Pie con timestamp y metadatos -->
  <div class="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 px-2">
    <div>
      Motor de Matching: <span class="text-slate-400">PostgreSQL (SELECT ... FOR UPDATE)</span>
    </div>
    {#if lastUpdated}
      <div class="font-mono mt-1 sm:mt-0">
        Última sincronización: {lastUpdated}
      </div>
    {/if}
  </div>
</div>

<!-- Modal para colocar nueva orden -->
<NuevaOrdenGmxModal
  isOpen={modalAbierto}
  productoInicial={producto}
  {apiBaseUrl}
  {authToken}
  onCerrar={() => (modalAbierto = false)}
  onOrdenCreada={handleOrdenCreada}
/>
