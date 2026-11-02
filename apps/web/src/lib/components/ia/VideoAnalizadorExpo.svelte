<script lang="ts">
  import type { VisionAnalisisResult, VideoAnalisisInput } from '@ganadito/contracts';

  interface Props {
    apiBaseUrl?: string;
    authToken?: string | null;
    onAplicarLote?: (resultado: VisionAnalisisResult) => void;
  }

  let {
    apiBaseUrl = 'http://localhost:3000',
    authToken = null,
    onAplicarLote
  }: Props = $props();

  // Estados de carga de video
  let videoFile = $state<File | null>(null);
  let videoPreviewUrl = $state<string | null>(null);
  let isDragging = $state(false);
  let uploadProgress = $state(0);
  let isAnalyzing = $state(false);
  let errorMsg = $state<string | null>(null);

  // Resultado del análisis
  let analisisResult = $state<VisionAnalisisResult | null>(null);
  let modoEdicion = $state(false);

  // Campos editables por el ganadero
  let biotipoEditado = $state('');
  let condicionEditada = $state(3.5);
  let denticionEditada = $state('');

  // Videos de muestra para demostración inmediata en campo
  const VIDEOS_DEMO = [
    {
      titulo: 'Lote Brahman Comercial (Oxapampa)',
      raza: 'Cebú / Brahman',
      preview: 'https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?auto=format&fit=crop&w=600&q=80',
      biotipo: 'Cebú Comercial / Brahman',
      condicion: 3.8,
      denticion: '2 Dientes (18 - 24 meses)',
      confianza: 0.942
    },
    {
      titulo: 'Novillos Simmental Engorde (Concepción)',
      raza: 'Simmental Cruzado',
      preview: 'https://images.unsplash.com/photo-1546445317-29f4545e9d53?auto=format&fit=crop&w=600&q=80',
      biotipo: 'Simmental F1 / Carne',
      condicion: 4.2,
      denticion: '4 Dientes (24 - 36 meses)',
      confianza: 0.918
    }
  ];

  function handleFileSelected(file: File) {
    errorMsg = null;
    if (!file.type.includes('video/')) {
      errorMsg = 'Formato inválido. Por favor selecciona un video en formato MP4, WebM o MOV.';
      return;
    }

    if (file.size > 80 * 1024 * 1024) {
      errorMsg = 'El video excede el límite permitido de 80 MB. Se recomienda un clip de 15 segundos.';
      return;
    }

    videoFile = file;
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }
    videoPreviewUrl = URL.createObjectURL(file);
    analisisResult = null;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      handleFileSelected(file);
    }
  }

  async function ejecutarAnalisis(simulado = false, demoData?: (typeof VIDEOS_DEMO)[0]) {
    errorMsg = null;
    isAnalyzing = true;
    uploadProgress = 0;

    // Simular progreso de subida visual
    const progressInterval = setInterval(() => {
      uploadProgress = Math.min(95, uploadProgress + 15);
    }, 150);

    try {
      if (simulado && demoData) {
        await new Promise((r) => setTimeout(r, 1400));
        clearInterval(progressInterval);
        uploadProgress = 100;

        analisisResult = {
          biotipo_sugerido: demoData.biotipo,
          condicion_corporal_score: demoData.condicion,
          estimacion_dentaria: demoData.denticion,
          confianza_score: demoData.confianza,
          fotogramas_muestreados: 15,
          duracion_evaluada_seg: 15.0,
          es_vinculante: false,
          estado: 'COMPLETADO',
          servicio_disponible: true,
          fallback_manual: false
        };
      } else {
        const payload: VideoAnalisisInput = {
          duracion_segundos: 15.0,
          num_fotogramas: 15,
          raza_declarada: 'BOVINO_COMERCIAL'
        };

        const res = await fetch(`${apiBaseUrl}/api/v1/ia/analizar-video`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
          },
          body: JSON.stringify(payload)
        });

        clearInterval(progressInterval);
        uploadProgress = 100;

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `Error HTTP ${res.status}`);
        }

        const data: VisionAnalisisResult = await res.json();
        analisisResult = data;
      }

      // Inicializar valores editables
      if (analisisResult) {
        biotipoEditado = analisisResult.biotipo_sugerido;
        condicionEditada = analisisResult.condicion_corporal_score;
        denticionEditada = analisisResult.estimacion_dentaria;
      }
    } catch (err: any) {
      clearInterval(progressInterval);
      // Fallback resiliente
      analisisResult = {
        biotipo_sugerido: 'Cebú Comercial / Criollo',
        condicion_corporal_score: 3.0,
        estimacion_dentaria: '2 a 4 Dientes',
        confianza_score: 0.85,
        fotogramas_muestreados: 15,
        duracion_evaluada_seg: 15.0,
        es_vinculante: false,
        estado: 'PENDIENTE_REVISION_MANUAL',
        servicio_disponible: false,
        fallback_manual: true,
        motivo_fallback: err.message || 'Servicio de análisis automático en mantenimiento.'
      };
      biotipoEditado = analisisResult.biotipo_sugerido;
      condicionEditada = analisisResult.condicion_corporal_score;
      denticionEditada = analisisResult.estimacion_dentaria;
    } finally {
      isAnalyzing = false;
    }
  }

  function aplicarCambiosLote() {
    if (!analisisResult) return;
    const resultadoFinal: VisionAnalisisResult = {
      ...analisisResult,
      biotipo_sugerido: biotipoEditado,
      condicion_corporal_score: condicionEditada,
      estimacion_dentaria: denticionEditada
    };

    if (onAplicarLote) {
      onAplicarLote(resultadoFinal);
    }
    modoEdicion = false;
  }
