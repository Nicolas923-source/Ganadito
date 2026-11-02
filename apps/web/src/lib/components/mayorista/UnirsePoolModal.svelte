<script lang="ts">
  import type {
    PoolConProgreso,
    PoolCompraMayorista,
    UnirsePoolResponse
  } from '@ganadito/contracts';

  interface Props {
    isOpen: boolean;
    pool: (PoolConProgreso | PoolCompraMayorista) | null;
    apiBaseUrl?: string;
    authToken?: string | null;
    onCerrar: () => void;
    onExito?: (resultado: UnirsePoolResponse) => void;
  }

  let {
    isOpen,
    pool,
    apiBaseUrl = 'http://localhost:3000',
    authToken = null,
    onCerrar,
    onExito
  }: Props = $props();

  let cantidad = $state<number>(100);
  let tokenManual = $state<string>('');
  let isSubmitting = $state(false);
  let errorMessage = $state<string | null>(null);
  let resultadoExito = $state<UnirsePoolResponse | null>(null);

  // Inicializar cantidad sugerida al abrir modal
  $effect(() => {
    if (pool && isOpen) {
      errorMessage = null;
      resultadoExito = null;
      // Sugerir cantidad razonable según unidad de medida
      if (pool.unidad_medida === 'TONELADA') {
        cantidad = 1;
      } else if (pool.unidad_medida === 'SACO_50KG') {
        cantidad = 10;
      } else {
        cantidad = Math.max(1, Math.min(100, pool.meta_volumen - pool.volumen_acumulado));
      }
    }
  });

  let subtotalPEN = $derived(
    pool ? Number(((cantidad || 0) * pool.precio_unitario_mayorista).toFixed(2)) : 0
  );

  async function handleUnirse(e: SubmitEvent) {
    e.preventDefault();
    if (!pool || isSubmitting) return;

    if (!cantidad || cantidad <= 0) {
      errorMessage = 'La cantidad debe ser mayor a 0.';
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

      const res = await fetch(`${apiBaseUrl}/api/v1/mayorista/pools/${pool.id}/unirse`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ cantidad })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Se requiere sesión con una organización activa. Ingrese su token o inicie sesión.');
        }
        if (res.status === 409) {
          throw new Error(data.message || 'La campaña ha expirado o no acepta más volumen.');
        }
        if (res.status === 400) {
          throw new Error(data.message || 'Datos de participación inválidos.');
        }
        throw new Error(data.message || `Error del servidor (${res.status})`);
      }

      resultadoExito = data as UnirsePoolResponse;
      onExito?.(resultadoExito);
    } catch (err: any) {
      errorMessage = err.message || 'Error de comunicación al unirse al pool.';
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

{#if isOpen && pool}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-unirse-title"
  >
    <div
      class="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl p-6 sm:p-7 text-slate-100 relative space-y-5"
    >
      <!-- Cabecera del Modal -->
      <div class="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full {pool.es_oferta_flash ? 'bg-amber-400' : 'bg-emerald-400'}"></span>
            <h3 id="modal-unirse-title" class="text-lg font-bold text-white tracking-tight">
              {pool.es_oferta_flash ? 'Aprovechar Oferta Flash' : 'Unirse al Pool Mayorista'}
            </h3>
          </div>
          <p class="text-xs text-slate-400 mt-0.5 line-clamp-1">
            {pool.titulo}
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

      {#if resultadoExito}
        <!-- Pantalla de Éxito -->
        <div class="space-y-4 py-2">
          <div class="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 text-center space-y-2">
            <div class="text-4xl">🎉</div>
            <div class="text-base font-bold text-emerald-300">
              ¡Participación Registrada Exitosamente!
            </div>
            <p class="text-xs text-slate-300">
              Has reservado <strong class="text-white font-mono">{resultadoExito.participacion.cantidad} {pool.unidad_medida}</strong> a precio mayorista.
            </p>
            <div class="text-xs font-mono font-bold text-emerald-400">
              Total: S/ {resultadoExito.participacion.monto_total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </div>
            <div class="text-[10px] font-mono text-slate-500 pt-1">
              ID Participación: {resultadoExito.participacion.id}
            </div>
          </div>

          {#if resultadoExito.meta_alcanzada}
            <div class="p-3.5 bg-gradient-to-r from-emerald-950/60 to-teal-950/60 border border-emerald-500/40 rounded-xl text-xs text-emerald-200 text-center font-semibold">
              🌟 ¡Felicidades! Tu compra completó el 100% de la meta del pool y la orden comercial ha sido confirmada.
            </div>
          {/if}

          <div class="pt-2 flex justify-end">
            <button
              type="button"
              onclick={onCerrar}
              class="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm transition-colors shadow-lg shadow-emerald-600/20"
            >
              Listo / Volver al Mercado
            </button>
          </div>
        </div>
      {:else}
        <!-- Formulario de Participación -->
        <form onsubmit={handleUnirse} class="space-y-4">
          <!-- Resumen del Pool -->
          <div class="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-400">Precio Mayorista Acordado:</span>
              <span class="font-mono font-bold text-emerald-400 text-sm">
                S/ {pool.precio_unitario_mayorista.toFixed(2)} / {pool.unidad_medida}
              </span>
            </div>
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-400">Volumen Acumulado Actual:</span>
              <span class="font-mono text-slate-300">
                {pool.volumen_acumulado.toLocaleString('es-PE')} de {pool.meta_volumen.toLocaleString('es-PE')} {pool.unidad_medida}
              </span>
            </div>
          </div>

          <!-- Input Cantidad Deseada -->
          <div>
            <label for="input-cantidad-pool" class="block text-xs font-semibold text-slate-300 mb-1.5">
              Cantidad a Reservar ({pool.unidad_medida})
            </label>
            <div class="relative">
              <input
                id="input-cantidad-pool"
                type="number"
                min="0.1"
                step="any"
                required
                bind:value={cantidad}
                class="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3.5 py-2.5 text-white font-mono text-base font-semibold"
              />
              <span class="absolute right-3.5 top-3 text-xs font-semibold text-slate-400">
                {pool.unidad_medida}
              </span>
            </div>
            <p class="text-[11px] text-slate-500 mt-1">
              Ingresa el volumen que tu carnicería o establo desea consolidar.
            </p>
          </div>

          <!-- Total a Pagar en PEN Calculado Instantáneamente -->
          <div class="bg-slate-950/80 p-4 rounded-xl border border-slate-800/90 flex items-center justify-between">
            <div>
              <span class="text-xs text-slate-400 font-medium">Subtotal a Pagar</span>
              <div class="text-[11px] text-slate-500 mt-0.5">
                {cantidad || 0} {pool.unidad_medida} × S/ {pool.precio_unitario_mayorista.toFixed(2)}
              </div>
            </div>
            <div class="text-right">
              <div class="text-2xl font-black font-mono text-emerald-400">
                S/ {subtotalPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </div>
              <span class="text-[10px] text-emerald-500 font-semibold">Tarifa mayorista sin recargos</span>
            </div>
          </div>

          <!-- Token de Autorización Opcional para pruebas -->
          <div>
            <label for="input-token-unirse" class="block text-[11px] font-medium text-slate-400 mb-1">
              Token JWT (opcional si ya inició sesión):
            </label>
            <input
              id="input-token-unirse"
              type="password"
              placeholder="Bearer eyJhbGciOi..."
              bind:value={tokenManual}
              class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 font-mono placeholder-slate-600 focus:outline-none focus:border-slate-600"
            />
          </div>

          <!-- Mensaje de Error si ocurre -->
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
              class="px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2 {pool.es_oferta_flash
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-amber-500/20'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'} disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {#if isSubmitting}
                <span class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Reservando volumen...</span>
              {:else}
                <span>Confirmar Reserva de {cantidad || 0} {pool.unidad_medida}</span>
              {/if}
            </button>
          </div>
        </form>
      {/if}
    </div>
  </div>
{/if}
