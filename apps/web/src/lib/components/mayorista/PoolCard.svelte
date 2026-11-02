<script lang="ts">
  import type { PoolConProgreso, PoolCompraMayorista, TipoProductoMayorista } from '@ganadito/contracts';

  interface Props {
    pool: PoolConProgreso | PoolCompraMayorista;
    onUnirse?: (pool: PoolConProgreso | PoolCompraMayorista) => void;
  }

  let { pool, onUnirse }: Props = $props();

  // Temporizador regresivo dinámico
  let tiempoRestante = $state({
    horas: 0,
    minutos: 0,
    segundos: 0,
    expirado: false
  });

  function calcularTiempoRestante() {
    const ahora = Date.now();
    const limite = new Date(pool.fecha_limite).getTime();
    const diferenciaMs = limite - ahora;

    if (diferenciaMs <= 0) {
      tiempoRestante = { horas: 0, minutos: 0, segundos: 0, expirado: true };
      return;
    }

    const horas = Math.floor(diferenciaMs / (1000 * 60 * 60));
    const minutos = Math.floor((diferenciaMs % (1000 * 60 * 60)) / (1000 * 60));
    const segundos = Math.floor((diferenciaMs % (1000 * 60)) / 1000);

    tiempoRestante = { horas, minutos, segundos, expirado: false };
  }

  $effect(() => {
    calcularTiempoRestante();
    const interval = setInterval(calcularTiempoRestante, 1000);
    return () => clearInterval(interval);
  });

  // Progreso porcentual reactivo
  let porcentajeProgreso = $derived(
    pool.progreso_porcentaje !== undefined
      ? pool.progreso_porcentaje
      : pool.meta_volumen > 0
        ? Math.min(100, Math.round((pool.volumen_acumulado / pool.meta_volumen) * 100))
        : 0
  );

  let metaAlcanzada = $derived(
    pool.estado === 'ALCANZADO' || pool.volumen_acumulado >= pool.meta_volumen
  );

  let volumenRestante = $derived(
    Math.max(0, pool.meta_volumen - pool.volumen_acumulado)
  );

  // Mapeo legible de tipos de productos
  const ETIQUETAS_PRODUCTO: Record<TipoProductoMayorista, { texto: string; estilo: string }> = {
    MEDIAS_CANALES: { texto: 'Medias Canales', estilo: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
    CUARTOS_COMPENSADOS: { texto: 'Cuartos Compensados', estilo: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
    CORTES_CALIBRADOS: { texto: 'Cortes Calibrados', estilo: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    GRANO_FORRAJE: { texto: 'Grano & Forraje', estilo: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
    INSUMO_AGRICOLA: { texto: 'Insumo Agrícola', estilo: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
    EQUIPAMIENTO_SANITARIO: { texto: 'Equipamiento Sanitario', estilo: 'bg-purple-500/10 text-purple-400 border-purple-500/30' }
  };

  let infoProducto = $derived(
    ETIQUETAS_PRODUCTO[pool.tipo_producto] || {
      texto: pool.tipo_producto,
      estilo: 'bg-slate-800 text-slate-300 border-slate-700'
    }
  );
</script>

<div
  class="bg-slate-900 border rounded-2xl p-5 shadow-xl transition-all duration-200 hover:shadow-2xl flex flex-col justify-between relative overflow-hidden group {pool.es_oferta_flash
    ? 'border-amber-500/40 hover:border-amber-500/80 bg-gradient-to-b from-slate-900 via-slate-900 to-amber-950/20'
    : 'border-slate-800 hover:border-slate-700'}"
>
  <!-- Barra decorativa superior si es flash o meta alcanzada -->
  {#if pool.es_oferta_flash}
    <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600"></div>
  {:else if metaAlcanzada}
    <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600"></div>
  {/if}

  <div class="space-y-4">
    <!-- Fila superior: Badges de Tipo, Flash y Estado -->
    <div class="flex items-center justify-between gap-2">
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold border {infoProducto.estilo}">
          {infoProducto.texto}
        </span>

        {#if pool.es_oferta_flash}
          <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 flex items-center gap-1 shadow-sm">
            <span>⚡ Flash Deal</span>
          </span>
        {/if}
      </div>

      {#if metaAlcanzada}
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
          <span>✓ META ALCANZADA</span>
        </span>
      {:else if tiempoRestante.expirado}
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
          EXPIRADO
        </span>
      {:else}
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          EN CURSO
        </span>
      {/if}
    </div>

    <!-- Título y Descripción -->
    <div>
      <h3 class="text-base font-bold text-white group-hover:text-emerald-300 transition-colors line-clamp-1">
        {pool.titulo}
      </h3>
      <p class="text-xs text-slate-400 mt-1 line-clamp-2 min-h-[2rem]">
        {pool.descripcion}
      </p>
    </div>

    <!-- Precio Mayorista Destacado -->
    <div class="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 flex items-baseline justify-between">
      <div>
        <span class="text-[11px] text-slate-400 font-medium">Precio Mayorista B2B</span>
        <div class="flex items-baseline gap-1 mt-0.5">
          <span class="text-xs text-emerald-400 font-bold">S/</span>
          <span class="text-2xl font-black font-mono text-white tracking-tight">
            {pool.precio_unitario_mayorista.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
          </span>
          <span class="text-xs text-slate-400 font-medium">/ {pool.unidad_medida}</span>
        </div>
      </div>

      <!-- Temporizador Cuenta Regresiva -->
      {#if pool.es_oferta_flash && !tiempoRestante.expirado}
        <div class="text-right">
          <span class="text-[10px] uppercase font-bold text-amber-400 block tracking-wider">Termina en</span>
          <div class="font-mono font-bold text-xs text-amber-300 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/30 inline-block mt-0.5">
            {String(tiempoRestante.horas).padStart(2, '0')}:{String(tiempoRestante.minutos).padStart(2, '0')}:{String(tiempoRestante.segundos).padStart(2, '0')}
          </div>
        </div>
      {/if}
    </div>

    <!-- Barra de Progreso de Volumen Agrupado -->
    <div class="space-y-1.5">
      <div class="flex items-center justify-between text-xs">
        <span class="text-slate-400 font-medium">
          Progreso de demanda: <strong class="text-white font-mono">{porcentajeProgreso}%</strong>
        </span>
        <span class="font-mono text-slate-300 text-xs">
          {pool.volumen_acumulado.toLocaleString('es-PE')} / {pool.meta_volumen.toLocaleString('es-PE')} {pool.unidad_medida}
        </span>
      </div>

      <!-- Barra visual de llenado -->
      <div class="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
        <div
          class="h-full rounded-full transition-all duration-500 {metaAlcanzada
            ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-md shadow-emerald-500/40'
            : pool.es_oferta_flash
              ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
              : 'bg-gradient-to-r from-emerald-600 to-emerald-400'}"
          style="width: {porcentajeProgreso}%;"
        ></div>
      </div>

      <!-- Estado de faltante o éxito -->
      <div class="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
        {#if metaAlcanzada}
          <span class="text-emerald-400 font-semibold">¡Meta de volumen asegurada!</span>
          <span class="text-slate-400 font-mono">Cupo completo</span>
        {:else}
          <span>Faltan {volumenRestante.toLocaleString('es-PE')} {pool.unidad_medida}</span>
          <span class="text-slate-400">para confirmar precio</span>
        {/if}
      </div>
    </div>
  </div>

  <!-- Botón de Acción Inferior -->
  <div class="pt-5 mt-2 border-t border-slate-800/70">
    <button
      type="button"
      onclick={() => onUnirse?.(pool)}
      disabled={tiempoRestante.expirado}
      class="w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed {pool.es_oferta_flash
        ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-amber-500/20 font-black'
        : metaAlcanzada
          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
          : 'bg-slate-800 hover:bg-emerald-600 text-white hover:shadow-emerald-600/20'}"
    >
      {#if tiempoRestante.expirado}
        <span>Campaña Finalizada</span>
      {:else if pool.es_oferta_flash}
        <span>⚡ Aprovechar Oferta Flash</span>
      {:else if metaAlcanzada}
        <span>Unirse al Pedido Consolidado</span>
      {:else}
        <span>Participar en este Pool</span>
      {/if}
    </button>
  </div>
</div>
