<script lang="ts">
  import type { LiquidacionCompraInput, EmisionComprobanteResponse, ComprobanteFiscalRecord } from '@ganadito/contracts';

  interface Props {
    isOpen: boolean;
    apiBaseUrl?: string;
    authToken?: string | null;
    ordenCompraIdPredeterminada?: string;
    onClose: () => void;
    onLiquidacionEmitida?: (comprobante: ComprobanteFiscalRecord) => void;
  }

  let {
    isOpen = false,
    apiBaseUrl = 'http://localhost:3000',
    authToken = null,
    ordenCompraIdPredeterminada = '',
    onClose,
    onLiquidacionEmitida
  }: Props = $props();

  let ordenCompraId = $state('');
  let emisorRuc = $state('20608492015');
  let emisorRazonSocial = $state('Frigorífico Metropolitano Lurín S.A.C.');
  let productorDni = $state('45892134');
  let productorNombre = $state('Juan Quispe Huamán (Fundo Ganadero Pozuzo)');
  let productorPpaCodigo = $state('PPA-2026-89421');
  let montoTotalPen = $state(28450.0);

  let isSubmitting = $state(false);
  let errorMsg = $state<string | null>(null);

  $effect(() => {
    if (ordenCompraIdPredeterminada) {
      ordenCompraId = ordenCompraIdPredeterminada;
    } else if (!ordenCompraId) {
      ordenCompraId = 'ord-demo-001';
    }
  });

  async function emitirLiquidacion() {
    errorMsg = null;

    if (!ordenCompraId.trim()) {
      errorMsg = 'Debes especificar el ID de la orden de compra liquidada.';
      return;
    }
    if (!/^\d{11}$/.test(emisorRuc.trim())) {
      errorMsg = 'El RUC del emisor debe tener exactamente 11 dígitos.';
      return;
    }
    if (!/^\d{8}$/.test(productorDni.trim())) {
      errorMsg = 'El DNI del productor ganadero debe tener exactamente 8 dígitos.';
      return;
    }
    if (montoTotalPen <= 0) {
      errorMsg = 'El monto total debe ser un valor positivo en Soles (PEN).';
      return;
    }

    isSubmitting = true;

    const payload: LiquidacionCompraInput = {
      orden_compra_id: ordenCompraId.trim(),
      emisor_ruc: emisorRuc.trim(),
      emisor_razon_social: emisorRazonSocial.trim(),
      productor_dni: productorDni.trim(),
      productor_nombre: productorNombre.trim(),
      productor_ppa_codigo: productorPpaCodigo.trim() || null,
      monto_total_pen: Number(montoTotalPen),
      items: [
        {
          descripcion: 'Lote Bovino en Pie para Beneficio (Régimen PPA)',
          cantidad: 1,
          unidad_medida: 'NIU',
          precio_unitario_pen: Number(montoTotalPen),
          monto_total_pen: Number(montoTotalPen)
        }
      ]
    };

    try {
      let nuevoComprobante: ComprobanteFiscalRecord;

      if (authToken) {
        const res = await fetch(`${apiBaseUrl}/api/v1/tributario/liquidaciones-compra`, {
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

        const data: EmisionComprobanteResponse = await res.json();
        nuevoComprobante = data.comprobante;
      } else {
        // Simulación determinista en modo demo
        const correlativoNum = Math.floor(Math.random() * 900) + 100;
        nuevoComprobante = {
          id: `comp-liq-${Date.now().toString(36)}`,
          orden_id: ordenCompraId,
          tipo_comprobante: 'LIQUIDACION_COMPRA_ELECTRONICA',
          serie: 'E001',
          correlativo: correlativoNum,
          emisor_ruc: emisorRuc,
          receptor_num_doc: productorDni,
          receptor_tipo_doc: 'DNI',
          monto_subtotal: Number(montoTotalPen),
          monto_igv: 0.0,
          monto_total: Number(montoTotalPen),
          estado_sunat: 'CONFIRMADO',
          external_correlation_id: `SUNAT-E001-${correlativoNum}-${Date.now()}`,
          xml_payload_resumen: {
            emisor: { ruc: emisorRuc, razon_social: emisorRazonSocial },
            receptor: { dni: productorDni, nombre: productorNombre, ppa: productorPpaCodigo },
            totales: { subtotal: montoTotalPen, igv: 0.0, total: montoTotalPen },
            exonerado_igv_ppa: true
          },
          cdr_sunat_codigo: '0',
          cdr_sunat_mensaje: 'La Liquidación de Compra ha sido aceptada por SUNAT.',
          retry_count: 0,
          next_retry_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }

      if (onLiquidacionEmitida) {
        onLiquidacionEmitida(nuevoComprobante);
      }
      onClose();
    } catch (err: any) {
      errorMsg = err.message || 'Error al emitir la liquidación de compra.';
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
          <span class="text-xl">🏛️</span>
          <div>
            <h3 class="text-lg font-bold text-white">Emitir Liquidación de Compra Electrónica (SEE-SUNAT)</h3>
            <p class="text-xs text-slate-400">Comprobante tributario serie E001 para productores agrarios sin RUC</p>
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

      <!-- Alerta Destacada: Escudo Fiscal PPA -->
      <div class="my-4 p-4 rounded-xl bg-gradient-to-r from-emerald-950/70 to-teal-950/70 border border-emerald-500/40 text-emerald-200 text-xs space-y-1.5 shadow-md">
        <div class="flex items-center gap-2 font-bold text-emerald-300">
          <span class="text-base">🛡️</span>
          <span>Escudo Fiscal & Deducibilidad del 100% de Impuesto a la Renta</span>
        </div>
        <p class="leading-relaxed text-[11px] text-emerald-100/90">
          Sustento de gasto 100% deducible de Impuesto a la Renta (tasa corporativa 29.5%) bajo el régimen del Padrón de Productores Agrarios (PPA). Operación de compra exonerada de IGV conforme al D.Leg. N.° 1521 y Ley N.° 31075.
        </p>
      </div>

      {#if errorMsg}
        <div class="mb-4 p-3 rounded-xl bg-red-950/70 border border-red-500/40 text-red-200 text-xs">
          {errorMsg}
        </div>
      {/if}

      <!-- Formulario de Emisión -->
      <form onsubmit={(e) => { e.preventDefault(); emitirLiquidacion(); }} class="space-y-4">
        <!-- Orden Vinculada -->
        <div>
          <label for="input-orden-id" class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
            ID de Orden de Compra Comercial (Debe estar LIQUIDADA)
          </label>
          <input
            id="input-orden-id"
            type="text"
            bind:value={ordenCompraId}
            placeholder="Ej: ord-bov-demo-01"
            class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
        </div>

        <!-- Emisor (Frigorífico / Comprador) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label for="input-emisor-ruc" class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              RUC del Emisor (Comprador)
            </label>
            <input
              id="input-emisor-ruc"
              type="text"
              maxlength="11"
              bind:value={emisorRuc}
              class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>
          <div>
            <label for="input-emisor-razon" class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Razón Social del Emisor
            </label>
            <input
              id="input-emisor-razon"
              type="text"
              bind:value={emisorRazonSocial}
              class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>
        </div>

        <!-- Productor Ganadero (Receptor sin RUC) -->
        <div class="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800 space-y-3">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            Datos del Productor Ganadero (Receptor)
          </span>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label for="input-productor-dni" class="block text-slate-400 text-[11px] mb-1 font-semibold">
                DNI del Productor (8 dígitos)
              </label>
              <input
                id="input-productor-dni"
                type="text"
                maxlength="8"
                bind:value={productorDni}
                class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label for="input-productor-ppa" class="block text-slate-400 text-[11px] mb-1 font-semibold">
                Código PPA (Padrón MIDAGRI)
              </label>
              <input
                id="input-productor-ppa"
                type="text"
                bind:value={productorPpaCodigo}
                placeholder="PPA-XXXX-XXXXX"
                class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-emerald-400 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label for="input-productor-nombre" class="block text-slate-400 text-[11px] mb-1 font-semibold">
              Nombres y Apellidos Completos
            </label>
            <input
              id="input-productor-nombre"
              type="text"
              bind:value={productorNombre}
              class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              required
            />
          </div>
        </div>

        <!-- Monto Total PEN -->
        <div>
          <label for="input-monto-total" class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
            Importe Total de la Operación (PEN S/)
          </label>
          <div class="relative">
            <input
              id="input-monto-total"
              type="number"
              step="0.01"
              min="1"
              bind:value={montoTotalPen}
              class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-emerald-400 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
            <span class="absolute right-3.5 top-2.5 text-xs text-slate-400 font-bold">PEN (S/)</span>
          </div>
        </div>

        <!-- Acciones -->
        <div class="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
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
            class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2"
          >
            {#if isSubmitting}
              <span class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              <span>Emitiendo en SUNAT...</span>
            {:else}
              <span>✓ Emitir y Transmitir a SUNAT</span>
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
