<script lang="ts">
  import {
    calcularEscandalloAnatomico,
    type ResultadoEscandalloAnatomico,
    type CuartoAnatomico,
    type CorteEscandalloResultado
  } from '@ganadito/contracts';

  interface Props {
    pesoInicialKg?: number;
    costoInicialKiloPEN?: number;
    margenInicialPct?: number;
    mermaInicialPct?: number;
  }

  let {
    pesoInicialKg = 260,
    costoInicialKiloPEN = 18.5,
    margenInicialPct = 22,
    mermaInicialPct = 3.5
  }: Props = $props();

  // Inputs reactivos inicializados
  let pesoCanalKg = $state(260);
  let costoKiloPEN = $state(18.5);
  let margenObjetivoPct = $state(22);
  let mermaDespostePct = $state(3.5);

  let inicializado = false;
  $effect(() => {
    if (!inicializado) {
      pesoCanalKg = pesoInicialKg;
      costoKiloPEN = costoInicialKiloPEN;
      margenObjetivoPct = margenInicialPct;
      mermaDespostePct = mermaInicialPct;
      inicializado = true;
    }
  });

  // Filtro por cuarto anatómico
  let filtroCuarto = $state<'TODOS' | CuartoAnatomico>('TODOS');
  let busquedaCorte = $state('');
  let mensajeCopiado = $state(false);

  // Presets zootécnicos comunes en camales del Perú
  function aplicarPreset(peso: number, costo: number, margen: number, merma: number) {
    pesoCanalKg = peso;
    costoKiloPEN = costo;
    margenObjetivoPct = margen;
    mermaDespostePct = merma;
  }

  // Cálculo determinista reactivo protegido
  let resultado = $derived.by<ResultadoEscandalloAnatomico | null>(() => {
    try {
      if (
        pesoCanalKg <= 0 ||
        costoKiloPEN <= 0 ||
        margenObjetivoPct <= 0 ||
        margenObjetivoPct >= 95 ||
        mermaDespostePct < 0 ||
        mermaDespostePct >= 50
      ) {
        return null;
      }
      return calcularEscandalloAnatomico(
        pesoCanalKg,
        costoKiloPEN,
        margenObjetivoPct / 100,
        mermaDespostePct / 100
      );
    } catch {
      return null;
    }
  });

  // Cortes filtrados según el cuarto y búsqueda
  let cortesFiltrados = $derived.by<CorteEscandalloResultado[]>(() => {
    if (!resultado) return [];
    return resultado.cortes.filter((corte) => {
      const matchCuarto = filtroCuarto === 'TODOS' || corte.cuarto === filtroCuarto;
      const matchBusqueda =
        busquedaCorte.trim() === '' ||
        corte.nombre.toLowerCase().includes(busquedaCorte.toLowerCase()) ||
        corte.codigo.toLowerCase().includes(busquedaCorte.toLowerCase());
      return matchCuarto && matchBusqueda;
    });
  });

  // Subtotales filtrados para la tabla
  let subtotalPesoKg = $derived(
    cortesFiltrados.reduce((acc, c) => acc + c.peso_estimado_kg, 0)
  );
  let subtotalIngresoPEN = $derived(
    cortesFiltrados.reduce((acc, c) => acc + c.ingreso_estimado_pen, 0)
  );
  let subtotalCostoPEN = $derived(
    cortesFiltrados.reduce((acc, c) => acc + c.costo_total_corte_pen, 0)
  );

  async function copiarFichaTecnica() {
    if (!resultado) return;
    const texto = [
      `=== FICHA TÉCNICA DE ESCANDALLO ANATÓMICO (NTP 201.055) ===`,
      `Norma: NTP 201.055 | Ganadito GMX Engine`,
      `Peso Canal: ${resultado.peso_canal_kg.toFixed(2)} kg`,
      `Costo Canal: S/ ${resultado.costo_kilo_canal_pen.toFixed(2)} / kg (Total: S/ ${resultado.costo_total_canal_pen.toFixed(2)})`,
      `Merma de Desposte: ${resultado.merma_desposte_pct * 100}% (${resultado.merma_kg.toFixed(2)} kg)`,
      `Carne Aprovechable: ${resultado.peso_aprovechable_kg.toFixed(2)} kg`,
      `Margen Objetivo: ${resultado.margen_objetivo_pct * 100}%`,
      `Margen Neto Efectivo: ${resultado.margen_neto_ponderado_pct.toFixed(2)}%`,
      `Ingreso Total Proyectado: S/ ${resultado.ingreso_total_estimado_pen.toFixed(2)}`,
      `Ganancia Neta Proyectada: S/ ${resultado.utilidad_neta_estimada_pen.toFixed(2)}`,
      `-------------------------------------------------------`,
      `DESGLOSE DE CORTES (18 cortes canónicos):`,
      ...resultado.cortes.map(
        (c) =>
          `- [${c.cuarto === 'CUARTO_TRASERO' ? 'TRASERO' : 'DELANT'}] ${c.nombre.padEnd(22)} | ` +
          `Peso: ${c.peso_estimado_kg.toFixed(2)} kg (${c.proporcion_pct}%) | ` +
          `Costo: S/ ${c.costo_unitario_prorrateado_pen.toFixed(2)}/kg | ` +
          `P.Venta: S/ ${c.precio_sugerido_kilo_pen.toFixed(2)}/kg | ` +
          `Ingreso: S/ ${c.ingreso_estimado_pen.toFixed(2)} | ` +
          `Margen: ${c.margen_corte_pct}%`
      )
    ].join('\n');

    try {
      await navigator.clipboard.writeText(texto);
      mensajeCopiado = true;
      setTimeout(() => {
        mensajeCopiado = false;
      }, 3000);
    } catch {
      // Si el navegador bloquea clipboard, log fallback
      console.info(texto);
    }
  }
