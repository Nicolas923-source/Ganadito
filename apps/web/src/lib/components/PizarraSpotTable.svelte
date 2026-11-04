<script lang="ts">
  export interface ItemCotizacionVisual {
    id: string;
    establecimiento_id?: string;
    establecimiento_nombre?: string;
    producto: string;
    categoria: string;
    calidad: string;
    precio_unitario: number;
    moneda: string;
    unidad_medida: string;
    procedencia_ubigeo: string;
    vigencia_hasta: string;
    verificado: boolean;
    latitud?: number;
    longitud?: number;
  }
  interface Props { cotizaciones?: ItemCotizacionVisual[]; selectedId?: string | null; isLoading?: boolean; onSelectCotizacion?: (cotizacion: ItemCotizacionVisual) => void; }
  let { cotizaciones = [], selectedId = null, isLoading = false, onSelectCotizacion }: Props = $props();
</script>

<div class="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
  {#if isLoading}<p role="status" class="p-6 text-slate-400">Consultando cotizaciones…</p>
  {:else if cotizaciones.length === 0}<p role="status" class="p-6 text-slate-400">No hay cotizaciones disponibles para esta consulta.</p>
  {:else}<ul class="divide-y divide-slate-800">{#each cotizaciones as cotizacion (cotizacion.id)}<li><button type="button" class="w-full p-4 text-left hover:bg-slate-800 {selectedId === cotizacion.establecimiento_id ? 'bg-slate-800' : ''}" onclick={() => onSelectCotizacion?.(cotizacion)}>
    <div class="flex justify-between gap-4"><strong class="text-white">{cotizacion.producto.replaceAll('_', ' ')}</strong><span class="font-mono font-bold text-emerald-400">{cotizacion.moneda} {Number.isFinite(cotizacion.precio_unitario) ? cotizacion.precio_unitario.toFixed(2) : 'No informado'}</span></div>
    <p class="text-sm text-slate-300 mt-1">{cotizacion.categoria} · {cotizacion.calidad} · {cotizacion.unidad_medida}</p>
    <p class="text-xs text-slate-400 mt-2">{cotizacion.establecimiento_nombre || 'Establecimiento no informado'} · Ubigeo {cotizacion.procedencia_ubigeo || 'no informado'}</p>
    <p class="text-xs text-slate-500 mt-1">Vigencia: {new Date(cotizacion.vigencia_hasta).toLocaleString('es-PE')} · {cotizacion.verificado ? 'Marcada verificada por la API' : 'Sin verificación informada'}</p>
  </button></li>{/each}</ul>{/if}
</div>
