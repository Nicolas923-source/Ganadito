<script lang="ts">
  export interface ItemPujaFeed {
    id: string;
    monto: number;
    secuencia: number;
    postor: string;
    hora: string;
    esGanadora?: boolean;
    extensionAplicada?: boolean;
    timestamp?: string;
  }

  interface Props {
    pujas: ItemPujaFeed[];
    precioActual?: number;
    precioBase?: number;
  }

  let { pujas = [], precioActual = 0, precioBase = 0 }: Props = $props();
</script>

<div class="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-xl flex flex-col h-full max-h-[460px]">
  <div class="flex items-center justify-between pb-3 border-b border-slate-800">
    <div class="flex items-center gap-2">
      <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
      <h3 class="text-xs font-bold uppercase tracking-wider text-slate-300">Libro de Pujas en Vivo</h3>
    </div>
    <span class="text-xs font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
      {pujas.length} {pujas.length === 1 ? 'oferta' : 'ofertas'}
    </span>
  </div>

  <div class="flex-1 overflow-y-auto space-y-2.5 pt-3 pr-1">
    {#if pujas.length === 0}
      <div class="h-44 flex flex-col items-center justify-center text-center p-4 text-slate-400 space-y-2">
        <div class="w-10 h-10 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-500">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>
        <p class="text-xs font-medium">No se recibieron pujas durante esta visita.</p>
        <p class="text-[11px] text-slate-500">Precio base de apertura: <span class="font-bold text-slate-300 font-mono">S/ {precioBase.toFixed(2)}</span></p>
      </div>
    {:else}
      {#each pujas as puja, index (puja.id || `${puja.secuencia}-${puja.monto}`)}
        <div
          class="p-3 rounded-xl border transition-all duration-300 flex items-center justify-between gap-3 {index === 0
            ? 'bg-emerald-500/10 border-emerald-500/40 shadow-sm shadow-emerald-500/10'
            : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'}"
        >
          <!-- Identificación del postor y secuencia -->
          <div class="flex items-center gap-2.5 min-w-0">
            <div
              class="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold font-mono {index === 0
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30 font-black'
                : 'bg-slate-800 text-slate-400'}"
            >
              #{puja.secuencia}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-semibold text-slate-200 truncate">
                  {puja.postor}
                </span>
                {#if index === 0}
                  <span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    ÚLTIMA RECIBIDA
                  </span>
                {/if}
              </div>
              <div class="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                <span>{puja.hora}</span>
                {#if puja.extensionAplicada}
                  <span class="text-amber-400 font-medium">⏱ +Anti-sniping</span>
                {/if}
              </div>
            </div>
          </div>

          <!-- Monto ofertado -->
          <div class="text-right flex-shrink-0">
            <div class="text-sm font-black font-mono tracking-tight {index === 0 ? 'text-emerald-400' : 'text-slate-300'}">
              S/ {puja.monto.toFixed(2)}
            </div>
            {#if index === 0}
              <div class="text-[9px] text-emerald-400/80 font-medium uppercase tracking-wider">
                Última puja recibida
              </div>
            {:else}
              <div class="text-[9px] text-slate-500 uppercase">
                Puja recibida
              </div>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>
