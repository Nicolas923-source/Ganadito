<script lang="ts">
  import '../app.css';
  interface Props {
    children?: import('svelte').Snippet;
  }
  let { children }: Props = $props();
</script>

<div class="min-h-screen flex flex-col bg-slate-900 text-slate-100 selection:bg-emerald-500 selection:text-white">
  <!-- Header / Barra Superior con estética profesional fintech/agro -->
  <header class="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <a href="/" class="flex items-center gap-2.5 group">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <span class="text-xl font-black text-white tracking-wider">G</span>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-lg font-bold tracking-tight text-white">GANADITO</span>
              <span class="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Pizarra Spot
              </span>
            </div>
            <p class="text-xs text-slate-400">Ecosistema Pecuario & Mercado Transaccional</p>
          </div>
        </a>
      </div>

      <!-- Menú de Navegación -->
      <nav class="hidden sm:flex items-center gap-2 text-xs">
        <a
          href="/"
          class="px-3 py-1.5 rounded-lg font-semibold text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
        >
          Mercado Spot & Mapa
        </a>
        <a
          href="/subastas/lote-demo-01"
          class="px-3 py-1.5 rounded-lg font-semibold text-slate-300 hover:text-white hover:bg-slate-900 transition-colors flex items-center gap-1.5"
        >
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Subastas en Vivo
        </a>
        <a
          href="/gmx"
          class="px-3 py-1.5 rounded-lg font-semibold text-slate-300 hover:text-white hover:bg-slate-900 transition-colors flex items-center gap-1.5"
        >
          <span class="w-2 h-2 rounded-full bg-amber-400"></span>
          Bolsa Cárnica GMX
        </a>
      </nav>

      <!-- Indicadores de Mercado en Vivo -->
      <div class="hidden md:flex items-center gap-6 text-xs">
        <div class="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span class="text-slate-400">Mercado Spot:</span>
          <span class="font-semibold text-emerald-400">Abierto (Perú)</span>
        </div>
        <div class="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
          <span class="text-slate-400">PostGIS Activo:</span>
          <span class="font-mono text-slate-300">EPSG:4326 (WGS84)</span>
        </div>
      </div>
    </div>
  </header>

  <!-- Contenido Principal -->
  <main class="flex-1 flex flex-col">
    {@render children?.()}
  </main>

  <!-- Footer accesible y limpio -->
  <footer class="bg-slate-950 border-t border-slate-800 py-6 text-slate-500 text-xs">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="flex items-center gap-2">
        <span class="font-bold text-slate-400">GANADITO v1.0</span>
        <span>—</span>
        <span>Mercado Transaccional Pecuario y Cárnico</span>
      </div>
      <div class="flex items-center gap-4 text-slate-400">
        <span>Cotizaciones en S/ por Kilogramo Vivo / Canal</span>
        <span class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        <span class="text-emerald-400 font-medium">SEE-SUNAT & PostGIS Ready</span>
      </div>
    </div>
  </footer>
</div>