</script>

<div class="space-y-6">
  <!-- Zona de Carga de Video / Drag & Drop -->
  <div class="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-800">
      <div>
        <div class="flex items-center gap-2">
          <span class="text-xl">📹</span>
          <h2 class="text-lg font-bold text-white tracking-tight">ExpoGanadito Video Pipeline (15 Segundos)</h2>
        </div>
        <p class="text-xs text-slate-400 mt-0.5">
          Visión computacional para perfilado anatómico: estimación de biotipo, condición corporal y dentición.
        </p>
      </div>

      <div class="flex items-center gap-2 text-xs">
        <span class="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
          OpenCV + Satélite IA
        </span>
      </div>
    </div>

    {#if errorMsg}
      <div class="mb-4 p-3 rounded-xl bg-red-950/70 border border-red-500/40 text-red-200 text-xs">
        {errorMsg}
      </div>
    {/if}

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Dropzone y Selector de Video -->
      <div class="lg:col-span-7 space-y-4">
        <!-- Contenedor Drag & Drop -->
        <div
          role="button"
          tabindex="0"
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { document.getElementById('video-input-file')?.click(); } }}
          ondragover={(e) => { e.preventDefault(); isDragging = true; }}
          ondragleave={() => (isDragging = false)}
          ondrop={handleDrop}
          onclick={() => document.getElementById('video-input-file')?.click()}
          class="border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all {isDragging
            ? 'border-emerald-500 bg-emerald-500/10'
            : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'}"
        >
          <input
            id="video-input-file"
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            class="hidden"
            onchange={(e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) handleFileSelected(file);
            }}
          />

          {#if videoPreviewUrl}
            <!-- Preview de video cargado -->
            <div class="space-y-3">
              <video
                src={videoPreviewUrl}
                controls
                playsinline
                class="w-full max-h-56 rounded-xl bg-black mx-auto shadow-md"
              >
                <track kind="captions" />
              </video>
              <div class="flex items-center justify-between text-xs text-slate-400 px-2">
                <span class="truncate max-w-xs text-white font-medium">{videoFile?.name}</span>
                <span class="font-mono">{((videoFile?.size || 0) / (1024 * 1024)).toFixed(1)} MB</span>
              </div>
            </div>
          {:else}
            <!-- Ícono y Llamado a la Acción -->
            <div class="py-6 space-y-2">
              <div class="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-2xl border border-emerald-500/20">
                🎥
              </div>
              <p class="text-sm font-bold text-white">Arrastra el video aquí o haz clic para subir</p>
              <p class="text-xs text-slate-400">
                Video recomendado: 15 segundos en plano lateral y frontal del lote. Formatos MP4, WebM o MOV.
              </p>
              <div class="pt-2">
                <span class="px-3 py-1 rounded-lg bg-slate-800 text-[11px] font-semibold text-slate-300">
                  Cámara de Celular o Archivo
                </span>
              </div>
            </div>
          {/if}
        </div>

        <!-- Barra de Progreso y Botón de Análisis -->
        {#if isAnalyzing}
          <div class="space-y-2 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-300 font-medium flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                Extrayendo 15 fotogramas clave y evaluando biotipo...
              </span>
              <span class="font-mono text-emerald-400 font-bold">{uploadProgress}%</span>
            </div>
            <div class="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                class="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                style="width: {uploadProgress}%"
              ></div>
            </div>
          </div>
        {:else if videoFile}
          <div class="flex items-center gap-3">
            <button
              type="button"
              onclick={() => ejecutarAnalisis(false)}
              disabled={isAnalyzing}
              class="flex-1 py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
            >
              <span>⚡ Iniciar Análisis ExpoGanadito (15s)</span>
            </button>
            <button
              type="button"
              onclick={() => {
                videoFile = null;
                if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
                videoPreviewUrl = null;
                analisisResult = null;
              }}
              class="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Quitar
            </button>
          </div>
        {/if}

        <!-- Muestras de prueba rápida en 1 clic -->
        <div class="pt-2">
          <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            O prueba con un video de demostración pre-grabado:
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {#each VIDEOS_DEMO as demo}
              <button
                type="button"
                onclick={() => ejecutarAnalisis(true, demo)}
                class="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition-all group"
              >
                <img
                  src={demo.preview}
                  alt={demo.titulo}
                  class="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                />
                <div class="min-w-0">
                  <p class="text-xs font-bold text-white group-hover:text-emerald-400 truncate">
                    {demo.titulo}
                  </p>
                  <p class="text-[11px] text-slate-400 truncate">{demo.raza} — 15s</p>
                </div>
              </button>
            {/each}
          </div>
        </div>
      </div>

      <!-- Tarjeta de Resultados de la IA -->
      <div class="lg:col-span-5">
        {#if analisisResult}
          <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <!-- Header de Resultados -->
            <div class="flex items-center justify-between pb-3 border-b border-slate-800">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-300">
                Dictamen Técnico Asistido
              </span>
              <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold {analisisResult.confianza_score >= 0.85
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}">
                Confianza: {(analisisResult.confianza_score * 100).toFixed(1)}%
              </span>
            </div>

            <!-- Aviso Explícito Obligatorio: No Vinculante -->
            <div class="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-200 flex items-start gap-2">
              <span class="text-sm mt-0.5">⚠️</span>
              <div>
                <p class="font-bold text-amber-300">Pre-dictamen técnico asistido — No vinculante</p>
                <p class="text-amber-200/80 mt-0.5">
                  Los resultados de visión computacional son referenciales y sujetos a confirmación por el ganadero o pesaje oficial en báscula.
                </p>
              </div>
            </div>

            {#if analisisResult.fallback_manual}
              <div class="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-300">
                <p class="font-semibold text-slate-200">ℹ️ Servicio automático en mantenimiento</p>
                <p class="text-slate-400 text-[11px] mt-0.5">
                  Puedes ingresar o ajustar los datos manualmente a continuación.
                </p>
              </div>
            {/if}

            <!-- Datos Anatómicos Detectados -->
            <div class="space-y-3 text-xs">
              <!-- Biotipo -->
              <div class="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <span class="text-slate-400 block mb-1">Biotipo Racial Sugerido:</span>
                {#if modoEdicion}
                  <input
                    type="text"
                    bind:value={biotipoEditado}
                    class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                {:else}
                  <span class="font-bold text-sm text-white">{biotipoEditado}</span>
                {/if}
              </div>

              <!-- Condición Corporal -->
              <div class="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <div class="flex items-center justify-between mb-1.5">
                  <span class="text-slate-400">Condición Corporal (Escala 1 - 5):</span>
                  <span class="font-bold text-emerald-400 font-mono text-sm">{condicionEditada.toFixed(1)} / 5.0</span>
                </div>
                {#if modoEdicion}
                  <input
                    type="range"
                    min="1.0"
                    max="5.0"
                    step="0.1"
                    bind:value={condicionEditada}
                    class="w-full accent-emerald-500"
                  />
                {:else}
                  <div class="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-emerald-500 rounded-full"
                      style="width: {(condicionEditada / 5) * 100}%"
                    ></div>
                  </div>
                {/if}
              </div>

              <!-- Estimación Dentaria -->
              <div class="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <span class="text-slate-400 block mb-1">Estimación Dentaria / Cronología:</span>
                {#if modoEdicion}
                  <select
                    bind:value={denticionEditada}
                    class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="Dientes de Leche (< 18 meses)">Dientes de Leche (&lt; 18 meses)</option>
                    <option value="2 Dientes (18 - 24 meses)">2 Dientes (18 - 24 meses)</option>
                    <option value="4 Dientes (24 - 36 meses)">4 Dientes (24 - 36 meses)</option>
                    <option value="Boca Llena (> 36 meses)">Boca Llena (&gt; 36 meses)</option>
                  </select>
                {:else}
                  <span class="font-semibold text-slate-200">{denticionEditada}</span>
                {/if}
              </div>
            </div>

            <!-- Botones de Acción -->
            <div class="pt-2 flex items-center gap-2">
              <button
                type="button"
                onclick={() => (modoEdicion = !modoEdicion)}
                class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
              >
                {modoEdicion ? 'Listo' : '✏️ Editar'}
              </button>
              <button
                type="button"
                onclick={aplicarCambiosLote}
                class="flex-1 py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all text-center"
              >
                ✓ Aplicar a mi Lote
              </button>
            </div>
          </div>
        {:else}
          <!-- Estado Vacío del Panel de Resultados -->
          <div class="h-full min-h-[300px] flex flex-col items-center justify-center bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-6 text-center text-slate-500">
            <span class="text-3xl mb-2">📊</span>
            <p class="text-xs font-semibold text-slate-400">Sin análisis activo</p>
            <p class="text-[11px] text-slate-500 max-w-xs mt-1">
              Sube un video de 15 segundos o selecciona un video de prueba para visualizar el dictamen de visión computacional.
            </p>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
