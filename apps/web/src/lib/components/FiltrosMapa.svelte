<script lang="ts">
  interface Props {
    radioKm: number;
    tipoActor: string;
    busquedaProducto: string;
    sentido: string;
    onReset?: () => void;
  }

  let {
    radioKm = $bindable(50),
    tipoActor = $bindable('TODOS'),
    busquedaProducto = $bindable(''),
    sentido = $bindable('TODOS'),
    onReset
  }: Props = $props();

  const RADIOS_KM = [
    { valor: 10, etiqueta: '10 km' },
    { valor: 25, etiqueta: '25 km' },
    { valor: 50, etiqueta: '50 km' },
    { valor: 100, etiqueta: '100 km' }
  ];

  const TIPOS_ACTOR = [
    { valor: 'TODOS', etiqueta: 'Todos los Actores', color: 'bg-slate-700' },
    { valor: 'CAMAL_FRIGORIFICO', etiqueta: 'Camales y Frigoríficos', color: 'bg-rose-500' },
    { valor: 'FEEDLOT', etiqueta: 'Feedlots / Engorde', color: 'bg-amber-500' },
    { valor: 'ASOCIACION_PRODUCTORES', etiqueta: 'Asociaciones Ganaderas', color: 'bg-emerald-500' },
    { valor: 'CARNICERIA', etiqueta: 'Carnicerías Mayoristas', color: 'bg-blue-500' },
    { valor: 'ESTABLO', etiqueta: 'Establos Lecheros/Cría', color: 'bg-purple-500' }
  ];

  const ETIQUETAS_RAPIDAS = ['Vacuno en pie', 'Media canal', 'Torete', 'Vaca engorde', 'Cortes calibrados'];
</script>

<div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-sm space-y-4">
  <div class="flex items-center justify-between border-b border-slate-800/80 pb-3">
    <div class="flex items-center gap-2">
      <div class="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
      </div>
      <div>
        <h3 class="text-sm font-semibold text-white">Filtros de Mercado</h3>
        <p class="text-[11px] text-slate-400">Búsqueda radial y tipo de actor</p>
      </div>
    </div>

    {#if busquedaProducto || tipoActor !== 'TODOS' || radioKm !== 50 || sentido !== 'TODOS'}
      <button
        type="button"
        onclick={onReset}
        class="text-xs text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1 px-2 py-1 rounded-md hover:bg-slate-800"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
        <span>Restablecer</span>
      </button>
    {/if}
  </div>

  <!-- Búsqueda textual por producto o corte -->
  <div class="space-y-1.5">
    <label for="busqueda-producto" class="block text-xs font-medium text-slate-300">
      Buscar Producto o Categoría
    </label>
    <div class="relative">
      <input
        id="busqueda-producto"
        type="text"
        bind:value={busquedaProducto}
        placeholder="Ej. Vacuno en pie, Media canal, Torete..."
        class="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 pl-9 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
      />
      <div class="absolute left-3 top-3 text-slate-500 pointer-events-none">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>
      {#if busquedaProducto}
        <button
          type="button"
          onclick={() => (busquedaProducto = '')}
          class="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 p-0.5 rounded"
          aria-label="Limpiar búsqueda"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      {/if}
    </div>

    <!-- Sugerencias rápidas -->
    <div class="flex flex-wrap gap-1.5 pt-1">
      {#each ETIQUETAS_RAPIDAS as tag}
        <button
          type="button"
          onclick={() => (busquedaProducto = tag)}
          class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/50 transition-colors"
        >
          {tag}
        </button>
      {/each}
    </div>
  </div>

  <!-- Selector de Radio Espacial PostGIS -->
  <div class="space-y-1.5">
    <div class="flex items-center justify-between">
      <span class="text-xs font-medium text-slate-300">
        Radio de Cobertura (PostGIS ST_DWithin)
      </span>
      <span class="text-xs font-semibold text-emerald-400 font-mono">{radioKm} km</span>
    </div>
    <div class="grid grid-cols-4 gap-2">
      {#each RADIOS_KM as r}
        <button
          type="button"
          onclick={() => (radioKm = r.valor)}
          class="py-2 text-xs font-medium rounded-xl border transition-all text-center {radioKm === r.valor
            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm shadow-emerald-500/20'
            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'}"
        >
          {r.etiqueta}
        </button>
      {/each}
    </div>
  </div>

  <!-- Filtro por Tipo de Actor Pecuario -->
  <div class="space-y-1.5">
    <label for="tipo-actor" class="block text-xs font-medium text-slate-300">
      Tipo de Establecimiento / Actor
    </label>
    <div class="relative">
      <select
        id="tipo-actor"
        bind:value={tipoActor}
        class="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
      >
        {#each TIPOS_ACTOR as actor}
          <option value={actor.valor}>{actor.etiqueta}</option>
        {/each}
      </select>
      <div class="absolute right-3.5 top-3.5 text-slate-400 pointer-events-none">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  </div>

  <!-- Sentido de la Cotización -->
  <div class="space-y-1.5 pt-1">
    <span class="block text-xs font-medium text-slate-300">Tipo de Cotización</span>
    <div class="grid grid-cols-3 gap-2">
      <button
        type="button"
        onclick={() => (sentido = 'TODOS')}
        class="py-1.5 text-xs font-medium rounded-lg border text-center transition-all {sentido === 'TODOS'
          ? 'bg-slate-800 border-slate-600 text-white'
          : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:text-slate-200'}"
      >
        Todas
      </button>
      <button
        type="button"
        onclick={() => (sentido = 'OFERTA_VENTA')}
        class="py-1.5 text-xs font-medium rounded-lg border text-center transition-all {sentido === 'OFERTA_VENTA'
          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
          : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:text-slate-200'}"
      >
        Ofertas
      </button>
      <button
        type="button"
        onclick={() => (sentido = 'DEMANDA_COMPRA')}
        class="py-1.5 text-xs font-medium rounded-lg border text-center transition-all {sentido === 'DEMANDA_COMPRA'
          ? 'bg-blue-500/20 border-blue-500 text-blue-300'
          : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:text-slate-200'}"
      >
        Demandas
      </button>
    </div>
  </div>
</div>
