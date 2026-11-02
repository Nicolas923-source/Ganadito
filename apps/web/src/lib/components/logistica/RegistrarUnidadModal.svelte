<script lang="ts">
  import type { UnidadTransporte, TipoUnidadTransporte } from '@ganadito/contracts';

  interface Props {
    isOpen: boolean;
    apiBaseUrl?: string;
    authToken?: string | null;
    onClose: () => void;
    onUnidadRegistrada?: (unidad: UnidadTransporte) => void;
  }

  let {
    isOpen = false,
    apiBaseUrl = 'http://localhost:3000',
    authToken = null,
    onClose,
    onUnidadRegistrada
  }: Props = $props();

  let placa = $state('');
  let tipoUnidad = $state<TipoUnidadTransporte>('CAMION_JAULA_SIMPLE');
  let capacidadToneladas = $state(15);
  let capacidadCabezas = $state<number | null>(25);
  let tieneTermoregistrador = $state(false);

  let isSubmitting = $state(false);
  let errorMessage = $state<string | null>(null);

  // Al cambiar a furgón refrigerado, sugerir termoregistrador
  function handleTipoChange(tipo: TipoUnidadTransporte) {
    tipoUnidad = tipo;
    if (tipo === 'FURGON_ISOTERMICO_REFRIGERADO') {
      tieneTermoregistrador = true;
      capacidadCabezas = null;
    } else if (tipo === 'CAMION_JAULA_SIMPLE' || tipo === 'CAMION_JAULA_DOBLE_PISO') {
      tieneTermoregistrador = false;
      if (!capacidadCabezas) capacidadCabezas = tipo === 'CAMION_JAULA_DOBLE_PISO' ? 45 : 25;
    } else {
      tieneTermoregistrador = false;
      capacidadCabezas = null;
    }
  }

  async function registrarUnidad() {
    errorMessage = null;
    const placaLimpia = placa.trim().toUpperCase();

    if (!placaLimpia || placaLimpia.length < 5) {
      errorMessage = 'Ingresa una placa vehicular válida (ej. V7T-824).';
      return;
    }

    if (capacidadToneladas <= 0) {
      errorMessage = 'La capacidad en toneladas debe ser mayor a 0.';
      return;
    }

    isSubmitting = true;

    const payload = {
      placa: placaLimpia,
      tipo_unidad: tipoUnidad,
      capacidad_toneladas: Number(capacidadToneladas),
      capacidad_cabezas: capacidadCabezas ? Number(capacidadCabezas) : null,
      tiene_termoregistrador: Boolean(tieneTermoregistrador)
    };

    try {
      let nuevaUnidad: UnidadTransporte;

      if (authToken) {
        const res = await fetch(`${apiBaseUrl}/api/v1/logistica/unidades`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `Error del servidor HTTP ${res.status}`);
        }

        nuevaUnidad = await res.json();
      } else {
        // Modo fallback / simulación local
        nuevaUnidad = {
          id: `unid-${Date.now().toString(36)}`,
          transportista_id: 'usr-demo-transportista',
          organizacion_id: 'org-demo-transporte',
          placa: placaLimpia,
          tipo_unidad: tipoUnidad,
          capacidad_toneladas: capacidadToneladas,
          capacidad_cabezas: capacidadCabezas,
          tiene_termoregistrador: tieneTermoregistrador,
          activa: true,
          created_at: new Date().toISOString()
        };
      }

      if (onUnidadRegistrada) {
        onUnidadRegistrada(nuevaUnidad);
      }

      // Limpiar formulario y cerrar
      placa = '';
      capacidadToneladas = 15;
      onClose();
    } catch (err: any) {
      errorMessage = err.message || 'Error al homologar la unidad vehicular.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
    <div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
      <!-- Header -->
      <div class="flex items-center justify-between pb-4 border-b border-slate-800">
        <div class="flex items-center gap-2">
          <span class="text-xl">🚛</span>
          <div>
            <h3 class="text-lg font-bold text-white">Homologar Unidad de Transporte</h3>
            <p class="text-xs text-slate-400">Registro técnico vehicular para flota Ganadito Express</p>
          </div>
        </div>
        <button
          type="button"
          onclick={onClose}
          class="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-sm"
        >
          ✕
        </button>
      </div>

      {#if errorMessage}
        <div class="my-3 p-3 rounded-xl bg-red-950/70 border border-red-500/40 text-red-200 text-xs">
          {errorMessage}
        </div>
      {/if}

      <!-- Formulario -->
      <form onsubmit={(e) => { e.preventDefault(); registrarUnidad(); }} class="my-4 space-y-4">
        <!-- Placa MTC -->
        <div>
          <label for="input-placa" class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Placa de Rodaje Vehicular (MTC)
          </label>
          <input
            id="input-placa"
            type="text"
            placeholder="Ej: V7T-824 o ABC-123"
            bind:value={placa}
            class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
        </div>

        <!-- Tipo de Unidad -->
        <div>
          <label for="select-tipo-homologacion" class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Configuración Técnica de Carrocería
          </label>
          <select
            id="select-tipo-homologacion"
            value={tipoUnidad}
            onchange={(e) => handleTipoChange((e.target as HTMLSelectElement).value as TipoUnidadTransporte)}
            class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="CAMION_JAULA_SIMPLE">Camión Jaula Simple (Bovinos en Pie)</option>
            <option value="CAMION_JAULA_DOBLE_PISO">Camión Jaula Doble Piso (Alto Volumen)</option>
            <option value="FURGON_ISOTERMICO_REFRIGERADO">Furgón Isotérmico Refrigerado (Cadena de Frío Canales)</option>
            <option value="FURGON_SECO">Furgón Seco (Granos, Harinas y Concentrados)</option>
          </select>
        </div>

        <!-- Capacidades -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label for="input-capacidad-toneladas" class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Capacidad de Carga Útil (TM)
            </label>
            <input
              id="input-capacidad-toneladas"
              type="number"
              min="1"
              max="60"
              step="0.5"
              bind:value={capacidadToneladas}
              class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label for="input-capacidad-cabezas" class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Capacidad Bovinos (Cabezas)
            </label>
            <input
              id="input-capacidad-cabezas"
              type="number"
              min="0"
              max="120"
              bind:value={capacidadCabezas}
              placeholder="Opcional para furgones"
              class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <!-- Termoregistrador Calibrado -->
        <div class="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between">
          <div>
            <span class="text-xs font-semibold text-slate-200 block">¿Cuenta con Termoregistrador Digital?</span>
            <span class="text-[11px] text-slate-400">Requisito obligatorio de SENASA para furgones de carne canal fría.</span>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              bind:checked={tieneTermoregistrador}
              class="sr-only peer"
            />
            <div class="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
          </label>
        </div>

        <!-- Acciones -->
        <div class="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onclick={onClose}
            class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2"
          >
            {#if isSubmitting}
              <span class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              <span>Guardando Unidad...</span>
            {:else}
              <span>Registrar Unidad</span>
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
