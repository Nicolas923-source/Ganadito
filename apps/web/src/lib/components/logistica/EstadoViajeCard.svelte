<script lang="ts">
  import type { SolicitudFlete, UnidadTransporte } from '@ganadito/contracts';

  interface Props {
    solicitud: SolicitudFlete;
    unidad?: UnidadTransporte | null;
    authToken?: string | null;
    apiBaseUrl?: string;
    onEstadoActualizado?: (solicitudId: string, nuevoEstado: 'EN_TRANSITO' | 'ENTREGADO') => void;
  }

  let {
    solicitud,
    unidad = null,
    authToken = null,
    apiBaseUrl = 'http://localhost:3000',
    onEstadoActualizado
  }: Props = $props();

  let isUpdating = $state(false);
  let errorMsg = $state<string | null>(null);

  const NOMBRES_ESTABLECIMIENTOS: Record<string, string> = {
    'est-lurin-01': 'Lima — Frigorífico & Camal Lurín',
    'est-oxapampa-01': 'Oxapampa — Fundo Ganadero Pozuzo',
    'est-huancayo-01': 'Huancayo — Establo Valle del Mantaro',
    'est-arequipa-01': 'Arequipa — Camal Metropolitano Yura',
    'est-trujillo-01': 'Trujillo — Complejo Pecuario Moche',
    'est-cajamarca-01': 'Cajamarca — Cuenca Baños del Inca',
    'est-puno-01': 'Puno — Hacienda Ganadera Melgar'
  };

  function obtenerLugar(id: string): string {
    return NOMBRES_ESTABLECIMIENTOS[id] || id;
  }

  async function actualizarEstado(nuevoEstado: 'EN_TRANSITO' | 'ENTREGADO') {
    isUpdating = true;
    errorMsg = null;

    try {
      if (authToken) {
        const res = await fetch(`${apiBaseUrl}/api/v1/logistica/solicitudes/${solicitud.id}/estado`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({ estado: nuevoEstado })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `Error del servidor HTTP ${res.status}`);
        }
      }

      if (onEstadoActualizado) {
        onEstadoActualizado(solicitud.id, nuevoEstado);
      }
    } catch (err: any) {
      errorMsg = err.message || 'Error al actualizar el estado del viaje.';
    } finally {
      isUpdating = false;
    }
  }

  let pasoActual = $derived.by(() => {
    switch (solicitud.estado) {
      case 'ASIGNADO':
        return 1;
      case 'EN_TRANSITO':
        return 2;
      case 'ENTREGADO':
        return 3;
      default:
        return 0;
    }
  });
</script>

