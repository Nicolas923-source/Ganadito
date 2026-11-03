<script lang="ts">
  import type {
    SolicitudFactoringInput,
    FactoringCavaliRecord,
    FactoringCavaliResponse
  } from '@ganadito/contracts';

  interface Props {
    isOpen: boolean;
    apiBaseUrl?: string;
    authToken?: string | null;
    ordenIdPredeterminada?: string;
    comprobanteIdPredeterminado?: string;
    montoFacturaPredeterminado?: number;
    onClose: () => void;
    onFactoringSolicitado?: (record: FactoringCavaliRecord) => void;
  }

  let {
    isOpen = false,
    apiBaseUrl = 'http://localhost:3000',
    authToken = null,
    ordenIdPredeterminada = '',
    comprobanteIdPredeterminado = '',
    montoFacturaPredeterminado = 45000.0,
    onClose,
    onFactoringSolicitado
  }: Props = $props();

  let ordenId = $state('');
  let comprobanteId = $state('');
  let montoFactura = $state(45000.0);
  let porcentajeAdelanto = $state(80);
  let tasaMensual = $state(1.2);

  let isSubmitting = $state(false);
  let errorMsg = $state<string | null>(null);
  let resultadoFactoring = $state<FactoringCavaliRecord | null>(null);

  $effect(() => {
    if (ordenIdPredeterminada) ordenId = ordenIdPredeterminada;
    else if (!ordenId) ordenId = 'ord-bov-demo-01';

    if (comprobanteIdPredeterminado) comprobanteId = comprobanteIdPredeterminado;
    else if (!comprobanteId) comprobanteId = 'comp-fact-001';

    if (montoFacturaPredeterminado && montoFacturaPredeterminado > 0) {
      montoFactura = montoFacturaPredeterminado;
    }
  });

  // Cálculos financieros reactivos
  let adelantoBruto = $derived(Number((montoFactura * (porcentajeAdelanto / 100)).toFixed(2)));
  let costoFinanciero = $derived(Number((adelantoBruto * (tasaMensual / 100)).toFixed(2)));
  let desembolsoNeto = $derived(Number((adelantoBruto - costoFinanciero).toFixed(2)));

  async function solicitarFactoring() {
    errorMsg = null;
    resultadoFactoring = null;

    if (!ordenId.trim()) {
      errorMsg = 'Debes ingresar el ID de la orden de compra conformada.';
      return;
    }
    if (!comprobanteId.trim()) {
      errorMsg = 'Debes especificar el ID de la factura electrónica.';
      return;
    }
    if (montoFactura <= 0) {
      errorMsg = 'El monto de la factura debe ser mayor a 0.';
      return;
    }

    isSubmitting = true;

    const payload: SolicitudFactoringInput = {
      orden_id: ordenId.trim(),
      comprobante_id: comprobanteId.trim(),
      porcentaje_adelanto: Number(porcentajeAdelanto),
      tasa_descuento_mensual: Number(tasaMensual)
    };

    try {
      let record: FactoringCavaliRecord;

      if (authToken) {
        const res = await fetch(`${apiBaseUrl}/api/v1/fintech/cavali/solicitar-factoring`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `Error del servidor HTTP ${res.status}`);
        }

        const data: FactoringCavaliResponse = await res.json();
        record = data.solicitud;
      } else {
        // Simulación determinista en modo demo
        const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        record = {
          id: `fact-cavali-${Date.now().toString(36)}`,
          orden_id: ordenId,
          comprobante_id: comprobanteId,
          organizacion_id: 'org-vendedora-demo',
          monto_factura: montoFactura,
          porcentaje_adelanto: porcentajeAdelanto,
          tasa_descuento_mensual: tasaMensual,
          monto_adelanto_neto: desembolsoNeto,
          estado: 'CONFIRMADO',
          cavali_tracking_id: `CAVALI-ANOT-${randomId}-${Date.now()}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }

      resultadoFactoring = record;
      if (onFactoringSolicitado) {
        onFactoringSolicitado(record);
      }
    } catch (err: any) {
      errorMsg = err.message || 'Error al procesar la anotación de factoring con CAVALI.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
    <div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="flex items-center justify-between pb-4 border-b border-slate-800">
        <div class="flex items-center gap-2">
          <span class="text-xl">💰</span>
          <div>
            <h3 class="text-lg font-bold text-white">Solicitud de Factoring Electrónico CAVALI</h3>
            <p class="text-xs text-slate-400">Anotación en cuenta de Facturas Negociables (Ley N.° 29623)</p>
          </div>
        </div>
        <button
          type="button"
          onclick={onClose}
          class="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-sm"
        >
          ✕
        </button>
      </div>

      <!-- Banner de Liquidez -->
      <div class="my-4 p-3.5 bg-gradient-to-r from-blue-950/70 to-indigo-950/70 border border-blue-500/40 rounded-xl text-xs space-y-1 text-blue-200">
        <p class="font-bold text-blue-300 flex items-center gap-1.5">
          <span>⚡</span> Liquidez Inmediata en 24 a 48 Horas
        </p>
        <p class="text-[11px] leading-relaxed text-blue-100/90">
          Transforma tus facturas por cobrar a camales y frigoríficos en capital de trabajo inmediato sin esperar los 30 a 60 días de plazo comercial.
        </p>
      </div>

      {#if errorMsg}
        <div class="mb-4 p-3 rounded-xl bg-red-950/70 border border-red-500/40 text-red-200 text-xs">
          {errorMsg}
        </div>
      {/if}

      {#if resultadoFactoring}
        <!-- Confirmación de Anotación en Cuenta CAVALI -->
        <div class="my-4 p-4 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-xs space-y-3">
          <div class="flex items-center gap-2 font-bold text-emerald-300">
            <span>✓</span>
            <span>Factura Negociable Anotada en Cuenta Exitosamente</span>
          </div>

          <div class="space-y-1 font-mono text-[11px] bg-black/60 p-3 rounded-lg border border-slate-800">
            <p class="text-slate-400">CAVALI Tracking ID:</p>
            <p class="text-white font-bold break-all text-xs text-emerald-400">
              {resultadoFactoring.cavali_tracking_id}
            </p>
          </div>

          <div class="flex items-baseline justify-between pt-1">
            <span class="text-slate-300">Desembolso Líquido Aprobado:</span>
            <span class="text-lg font-black font-mono text-emerald-400">
              S/ {resultadoFactoring.monto_adelanto_neto?.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div class="pt-2 flex justify-end">
            <button
              type="button"
              onclick={onClose}
              class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
            >
              Entendido / Cerrar
            </button>
          </div>
        </div>
      {:else}
        <!-- Formulario y Calculadora -->
        <form onsubmit={(e) => { e.preventDefault(); solicitarFactoring(); }} class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label for="input-fact-orden" class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Orden Comercial ID
              </label>
              <input
                id="input-fact-orden"
                type="text"
                bind:value={ordenId}
                class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label for="input-fact-comp" class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Comprobante / Factura ID
              </label>
              <input
                id="input-fact-comp"
                type="text"
                bind:value={comprobanteId}
                class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>
          </div>

          <!-- Monto de la Factura -->
          <div>
            <label for="input-fact-monto" class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Importe Nominal de la Factura (PEN)
            </label>
            <div class="relative">
              <input
                id="input-fact-monto"
                type="number"
                step="0.01"
                min="100"
                bind:value={montoFactura}
                class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
              <span class="absolute right-3.5 top-2.5 text-xs text-slate-400 font-bold">PEN (S/)</span>
            </div>
          </div>

          <!-- Slider de Adelanto -->
          <div class="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800 space-y-2">
            <div class="flex items-center justify-between">
              <label for="range-adelanto" class="text-xs font-semibold text-slate-300">
                Porcentaje de Adelanto Inmediato:
              </label>
              <span class="font-mono font-bold text-emerald-400 text-sm">{porcentajeAdelanto}%</span>
            </div>
            <input
              id="range-adelanto"
              type="range"
              min="50"
              max="95"
              step="5"
              bind:value={porcentajeAdelanto}
              class="w-full accent-emerald-500"
            />
            <div class="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>50% (Conservador)</span>
              <span>80% (Estándar de Mercado)</span>
              <span>95% (Máximo)</span>
            </div>
          </div>

          <!-- Calculadora Financiera de Desembolso -->
          <div class="p-4 bg-slate-950/90 rounded-xl border border-slate-800 space-y-2.5 text-xs">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400 block pb-1 border-b border-slate-800">
              Proyección de Liquidación Financiera
            </span>

            <div class="flex justify-between text-slate-300">
              <span class="text-slate-400">Importe Adelantado ({porcentajeAdelanto}%):</span>
              <span class="font-mono font-medium text-white">S/ {adelantoBruto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
            </div>

            <div class="flex justify-between text-slate-300">
              <span class="text-slate-400">Costo Financiero Estimado ({tasaMensual}% mensual):</span>
              <span class="font-mono font-medium text-rose-400">- S/ {costoFinanciero.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
            </div>

            <div class="pt-2 border-t border-slate-800 flex items-baseline justify-between">
              <span class="text-xs font-bold text-slate-200">Liquidez Neta a Recibir:</span>
              <span class="text-xl font-black font-mono text-emerald-400">
                S/ {desembolsoNeto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <!-- Acciones -->
          <div class="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onclick={onClose}
              class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2"
            >
              {#if isSubmitting}
                <span class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Anotando en CAVALI...</span>
              {:else}
                <span>🚀 Confirmar y Solicitar Adelanto</span>
              {/if}
            </button>
          </div>
        </form>
      {/if}
    </div>
  </div>
{/if}
