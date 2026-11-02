<script lang="ts">
  import type {
    TipoProductoMayorista,
    UnidadMedidaMayorista,
    PoolCompraMayorista,
    CrearPoolMayoristaInput
  } from '@ganadito/contracts';

  interface Props {
    isOpen: boolean;
    apiBaseUrl?: string;
    authToken?: string | null;
    onCerrar: () => void;
    onPoolCreado?: (nuevoPool: PoolCompraMayorista) => void;
  }

  let {
    isOpen,
    apiBaseUrl = 'http://localhost:3000',
    authToken = null,
    onCerrar,
    onPoolCreado
  }: Props = $props();

  let titulo = $state('Lote Consolidado de Medias Canales Frías');
  let descripcion = $state('Faenado en Camal Frigorífico autorizado SENASA. Acondicionado a 2°C para carnicerías y distribuidores.');
  let tipoProducto = $state<TipoProductoMayorista>('MEDIAS_CANALES');
  let unidadMedida = $state<UnidadMedidaMayorista>('KG');
  let precioUnitarioMayorista = $state<number>(18.5);
  let metaVolumen = $state<number>(2000);
  let esOfertaFlash = $state(false);
  let tokenManual = $state('');

  // Fecha límite por defecto: +48 horas para normal, +24 horas para flash
  let horasAdicionales = $derived(esOfertaFlash ? 24 : 72);
  let fechaLimite = $state(
    new Date(Date.now() + 72 * 3600 * 1000).toISOString().slice(0, 16)
  );

  let isSubmitting = $state(false);
  let errorMessage = $state<string | null>(null);
  let poolCreado = $state<PoolCompraMayorista | null>(null);

  // Ajustar fecha límite sugerida si conmuta flash
  function toggleFlash() {
    esOfertaFlash = !esOfertaFlash;
    fechaLimite = new Date(Date.now() + (esOfertaFlash ? 24 : 72) * 3600 * 1000)
      .toISOString()
      .slice(0, 16);
  }

  let valorMetaTotalPEN = $derived(
    Number(((metaVolumen || 0) * (precioUnitarioMayorista || 0)).toFixed(2))
  );

  async function handleCrearPool(e: SubmitEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    if (!titulo.trim()) {
      errorMessage = 'El título de la campaña es requerido.';
      return;
    }
    if (!precioUnitarioMayorista || precioUnitarioMayorista <= 0) {
      errorMessage = 'El precio unitario debe ser mayor a S/ 0.00.';
      return;
    }
    if (!metaVolumen || metaVolumen <= 0) {
      errorMessage = 'La meta de volumen debe ser mayor a 0.';
      return;
    }

    isSubmitting = true;
    errorMessage = null;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      const token =
        authToken ||
        tokenManual.trim() ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null);

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const input: CrearPoolMayoristaInput = {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        tipo_producto: tipoProducto,
        unidad_medida: unidadMedida,
        precio_unitario_mayorista: precioUnitarioMayorista,
        meta_volumen: metaVolumen,
        fecha_limite: new Date(fechaLimite).toISOString(),
        es_oferta_flash: esOfertaFlash
      };

      const res = await fetch(`${apiBaseUrl}/api/v1/mayorista/pools`, {
        method: 'POST',
        headers,
        body: JSON.stringify(input)
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Se requiere sesión autorizada con rol Vendedor u Organización. Ingrese su token o inicie sesión.');
        }
        if (res.status === 400) {
          throw new Error(data.message || 'Datos de creación del pool inválidos.');
        }
        throw new Error(data.message || `Error del servidor (${res.status})`);
      }

      poolCreado = data as PoolCompraMayorista;
      onPoolCreado?.(poolCreado);
    } catch (err: any) {
      errorMessage = err.message || 'No se pudo crear la campaña mayorista.';
    } finally {
      isSubmitting = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isOpen) {
      onCerrar();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-crear-pool-title"
  >
    <div
      class="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl p-6 sm:p-7 text-slate-100 relative space-y-5"
    >
      <!-- Cabecera -->
      <div class="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <h3 id="modal-crear-pool-title" class="text-lg font-bold text-white tracking-tight">
              Crear Campaña de Compra Mayorista (Pool B2B)
            </h3>
          </div>
          <p class="text-xs text-slate-400 mt-0.5">
            Publica una oferta agrupada o venta flash para múltiples compradores simultáneos
          </p>
        </div>
        <button
          type="button"
          onclick={onCerrar}
          class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors text-lg"
          aria-label="Cerrar modal"
        >
          ✕
        </button>
      </div>

      {#if poolCreado}
        <!-- Éxito -->
        <div class="space-y-4 py-2">
          <div class="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 text-center space-y-2">
            <div class="text-4xl">🚀</div>
            <div class="text-base font-bold text-emerald-300">
              ¡Campaña Mayorista Publicada Exitosamente!
            </div>
            <p class="text-xs text-slate-300">
              Título: <strong class="text-white">{poolCreado.titulo}</strong>
            </p>
            <div class="text-xs font-mono text-slate-400">
              Meta: {poolCreado.meta_volumen.toLocaleString('es-PE')} {poolCreado.unidad_medida} @ S/ {poolCreado.precio_unitario_mayorista.toFixed(2)}
            </div>
            <div class="text-[10px] font-mono text-slate-500">
              ID Campaña: {poolCreado.id}
            </div>
          </div>

          <div class="pt-2 flex justify-end">
            <button
              type="button"
              onclick={onCerrar}
              class="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm transition-colors shadow-lg shadow-emerald-600/20"
            >
              Listo / Ver en el Mercado
            </button>
          </div>
        </div>
      {:else}
        <!-- Formulario de Creación -->
        <form onsubmit={handleCrearPool} class="space-y-4">
          <!-- Toggle Oferta Flash -->
          <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-white flex items-center gap-1.5">
                <span>⚡ Oferta Flash (Cuenta Regresiva 24h)</span>
              </span>
              <p class="text-[11px] text-slate-400 mt-0.5">
                Destaca la campaña con temporizador de urgencia para liquidación rápida.
              </p>
            </div>
            <button
              type="button"
              onclick={toggleFlash}
              class="w-12 h-6 rounded-full transition-colors relative p-0.5 {esOfertaFlash ? 'bg-amber-500' : 'bg-slate-800'}"
              aria-label="Activar oferta flash"
            >
              <div
                class="w-5 h-5 rounded-full bg-white shadow-md transition-transform {esOfertaFlash ? 'translate-x-6' : 'translate-x-0'}"
              ></div>
            </button>
          </div>

          <!-- Título -->
          <div>
            <label for="input-titulo-pool" class="block text-xs font-semibold text-slate-300 mb-1">
              Título de la Campaña
            </label>
            <input
              id="input-titulo-pool"
              type="text"
              required
              bind:value={titulo}
              placeholder="Ej. Pool de 10 Toneladas de Maíz Amarillo Duro..."
              class="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-white"
            />
          </div>

          <!-- Descripción -->
          <div>
            <label for="input-desc-pool" class="block text-xs font-semibold text-slate-300 mb-1">
              Descripción y Condiciones
            </label>
            <textarea
              id="input-desc-pool"
              rows="2"
              bind:value={descripcion}
              placeholder="Detalla origen, calidad, condiciones sanitarias SENASA o de entrega..."
              class="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-white"
            ></textarea>
          </div>

          <!-- Tipo de Producto y Unidad de Medida -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label for="select-tipo-prod" class="block text-xs font-semibold text-slate-300 mb-1">
                Categoría
              </label>
              <select
                id="select-tipo-prod"
                bind:value={tipoProducto}
                class="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="MEDIAS_CANALES">Medias Canales</option>
                <option value="CUARTOS_COMPENSADOS">Cuartos Compensados</option>
                <option value="CORTES_CALIBRADOS">Cortes Calibrados</option>
                <option value="GRANO_FORRAJE">Grano & Forraje</option>
                <option value="INSUMO_AGRICOLA">Insumos Agrícolas</option>
                <option value="EQUIPAMIENTO_SANITARIO">Equipamiento Sanitario</option>
              </select>
            </div>

            <div>
              <label for="select-unidad" class="block text-xs font-semibold text-slate-300 mb-1">
                Unidad de Medida
              </label>
              <select
                id="select-unidad"
                bind:value={unidadMedida}
                class="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="KG">Kilogramos (KG)</option>
                <option value="TONELADA">Toneladas (TM)</option>
                <option value="SACO_50KG">Sacos de 50 KG</option>
                <option value="UNIDAD">Unidades</option>
              </select>
            </div>
          </div>

          <!-- Precio Unitario Mayorista y Meta de Volumen -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label for="input-precio-unit" class="block text-xs font-semibold text-slate-300 mb-1">
                Precio Mayorista (S/ por {unidadMedida})
              </label>
              <div class="relative">
                <span class="absolute left-3 top-2 text-xs font-mono text-slate-400">S/</span>
                <input
                  id="input-precio-unit"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  bind:value={precioUnitarioMayorista}
                  class="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl pl-8 pr-3 py-2 text-xs text-white font-mono font-semibold"
                />
              </div>
            </div>

            <div>
              <label for="input-meta-vol" class="block text-xs font-semibold text-slate-300 mb-1">
                Meta Mínima de Volumen
              </label>
              <div class="relative">
                <input
                  id="input-meta-vol"
                  type="number"
                  min="1"
                  step="any"
                  required
                  bind:value={metaVolumen}
                  class="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white font-mono font-semibold"
                />
                <span class="absolute right-3 top-2 text-xs font-mono text-slate-400">{unidadMedida}</span>
              </div>
            </div>
          </div>

          <!-- Fecha Límite -->
          <div>
            <label for="input-fecha-limite" class="block text-xs font-semibold text-slate-300 mb-1">
              Fecha y Hora de Cierre
            </label>
            <input
              id="input-fecha-limite"
              type="datetime-local"
              required
              bind:value={fechaLimite}
              class="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white font-mono"
            />
          </div>

          <!-- Resumen Valor Total de la Campaña -->
          <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <span class="text-xs text-slate-400">Valor Nocional Total de la Meta:</span>
            <span class="text-sm font-black font-mono text-emerald-400">
              S/ {valorMetaTotalPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <!-- Token Opcional -->
          <div>
            <label for="input-token-crear" class="block text-[11px] font-medium text-slate-400 mb-1">
              Token JWT (opcional si ya inició sesión):
            </label>
            <input
              id="input-token-crear"
              type="password"
              placeholder="Bearer eyJhbGciOi..."
              bind:value={tokenManual}
              class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 font-mono placeholder-slate-600 focus:outline-none focus:border-slate-600"
            />
          </div>

          <!-- Error -->
          {#if errorMessage}
            <div class="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
              {errorMessage}
            </div>
          {/if}

          <!-- Botones -->
          <div class="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onclick={onCerrar}
              disabled={isSubmitting}
              class="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              class="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {#if isSubmitting}
                <span class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Publicando Campaña...</span>
              {:else}
                <span>Publicar Campaña Mayorista</span>
              {/if}
            </button>
          </div>
        </form>
      {/if}
    </div>
  </div>
{/if}
