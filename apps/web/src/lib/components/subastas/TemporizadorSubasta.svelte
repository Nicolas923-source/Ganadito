<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { EstadoLote } from '@ganadito/contracts';

  interface Props {
    fechaCierre: string; // ISO date string de la fecha de cierre oficial
    estadoLote?: EstadoLote;
    onFinalizado?: () => void;
  }

  let { fechaCierre, estadoLote = 'ACTIVO', onFinalizado }: Props = $props();

  let tiempoRestanteMs = $state(0);
  let segundosRestantes = $state(0);
  let timerId: any = null;
  let ultimaFechaCierre = $state('');
  let destelloAntiSniping = $state(false);
  let destelloTimeout: any = null;
  let notifiedDeadline = '';

  // Detectar si la fecha de cierre se extendió por anti-sniping
  $effect(() => {
    if (!ultimaFechaCierre) {
      ultimaFechaCierre = fechaCierre;
      return;
    }

    if (fechaCierre && ultimaFechaCierre && fechaCierre !== ultimaFechaCierre) {
      const fechaAnterior = new Date(ultimaFechaCierre).getTime();
      const nuevaFecha = new Date(fechaCierre).getTime();

      if (nuevaFecha > fechaAnterior && estadoLote === 'ACTIVO') {
        // Disparar destello visual dorado/ámbar
        destelloAntiSniping = true;
        if (destelloTimeout) clearTimeout(destelloTimeout);
        destelloTimeout = setTimeout(() => {
          destelloAntiSniping = false;
        }, 3500);
      }
      ultimaFechaCierre = fechaCierre;
    }
  });

  function recalcularTiempo() {
    if (!fechaCierre) {
      tiempoRestanteMs = 0;
      segundosRestantes = 0;
      return;
    }

    const cierreMs = new Date(fechaCierre).getTime();
    const ahoraMs = Date.now();
    const diff = Math.max(0, cierreMs - ahoraMs);

    tiempoRestanteMs = diff;
    segundosRestantes = Math.floor(diff / 1000);

    if (diff === 0 && estadoLote === 'ACTIVO' && notifiedDeadline !== fechaCierre) {
      notifiedDeadline = fechaCierre;
      onFinalizado?.();
    }
  }

  onMount(() => {
    recalcularTiempo();
    // Ticking constante cada 250ms para sincronización suave
    timerId = setInterval(recalcularTiempo, 250);
  });

  onDestroy(() => {
    if (timerId) clearInterval(timerId);
    if (destelloTimeout) clearTimeout(destelloTimeout);
  });

  let esFinalizada = $derived(
    estadoLote === 'ADJUDICADO' ||
    estadoLote === 'DESIERTO' ||
    estadoLote === 'CERRADO' ||
    estadoLote === 'CANCELADO'
  );
  let esperandoCierre = $derived(!esFinalizada && segundosRestantes <= 0);

  let esUltimosSegundos = $derived(!esFinalizada && segundosRestantes > 0 && segundosRestantes <= 60);

  let horas = $derived(Math.floor(segundosRestantes / 3600));
  let minutos = $derived(Math.floor((segundosRestantes % 3600) / 60));
  let segundos = $derived(segundosRestantes % 60);

  function pad(num: number): string {
    return num.toString().padStart(2, '0');
  }
</script>

<div
  class="relative rounded-2xl p-4 transition-all duration-500 border overflow-hidden {destelloAntiSniping
    ? 'border-amber-400 bg-amber-500/20 ring-4 ring-amber-400/50 shadow-2xl shadow-amber-500/30'
    : esUltimosSegundos
      ? 'border-rose-500 bg-rose-950/40 shadow-lg shadow-rose-900/30 animate-pulse'
      : esFinalizada
        ? 'border-slate-800 bg-slate-900/60'
        : 'border-slate-800 bg-slate-950/80 shadow-md'}"
>
  <!-- Alerta de Anti-Sniping Dinámica -->
  {#if destelloAntiSniping}
    <div
      class="mb-3 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 text-xs font-bold flex items-center justify-between shadow-md"
    >
      <div class="flex items-center gap-1.5">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" />
        </svg>
        <span>¡ANTI-SNIPING ACTIVADO! TIEMPO EXTENDIDO</span>
      </div>
      <span class="text-[10px] uppercase font-mono tracking-wider bg-slate-950/20 px-1.5 py-0.5 rounded">Garantía de Puja Justa</span>
    </div>
  {/if}

  <div class="flex items-center justify-between gap-4">
    <div>
      <div class="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
        <span>Tiempo Restante de Cierre</span>
        {#if esUltimosSegundos}
          <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-500 text-white animate-bounce">
            ÚLTIMOS SEGUNDOS
          </span>
        {:else if esFinalizada}
          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-slate-800 text-slate-300">
            FINALIZADA
          </span>
        {:else if esperandoCierre}
          <span class="text-amber-300">ESPERANDO CONFIRMACIÓN DE CIERRE</span>
        {:else}
          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            EN VIVO
          </span>
        {/if}
      </div>

      <!-- Reloj con dígitos grandes de alto contraste -->
      <div class="mt-1 flex items-baseline gap-1 font-mono tracking-tight font-black select-none">
        {#if esFinalizada}
          <span class="text-3xl text-slate-500">00:00:00</span>
        {:else}
          <span class="text-4xl sm:text-5xl {esUltimosSegundos ? 'text-rose-400' : 'text-white'}">
            {#if horas > 0}{pad(horas)}:{/if}{pad(minutos)}:{pad(segundos)}
          </span>
        {/if}
      </div>
    </div>

    <!-- Indicador contextual o zootécnico -->
    <div class="text-right hidden sm:block">
      <div class="text-[11px] text-slate-400 font-medium">Cierre Oficial</div>
      <div class="text-xs font-mono text-slate-200 mt-0.5">
        {#if fechaCierre}
          {new Date(fechaCierre).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        {:else}
          --:--:--
        {/if}
      </div>
    </div>
  </div>
</div>
