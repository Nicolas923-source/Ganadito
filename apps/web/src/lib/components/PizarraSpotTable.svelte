<script lang="ts">
  export interface ItemCotizacionVisual {
    id: string;
    establecimiento_id?: string | null;
    establecimiento_nombre?: string | null;
    producto: string;
    categoria: string;
    calidad: string;
    precio_unitario: number;
    moneda: string;
    unidad_medida: string;
    procedencia_ubigeo: string;
    vigencia_hasta: string;
    verificado: boolean;
    latitud?: number | null;
    longitud?: number | null;
    ubicacion_aproximada: boolean;
  }
  interface Props { cotizaciones?: ItemCotizacionVisual[]; selectedId?: string | null; isLoading?: boolean; onSelectCotizacion?: (cotizacion: ItemCotizacionVisual) => void; }
  let { cotizaciones = [], selectedId = null, isLoading = false, onSelectCotizacion }: Props = $props();
</script>

<div class="rounded-2xl border border-linea bg-superficie overflow-hidden">
  {#if isLoading}<p role="status" class="p-6 text-apagado">Consultando cotizaciones…</p>
  {:else if cotizaciones.length === 0}<p role="status" class="p-6 text-apagado">No hay cotizaciones disponibles para esta consulta.</p>
  {:else}<ul class="divide-y divide-linea">{#each cotizaciones as cotizacion (cotizacion.id)}<li><button type="button" disabled={!Number.isFinite(cotizacion.latitud) || !Number.isFinite(cotizacion.longitud)} class="fila w-full p-4 text-left enabled:hover:bg-campo-2 {selectedId !== null && selectedId === cotizacion.establecimiento_id ? 'bg-campo-2' : ''}" onclick={() => onSelectCotizacion?.(cotizacion)}>
    <div class="flex justify-between gap-4"><strong class="text-tinta">{cotizacion.producto.replaceAll('_', ' ')}</strong><span class="font-mono font-bold text-pasto">{cotizacion.moneda} {Number.isFinite(cotizacion.precio_unitario) ? cotizacion.precio_unitario.toFixed(2) : 'No informado'}</span></div>
    <p class="text-sm text-tinta-2 mt-1">{cotizacion.categoria} · {cotizacion.calidad} · {cotizacion.unidad_medida}</p>
    <p class="text-xs text-apagado mt-2">{cotizacion.establecimiento_nombre || 'Establecimiento no informado'} · Ubigeo {cotizacion.procedencia_ubigeo || 'no informado'}</p>
    <p class="text-xs mt-2 {cotizacion.ubicacion_aproximada ? 'text-aviso' : 'text-apagado'}">{!Number.isFinite(cotizacion.latitud) || !Number.isFinite(cotizacion.longitud) ? 'Ubicación no disponible' : cotizacion.ubicacion_aproximada ? 'Ubicación aproximada. El área es orientativa y no indica el punto exacto.' : 'Ubicación exacta'}</p>
    <p class="text-xs text-apagado mt-1">Vigencia: {new Date(cotizacion.vigencia_hasta).toLocaleString('es-PE')} · {cotizacion.verificado ? 'Marcada verificada por la API' : 'Sin verificación informada'}</p>
  </button></li>{/each}</ul>{/if}
</div>
