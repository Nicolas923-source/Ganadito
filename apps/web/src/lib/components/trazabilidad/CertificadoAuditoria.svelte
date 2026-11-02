<script lang="ts">
  import type { VerificacionCadenaResponse } from '@ganadito/contracts';

  interface Props {
    verificacion: VerificacionCadenaResponse | null;
    isLoading?: boolean;
    onReverificar?: () => void;
  }

  let { verificacion, isLoading = false, onReverificar }: Props = $props();
</script>

<div class="rounded-2xl border transition-all duration-300 p-5 sm:p-6 shadow-xl {verificacion?.integro
  ? 'bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-500/40'
  : verificacion?.integro === false
    ? 'bg-gradient-to-r from-rose-950/50 via-slate-900 to-slate-900 border-rose-500/50'
    : 'bg-slate-900 border-slate-800'}">
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <!-- Icono y Estado Principal -->
    <div class="flex items-start sm:items-center gap-4">
      <div class="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg {verificacion?.integro
        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-2xl'
        : verificacion?.integro === false
          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 text-2xl animate-bounce'
          : 'bg-slate-800 text-slate-400 border border-slate-700 text-2xl'}">
        {#if isLoading}
          <span class="animate-spin text-xl">⚙️</span>
        {:else if verificacion?.integro}
          <span>🛡️</span>
        {:else if verificacion?.integro === false}
          <span>⚠️</span>
        {:else}
          <span>🔍</span>
        {/if}
      </div>

      <div>
        <div class="flex items-center gap-2">
          <h3 class="text-base font-bold tracking-tight text-white">
            {#if isLoading}
              Ejecutando Auditoría Criptográfica SHA-256...
            {:else if verificacion?.integro}
              Cadena Criptográfica Verificada e Íntegra
            {:else if verificacion?.integro === false}
              ¡Alerta Crítica: Discrepancia en la Cadena Inmutable!
            {:else}
              Auditoría Criptográfica Pendiente
            {/if}
          </h3>

          {#if verificacion?.integro}
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              100% VÁLIDA
            </span>
          {:else if verificacion?.integro === false}
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              CORRUPTA
            </span>
          {/if}
        </div>

        <p class="text-xs text-slate-400 mt-0.5 max-w-2xl">
          {#if verificacion?.integro}
            Se han verificado matemáticamente <strong class="text-white font-mono">{verificacion.total_eventos} eventos consecutivos</strong>. Cada bloque contiene el hash SHA-256 canónico de su predecesor.
          {:else if verificacion?.integro === false}
            El hash almacenado difiere del recálculo determinista en la <strong class="text-rose-300">secuencia #{verificacion.secuencia_corrupta}</strong>. Posible manipulación manual detectada.
          {:else}
            Comprueba la correlación de hashes génesis y eslabones de eventos para este bovino.
          {/if}
        </p>

        {#if verificacion?.detalle}
          <div class="mt-2 text-[11px] font-mono text-rose-300 bg-rose-950/40 p-2 rounded border border-rose-500/30">
            {verificacion.detalle}
          </div>
        {/if}
      </div>
    </div>

    <!-- Botón para Reverificar -->
    <div class="self-end sm:self-center shrink-0">
      <button
        type="button"
        onclick={onReverificar}
        disabled={isLoading}
        class="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
      >
        <span class={isLoading ? 'animate-spin' : ''}>🔄</span>
        <span>{isLoading ? 'Auditando...' : 'Reauditar Cadena'}</span>
      </button>
    </div>
  </div>
</div>
