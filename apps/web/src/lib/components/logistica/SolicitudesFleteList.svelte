<script lang="ts">
  import type {
    SolicitudFlete,
    UnidadTransporte,
    TipoCargaLogistica
  } from '@ganadito/contracts';

  interface Props {
    solicitudes: SolicitudFlete[];
    unidadesDisponibles?: UnidadTransporte[];
    isLoading?: boolean;
    authToken?: string | null;
    apiBaseUrl?: string;
    onTomarFleteExito?: (solicitudId: string, unidadId: string) => void;
    onAbrirRegistrarUnidad?: () => void;
  }

  let {
    solicitudes = [],
    unidadesDisponibles = [],
    isLoading = false,
    authToken = null,
    apiBaseUrl = 'http://localhost:3000',
    onTomarFleteExito,
    onAbrirRegistrarUnidad
  }: Props = $props();

  let filtroCarga = $state<'TODOS' | TipoCargaLogistica>('TODOS');
  let busquedaTexto = $state('');

  // Estado del modal de confirmación para tomar flete
  let solicitudSeleccionada = $state<SolicitudFlete | null>(null);
  let unidadSeleccionadaId = $state<string>('');
  let isTomandoFlete = $state(false);
  let mensajeError = $state<string | null>(null);
  let colision409Detectada = $state(false);

  // Mapeo amigable de IDs de establecimientos a nombres legibles
  const NOMBRES_ESTABLECIMIENTOS: Record<string, string> = {
    'est-lurin-01': 'Lima — Frigorífico & Camal Lurín',
    'est-oxapampa-01': 'Oxapampa — Fundo Ganadero Pozuzo',
    'est-huancayo-01': 'Huancayo — Establo Valle del Mantaro',
    'est-arequipa-01': 'Arequipa — Camal Metropolitano Yura',
    'est-trujillo-01': 'Trujillo — Complejo Pecuario Moche',
    'est-cajamarca-01': 'Cajamarca — Cuenca Baños del Inca',
    'est-puno-01': 'Puno — Hacienda Ganadera Melgar'
  };

  function obtenerNombreLugar(id: string): string {
    return NOMBRES_ESTABLECIMIENTOS[id] || id;
  }

  // Filtrado reactivo de cargas
  let solicitudesFiltradas = $derived.by(() => {
    return solicitudes.filter((sol) => {
      if (sol.estado !== 'PENDIENTE_ASIGNACION') return false;

      if (filtroCarga !== 'TODOS' && sol.tipo_carga !== filtroCarga) {
        return false;
      }

      if (busquedaTexto.trim()) {
        const query = busquedaTexto.toLowerCase();
        const orig = obtenerNombreLugar(sol.origen_establecimiento_id).toLowerCase();
        const dest = obtenerNombreLugar(sol.destino_establecimiento_id).toLowerCase();
        const id = sol.id.toLowerCase();
        if (!orig.includes(query) && !dest.includes(query) && !id.includes(query)) {
          return false;
        }
      }

      return true;
    });
  });

  function iniciarTomaFlete(sol: SolicitudFlete) {
    solicitudSeleccionada = sol;
    mensajeError = null;
    colision409Detectada = false;

    // Pre-seleccionar unidad disponible si existe
    if (unidadesDisponibles.length > 0 && unidadesDisponibles[0]) {
      unidadSeleccionadaId = unidadesDisponibles[0].id;
    } else {
      unidadSeleccionadaId = '';
    }
  }

  function cerrarModalToma() {
    solicitudSeleccionada = null;
    mensajeError = null;
    colision409Detectada = false;
  }

  async function confirmarTomarFlete() {
    if (!solicitudSeleccionada) return;

    if (!unidadSeleccionadaId && unidadesDisponibles.length === 0) {
      mensajeError = 'Debes homologar al menos una unidad de transporte vehicular para tomar fletes.';
      return;
    }

    if (!unidadSeleccionadaId && unidadesDisponibles.length > 0 && unidadesDisponibles[0]) {
      unidadSeleccionadaId = unidadesDisponibles[0].id;
    }

    isTomandoFlete = true;
    mensajeError = null;
    colision409Detectada = false;

    const solId = solicitudSeleccionada.id;
    const unidId = unidadSeleccionadaId;

    try {
      if (authToken) {
        const res = await fetch(`${apiBaseUrl}/api/v1/logistica/solicitudes/${solId}/tomar-flete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({ unidad_id: unidId })
        });

        if (res.status === 409) {
          colision409Detectada = true;
          throw new Error('Esta solicitud de flete acaba de ser adjudicada a otro transportista en tiempo real.');
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `Error del servidor HTTP ${res.status}`);
        }
      }

      // Notificar éxito al contenedor
      if (onTomarFleteExito) {
        onTomarFleteExito(solId, unidId);
      }

      cerrarModalToma();
    } catch (err: any) {
      mensajeError = err.message || 'Error al intentar adjudicar el flete.';
    } finally {
      isTomandoFlete = false;
    }
  }
</script>

<div class="space-y-6">
  <!-- Barra de Filtros y Búsqueda -->
  <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
    <!-- Pestañas de Tipo de Carga -->
    <div class="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
      <button
        type="button"
        onclick={() => (filtroCarga = 'TODOS')}
        class="px-3 py-1.5 rounded-lg transition-colors {filtroCarga === 'TODOS'
          ? 'bg-emerald-500 text-white shadow-sm'
          : 'bg-slate-900 text-slate-400 hover:text-white'}"
      >
        Todas las Cargas ({solicitudes.filter((s) => s.estado === 'PENDIENTE_ASIGNACION').length})
      </button>

      <button
        type="button"
        onclick={() => (filtroCarga = 'GANADO_EN_PIE')}
        class="px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 {filtroCarga === 'GANADO_EN_PIE'
          ? 'bg-emerald-500 text-white shadow-sm'
          : 'bg-slate-900 text-slate-400 hover:text-white'}"
      >
        <span>🐄</span> Ganado en Pie
      </button>

      <button
        type="button"
        onclick={() => (filtroCarga = 'CARNE_CANAL')}
        class="px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 {filtroCarga === 'CARNE_CANAL'
          ? 'bg-cyan-500 text-white shadow-sm'
          : 'bg-slate-900 text-slate-400 hover:text-white'}"
      >
        <span>❄️</span> Carne en Canal
      </button>

      <button
        type="button"
        onclick={() => (filtroCarga = 'INSUMOS_GRANOS')}
        class="px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 {filtroCarga === 'INSUMOS_GRANOS'
          ? 'bg-amber-500 text-white shadow-sm'
          : 'bg-slate-900 text-slate-400 hover:text-white'}"
      >
        <span>🌾</span> Granos / Insumos
      </button>
    </div>

    <!-- Buscador de Ruta / Terminal -->
    <div class="relative w-full sm:w-64">
      <input
        type="text"
        placeholder="Buscar origen, destino o ID..."
        bind:value={busquedaTexto}
        class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />
    </div>
  </div>

  <!-- Skeletons Loader cuando carga -->
  {#if isLoading}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {#each [1, 2, 3, 4, 5, 6] as _}
        <div class="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 animate-pulse space-y-4">
          <div class="flex items-center justify-between">
            <div class="h-4 w-28 bg-slate-800 rounded"></div>
            <div class="h-4 w-20 bg-slate-800 rounded"></div>
          </div>
          <div class="h-6 w-3/4 bg-slate-800 rounded"></div>
          <div class="h-10 w-full bg-slate-800/80 rounded"></div>
          <div class="h-8 w-full bg-slate-800 rounded"></div>
        </div>
      {/each}
    </div>
  {:else if solicitudesFiltradas.length === 0}
    <!-- Estado Vacío (Empty State) Accesible -->
    <div class="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-12 text-center max-w-lg mx-auto">
      <div class="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mx-auto mb-4 text-2xl border border-slate-800">
        📦
      </div>
      <h3 class="text-base font-bold text-white mb-2">No hay cargas disponibles con este criterio</h3>
      <p class="text-xs text-slate-400 mb-6">
        Actualmente no hay solicitudes de flete en espera para el filtro seleccionado. Puedes cotizar y publicar un nuevo envío o esperar a que productores y camales emitan órdenes.
      </p>
      {#if filtroCarga !== 'TODOS' || busquedaTexto}
        <button
          type="button"
          onclick={() => {
            filtroCarga = 'TODOS';
            busquedaTexto = '';
          }}
          class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
        >
          Limpiar Filtros
        </button>
      {/if}
    </div>
  {:else}
    <!-- Grid de Tarjetas de Carga Disponible -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {#each solicitudesFiltradas as solicitud (solicitud.id)}
        <div class="flex flex-col justify-between bg-slate-950/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-lg transition-all group">
          <div>
            <!-- Header de Tarjeta: Tipo de Carga e ID -->
            <div class="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-800/80">
              {#if solicitud.tipo_carga === 'GANADO_EN_PIE'}
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <span>🐄</span> Ganado en Pie
                </span>
              {:else if solicitud.tipo_carga === 'CARNE_CANAL'}
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  <span>❄️</span> Carne en Canal (Frío)
                </span>
              {:else}
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  <span>🌾</span> Insumos / Granos
                </span>
              {/if}

              <span class="text-[10px] font-mono text-slate-500">
                #{solicitud.id.substring(0, 8)}
              </span>
            </div>

            <!-- Ruta y Distancia Geodésica -->
            <div class="space-y-3 mb-4">
              <div class="flex items-start gap-2.5">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1 flex-shrink-0"></span>
                <div class="flex-1 min-w-0">
                  <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Origen</p>
                  <p class="text-xs font-semibold text-white truncate" title={obtenerNombreLugar(solicitud.origen_establecimiento_id)}>
                    {obtenerNombreLugar(solicitud.origen_establecimiento_id)}
                  </p>
                </div>
              </div>

              <div class="pl-1.5 -my-1 border-l-2 border-dashed border-slate-700 ml-1 py-1">
                <span class="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  ~{solicitud.distancia_km} km de travesía
                </span>
              </div>

              <div class="flex items-start gap-2.5">
                <span class="w-2.5 h-2.5 rounded-full bg-rose-500 mt-1 flex-shrink-0"></span>
                <div class="flex-1 min-w-0">
                  <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Destino</p>
                  <p class="text-xs font-semibold text-white truncate" title={obtenerNombreLugar(solicitud.destino_establecimiento_id)}>
                    {obtenerNombreLugar(solicitud.destino_establecimiento_id)}
                  </p>
                </div>
              </div>
            </div>

            <!-- Peso y Especificaciones -->
            <div class="grid grid-cols-2 gap-2 p-2.5 bg-slate-900/80 rounded-xl border border-slate-800/80 mb-4 text-xs">
              <div>
                <span class="text-[10px] text-slate-400 block">Peso Total:</span>
                <span class="font-bold text-slate-100 font-mono">{solicitud.peso_toneladas} TM</span>
              </div>
              <div>
                <span class="text-[10px] text-slate-400 block">Tipo Requerido:</span>
                <span class="font-medium text-slate-300 text-[11px] truncate block">
                  {solicitud.tipo_carga === 'CARNE_CANAL' ? 'Furgón Frío' : 'Camión Jaula'}
                </span>
              </div>
            </div>
          </div>

          <!-- Payout y Botón de Acción -->
          <div class="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
            <div>
              <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Pago Transportista:</span>
              <span class="text-lg font-black font-mono text-emerald-400">
                S/ {solicitud.costo_flete_bruto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <button
              type="button"
              onclick={() => iniciarTomaFlete(solicitud)}
              class="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs tracking-wide shadow-md shadow-emerald-600/20 transition-all active:scale-95"
            >
              Tomar Flete
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Modal Accesible para Tomar Carga / Seleccionar Unidad Vehicular -->
  {#if solicitudSeleccionada}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
        <div class="flex items-center justify-between pb-4 border-b border-slate-800">
          <div class="flex items-center gap-2">
            <span class="text-xl">🚛</span>
            <h3 class="text-lg font-bold text-white">Adjudicación de Carga de Flete</h3>
          </div>
          <button
            type="button"
            onclick={cerrarModalToma}
            class="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-sm"
          >
            ✕
          </button>
        </div>

        <!-- Alerta de Colisión 409 Conflict -->
        {#if colision409Detectada}
          <div class="my-4 p-4 rounded-xl bg-amber-950/70 border border-amber-500/40 text-amber-200 text-xs space-y-2">
            <div class="flex items-center gap-2 font-bold text-amber-300">
              <span>⚠️</span>
              <span>Carga Adjudicada a Otro Transportista</span>
            </div>
            <p>
              Esta solicitud acaba de ser asignada concurrentemente a otro operador mediante transacción atómica pesimista. El listado ha sido actualizado.
            </p>
          </div>
        {:else if mensajeError}
          <div class="my-4 p-3 rounded-xl bg-red-950/70 border border-red-500/40 text-red-200 text-xs">
            {mensajeError}
          </div>
        {/if}

        <div class="my-4 space-y-3 text-xs text-slate-300">
          <div class="p-3 bg-slate-950/70 rounded-xl border border-slate-800/80 space-y-2">
            <div class="flex justify-between">
              <span class="text-slate-400">Origen:</span>
              <span class="font-semibold text-white">{obtenerNombreLugar(solicitudSeleccionada.origen_establecimiento_id)}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Destino:</span>
              <span class="font-semibold text-white">{obtenerNombreLugar(solicitudSeleccionada.destino_establecimiento_id)}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Carga / Peso:</span>
              <span class="font-semibold text-emerald-400">{solicitudSeleccionada.tipo_carga} — {solicitudSeleccionada.peso_toneladas} TM</span>
            </div>
            <div class="flex justify-between pt-2 border-t border-slate-800">
              <span class="text-slate-400">Pago Neto Garantizado:</span>
              <span class="font-bold text-sm text-emerald-400 font-mono">
                S/ {solicitudSeleccionada.costo_flete_bruto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <!-- Selector de Unidad Vehicular -->
          <div>
            <label for="select-unidad-flete" class="block font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Unidad Vehicular Homologada a Asignar
            </label>
            {#if unidadesDisponibles.length > 0}
              <select
                id="select-unidad-flete"
                bind:value={unidadSeleccionadaId}
                class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {#each unidadesDisponibles as unidad}
                  <option value={unidad.id}>
                    Placa: {unidad.placa} ({unidad.tipo_unidad} — {unidad.capacidad_toneladas} TM)
                  </option>
                {/each}
              </select>
            {:else}
              <div class="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-slate-400">
                <p class="text-xs mb-2">No tienes unidades vehiculares registradas en tu perfil de transportista.</p>
                {#if onAbrirRegistrarUnidad}
                  <button
                    type="button"
                    onclick={() => {
                      cerrarModalToma();
                      onAbrirRegistrarUnidad();
                    }}
                    class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                  >
                    + Homologar Unidad Ahora
                  </button>
                {/if}
              </div>
            {/if}
          </div>
        </div>

        <div class="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onclick={cerrarModalToma}
            class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
          >
            Cancelar
          </button>
          <button
            type="button"
            onclick={confirmarTomarFlete}
            disabled={isTomandoFlete || colision409Detectada}
            class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2"
          >
            {#if isTomandoFlete}
              <span class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              <span>Adjudicando...</span>
            {:else}
              <span>Confirmar y Tomar Flete</span>
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
