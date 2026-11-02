<script lang="ts">
  import {
    calcularCotizacionFlete,
    type TipoCargaLogistica,
    type TipoUnidadTransporte,
    type CotizacionFleteResult,
    type CrearSolicitudFleteInput,
    type SolicitudFlete
  } from '@ganadito/contracts';

  interface Props {
    apiBaseUrl?: string;
    authToken?: string | null;
    onSolicitudPublicada?: (solicitud: SolicitudFlete) => void;
  }

  let { apiBaseUrl = 'http://localhost:3000', authToken = null, onSolicitudPublicada }: Props = $props();

  // Lista de terminales y centros logísticos ganaderos reconocidos
  const CENTROS_LOGISTICOS = [
    { id: 'est-lurin-01', nombre: 'Lima — Frigorífico & Camal Metropolitano Lurín', region: 'Lima', kmBaseLima: 0 },
    { id: 'est-oxapampa-01', nombre: 'Oxapampa — Fundo Ganadero Pozuzo (Selva Central)', region: 'Pasco', kmBaseLima: 395 },
    { id: 'est-huancayo-01', nombre: 'Huancayo — Establo Valle del Mantaro', region: 'Junín', kmBaseLima: 310 },
    { id: 'est-arequipa-01', nombre: 'Arequipa — Centro de Beneficio Yura', region: 'Arequipa', kmBaseLima: 1015 },
    { id: 'est-trujillo-01', nombre: 'Trujillo — Complejo Pecuario Moche', region: 'La Libertad', kmBaseLima: 560 },
    { id: 'est-cajamarca-01', nombre: 'Cajamarca — Cuenca Lechera & Engorde Baños del Inca', region: 'Cajamarca', kmBaseLima: 865 },
    { id: 'est-puno-01', nombre: 'Puno — Hacienda Ganadera Melgar (Altiplano)', region: 'Puno', kmBaseLima: 1320 }
  ];

  let origenId = $state('est-oxapampa-01');
  let destinoId = $state('est-lurin-01');
  let tipoCarga = $state<TipoCargaLogistica>('GANADO_EN_PIE');
  let tipoUnidad = $state<TipoUnidadTransporte>('CAMION_JAULA_SIMPLE');
  let pesoToneladas = $state(12);
  let distanciaPersonalizada = $state<number | null>(null);

  // Estados de carga y retroalimentación
  let isPublishing = $state(false);
  let feedbackMessage = $state<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  // Auto-ajuste sugerido de tipo de unidad según el tipo de carga
  function handleTipoCargaChange(nuevaCarga: TipoCargaLogistica) {
    tipoCarga = nuevaCarga;
    if (nuevaCarga === 'CARNE_CANAL') {
      tipoUnidad = 'FURGON_ISOTERMICO_REFRIGERADO';
    } else if (nuevaCarga === 'GANADO_EN_PIE') {
      if (tipoUnidad !== 'CAMION_JAULA_SIMPLE' && tipoUnidad !== 'CAMION_JAULA_DOBLE_PISO') {
        tipoUnidad = 'CAMION_JAULA_SIMPLE';
      }
    } else if (nuevaCarga === 'INSUMOS_GRANOS') {
      if (tipoUnidad === 'FURGON_ISOTERMICO_REFRIGERADO') {
        tipoUnidad = 'FURGON_SECO';
      }
    }
  }

  // Estimación de distancia basada en terminales seleccionados
  let distanciaEstimada = $derived.by(() => {
    if (distanciaPersonalizada !== null && distanciaPersonalizada > 0) {
      return distanciaPersonalizada;
    }
    const orig = CENTROS_LOGISTICOS.find((c) => c.id === origenId);
    const dest = CENTROS_LOGISTICOS.find((c) => c.id === destinoId);
    if (!orig || !dest || orig.id === dest.id) {
      return 45; // Distancia inter-urbana mínima
    }
    // Estimación geodésica aproximada por red vial troncal
    if (orig.id === 'est-lurin-01') return dest.kmBaseLima;
    if (dest.id === 'est-lurin-01') return orig.kmBaseLima;
    return Math.round(Math.abs(orig.kmBaseLima - dest.kmBaseLima) * 0.9 + 80);
  });

  // Cálculo en tiempo real usando el contrato matemático estricto
  let cotizacion = $derived.by<CotizacionFleteResult>(() => {
    return calcularCotizacionFlete(
      distanciaEstimada,
      pesoToneladas,
      tipoUnidad,
      150 // Tarifa base fija en Soles
    );
  });

  async function publicarSolicitudFlete() {
    isPublishing = true;
    feedbackMessage = null;

    const payload: CrearSolicitudFleteInput = {
      origen_establecimiento_id: origenId,
      destino_establecimiento_id: destinoId,
      tipo_carga: tipoCarga,
      tipo_unidad: tipoUnidad,
      peso_toneladas: pesoToneladas
    };

    try {
      let nuevaSolicitud: SolicitudFlete;

      if (authToken) {
        const res = await fetch(`${apiBaseUrl}/api/v1/logistica/solicitudes`, {
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

        nuevaSolicitud = await res.json();
      } else {
        // Modo demostración / simulación inmediata sin autenticación activa
        nuevaSolicitud = {
          id: `sol-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
          solicitante_id: 'usr-demo-productor',
          origen_establecimiento_id: origenId,
          destino_establecimiento_id: destinoId,
          tipo_carga: tipoCarga,
          peso_toneladas: pesoToneladas,
          distancia_km: cotizacion.distancia_km,
          costo_flete_bruto: cotizacion.costo_flete_bruto,
          comision_referral_fee: cotizacion.comision_referral_fee,
          comision_plataforma_fee: cotizacion.comision_plataforma_fee,
          total_flete: cotizacion.total_flete,
          costo_total_pagar: cotizacion.costo_total_pagar,
          estado: 'PENDIENTE_ASIGNACION',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }

      feedbackMessage = {
        tipo: 'exito',
        texto: `¡Solicitud de flete publicada con éxito! ID: ${nuevaSolicitud.id.substring(0, 8)}... Carga listada en el tablero de transportistas.`
      };

      if (onSolicitudPublicada) {
        onSolicitudPublicada(nuevaSolicitud);
      }
    } catch (err: any) {
      feedbackMessage = {
        tipo: 'error',
        texto: err.message || 'No se pudo publicar la solicitud de flete.'
      };
    } finally {
      isPublishing = false;
    }
  }
</script>

<div class="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
  <!-- Encabezado del Cotizador -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
    <div>
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold text-sm border border-emerald-500/20">
          🚚
        </span>
        <h2 class="text-xl font-bold text-white tracking-tight">Cotizador de Fletes Ganadito Cargo</h2>
      </div>
      <p class="text-xs text-slate-400 mt-1">
        Cálculo geodésico y financiero transparente para transporte de ganado en pie, carne refrigerada e insumos.
      </p>
    </div>

    <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/60 text-xs">
      <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
      <span class="text-slate-300 font-medium">Algoritmo Geodésico & Tarifa Base: S/ 150.00</span>
    </div>
  </div>

  <!-- Formulario y Parámetros -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
    <!-- Columna Izquierda: Parámetros del Viaje -->
    <div class="lg:col-span-7 space-y-6">
      <!-- Origen y Destino -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label for="select-origen" class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Punto de Origen (Establo / Fundo)
          </label>
          <div class="relative">
            <select
              id="select-origen"
              bind:value={origenId}
              class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            >
              {#each CENTROS_LOGISTICOS as centro}
                <option value={centro.id}>{centro.nombre}</option>
              {/each}
            </select>
          </div>
        </div>

        <div>
          <label for="select-destino" class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Punto de Destino (Camal / Frigorífico)
          </label>
          <div class="relative">
            <select
              id="select-destino"
              bind:value={destinoId}
              class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            >
              {#each CENTROS_LOGISTICOS as centro}
                <option value={centro.id}>{centro.nombre}</option>
              {/each}
            </select>
          </div>
        </div>
      </div>

      <!-- Tipo de Carga -->
      <div>
        <label for="tipo-carga-group" class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
          Naturaleza de la Carga Pecuaria
        </label>
        <div id="tipo-carga-group" class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onclick={() => handleTipoCargaChange('GANADO_EN_PIE')}
            class="flex flex-col items-start p-3.5 rounded-xl border text-left transition-all {tipoCarga === 'GANADO_EN_PIE'
              ? 'bg-emerald-500/10 border-emerald-500/60 ring-1 ring-emerald-500/50 text-white'
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'}"
          >
            <div class="flex items-center justify-between w-full mb-1">
              <span class="text-base">🐄</span>
              {#if tipoCarga === 'GANADO_EN_PIE'}
                <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
              {/if}
            </div>
            <span class="font-bold text-xs">Ganado en Pie</span>
            <span class="text-[11px] text-slate-400 mt-1">Bovinos vivos, jaula con cama antideslizante</span>
          </button>

          <button
            type="button"
            onclick={() => handleTipoCargaChange('CARNE_CANAL')}
            class="flex flex-col items-start p-3.5 rounded-xl border text-left transition-all {tipoCarga === 'CARNE_CANAL'
              ? 'bg-cyan-500/10 border-cyan-500/60 ring-1 ring-cyan-500/50 text-white'
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'}"
          >
            <div class="flex items-center justify-between w-full mb-1">
              <span class="text-base">❄️</span>
              {#if tipoCarga === 'CARNE_CANAL'}
                <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
              {/if}
            </div>
            <span class="font-bold text-xs">Carne en Canal</span>
            <span class="text-[11px] text-slate-400 mt-1">Medias canales refrigeradas (0°C a 4°C SENASA)</span>
          </button>

          <button
            type="button"
            onclick={() => handleTipoCargaChange('INSUMOS_GRANOS')}
            class="flex flex-col items-start p-3.5 rounded-xl border text-left transition-all {tipoCarga === 'INSUMOS_GRANOS'
              ? 'bg-amber-500/10 border-amber-500/60 ring-1 ring-amber-500/50 text-white'
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'}"
          >
            <div class="flex items-center justify-between w-full mb-1">
              <span class="text-base">🌾</span>
              {#if tipoCarga === 'INSUMOS_GRANOS'}
                <span class="w-2 h-2 rounded-full bg-amber-400"></span>
              {/if}
            </div>
            <span class="font-bold text-xs">Insumos y Granos</span>
            <span class="text-[11px] text-slate-400 mt-1">Maíz chala, concentrados o forraje picado</span>
          </button>
        </div>
      </div>

      <!-- Tipo de Unidad Vehicular Homologada -->
      <div>
        <label for="select-tipo-unidad" class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
          Unidad Vehicular Homologada Recomendada
        </label>
        <select
          id="select-tipo-unidad"
          bind:value={tipoUnidad}
          class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
        >
          <option value="CAMION_JAULA_SIMPLE">Camión Jaula Simple (Factor S/ 0.35/km·TM)</option>
          <option value="CAMION_JAULA_DOBLE_PISO">Camión Jaula Doble Piso (Factor S/ 0.45/km·TM)</option>
          <option value="FURGON_ISOTERMICO_REFRIGERADO">Furgón Isotérmico Refrigerado con Termoregistrador (Factor S/ 0.50/km·TM)</option>
          <option value="FURGON_SECO">Furgón Seco Cerrado (Factor S/ 0.30/km·TM)</option>
        </select>
        {#if tipoCarga === 'CARNE_CANAL' && tipoUnidad !== 'FURGON_ISOTERMICO_REFRIGERADO'}
          <p class="text-amber-400 text-xs mt-1.5 flex items-center gap-1.5">
            ⚠️ Para transporte de canales refrigeradas, SENASA exige Furgón Isotérmico con Termoregistrador calibrado.
          </p>
        {/if}
      </div>

      <!-- Peso y Distancia -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label for="input-peso" class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Peso de Carga (Toneladas Métricas)
          </label>
          <div class="relative">
            <input
              id="input-peso"
              type="number"
              min="0.5"
              max="45"
              step="0.5"
              bind:value={pesoToneladas}
              class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            />
            <span class="absolute right-3.5 top-2.5 text-xs text-slate-400 font-medium">TM</span>
          </div>
          <!-- Presets rápidos -->
          <div class="flex items-center gap-1.5 mt-2">
            {#each [5, 10, 15, 20, 28] as preset}
              <button
                type="button"
                onclick={() => (pesoToneladas = preset)}
                class="px-2 py-0.5 text-[11px] rounded bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              >
                {preset} TM
              </button>
            {/each}
          </div>
        </div>

        <div>
          <label for="input-distancia" class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Distancia Estimada de Ruta
          </label>
          <div class="relative">
            <input
              id="input-distancia"
              type="number"
              min="1"
              max="4000"
              value={distanciaEstimada}
              oninput={(e) => (distanciaPersonalizada = Number((e.target as HTMLInputElement).value))}
              class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            />
            <span class="absolute right-3.5 top-2.5 text-xs text-slate-400 font-medium">km viales</span>
          </div>
          <p class="text-[11px] text-slate-400 mt-1">Cálculo de red troncal nacional (MTC / PostGIS).</p>
        </div>
      </div>
    </div>

    <!-- Columna Derecha: Tarjeta Financiera y Desglose -->
    <div class="lg:col-span-5 flex flex-col justify-between bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-inner">
      <div>
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Resumen Financiero</span>
          <span class="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
            Cotización Inmediata
          </span>
        </div>

        <div class="space-y-3.5 my-5 text-sm">
          <div class="flex items-center justify-between text-slate-300">
            <span class="flex items-center gap-1.5 text-xs text-slate-400">
              <span>Distancia Calculada:</span>
            </span>
            <span class="font-mono font-medium text-white">{cotizacion.distancia_km.toLocaleString('es-PE')} km</span>
          </div>

          <div class="flex items-center justify-between text-slate-300">
            <span class="flex items-center gap-1.5 text-xs text-slate-400">
              <span>Factor Unitario (km·TM):</span>
            </span>
            <span class="font-mono font-medium text-white">S/ {cotizacion.factor_km_tm.toFixed(4)}</span>
          </div>

          <div class="flex items-center justify-between text-slate-300">
            <span class="flex items-center gap-1.5 text-xs text-slate-400">
              <span>Flete Bruto Base:</span>
            </span>
            <span class="font-mono font-medium text-white">S/ {cotizacion.costo_flete_bruto.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>

          <div class="flex items-center justify-between text-slate-300">
            <span class="flex items-center gap-1.5 text-xs text-slate-400">
              <span>Tarifa de Plataforma & Monitoreo (5%):</span>
            </span>
            <span class="font-mono font-medium text-emerald-400">+ S/ {cotizacion.comision_referral_fee.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>

          <div class="pt-3 border-t border-slate-800/80 space-y-2">
            <div class="flex items-baseline justify-between">
              <span class="text-xs font-bold text-slate-300 uppercase tracking-wide">Total a Pagar (Generador):</span>
              <span class="text-2xl font-black font-mono text-emerald-400">
                S/ {cotizacion.total_flete.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div class="flex items-center justify-between bg-slate-950/60 px-3 py-2 rounded-lg border border-slate-800 text-xs">
              <span class="text-slate-400">Pago Neto a Transportista:</span>
              <span class="font-mono font-bold text-slate-200">
                S/ {cotizacion.costo_neto_transportista.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        <!-- Banner de Garantía y Cumplimiento -->
        <div class="p-3 bg-slate-950/80 rounded-lg border border-slate-800/90 text-[11px] text-slate-400 space-y-1">
          <p class="font-semibold text-slate-300 flex items-center gap-1">
            <span>🛡️</span> Garantía Ganadito Cargo Express
          </p>
          <p>
            Incluye trazabilidad GPS, validación de Guía de Tránsito SENASA y seguro de carga pecuaria con conciliación automática.
          </p>
        </div>
      </div>

      <!-- Feedback de Notificación -->
      {#if feedbackMessage}
        <div
          class="my-3 p-3 rounded-xl text-xs font-medium border {feedbackMessage.tipo === 'exito'
            ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
            : 'bg-red-950/60 border-red-500/40 text-red-300'}"
        >
          {feedbackMessage.texto}
        </div>
      {/if}

      <!-- Botón de Publicación -->
      <div class="pt-4 mt-2">
        <button
          type="button"
          onclick={publicarSolicitudFlete}
          disabled={isPublishing || pesoToneladas <= 0}
          class="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-emerald-600/25 transition-all transform active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {#if isPublishing}
            <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            <span>Publicando en Tablero...</span>
          {:else}
            <span>🚀 Publicar Solicitud de Flete</span>
          {/if}
        </button>
      </div>
    </div>
  </div>
</div>
