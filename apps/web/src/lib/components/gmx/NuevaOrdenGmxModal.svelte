<script lang="ts">
  import type {
    ProductoGmx,
    TipoOperacionGmx,
    CrearOrdenGmxResponse
  } from '@ganadito/contracts';

  interface Props {
    isOpen: boolean;
    productoInicial?: ProductoGmx;
    apiBaseUrl?: string;
    authToken?: string | null;
    onCerrar: () => void;
    onOrdenCreada?: (resultado: CrearOrdenGmxResponse) => void;
  }

  let {
    isOpen,
    productoInicial = 'MEDIA_CANAL',
    apiBaseUrl = 'http://localhost:3000',
    authToken = null,
    onCerrar,
    onOrdenCreada
  }: Props = $props();

  let tipoOperacion = $state<TipoOperacionGmx>('COMPRA');
  let producto = $state<ProductoGmx>('MEDIA_CANAL');
  let cantidadKg = $state<number>(500);
  let precioKiloLimite = $state<number>(19.5);
  let tokenManual = $state<string>('');
  let isSubmitting = $state(false);
  let errorMessage = $state<string | null>(null);
  let successResult = $state<CrearOrdenGmxResponse | null>(null);

  // Actualizar producto si cambia desde props
  $effect(() => {
    if (productoInicial) {
      producto = productoInicial;
    }
  });

  let totalNocionalPEN = $derived(
    Number(((cantidadKg || 0) * (precioKiloLimite || 0)).toFixed(2))
  );

  async function handleCrearOrden(e: SubmitEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    if (!cantidadKg || cantidadKg <= 0) {
      errorMessage = 'La cantidad debe ser mayor a 0 kg.';
      return;
    }
    if (!precioKiloLimite || precioKiloLimite <= 0) {
      errorMessage = 'El precio límite debe ser mayor a S/ 0.00.';
      return;
    }

    isSubmitting = true;
    errorMessage = null;
    successResult = null;

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

      const res = await fetch(`${apiBaseUrl}/api/v1/gmx/ordenes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tipo_operacion: tipoOperacion,
          producto,
          cantidad_kg: cantidadKg,
          precio_kilo_limite: precioKiloLimite
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error(
            'Se requiere autenticación JWT para operar en GMX. Ingrese su token o inicie sesión.'
          );
        }
        if (res.status === 400) {
          throw new Error(
            data.message || 'Datos de orden inválidos o falta de organización activa en la sesión.'
          );
        }
        throw new Error(data.message || `Error del servidor (${res.status})`);
      }

      successResult = data as CrearOrdenGmxResponse;
      onOrdenCreada?.(data as CrearOrdenGmxResponse);
    } catch (err: any) {
      errorMessage = err.message || 'No se pudo comunicar con el motor GMX.';
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
    aria-labelledby="modal-gmx-title"
  >
    <div
      class="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl p-6 sm:p-7 text-slate-100 relative space-y-5"
    >
      <!-- Cabecera del Modal -->
      <div class="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <h3 id="modal-gmx-title" class="text-lg font-bold text-white tracking-tight">
              Nueva Orden en Bolsa GMX
            </h3>
          </div>
          <p class="text-xs text-slate-400 mt-0.5">
            Registro de postura a precio límite con calce continuo en PostgreSQL
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

      {#if successResult}
        <!-- Pantalla de Éxito y Calces -->
        <div class="space-y-4 py-2">
          <div class="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center space-y-2">
            <div class="text-3xl">✓</div>
            <div class="text-base font-bold text-emerald-300">
              ¡Orden GMX Registrada Exitosamente!
            </div>
            <p class="text-xs text-slate-300">
              Estado: <span class="font-mono font-bold text-white uppercase">{successResult.orden.estado}</span>
            </p>
            <div class="text-[11px] font-mono text-slate-400">
              ID: {successResult.orden.id}
            </div>
          </div>

          {#if successResult.calces && successResult.calces.length > 0}
            <div class="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div class="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <span>⚡ Calces Inmediatos Ejecutados ({successResult.calces.length})</span>
              </div>
              <div class="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {#each successResult.calces as calce}
                  <div class="flex items-center justify-between text-xs bg-slate-900 p-2 rounded border border-slate-800">
                    <span class="font-mono text-white font-semibold">{calce.cantidad_kg} kg</span>
                    <span class="font-mono text-emerald-400 font-bold">@ S/ {calce.precio_pactado_kilo.toFixed(2)}</span>
                    <span class="font-mono text-slate-300">Total: S/ {calce.monto_total.toFixed(2)}</span>
                  </div>
                {/each}
              </div>
            </div>
          {:else}
            <div class="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 text-center">
              La orden quedó en estado <span class="font-bold text-white">ABIERTA</span> en el libro de órdenes esperando contraparte.
            </div>
          {/if}

          <div class="pt-2 flex justify-end">
            <button
              type="button"
              onclick={onCerrar}
              class="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm transition-colors shadow-lg shadow-emerald-600/20"
            >
              Listo / Volver al Libro
            </button>
          </div>
        </div>
      {:else}
        <!-- Formulario de Emisión -->
        <form onsubmit={handleCrearOrden} class="space-y-4">
          <!-- Toggle Tipo de Operación: COMPRA vs VENTA -->
          <div>
            <span class="block text-xs font-semibold text-slate-300 mb-1.5">
              Tipo de Operación
            </span>
            <div class="grid grid-cols-2 gap-2" role="group" aria-label="Tipo de Operación">
              <button
                type="button"
                onclick={() => (tipoOperacion = 'COMPRA')}
                class="py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 {tipoOperacion === 'COMPRA'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-400'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'}"
              >
                <span>▲ COMPRA (Bid)</span>
              </button>
              <button
                type="button"
                onclick={() => (tipoOperacion = 'VENTA')}
                class="py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 {tipoOperacion === 'VENTA'
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 ring-2 ring-rose-400'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'}"
              >
                <span>▼ VENTA (Ask)</span>
              </button>
            </div>
          </div>

          <!-- Selección de Producto Cárnico -->
          <div>
            <label for="select-producto" class="block text-xs font-semibold text-slate-300 mb-1.5">
              Producto Cárnico GMX
            </label>
            <select
              id="select-producto"
              bind:value={producto}
              class="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white font-medium"
            >
              <option value="MEDIA_CANAL">Media Canal Bovina (Estándar)</option>
              <option value="CUARTO_DELANTERO">Cuarto Delantero (10 Cortes)</option>
              <option value="CUARTO_TRASERO">Cuarto Trasero (8 Cortes Nobles)</option>
              <option value="CORTES_CALIBRADOS">Cortes Calibrados NTP 201.055</option>
            </select>
          </div>

          <!-- Cantidad y Precio Límite -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="input-cantidad" class="block text-xs font-semibold text-slate-300 mb-1.5">
                Volumen (kg)
              </label>
              <div class="relative">
                <input
                  id="input-cantidad"
                  type="number"
                  min="1"
                  max="100000"
                  step="1"
                  required
                  bind:value={cantidadKg}
                  class="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm font-semibold"
                />
                <span class="absolute right-3 top-3 text-xs text-slate-400">kg</span>
              </div>
            </div>

            <div>
              <label for="input-precio" class="block text-xs font-semibold text-slate-300 mb-1.5">
                Precio Límite (S/ kg)
              </label>
              <div class="relative">
                <span class="absolute left-3 top-3 text-xs text-slate-400 font-mono">S/</span>
                <input
                  id="input-precio"
                  type="number"
                  min="0.10"
                  max="500"
                  step="0.05"
                  required
                  bind:value={precioKiloLimite}
                  class="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl pl-8 pr-3.5 py-2.5 text-white font-mono text-sm font-semibold"
                />
              </div>
            </div>
          </div>

          <!-- Resumen de Valor Nocional -->
          <div class="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <div class="text-[11px] text-slate-400">Valor Nocional Total Estimado</div>
              <div class="text-xs text-slate-500">{cantidadKg || 0} kg × S/ {(precioKiloLimite || 0).toFixed(2)}</div>
            </div>
            <div class="text-right">
              <div class="text-base font-black font-mono text-emerald-400">
                S/ {totalNocionalPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <!-- Token de Autorización Opcional para pruebas -->
          <div>
            <label for="input-token-opt" class="block text-[11px] font-medium text-slate-400 mb-1">
              Token JWT (opcional si ya inició sesión):
            </label>
            <input
              id="input-token-opt"
              type="password"
              placeholder="Bearer eyJhbGciOi..."
              bind:value={tokenManual}
              class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 font-mono placeholder-slate-600 focus:outline-none focus:border-slate-600"
            />
          </div>

          <!-- Mensajes de Error -->
          {#if errorMessage}
            <div class="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
              {errorMessage}
            </div>
          {/if}

          <!-- Botones de Acción -->
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
              class="px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2 {tipoOperacion === 'COMPRA'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'} disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {#if isSubmitting}
                <span class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Procesando...</span>
              {:else}
                <span>Transmitir Orden de {tipoOperacion}</span>
              {/if}
            </button>
          </div>
        </form>
      {/if}
    </div>
  </div>
{/if}
