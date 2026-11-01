<script lang="ts">
  interface Props {
    subastaId: string;
    precioActual: number;
    incrementoMinimo: number;
    proximaPujaMinima: number;
    esAbierta?: boolean;
    postorGanadorId?: string | null;
    usuarioActualId?: string | null;
    apiBaseUrl?: string;
    authToken?: string | null;
    onPujaExitosa?: (resultado: any) => void;
  }

  let {
    subastaId,
    precioActual,
    incrementoMinimo,
    proximaPujaMinima,
    esAbierta = true,
    postorGanadorId = null,
    usuarioActualId = null,
    apiBaseUrl = 'http://localhost:3000',
    authToken = null,
    onPujaExitosa
  }: Props = $props();

  let isSubmitting = $state(false);
  let errorMessage = $state<string | null>(null);
  let successMessage = $state<string | null>(null);
  let pujaPersonalizada = $state<number | null>(null);

  // Determinar si el usuario actual va ganando
  let soyGanadorActual = $derived(
    Boolean(usuarioActualId && postorGanadorId && usuarioActualId === postorGanadorId)
  );

  async function emitirPuja(monto: number) {
    if (isSubmitting || !esAbierta) return;

    if (monto < proximaPujaMinima) {
      errorMessage = `La puja mínima aceptada debe ser al menos S/ ${proximaPujaMinima.toFixed(2)}`;
      return;
    }

    isSubmitting = true;
    errorMessage = null;
    successMessage = null;

    // Generar clave de idempotencia UUID v4 única para evitar duplicados ante reintentos de red
    const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `puja-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'idempotency-key': idempotencyKey
      };

      // Si se cuenta con token de autenticación
      const token = authToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null);
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${apiBaseUrl}/api/v1/subastas/${subastaId}/pujas`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          monto,
          idempotency_key: idempotencyKey
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Debes iniciar sesión con una cuenta de Comprador para emitir pujas.');
        }
        if (res.status === 403) {
          throw new Error('No tienes permisos de postor o intentas pujar tu propio lote.');
        }
        if (res.status === 409) {
          throw new Error(data.message || 'La puja fue superada por otro postor o el lote cambió de estado.');
        }
        throw new Error(data.message || 'Error al emitir la puja en el servidor.');
      }

      successMessage = `¡Puja de S/ ${monto.toFixed(2)} registrada exitosamente!`;
      pujaPersonalizada = null;
      onPujaExitosa?.(data);

      setTimeout(() => {
        successMessage = null;
      }, 4000);
    } catch (err: any) {
      errorMessage = err.message || 'Error de comunicación al enviar la puja.';
    } finally {
      isSubmitting = false;
    }
  }

  function handlePujaPersonalizadaSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (pujaPersonalizada !== null && pujaPersonalizada > 0) {
      emitirPuja(pujaPersonalizada);
    }
  }
</script>