<div class="bg-slate-950/90 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
  <!-- Barra de progreso superior -->
  <div class="h-1.5 w-full bg-slate-900 absolute top-0 left-0 right-0">
    <div
      class="h-full transition-all duration-500 {solicitud.estado === 'ENTREGADO'
        ? 'bg-emerald-500 w-full'
        : solicitud.estado === 'EN_TRANSITO'
          ? 'bg-amber-500 w-2/3'
          : 'bg-indigo-500 w-1/3'}"
    ></div>
  </div>

  <!-- Header: Estado y Placa -->
  <div class="flex items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-800/80 pt-1">
    <div class="flex items-center gap-2">
      <span class="text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider {solicitud.estado === 'ENTREGADO'
        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
        : solicitud.estado === 'EN_TRANSITO'
          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
          : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'}">
        {solicitud.estado === 'ENTREGADO'
          ? 'Completado / Entregado'
          : solicitud.estado === 'EN_TRANSITO'
            ? 'En Tránsito hacia Destino'
            : 'Flete Asignado'}
      </span>
      <span class="text-[11px] font-mono text-slate-500">#{solicitud.id.substring(0, 8)}</span>
    </div>

    {#if unidad}
      <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700/80 text-xs font-mono font-bold text-white">
        <span>🚛</span>
        <span>{unidad.placa}</span>
      </div>
    {:else if solicitud.unidad_id}
      <div class="text-xs font-mono text-slate-400">
        Unidad: {solicitud.unidad_id.substring(0, 8)}
      </div>
    {/if}
  </div>

  <!-- Línea de etapas (Stepper Visual) -->
  <div class="grid grid-cols-3 gap-2 py-3 mb-4 bg-slate-900/60 rounded-xl px-3 border border-slate-800">
    <div class="flex items-center gap-2 text-xs">
      <div class="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] {pasoActual >= 1
        ? 'bg-indigo-500 text-white'
        : 'bg-slate-800 text-slate-500'}">
        1
      </div>
      <span class="{pasoActual >= 1 ? 'text-slate-200 font-semibold' : 'text-slate-500'} text-[11px]">Asignado</span>
    </div>

    <div class="flex items-center gap-2 text-xs">
      <div class="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] {pasoActual >= 2
        ? 'bg-amber-500 text-white'
        : 'bg-slate-800 text-slate-500'}">
        2
      </div>
      <span class="{pasoActual >= 2 ? 'text-slate-200 font-semibold' : 'text-slate-500'} text-[11px]">En Tránsito</span>
    </div>

    <div class="flex items-center gap-2 text-xs">
      <div class="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] {pasoActual >= 3
        ? 'bg-emerald-500 text-white'
        : 'bg-slate-800 text-slate-500'}">
        3
      </div>
      <span class="{pasoActual >= 3 ? 'text-slate-200 font-semibold' : 'text-slate-500'} text-[11px]">Entregado</span>
    </div>
  </div>

  <!-- Ruta y Detalle de Carga -->
  <div class="space-y-2 mb-4 text-xs">
    <div class="flex items-center justify-between text-slate-300">
      <span class="text-slate-400">Origen:</span>
      <span class="font-medium text-white truncate ml-2 text-right">{obtenerLugar(solicitud.origen_establecimiento_id)}</span>
    </div>
    <div class="flex items-center justify-between text-slate-300">
      <span class="text-slate-400">Destino:</span>
      <span class="font-medium text-white truncate ml-2 text-right">{obtenerLugar(solicitud.destino_establecimiento_id)}</span>
    </div>
    <div class="flex items-center justify-between text-slate-300">
      <span class="text-slate-400">Carga / Distancia:</span>
      <span class="font-medium text-slate-200">
        {solicitud.tipo_carga} ({solicitud.peso_toneladas} TM) — ~{solicitud.distancia_km} km
      </span>
    </div>
    <div class="flex items-center justify-between pt-2 border-t border-slate-800/80">
      <span class="text-slate-400 font-semibold">Monto Neto a Cobrar:</span>
      <span class="text-base font-bold font-mono text-emerald-400">
        S/ {solicitud.costo_flete_bruto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
      </span>
    </div>
  </div>

  {#if errorMsg}
    <div class="mb-3 p-2.5 rounded-lg bg-red-950/70 border border-red-500/40 text-red-200 text-xs">
      {errorMsg}
    </div>
  {/if}

  <!-- Acciones para cambiar de fase -->
  <div class="pt-2">
    {#if solicitud.estado === 'ASIGNADO'}
      <button
        type="button"
        onclick={() => actualizarEstado('EN_TRANSITO')}
        disabled={isUpdating}
        class="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
      >
        {#if isUpdating}
          <span class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          <span>Actualizando Estado...</span>
        {:else}
          <span>🛣️ Iniciar Viaje (Marcar En Tránsito)</span>
        {/if}
      </button>
    {:else if solicitud.estado === 'EN_TRANSITO'}
      <button
        type="button"
        onclick={() => actualizarEstado('ENTREGADO')}
        disabled={isUpdating}
        class="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
      >
        {#if isUpdating}
          <span class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          <span>Registrando Entrega...</span>
        {:else}
          <span>🏁 Confirmar Entrega en Destino</span>
        {/if}
      </button>
    {:else if solicitud.estado === 'ENTREGADO'}
      <div class="w-full py-2 px-3 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 text-xs font-semibold text-center flex items-center justify-center gap-1.5">
        <span>✅</span>
        <span>Servicio Liquidado & Certificado de Entrega Emitido</span>
      </div>
    {/if}
  </div>
</div>
