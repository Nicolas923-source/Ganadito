<script lang="ts">
  import { browser } from '$app/environment';
  import CalculadoraEscandallo from '../../lib/components/gmx/CalculadoraEscandallo.svelte';
  import LibroOrdenesGmx from '../../lib/components/gmx/LibroOrdenesGmx.svelte';

  type TabGmx = 'ESCANDALLO' | 'ORDERBOOK';

  let tabActivo = $state<TabGmx>('ESCANDALLO');

  // URL base de API reactiva y segura
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
</script>

<svelte:head>
  <title>Bolsa Cárnica GMX & Escandallo Anatómico (NTP 201.055) | Ganadito</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
  <!-- Cabecera Principal del Módulo GMX -->
  <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-800 pb-6">
    <div>
      <div class="flex flex-wrap items-center gap-2 mb-2">
        <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
          NTP 201.055
        </span>
        <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Matching Atómico PostgreSQL
        </span>
        <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700 font-mono">
          PEN (Soles)
        </span>
      </div>
      <h1 class="text-2xl sm:text-3xl font-black text-white tracking-tight">
        Bolsa de Valores Cárnica (GMX) & Escandallo Anatómico
      </h1>
      <p class="text-sm text-slate-400 mt-1 max-w-3xl">
        Intermediación transparente de carne bovina al por mayor y motor de desposte analítico calibrado con los 18 cortes canónicos de la norma técnica peruana.
      </p>
    </div>

    <!-- Pestañas de Navegación Principal -->
    <div class="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 self-start md:self-auto">
      <button
        type="button"
        onclick={() => (tabActivo = 'ESCANDALLO')}
        class="px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 {tabActivo === 'ESCANDALLO'
          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
          : 'text-slate-400 hover:text-white hover:bg-slate-900'}"
      >
        <span>🥩 Calculadora de Escandallo</span>
      </button>

      <button
        type="button"
        onclick={() => (tabActivo = 'ORDERBOOK')}
        class="px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 {tabActivo === 'ORDERBOOK'
          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
          : 'text-slate-400 hover:text-white hover:bg-slate-900'}"
      >
        <span>📊 Bolsa de Órdenes GMX</span>
      </button>
    </div>
  </div>

  <!-- Vista Condicional según la Pestaña Activa -->
  {#if tabActivo === 'ESCANDALLO'}
    <div class="animate-fade-in">
      <CalculadoraEscandallo
        pesoInicialKg={260}
        costoInicialKiloPEN={18.5}
        margenInicialPct={22}
        mermaInicialPct={3.5}
      />
    </div>
  {:else if tabActivo === 'ORDERBOOK'}
    <div class="animate-fade-in">
      <LibroOrdenesGmx
        {apiBaseUrl}
        {authToken}
        productoInicial="MEDIA_CANAL"
      />
    </div>
  {/if}
</div>