<div class="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-xl space-y-4">
  <!-- Cabecera de puja -->
  <div class="flex items-center justify-between">
    <div>
      <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Pizarra de Puja Rápida</span>
      <h3 class="text-base font-bold text-white mt-0.5">Incrementos de Remate</h3>
    </div>
    <div class="text-right">
      <span class="text-[10px] text-slate-400 block font-medium">Próxima Mínima</span>
      <span class="text-sm font-mono font-bold text-emerald-400">S/ {proximaPujaMinima.toFixed(2)}</span>
    </div>
  </div>

  <!-- Cartel cuando el usuario actual va ganando -->
  {#if soyGanadorActual}
    <div class="rounded-xl p-3 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-emerald-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
      <span><strong>¡Llevas la puja ganadora!</strong> Eres el postor más alto actual.</span>
    </div>
  {/if}

  <!-- Mensajes de Estado (Error / Éxito) -->
  {#if errorMessage}
    <div class="rounded-xl p-3 bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center justify-between">
      <div class="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-rose-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>{errorMessage}</span>
      </div>
      <button type="button" onclick={() => (errorMessage = null)} class="text-slate-400 hover:text-white text-xs ml-2">✕</button>
    </div>
  {/if}

  {#if successMessage}
    <div class="rounded-xl p-3 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-emerald-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <span>{successMessage}</span>
    </div>
  {/if}

  <!-- Botones de incremento táctil 1x, 2x, 5x -->
  <div class="grid grid-cols-3 gap-2.5">
    <!-- Botón 1: 1x incremento mínimo -->
    <button
      type="button"
      disabled={isSubmitting || !esAbierta}
      onclick={() => emitirPuja(precioActual + incrementoMinimo)}
      class="group relative py-3.5 px-2 rounded-xl bg-gradient-to-b from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold transition-all shadow-lg shadow-emerald-900/30 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-center flex flex-col items-center justify-center border border-emerald-400/30"
    >
      <span class="text-[10px] uppercase font-semibold text-emerald-200 tracking-wider">Mínimo (+1x)</span>
      <span class="text-base sm:text-lg font-black tracking-tight mt-0.5 font-mono">
        +S/ {incrementoMinimo.toFixed(0)}
      </span>
      <span class="text-[10px] text-emerald-200/80 font-mono mt-0.5">
        (Total S/ {(precioActual + incrementoMinimo).toFixed(0)})
      </span>
    </button>

    <!-- Botón 2: 2x incremento mínimo -->
    <button
      type="button"
      disabled={isSubmitting || !esAbierta}
      onclick={() => emitirPuja(precioActual + incrementoMinimo * 2)}
      class="group relative py-3.5 px-2 rounded-xl bg-gradient-to-b from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-white font-bold transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-center flex flex-col items-center justify-center border border-slate-700 hover:border-slate-600"
    >
      <span class="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Agresivo (+2x)</span>
      <span class="text-base sm:text-lg font-black tracking-tight mt-0.5 font-mono text-emerald-300">
        +S/ {(incrementoMinimo * 2).toFixed(0)}
      </span>
      <span class="text-[10px] text-slate-400 font-mono mt-0.5">
        (Total S/ {(precioActual + incrementoMinimo * 2).toFixed(0)})
      </span>
    </button>

    <!-- Botón 3: 5x incremento mínimo -->
    <button
      type="button"
      disabled={isSubmitting || !esAbierta}
      onclick={() => emitirPuja(precioActual + incrementoMinimo * 5)}
      class="group relative py-3.5 px-2 rounded-xl bg-gradient-to-b from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold transition-all shadow-lg shadow-amber-950/40 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-center flex flex-col items-center justify-center border border-amber-400/30"
    >
      <span class="text-[10px] uppercase font-semibold text-amber-200 tracking-wider">Fuerte (+5x)</span>
      <span class="text-base sm:text-lg font-black tracking-tight mt-0.5 font-mono">
        +S/ {(incrementoMinimo * 5).toFixed(0)}
      </span>
      <span class="text-[10px] text-amber-200/80 font-mono mt-0.5">
        (Total S/ {(precioActual + incrementoMinimo * 5).toFixed(0)})
      </span>
    </button>
  </div>

  <!-- Formulario de puja personalizada -->
  <form onsubmit={handlePujaPersonalizadaSubmit} class="pt-2 border-t border-slate-800/80">
    <div class="flex gap-2">
      <div class="relative flex-1">
        <span class="absolute left-3.5 top-3 text-sm text-slate-400 font-bold">S/</span>
        <input
          type="number"
          step="any"
          min={proximaPujaMinima}
          bind:value={pujaPersonalizada}
          placeholder={`Monto personalizado (mín. ${proximaPujaMinima.toFixed(2)})`}
          disabled={isSubmitting || !esAbierta}
          class="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all font-mono disabled:opacity-50"
        />
      </div>
      <button
        type="submit"
        disabled={isSubmitting || !esAbierta || !pujaPersonalizada || pujaPersonalizada < proximaPujaMinima}
        class="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 flex items-center justify-center gap-1.5 min-w-[100px]"
      >
        {#if isSubmitting}
          <span class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
        {:else}
          Pujar
        {/if}
      </button>
    </div>
  </form>

  {#if !esAbierta}
    <div class="text-center py-2 text-xs text-slate-400 font-medium">
      🔒 Las pujas para este lote se encuentran cerradas o adjudicadas.
    </div>
  {/if}
</div>
