<script lang="ts">
  import type { TipoProductoMayorista } from '@ganadito/contracts';

  interface Props {
    categoriaSeleccionada: 'TODOS' | TipoProductoMayorista;
    soloFlash: boolean;
    busqueda: string;
    onCambioCategoria: (cat: 'TODOS' | TipoProductoMayorista) => void;
    onToggleFlash: (flash: boolean) => void;
    onCambioBusqueda: (texto: string) => void;
    onLimpiar?: () => void;
  }

  let {
    categoriaSeleccionada,
    soloFlash,
    busqueda,
    onCambioCategoria,
    onToggleFlash,
    onCambioBusqueda,
    onLimpiar
  }: Props = $props();

  const CATEGORIAS: { id: 'TODOS' | TipoProductoMayorista; nombre: string; icono: string }[] = [
    { id: 'TODOS', nombre: 'Todos los Productos', icono: '📦' },
    { id: 'MEDIAS_CANALES', nombre: 'Medias Canales', icono: '🥩' },
    { id: 'CUARTOS_COMPENSADOS', nombre: 'Cuartos Compensados', icono: '🍖' },
    { id: 'CORTES_CALIBRADOS', nombre: 'Cortes Calibrados', icono: '🔪' },
    { id: 'GRANO_FORRAJE', nombre: 'Grano & Forraje', icono: '🌾' },
    { id: 'INSUMO_AGRICOLA', nombre: 'Insumos Agrícolas', icono: '🌱' },
    { id: 'EQUIPAMIENTO_SANITARIO', nombre: 'Equipamiento Sanitario', icono: '💉' }
  ];

  let hayFiltrosActivos = $derived(
    categoriaSeleccionada !== 'TODOS' || soloFlash || busqueda.trim() !== ''
  );
</script>

<div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
  <!-- Fila Superior: Buscador y Toggle de Ofertas Flash -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
    <!-- Buscador de Texto -->
    <div class="relative flex-1 max-w-md">
      <span class="absolute left-3.5 top-2.5 text-slate-500 text-sm">🔍</span>
      <input
        type="text"
        placeholder="Buscar por producto, forraje o canal..."
        value={busqueda}
        oninput={(e) => onCambioBusqueda((e.target as HTMLInputElement).value)}
        class="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 transition-all"
      />
      {#if busqueda}
        <button
          type="button"
          onclick={() => onCambioBusqueda('')}
          class="absolute right-2.5 top-2.5 text-slate-400 hover:text-white text-xs p-0.5"
          aria-label="Limpiar búsqueda"
        >
          ✕
        </button>
      {/if}
    </div>

    <!-- Toggle Ofertas Flash y Botón Limpiar -->
    <div class="flex items-center gap-3 self-end sm:self-auto">
      <button
        type="button"
        onclick={() => onToggleFlash(!soloFlash)}
        class="px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border {soloFlash
          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/25 ring-2 ring-amber-400/50'
          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-amber-500/40 hover:text-amber-400'}"
      >
        <span class={soloFlash ? 'animate-bounce' : ''}>⚡</span>
        <span>Ofertas Flash 24h</span>
      </button>

      {#if hayFiltrosActivos}
        <button
          type="button"
          onclick={() => onLimpiar?.()}
          class="text-xs text-slate-400 hover:text-rose-400 underline transition-colors px-1"
        >
          Limpiar filtros
        </button>
      {/if}
    </div>
  </div>

  <!-- Pestañas de Categorías con Scroll Horizontal -->
  <div class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
    {#each CATEGORIAS as cat}
      <button
        type="button"
        onclick={() => onCambioCategoria(cat.id)}
        class="whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 {categoriaSeleccionada === cat.id
          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
          : 'bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-slate-800'}"
      >
        <span>{cat.icono}</span>
        <span>{cat.nombre}</span>
      </button>
    {/each}
  </div>
</div>
