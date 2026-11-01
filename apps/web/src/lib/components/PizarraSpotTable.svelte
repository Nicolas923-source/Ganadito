<script lang="ts">
  import type { CotizacionSpot } from '@ganadito/contracts';

  export interface ItemCotizacionVisual extends Omit<Partial<CotizacionSpot>, 'producto' | 'unidad_medida'> {
    id: string;
    producto: string;
    categoria?: string;
    calidad?: string;
    precio_unitario: number;
    unidad_medida: string;
    sentido: 'OFERTA_VENTA' | 'DEMANDA_COMPRA';
    procedencia_texto?: string;
    departamento?: string;
    establecimiento_nombre?: string;
    establecimiento_tipo?: string;
    distancia_km?: number;
    verificado?: boolean;
    vigencia_hasta?: string;
  }

  interface Props {
    cotizaciones?: ItemCotizacionVisual[];
    selectedId?: string | null;
    isLoading?: boolean;
    onSelectCotizacion?: (cot: ItemCotizacionVisual) => void;
  }

  let {
    cotizaciones = [],
    selectedId = null,
    isLoading = false,
    onSelectCotizacion
  }: Props = $props();

  const BADGES_DEPARTAMENTO: Record<string, { bg: string; text: string }> = {
    LIMA: { bg: 'bg-emerald-950/80 border-emerald-700/60', text: 'text-emerald-300' },
    AREQUIPA: { bg: 'bg-amber-950/80 border-amber-700/60', text: 'text-amber-300' },
    LA_LIBERTAD: { bg: 'bg-blue-950/80 border-blue-700/60', text: 'text-blue-300' },
    TRUJILLO: { bg: 'bg-blue-950/80 border-blue-700/60', text: 'text-blue-300' },
    PIURA: { bg: 'bg-rose-950/80 border-rose-700/60', text: 'text-rose-300' },
    JUNIN: { bg: 'bg-purple-950/80 border-purple-700/60', text: 'text-purple-300' },
    CAJAMARCA: { bg: 'bg-teal-950/80 border-teal-700/60', text: 'text-teal-300' },
    CUSCO: { bg: 'bg-orange-950/80 border-orange-700/60', text: 'text-orange-300' }
  };

  function getBadgeDepartamento(dep?: string) {
    if (!dep) return { bg: 'bg-slate-800 border-slate-700', text: 'text-slate-300' };
    const key = dep.toUpperCase().replace(/\s+/g, '_');
    return BADGES_DEPARTAMENTO[key] ?? { bg: 'bg-slate-800 border-slate-700', text: 'text-slate-300' };
  }
</script>

<div class="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full">
  <!-- Encabezado de la Pizarra Spot -->
  <div class="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="2" x2="12" y2="22" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      </div>
      <div>
        <div class="flex items-center gap-2">
          <h2 class="text-base font-bold text-white tracking-tight">Pizarra Spot de Precios</h2>
          <span class="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">
            En Vivo
          </span>
        </div>
        <p class="text-xs text-slate-400">Cotizaciones directas de productor y carnicerías</p>
      </div>
    </div>

    <div class="text-right">
      <span class="text-xs font-mono text-slate-400">Total:</span>
      <span class="text-xs font-bold text-white ml-1 font-mono">{cotizaciones.length} registros</span>
    </div>
  </div>

  <!-- Estado de Carga (Skeleton Loader) -->
  {#if isLoading}
    <div class="p-4 space-y-3">
      {#each [1, 2, 3, 4] as _}
        <div class="animate-pulse bg-slate-800/40 rounded-xl p-4 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="space-y-2 flex-1">
            <div class="h-4 bg-slate-700/60 rounded w-1/3"></div>
            <div class="h-3 bg-slate-700/40 rounded w-1/2"></div>
          </div>
          <div class="h-8 bg-slate-700/50 rounded w-28"></div>
        </div>
      {/each}
    </div>
  {:else if cotizaciones.length === 0}
    <!-- Estado Vacío (Empty State accesible) -->
    <div class="flex-1 flex flex-col items-center justify-center p-8 text-center my-auto">
      <div class="w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center text-slate-500 mb-3">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      </div>
      <h3 class="text-sm font-semibold text-white">Sin cotizaciones spot en el radio seleccionado</h3>
      <p class="text-xs text-slate-400 max-w-sm mt-1">
        Prueba ampliando el radio a 50 km o 100 km, o elimina el filtro de tipo de actor para ver precios en otras regiones del país.
      </p>
    </div>
  {:else}
    <!-- Tabla en Desktop / Tarjetas en Móvil -->
    <div class="flex-1 overflow-y-auto divide-y divide-slate-800/60">
      {#each cotizaciones as cot (cot.id)}
        {@const badgeDep = getBadgeDepartamento(cot.departamento)}
        {@const isSelected = selectedId === cot.id}
        <button
          type="button"
          onclick={() => onSelectCotizacion?.(cot)}
          class="w-full text-left p-4 hover:bg-slate-800/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 {isSelected
            ? 'bg-emerald-950/20 border-l-4 border-emerald-500 pl-3.5'
            : 'border-l-4 border-transparent'}"
        >
          <!-- Info del Producto y Establecimiento -->
          <div class="space-y-1.5 flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-sm font-bold text-white truncate">{cot.producto}</span>
              {#if cot.categoria}
                <span class="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                  {cot.categoria}
                </span>
              {/if}
              {#if cot.verificado}
                <span
                  class="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20"
                  title="Precio validado con pesaje en báscula oficial de camal o asociación"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Verificado</span>
                </span>
              {/if}
            </div>

            <!-- Metadatos de procedencia y establecimiento -->
            <div class="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              {#if cot.departamento}
                <span class="px-2 py-0.5 text-[10px] font-medium rounded border {badgeDep.bg} {badgeDep.text}">
                  {cot.departamento}
                </span>
              {/if}
              {#if cot.establecimiento_nombre}
                <span class="truncate text-slate-300 font-medium">{cot.establecimiento_nombre}</span>
              {/if}
              {#if cot.distancia_km !== undefined}
                <span class="text-slate-500">•</span>
                <span class="text-emerald-400/90 font-mono text-[11px]">a {cot.distancia_km.toFixed(1)} km</span>
              {/if}
            </div>
          </div>

          <!-- Precio Spot y Unidad de Medida -->
          <div class="flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800/60">
            <div class="flex items-baseline gap-1">
              <span class="text-xs text-slate-400 font-medium">S/</span>
              <span class="text-xl font-extrabold text-emerald-400 font-mono tracking-tight">
                {cot.precio_unitario.toFixed(2)}
              </span>
            </div>
            <div class="text-[11px] text-slate-400 flex items-center gap-1">
              <span class="capitalize">{cot.sentido === 'OFERTA_VENTA' ? 'Oferta' : 'Demanda'}</span>
              <span>/</span>
              <span>{cot.unidad_medida}</span>
            </div>
          </div>
        </button>
      {/each}
    </div>
  {/if}

  <!-- Pie de la Pizarra con Nota de Inocuidad -->
  <div class="p-3 bg-slate-950/80 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
    <div class="flex items-center gap-1.5">
      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
      <span>Precios Spot transparentes sin comisiones ocultas</span>
    </div>
    <span class="text-slate-500 font-mono text-[10px]">WGS84 • PostGIS</span>
  </div>
</div>
