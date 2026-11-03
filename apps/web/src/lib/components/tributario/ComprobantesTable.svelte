<script lang="ts">
  import type {
    ComprobanteFiscalRecord,
    ConciliacionPendientesResponse,
    EstadoIntegracionTributaria
  } from '@ganadito/contracts';
  import EstadoSunatBadge from './EstadoSunatBadge.svelte';

  interface Props {
    comprobantes: ComprobanteFiscalRecord[];
    apiBaseUrl?: string;
    authToken?: string | null;
    isLoading?: boolean;
    onConciliacionExitosa?: (res: ConciliacionPendientesResponse) => void;
    onEmitirNuevaLiquidacion?: () => void;
  }

  let {
    comprobantes = [],
    apiBaseUrl = 'http://localhost:3000',
    authToken = null,
    isLoading = false,
    onConciliacionExitosa,
    onEmitirNuevaLiquidacion
  }: Props = $props();

  // Filtros
  let filtroEstado = $state<'TODOS' | EstadoIntegracionTributaria>('TODOS');
  let busqueda = $state('');

  // Drawer / Modal de detalle XML y CDR
  let comprobanteSeleccionado = $state<ComprobanteFiscalRecord | null>(null);

  // Estado de conciliación
  let isConciliando = $state(false);
  let feedbackConciliacion = $state<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  let comprobantesFiltrados = $derived.by(() => {
    return comprobantes.filter((comp) => {
      if (filtroEstado !== 'TODOS' && comp.estado_sunat !== filtroEstado) {
        return false;
      }
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase();
        const serieComp = `${comp.serie}-${comp.correlativo}`.toLowerCase();
        const emisor = comp.emisor_ruc.toLowerCase();
        const receptor = comp.receptor_num_doc.toLowerCase();
        const orden = comp.orden_id.toLowerCase();
        return (
          serieComp.includes(q) ||
          emisor.includes(q) ||
          receptor.includes(q) ||
          orden.includes(q)
        );
      }
      return true;
    });
  });

  let totalPendientes = $derived(
    comprobantes.filter((c) => c.estado_sunat === 'ENVIADO_PENDIENTE' || c.estado_sunat === 'REQUIERE_CONCILIACION').length
  );

  async function ejecutarConciliacion() {
    isConciliando = true;
    feedbackConciliacion = null;

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/tributario/conciliar-pendientes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        }
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Error HTTP ${res.status}`);
      }

      const resultado: ConciliacionPendientesResponse = await res.json();
      feedbackConciliacion = {
        tipo: 'exito',
        texto: `Conciliación completada: ${resultado.confirmados} comprobante(s) confirmados ante SUNAT.`
      };

      if (onConciliacionExitosa) {
        onConciliacionExitosa(resultado);
      }
    } catch (err: any) {
      feedbackConciliacion = {
        tipo: 'error',
        texto: err.message || 'Error al ejecutar la conciliación tributaria.'
      };
    } finally {
      isConciliando = false;
    }
  }

  function formatearFecha(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  }
</script>

<div class="space-y-6">
  <!-- Barra de Herramientas: Filtros, Búsqueda y Botón de Conciliación -->
  <div class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
    <!-- Pestañas de Estado -->
    <div class="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
      <button
        type="button"
        onclick={() => (filtroEstado = 'TODOS')}
        class="px-3 py-1.5 rounded-lg transition-colors {filtroEstado === 'TODOS'
          ? 'bg-emerald-500 text-white shadow-sm'
          : 'bg-slate-900 text-slate-400 hover:text-white'}"
      >
        Todos ({comprobantes.length})
      </button>

      <button
        type="button"
        onclick={() => (filtroEstado = 'CONFIRMADO')}
        class="px-3 py-1.5 rounded-lg transition-colors {filtroEstado === 'CONFIRMADO'
          ? 'bg-emerald-500 text-white shadow-sm'
          : 'bg-slate-900 text-slate-400 hover:text-white'}"
      >
        Confirmados ({comprobantes.filter((c) => c.estado_sunat === 'CONFIRMADO').length})
      </button>

      <button
        type="button"
        onclick={() => (filtroEstado = 'ENVIADO_PENDIENTE')}
        class="px-3 py-1.5 rounded-lg transition-colors {filtroEstado === 'ENVIADO_PENDIENTE'
          ? 'bg-amber-500 text-white shadow-sm'
          : 'bg-slate-900 text-slate-400 hover:text-white'}"
      >
        Pendientes ({comprobantes.filter((c) => c.estado_sunat === 'ENVIADO_PENDIENTE').length})
      </button>

      <button
        type="button"
        onclick={() => (filtroEstado = 'REQUIERE_CONCILIACION')}
        class="px-3 py-1.5 rounded-lg transition-colors {filtroEstado === 'REQUIERE_CONCILIACION'
          ? 'bg-purple-500 text-white shadow-sm'
          : 'bg-slate-900 text-slate-400 hover:text-white'}"
      >
        Conciliación ({comprobantes.filter((c) => c.estado_sunat === 'REQUIERE_CONCILIACION').length})
      </button>
    </div>

    <!-- Buscador y Acciones -->
    <div class="flex items-center gap-2.5">
      <div class="relative w-full sm:w-60">
        <input
          type="text"
          placeholder="Buscar serie, RUC, DNI o ID..."
          bind:value={busqueda}
          class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
        />
      </div>

      <!-- Botón de Conciliación Manual -->
      <button
        type="button"
        onclick={ejecutarConciliacion}
        disabled={isConciliando || totalPendientes === 0}
        class="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
        title="Reintentar y conciliar comprobantes pendientes con el servidor SEE-SUNAT"
      >
        {#if isConciliando}
          <span class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          <span>Conciliando...</span>
        {:else}
          <span>🔄 Conciliar Pendientes ({totalPendientes})</span>
        {/if}
      </button>

      {#if onEmitirNuevaLiquidacion}
        <button
          type="button"
          onclick={onEmitirNuevaLiquidacion}
          class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all whitespace-nowrap"
        >
          + Emitir Liquidación
        </button>
      {/if}
    </div>
  </div>

  {#if feedbackConciliacion}
    <div
      class="p-3 rounded-xl text-xs font-semibold border {feedbackConciliacion.tipo === 'exito'
        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
        : 'bg-red-950/60 border-red-500/40 text-red-300'}"
    >
      {feedbackConciliacion.texto}
    </div>
  {/if}

  <!-- Tabla Financiera Responsiva -->
  <div class="bg-slate-950/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
    {#if isLoading}
      <div class="p-8 space-y-4 animate-pulse">
        {#each [1, 2, 3, 4, 5] as _}
          <div class="h-10 bg-slate-900 rounded-xl"></div>
        {/each}
      </div>
    {:else if comprobantesFiltrados.length === 0}
      <div class="p-12 text-center text-slate-400">
        <span class="text-3xl block mb-2">📑</span>
        <p class="text-sm font-bold text-white">No se encontraron comprobantes fiscales</p>
        <p class="text-xs text-slate-500 mt-1">
          No hay liquidaciones de compra ni facturas electrónicas con los filtros seleccionados.
        </p>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs text-slate-300">
          <thead class="bg-slate-900/90 text-slate-400 uppercase font-semibold border-b border-slate-800">
            <tr>
              <th class="px-4 py-3">Serie - Correlativo</th>
              <th class="px-4 py-3">Tipo de Comprobante</th>
              <th class="px-4 py-3">Emisor (RUC)</th>
              <th class="px-4 py-3">Receptor (Doc)</th>
              <th class="px-4 py-3 text-right">Monto Total</th>
              <th class="px-4 py-3 text-center">Estado SUNAT</th>
              <th class="px-4 py-3">Fecha Emisión</th>
              <th class="px-4 py-3 text-center">Acción</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60 font-medium">
            {#each comprobantesFiltrados as comp (comp.id)}
              <tr class="hover:bg-slate-900/50 transition-colors group">
                <!-- Serie - Correlativo -->
                <td class="px-4 py-3 font-mono font-bold text-white whitespace-nowrap">
                  {comp.serie}-{String(comp.correlativo).padStart(8, '0')}
                </td>

                <!-- Tipo -->
                <td class="px-4 py-3 whitespace-nowrap">
                  {#if comp.tipo_comprobante === 'LIQUIDACION_COMPRA_ELECTRONICA'}
                    <span class="text-emerald-400 font-semibold">Liquidación de Compra</span>
                  {:else if comp.tipo_comprobante === 'FACTURA_ELECTRONICA'}
                    <span class="text-cyan-400 font-semibold">Factura Electrónica</span>
                  {:else}
                    <span class="text-slate-300">Boleta de Venta</span>
                  {/if}
                </td>

                <!-- Emisor RUC -->
                <td class="px-4 py-3 font-mono text-slate-300 whitespace-nowrap">
                  {comp.emisor_ruc}
                </td>

                <!-- Receptor Doc -->
                <td class="px-4 py-3 font-mono text-slate-200 whitespace-nowrap">
                  <span class="text-[10px] text-slate-500 mr-1">{comp.receptor_tipo_doc}:</span>
                  <span>{comp.receptor_num_doc}</span>
                </td>

                <!-- Monto Total -->
                <td class="px-4 py-3 text-right font-mono font-bold text-white whitespace-nowrap">
                  S/ {comp.monto_total.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>

                <!-- Estado SUNAT Badge -->
                <td class="px-4 py-3 text-center whitespace-nowrap">
                  <EstadoSunatBadge estado={comp.estado_sunat} compacto={true} />
                </td>

                <!-- Fecha -->
                <td class="px-4 py-3 text-slate-400 whitespace-nowrap">
                  {formatearFecha(comp.created_at)}
                </td>

                <!-- Detalle -->
                <td class="px-4 py-3 text-center whitespace-nowrap">
                  <button
                    type="button"
                    onclick={() => (comprobanteSeleccionado = comp)}
                    class="px-2.5 py-1 rounded-lg bg-slate-900 group-hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-[11px] font-semibold transition-colors"
                  >
                    Ver CDR
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  <!-- Modal / Drawer de Detalle XML y Mensaje CDR de SUNAT -->
  {#if comprobanteSeleccionado}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <!-- Header -->
        <div class="flex items-center justify-between pb-4 border-b border-slate-800">
          <div class="flex items-center gap-2">
            <span class="text-xl">🧾</span>
            <div>
              <h3 class="text-base font-bold text-white font-mono">
                {comprobanteSeleccionado.serie}-{String(comprobanteSeleccionado.correlativo).padStart(8, '0')}
              </h3>
              <p class="text-xs text-slate-400">Detalle Fiscal & Constancia de Recepción (CDR) SUNAT</p>
            </div>
          </div>
          <button
            type="button"
            onclick={() => (comprobanteSeleccionado = null)}
            class="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-sm"
          >
            ✕
          </button>
        </div>

        <div class="my-4 space-y-4 text-xs text-slate-300">
          <!-- Tarjeta de Estado y CDR -->
          <div class="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-slate-400 font-semibold uppercase tracking-wider">Estado SUNAT:</span>
              <EstadoSunatBadge estado={comprobanteSeleccionado.estado_sunat} />
            </div>

            <div class="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
              <div>
                <span class="text-slate-500 block text-[10px]">Código CDR SUNAT:</span>
                <span class="font-mono font-bold text-white">{comprobanteSeleccionado.cdr_sunat_codigo || '0 (Aceptado)'}</span>
              </div>
              <div>
                <span class="text-slate-500 block text-[10px]">Correlation ID:</span>
                <span class="font-mono text-slate-300 text-[11px] truncate block" title={comprobanteSeleccionado.external_correlation_id}>
                  {comprobanteSeleccionado.external_correlation_id}
                </span>
              </div>
            </div>

            <div class="pt-2 border-t border-slate-800/80">
              <span class="text-slate-500 block text-[10px]">Mensaje de Respuesta Tributaria:</span>
              <p class="text-emerald-300 font-medium text-xs mt-0.5">
                {comprobanteSeleccionado.cdr_sunat_mensaje || 'La Liquidación de Compra ha sido aceptada por la Superintendencia Nacional de Aduanas y de Administración Tributaria (SUNAT).'}
              </p>
            </div>
          </div>

          <!-- Datos de la Operación Comercial -->
          <div class="grid grid-cols-2 gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <div>
              <span class="text-slate-400 block text-[10px]">RUC Emisor:</span>
              <span class="font-mono font-bold text-white">{comprobanteSeleccionado.emisor_ruc}</span>
            </div>
            <div>
              <span class="text-slate-400 block text-[10px]">Receptor ({comprobanteSeleccionado.receptor_tipo_doc}):</span>
              <span class="font-mono font-bold text-white">{comprobanteSeleccionado.receptor_num_doc}</span>
            </div>
            <div>
              <span class="text-slate-400 block text-[10px]">Monto Subtotal:</span>
              <span class="font-mono text-slate-200">S/ {comprobanteSeleccionado.monto_subtotal.toFixed(2)}</span>
            </div>
            <div>
              <span class="text-slate-400 block text-[10px]">Monto Total PEN:</span>
              <span class="font-mono font-black text-emerald-400 text-sm">S/ {comprobanteSeleccionado.monto_total.toFixed(2)}</span>
            </div>
          </div>

          <!-- Resumen de Payload XML -->
          <div>
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Payload XML Estructurado (SEE-SUNAT UBL 2.1)
            </span>
            <pre class="bg-black/80 text-emerald-400 p-3 rounded-xl border border-slate-800 font-mono text-[11px] overflow-x-auto max-h-48 leading-relaxed">
{JSON.stringify(comprobanteSeleccionado.xml_payload_resumen, null, 2)}
            </pre>
          </div>
        </div>

        <div class="pt-3 border-t border-slate-800 flex items-center justify-end">
          <button
            type="button"
            onclick={() => (comprobanteSeleccionado = null)}
            class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
          >
            Cerrar Detalle
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
