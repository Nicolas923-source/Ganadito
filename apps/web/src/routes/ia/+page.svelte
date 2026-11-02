<script lang="ts">
  import { browser } from '$app/environment';
  import type { VisionAnalisisResult, ChecklistMinsaResult } from '@ganadito/contracts';

  import VideoAnalizadorExpo from '../../lib/components/ia/VideoAnalizadorExpo.svelte';
  import AnalizadorCarneColor from '../../lib/components/ia/AnalizadorCarneColor.svelte';
  import ChecklistMinsaModal from '../../lib/components/ia/ChecklistMinsaModal.svelte';
  import DirectorioZoosanitario from '../../lib/components/ia/DirectorioZoosanitario.svelte';

  type TabIA = 'EXPOGANADITO' | 'BROMATOLOGIA' | 'DIRECTORIO';

  let tabActiva = $state<TabIA>('EXPOGANADITO');

  let isChecklistModalAbierto = $state(false);
  let loteIdActual = $state('LOTE-BOV-SELVA-01');
  let ultimoDictamen = $state<ChecklistMinsaResult | null>(null);
  let notificacionExito = $state<string | null>(null);

  // URL de API y Token
  let apiBaseUrl = $derived(
    browser
      ? import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`
      : 'http://localhost:3000'
  );

  let authToken = $state<string | null>(null);

  $effect(() => {
    if (browser) {
      authToken = localStorage.getItem('token');
    }
  });

  function handleLoteAplicado(resultado: VisionAnalisisResult) {
    notificacionExito = `¡Biotipo "${resultado.biotipo_sugerido}" y Condición ${resultado.condicion_corporal_score}/5.0 aplicados con éxito al lote!`;
    setTimeout(() => {
      notificacionExito = null;
    }, 6000);
  }

  function handleDictamenEmitido(resultado: ChecklistMinsaResult) {
    ultimoDictamen = resultado;
    notificacionExito = `Dictamen Sanitario emitido: ${resultado.aprobado_sanitariamente ? 'APROBADO' : 'OBSERVADO'} (RM N.° 822-2018/MINSA).`;
    setTimeout(() => {
      notificacionExito = null;
    }, 6000);
  }
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
  <!-- Banner Superior: Inteligencia Artificial Ganadera -->
  <div class="bg-gradient-to-r from-slate-950 via-slate-900 to-teal-950/40 border border-slate-800 rounded-3xl p-6 sm:p-8 mb-8 shadow-2xl relative overflow-hidden">
    <div class="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
      <div class="max-w-2xl">
        <div class="flex items-center gap-2 mb-3">
          <span class="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-teal-500/10 text-teal-400 border border-teal-500/30">
            Inteligencia Artificial Pecuaria
          </span>
          <span class="text-xs text-slate-400 font-medium">Satélite Python 3.11+ & OpenCV</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          ExpoGanadito Video Pipeline & Dr. Ganadito IA
        </h1>
        <p class="text-sm text-slate-300 mt-2 leading-relaxed">
          Perfilado biométrico de lotes bovinos en videos de 15 segundos y análisis colorimétrico CIELAB en canales cárnicas con detección precoz de carne DFD y checklist sanitario oficial RM N.° 822-2018/MINSA.
        </p>
      </div>

      <!-- Métricas y Estado del Satélite -->
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 text-center">
          <span class="text-[11px] uppercase tracking-wider text-slate-400 block font-semibold">Video Pipeline</span>
          <span class="text-xl font-black font-mono text-emerald-400">15s / 15 FPS</span>
          <span class="text-[10px] text-slate-500 block mt-0.5">Muestreo clave</span>
        </div>

        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 text-center">
          <span class="text-[11px] uppercase tracking-wider text-slate-400 block font-semibold">Espacio Color</span>
          <span class="text-xl font-black font-mono text-cyan-400">CIE L*a*b*</span>
          <span class="text-[10px] text-slate-500 block mt-0.5">Umbral DFD L* &lt; 46</span>
        </div>

        <div class="col-span-2 sm:col-span-1 bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 text-center">
          <span class="text-[11px] uppercase tracking-wider text-slate-400 block font-semibold">Norma Sanitaria</span>
          <span class="text-xl font-black font-mono text-teal-400">0°C a 4°C</span>
          <span class="text-[10px] text-slate-500 block mt-0.5">RM 822-2018</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Toast / Notificación Global -->
  {#if notificacionExito}
    <div class="mb-6 p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs font-semibold shadow-lg flex items-center justify-between animate-fade-in">
      <div class="flex items-center gap-2">
        <span class="text-base">✓</span>
        <span>{notificacionExito}</span>
      </div>
      <button
        type="button"
        onclick={() => (notificacionExito = null)}
        class="text-emerald-400 hover:text-white text-xs px-2"
      >
        ✕
      </button>
    </div>
  {/if}

  <!-- Pestañas de Navegación del Módulo IA -->
  <div class="flex items-center gap-2 border-b border-slate-800 mb-8 pb-3 overflow-x-auto text-sm font-semibold">
    <button
      type="button"
      onclick={() => (tabActiva = 'EXPOGANADITO')}
      class="px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap {tabActiva === 'EXPOGANADITO'
        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
        : 'text-slate-400 hover:text-white hover:bg-slate-900'}"
    >
      <span>🎥</span>
      <span>ExpoGanadito (Visión de Lotes 15s)</span>
    </button>

    <button
      type="button"
      onclick={() => (tabActiva = 'BROMATOLOGIA')}
      class="px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap {tabActiva === 'BROMATOLOGIA'
        ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
        : 'text-slate-400 hover:text-white hover:bg-slate-900'}"
    >
      <span>🥩</span>
      <span>Dr. Ganadito (Bromatología de Carne)</span>
    </button>

    <button
      type="button"
      onclick={() => (tabActiva = 'DIRECTORIO')}
      class="px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap {tabActiva === 'DIRECTORIO'
        ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
        : 'text-slate-400 hover:text-white hover:bg-slate-900'}"
    >
      <span>👨‍⚕️</span>
      <span>Directorio Zoosanitario SENASA</span>
    </button>
  </div>

  <!-- Contenido de las Pestañas -->
  {#if tabActiva === 'EXPOGANADITO'}
    <VideoAnalizadorExpo
      {apiBaseUrl}
      {authToken}
      onAplicarLote={handleLoteAplicado}
    />
  {:else if tabActiva === 'BROMATOLOGIA'}
    <div class="space-y-8">
      <AnalizadorCarneColor
        {apiBaseUrl}
        {authToken}
        onAbrirChecklistMinsa={() => (isChecklistModalAbierto = true)}
      />

      <!-- Sección de Acceso Rápido al Checklist Sanitario Oficial -->
      <div class="bg-slate-950/60 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 class="text-sm font-bold text-white flex items-center gap-2">
            <span>📋</span> Protocolo Oficial de Inocuidad Cárnica — RM N.° 822-2018/MINSA
          </h3>
          <p class="text-xs text-slate-400 mt-1 max-w-2xl">
            Obligatorio para recepción de canales en frigoríficos, salas de despiece y camales. Permite registrar temperatura de cámara en frío (0 °C a 4 °C) y dictamen organoléptico.
          </p>
        </div>

        <button
          type="button"
          onclick={() => (isChecklistModalAbierto = true)}
          class="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md transition-all whitespace-nowrap"
        >
          Abrir Checklist Sanitario
        </button>
      </div>
    </div>
  {:else if tabActiva === 'DIRECTORIO'}
    <DirectorioZoosanitario />
  {/if}

  <!-- Modal Interactivo del Checklist MINSA -->
  <ChecklistMinsaModal
    isOpen={isChecklistModalAbierto}
    {apiBaseUrl}
    {authToken}
    loteId={loteIdActual}
    onClose={() => (isChecklistModalAbierto = false)}
    onDictamenEmitido={handleDictamenEmitido}
  />
</div>