</script>

<div class="space-y-6">
  <!-- Tarjetas de Control e Inputs de Escandallo -->
  <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
      <div>
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            NTP 201.055
          </span>
          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            Motor Zootécnico
          </span>
          <h2 class="text-xl font-bold text-white tracking-tight">Calculadora de Escandallo Anatómico</h2>
        </div>
        <p class="text-xs text-slate-400 mt-1">
          Distribución ponderada del valor comercial en 18 cortes vacunos con conservación exacta de masa y merma.
        </p>
      </div>

      <!-- Presets zootécnicos -->
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs text-slate-400 font-medium mr-1">Presets:</span>
        <button
          type="button"
          onclick={() => aplicarPreset(280, 18.5, 22, 3.5)}
          class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
        >
          Novillo Gordo (280 kg)
        </button>
        <button
          type="button"
          onclick={() => aplicarPreset(240, 19.0, 24, 3.5)}
          class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
        >
          Vaquillona (240 kg)
        </button>
        <button
          type="button"
          onclick={() => aplicarPreset(320, 17.8, 20, 3.8)}
          class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
        >
          Toro Engorde (320 kg)
        </button>
      </div>
    </div>

    <!-- Inputs del Desposte -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Peso de la Canal -->
      <div class="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
        <label for="input-peso-canal" class="block text-xs font-medium text-slate-400 mb-1.5">
          Peso de Canal Fría (kg)
        </label>
        <div class="relative">
          <input
            id="input-peso-canal"
            type="number"
            min="50"
            max="700"
            step="0.5"
            bind:value={pesoCanalKg}
            class="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-2 text-white font-mono text-base font-semibold"
          />
          <span class="absolute right-3 top-2.5 text-xs font-medium text-slate-400">kg</span>
        </div>
        <p class="text-[11px] text-slate-500 mt-1">Peso en gancho tras oreo</p>
      </div>

      <!-- Costo por Kilo Canal -->
      <div class="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
        <label for="input-costo-kilo" class="block text-xs font-medium text-slate-400 mb-1.5">
          Costo por Kilo Canal (S/ kg)
        </label>
        <div class="relative">
          <span class="absolute left-3 top-2.5 text-xs font-medium text-slate-400">S/</span>
          <input
            id="input-costo-kilo"
            type="number"
            min="1"
            max="60"
            step="0.10"
            bind:value={costoKiloPEN}
            class="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg pl-8 pr-3.5 py-2 text-white font-mono text-base font-semibold"
          />
        </div>
        <p class="text-[11px] text-slate-500 mt-1">Precio pagado en camal</p>
      </div>

      <!-- Margen Objetivo Comercial -->
      <div class="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
        <label for="input-margen-obj" class="block text-xs font-medium text-slate-400 mb-1.5">
          Margen Objetivo Mínimo (%)
        </label>
        <div class="relative">
          <input
            id="input-margen-obj"
            type="number"
            min="5"
            max="60"
            step="0.5"
            bind:value={margenObjetivoPct}
            class="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-2 text-white font-mono text-base font-semibold"
          />
          <span class="absolute right-3 top-2.5 text-xs font-medium text-slate-400">%</span>
        </div>
        <p class="text-[11px] text-slate-500 mt-1">Rentabilidad objetivo sobre ventas</p>
      </div>

      <!-- Merma de Desposte -->
      <div class="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
        <label for="input-merma-pct" class="block text-xs font-medium text-slate-400 mb-1.5">
          Merma de Desposte (%)
        </label>
        <div class="relative">
          <input
            id="input-merma-pct"
            type="number"
            min="0"
            max="15"
            step="0.1"
            bind:value={mermaDespostePct}
            class="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-2 text-white font-mono text-base font-semibold"
          />
          <span class="absolute right-3 top-2.5 text-xs font-medium text-slate-400">%</span>
        </div>
        <p class="text-[11px] text-slate-500 mt-1">Grasa no comercial, aserrín, evaporación</p>
      </div>
    </div>
  </div>

  <!-- Resumen de Resultados Financieros y Zootécnicos -->
  {#if resultado}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <!-- Costo Total -->
      <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col justify-between">
        <div class="flex items-center justify-between text-slate-400 text-xs">
          <span>Inversión Canal</span>
          <span class="text-[10px] font-mono text-slate-500">Costo Base</span>
        </div>
        <div class="mt-2">
          <div class="text-2xl font-black font-mono text-white tracking-tight">
            S/ {resultado.costo_total_canal_pen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
          </div>
          <div class="text-xs text-slate-400 mt-1">
            {resultado.peso_canal_kg.toFixed(1)} kg @ S/ {resultado.costo_kilo_canal_pen.toFixed(2)}/kg
          </div>
        </div>
      </div>

      <!-- Ingreso Proyectado -->
      <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col justify-between">
        <div class="flex items-center justify-between text-slate-400 text-xs">
          <span>Ingreso Proyectado</span>
          <span class="text-[10px] font-mono text-emerald-400">Ventas</span>
        </div>
        <div class="mt-2">
          <div class="text-2xl font-black font-mono text-emerald-400 tracking-tight">
            S/ {resultado.ingreso_total_estimado_pen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
          </div>
          <div class="text-xs text-slate-400 mt-1">
            18 cortes comercializados
          </div>
        </div>
      </div>

      <!-- Ganancia Neta -->
      <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col justify-between">
        <div class="flex items-center justify-between text-slate-400 text-xs">
          <span>Ganancia Neta</span>
          <span class="text-[10px] font-mono text-emerald-400 font-bold">Utilidad</span>
        </div>
        <div class="mt-2">
          <div class="text-2xl font-black font-mono text-emerald-300 tracking-tight">
            S/ {resultado.utilidad_neta_estimada_pen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
          </div>
          <div class="text-xs text-slate-400 mt-1">
            Margen bruto del desposte
          </div>
        </div>
      </div>

      <!-- Margen Efectivo -->
      <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col justify-between">
        <div class="flex items-center justify-between text-slate-400 text-xs">
          <span>Margen Efectivo</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded font-bold {resultado.margen_neto_ponderado_pct >= margenObjetivoPct ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}">
            {resultado.margen_neto_ponderado_pct >= margenObjetivoPct ? 'CUMPLE' : 'ALERTA'}
          </span>
        </div>
        <div class="mt-2">
          <div class="text-2xl font-black font-mono text-emerald-400 tracking-tight">
            {resultado.margen_neto_ponderado_pct.toFixed(2)}%
          </div>
          <div class="text-xs text-slate-400 mt-1">
            Objetivo: &gt; {margenObjetivoPct.toFixed(1)}%
          </div>
        </div>
      </div>

      <!-- Rendimiento de Masa -->
      <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col justify-between">
        <div class="flex items-center justify-between text-slate-400 text-xs">
          <span>Rendimiento Físico</span>
          <span class="text-[10px] font-mono text-cyan-400">Masa OK</span>
        </div>
        <div class="mt-2">
          <div class="text-2xl font-black font-mono text-cyan-300 tracking-tight">
            {resultado.peso_aprovechable_kg.toFixed(1)} <span class="text-sm font-normal text-slate-400">kg</span>
          </div>
          <div class="text-xs text-slate-400 mt-1">
            + {resultado.merma_kg.toFixed(1)} kg merma ({resultado.merma_desposte_pct * 100}%)
          </div>
        </div>
      </div>
    </div>
  {:else}
    <div class="p-6 bg-rose-500/10 border border-rose-500/30 rounded-xl text-center text-rose-300 text-sm">
      Valores de entrada fuera de rango. Por favor ingrese números válidos y mayores a cero.
    </div>
  {/if}

  <!-- Barra de Herramientas de la Tabla (Filtros y Exportación) -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
    <!-- Filtros de Cuarto y Búsqueda -->
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs text-slate-400 font-semibold mr-1">Filtrar:</span>
      <button
        type="button"
        onclick={() => (filtroCuarto = 'TODOS')}
        class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors {filtroCuarto === 'TODOS'
          ? 'bg-emerald-600 text-white'
          : 'bg-slate-800 text-slate-400 hover:text-white'}"
      >
        Todos los Cortes (18)
      </button>
      <button
        type="button"
        onclick={() => (filtroCuarto = 'CUARTO_TRASERO')}
        class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors {filtroCuarto === 'CUARTO_TRASERO'
          ? 'bg-amber-600 text-white'
          : 'bg-slate-800 text-slate-400 hover:text-white'}"
      >
        Cuarto Trasero (8 Cortes)
      </button>
      <button
        type="button"
        onclick={() => (filtroCuarto = 'CUARTO_DELANTERO')}
        class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors {filtroCuarto === 'CUARTO_DELANTERO'
          ? 'bg-cyan-600 text-white'
          : 'bg-slate-800 text-slate-400 hover:text-white'}"
      >
        Cuarto Delantero (10 Cortes)
      </button>
    </div>

    <!-- Buscador de corte y Botón Copiar -->
    <div class="flex items-center gap-2.5">
      <div class="relative">
        <input
          type="text"
          placeholder="Buscar corte (ej. Lomo Fino)..."
          bind:value={busquedaCorte}
          class="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-48 sm:w-56"
        />
        {#if busquedaCorte}
          <button
            type="button"
            onclick={() => (busquedaCorte = '')}
            class="absolute right-2 top-1.5 text-slate-400 hover:text-white text-xs"
          >
            ✕
          </button>
        {/if}
      </div>

      <button
        type="button"
        onclick={copiarFichaTecnica}
        class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
      >
        <span>{mensajeCopiado ? '✓ Copiado' : '📋 Copiar Ficha'}</span>
      </button>
    </div>
  </div>

  <!-- Tabla Detallada de los 18 Cortes Anatómicos -->
  {#if resultado}
    <div class="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <th class="py-3.5 px-4">Corte Anatómico</th>
              <th class="py-3.5 px-3">Cuarto</th>
              <th class="py-3.5 px-3 text-right">% Rend.</th>
              <th class="py-3.5 px-3 text-right">Peso Est. (kg)</th>
              <th class="py-3.5 px-3 text-right">Costo Unit. (S/ kg)</th>
              <th class="py-3.5 px-4 text-right">P. Venta Sug. (S/ kg)</th>
              <th class="py-3.5 px-4 text-right">Ingreso Est. (S/)</th>
              <th class="py-3.5 px-3 text-right">Margen (%)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60 text-xs">
            {#each cortesFiltrados as corte}
              <tr class="hover:bg-slate-800/40 transition-colors {corte.cuarto === 'CUARTO_TRASERO' ? 'border-l-2 border-l-amber-500/60' : 'border-l-2 border-l-cyan-500/60'}">
                <!-- Nombre de Corte -->
                <td class="py-3 px-4 font-semibold text-white">
                  <div class="flex items-center gap-2">
                    <span>{corte.nombre}</span>
                    {#if corte.codigo === 'LOMO_FINO' || corte.codigo === 'TAPADECUADRIL' || corte.codigo === 'BIFE_ANGOSTO'}
                      <span class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                        Premium
                      </span>
                    {/if}
                  </div>
                  <span class="text-[10px] font-mono text-slate-500">{corte.codigo}</span>
                </td>

                <!-- Cuarto -->
                <td class="py-3 px-3">
                  <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full {corte.cuarto === 'CUARTO_TRASERO' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'}">
                    {corte.cuarto === 'CUARTO_TRASERO' ? 'Trasero' : 'Delantero'}
                  </span>
                </td>

                <!-- % Rendimiento -->
                <td class="py-3 px-3 text-right font-mono text-slate-300">
                  {corte.proporcion_pct.toFixed(2)}%
                </td>

                <!-- Peso Estimado (kg) -->
                <td class="py-3 px-3 text-right font-mono font-semibold text-white">
                  {corte.peso_estimado_kg.toFixed(2)} kg
                </td>

                <!-- Costo Unitario Prorrateado -->
                <td class="py-3 px-3 text-right font-mono text-slate-400">
                  S/ {corte.costo_unitario_prorrateado_pen.toFixed(2)}
                </td>

                <!-- Precio Venta Sugerido -->
                <td class="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                  S/ {corte.precio_sugerido_kilo_pen.toFixed(2)}
                </td>

                <!-- Ingreso Estimado -->
                <td class="py-3 px-4 text-right font-mono font-bold text-white">
                  S/ {corte.ingreso_estimado_pen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </td>

                <!-- Margen Corte % -->
                <td class="py-3 px-3 text-right font-mono font-semibold {corte.margen_corte_pct >= 20 ? 'text-emerald-400' : 'text-amber-400'}">
                  {corte.margen_corte_pct.toFixed(1)}%
                </td>
              </tr>
            {/each}
          </tbody>

          <!-- Fila de Resumen / Totales -->
          <tfoot>
            <tr class="bg-slate-950 font-bold text-xs border-t-2 border-slate-700 text-slate-200">
              <td class="py-4 px-4" colspan="2">
                <div class="flex items-center gap-2">
                  <span class="text-white">TOTAL PARCIAL FILTRADO ({cortesFiltrados.length} cortes)</span>
                </div>
              </td>
              <td class="py-4 px-3 text-right font-mono text-slate-400">—</td>
              <td class="py-4 px-3 text-right font-mono text-white">
                {subtotalPesoKg.toFixed(2)} kg
              </td>
              <td class="py-4 px-3 text-right font-mono text-slate-400">
                S/ {subtotalCostoPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </td>
              <td class="py-4 px-4 text-right font-mono text-slate-400">—</td>
              <td class="py-4 px-4 text-right font-mono text-emerald-400 text-sm">
                S/ {subtotalIngresoPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </td>
              <td class="py-4 px-3 text-right font-mono text-emerald-400">
                {subtotalIngresoPEN > 0 ? (((subtotalIngresoPEN - subtotalCostoPEN) / subtotalIngresoPEN) * 100).toFixed(1) : 0}%
              </td>
            </tr>

            <!-- Balance Total Integral de la Canal -->
            <tr class="bg-slate-950/90 text-xs border-t border-slate-800 text-slate-400">
              <td class="py-3 px-4" colspan="3">
                <span class="text-slate-400">Canal Completa (Aprovechable + Merma de Desposte):</span>
              </td>
              <td class="py-3 px-3 text-right font-mono text-cyan-300">
                {resultado.peso_aprovechable_kg.toFixed(2)} kg + {resultado.merma_kg.toFixed(2)} kg = {resultado.suma_cortes_mas_merma_kg.toFixed(2)} kg
              </td>
              <td class="py-3 px-3 text-right font-mono text-slate-300">
                Inversión: S/ {resultado.costo_total_canal_pen.toFixed(2)}
              </td>
              <td class="py-3 px-4 text-right font-mono text-slate-300">
                Promedio: S/ {(resultado.ingreso_total_estimado_pen / resultado.peso_aprovechable_kg).toFixed(2)}/kg
              </td>
              <td class="py-3 px-4 text-right font-mono text-emerald-400 font-bold">
                Total: S/ {resultado.ingreso_total_estimado_pen.toFixed(2)}
              </td>
              <td class="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                Neto: {resultado.margen_neto_ponderado_pct.toFixed(2)}%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  {/if}
</div>
