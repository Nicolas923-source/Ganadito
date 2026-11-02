<script lang="ts">
  import type { TipoEventoTrazabilidad, EventoTrazabilidad, AgregarEventoInput } from '@ganadito/contracts';

  interface Props {
    isOpen: boolean;
    bovinoId: string;
    apiBaseUrl?: string;
    authToken?: string | null;
    onCerrar: () => void;
    onEventoRegistrado?: (evento: EventoTrazabilidad) => void;
  }

  let {
    isOpen,
    bovinoId,
    apiBaseUrl = 'http://localhost:3000',
    authToken = null,
    onCerrar,
    onEventoRegistrado
  }: Props = $props();

  let eventType = $state<TipoEventoTrazabilidad>('VACUNACION');
  let tokenManual = $state('');
  let isSubmitting = $state(false);
  let errorMessage = $state<string | null>(null);
  let eventoCreado = $state<EventoTrazabilidad | null>(null);

  // Campos específicos de metadata
  // Vacunación
  let vacunaNombre = $state('Fiebre Aftosa (Aftovax Bivalente)');
  let vacunaLote = $state('LOTE-SENASA-2026-X9');
  let dosisMl = $state(2.5);

  // Movilización CSTI
  let numeroGuiaCsti = $state('CSTI-2026-0091823-SENASA');
  let predioOrigen = $state('Fundo San José, Oxapampa');
  let predioDestino = $state('Camal Frigorífico Metropolitano, Lurín Km 32');
  let placaVehiculo = $state('ABC-982');

  // Pesaje
  let pesoKg = $state(480.5);
  let condicionCorporal = $state('3.5/5');

  // Camal
  let pesoVivoFinalKg = $state(495.0);
  let pesoCanalCalienteKg = $state(282.5);

  // Inspección Post-Mortem
  let dictamenSanitario = $state('APTO PARA CONSUMO HUMANO');
  let medicoVeterinario = $state('Dr. Carlos Mendoza CMVP 4921');

  // Tratamiento
  let farmaco = $state('Ivermectina 1% + Vitaminas ADE');
  let diasRetiro = $state(28);

  // Cambio de Propiedad
  let nuevoPropietario = $state('Inversiones Ganaderas del Perú S.A.C.');

  function construirMetadata(): Record<string, unknown> {
    switch (eventType) {
      case 'VACUNACION':
        return {
          vacuna: vacunaNombre.trim(),
          lote_biologico: vacunaLote.trim(),
          dosis_ml: Number(dosisMl),
          organismo_control: 'SENASA'
        };
      case 'MOVILIZACION_CSTI':
        return {
          numero_guia: numeroGuiaCsti.trim(),
          origen: predioOrigen.trim(),
          destino: predioDestino.trim(),
          placa_transporte: placaVehiculo.trim(),
          validez_horas: 48
        };
      case 'PESAJE':
        return {
          peso_kg: Number(pesoKg),
          condicion_corporal: condicionCorporal,
          tipo_control: 'RUTINARIO_ENGORDE'
        };
      case 'PESAJE_CAMAL':
        return {
          peso_vivo_kg: Number(pesoVivoFinalKg),
          peso_canal_caliente_kg: Number(pesoCanalCalienteKg),
          rendimiento_canal_pct: Number(((pesoCanalCalienteKg / pesoVivoFinalKg) * 100).toFixed(2))
        };
      case 'INSPECCION_POST_MORTEM':
        return {
          dictamen: dictamenSanitario.trim(),
          veterinario_responsable: medicoVeterinario.trim(),
          conforme_minsa_rm_822_2018: true
        };
      case 'TRATAMIENTO':
        return {
          farmaco: farmaco.trim(),
          periodo_retiro_dias: Number(diasRetiro)
        };
      case 'CAMBIO_PROPIEDAD':
        return {
          nuevo_titular: nuevoPropietario.trim(),
          motivo: 'VENTA_COMERCIAL_SUBASTA'
        };
      default:
        return { descripcion: 'Evento pecuario registrado' };
    }
  }

  async function handleAgregarEvento(e: SubmitEvent) {
    e.preventDefault();
    if (isSubmitting) return;

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

      const body: AgregarEventoInput = {
        event_type: eventType,
        metadata: construirMetadata()
      };

      const res = await fetch(`${apiBaseUrl}/api/v1/trazabilidad/bovinos/${bovinoId}/eventos`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Se requiere sesión autorizada para registrar eventos de trazabilidad. Ingrese su token JWT.');
        }
        if (res.status === 400) {
          throw new Error(data.message || 'Datos del evento no válidos.');
        }
        throw new Error(data.message || `Error del servidor (${res.status})`);
      }

      eventoCreado = data as EventoTrazabilidad;
      onEventoRegistrado?.(eventoCreado);
    } catch (err: any) {
      errorMessage = err.message || 'No se pudo registrar el evento de trazabilidad.';
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
    aria-labelledby="modal-evento-title"
  >
    <div
      class="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl p-6 sm:p-7 text-slate-100 relative space-y-5"
    >
      <!-- Cabecera -->
      <div class="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <h3 id="modal-evento-title" class="text-lg font-bold text-white tracking-tight">
              Registrar Evento de Trazabilidad Inmutable
            </h3>
          </div>
          <p class="text-xs text-slate-400 mt-0.5">
            Generará un nuevo bloque criptográfico SHA-256 encadenado
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

      {#if eventoCreado}
        <!-- Éxito -->
        <div class="space-y-4 py-2">
          <div class="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 text-center space-y-2">
            <div class="text-4xl">🔒</div>
            <div class="text-base font-bold text-emerald-300">
              ¡Bloque #{eventoCreado.secuencia} Criptográficamente Sellado!
            </div>
            <p class="text-xs text-slate-300">
              Tipo: <strong class="text-white font-mono">{eventoCreado.event_type}</strong>
            </p>
            <div class="text-[11px] font-mono text-slate-400 break-all p-2 bg-slate-950 rounded border border-slate-800">
              Hash: {eventoCreado.current_hash}
            </div>
          </div>

          <div class="pt-2 flex justify-end">
            <button
              type="button"
              onclick={onCerrar}
              class="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm transition-colors shadow-lg shadow-emerald-600/20"
            >
              Listo / Ver en la Cadena
            </button>
          </div>
        </div>
      {:else}
        <!-- Formulario -->
        <form onsubmit={handleAgregarEvento} class="space-y-4">
          <!-- Selector de Tipo de Evento -->
          <div>
            <label for="select-tipo-evento" class="block text-xs font-semibold text-slate-300 mb-1">
              Tipo de Hito Pecuario / Sanitario
            </label>
            <select
              id="select-tipo-evento"
              bind:value={eventType}
              class="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white"
            >
              <option value="VACUNACION">💉 Vacunación & Inmunización Oficial</option>
              <option value="MOVILIZACION_CSTI">🚛 Movilización CSTI SENASA</option>
              <option value="PESAJE">⚖️ Control de Pesaje en Balanza</option>
              <option value="PESAJE_CAMAL">🥩 Ingreso & Pesaje en Camal</option>
              <option value="INSPECCION_POST_MORTEM">🔬 Inspección Sanitaria Post-Mortem</option>
              <option value="TRATAMIENTO">💊 Tratamiento Veterinario</option>
              <option value="CAMBIO_PROPIEDAD">🤝 Cambio de Propiedad Comercial</option>
            </select>
          </div>

          <!-- Campos dinámicos de metadata según el tipo seleccionado -->
          {#if eventType === 'VACUNACION'}
            <div class="space-y-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <span class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                Datos de la Vacunación
              </span>
              <div>
                <label for="input-vacuna-nom" class="block text-[11px] text-slate-400 mb-1">Nombre Biológico</label>
                <input
                  id="input-vacuna-nom"
                  type="text"
                  required
                  bind:value={vacunaNombre}
                  class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label for="input-vacuna-lote" class="block text-[11px] text-slate-400 mb-1">Lote Biológico</label>
                  <input
                    id="input-vacuna-lote"
                    type="text"
                    required
                    bind:value={vacunaLote}
                    class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label for="input-vacuna-dosis" class="block text-[11px] text-slate-400 mb-1">Dosis (ml)</label>
                  <input
                    id="input-vacuna-dosis"
                    type="number"
                    step="0.1"
                    required
                    bind:value={dosisMl}
                    class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>
            </div>
          {:else if eventType === 'MOVILIZACION_CSTI'}
            <div class="space-y-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <span class="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                Certificado Sanitario de Tránsito Interno (CSTI)
              </span>
              <div>
                <label for="input-csti-num" class="block text-[11px] text-slate-400 mb-1">Número de Guía SENASA</label>
                <input
                  id="input-csti-num"
                  type="text"
                  required
                  bind:value={numeroGuiaCsti}
                  class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                />
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label for="input-csti-orig" class="block text-[11px] text-slate-400 mb-1">Predio Origen</label>
                  <input
                    id="input-csti-orig"
                    type="text"
                    required
                    bind:value={predioOrigen}
                    class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label for="input-csti-dest" class="block text-[11px] text-slate-400 mb-1">Destino</label>
                  <input
                    id="input-csti-dest"
                    type="text"
                    required
                    bind:value={predioDestino}
                    class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>
              <div>
                <label for="input-csti-placa" class="block text-[11px] text-slate-400 mb-1">Placa Vehículo de Transporte</label>
                <input
                  id="input-csti-placa"
                  type="text"
                  required
                  bind:value={placaVehiculo}
                  class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono uppercase"
                />
              </div>
            </div>
          {:else if eventType === 'PESAJE'}
            <div class="space-y-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <span class="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block">
                Balanza y Condición
              </span>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label for="input-pesaje-kg" class="block text-[11px] text-slate-400 mb-1">Peso Vivo (kg)</label>
                  <input
                    id="input-pesaje-kg"
                    type="number"
                    step="0.5"
                    required
                    bind:value={pesoKg}
                    class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label for="input-pesaje-cond" class="block text-[11px] text-slate-400 mb-1">Condición Corporal</label>
                  <input
                    id="input-pesaje-cond"
                    type="text"
                    required
                    bind:value={condicionCorporal}
                    class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>
            </div>
          {:else if eventType === 'PESAJE_CAMAL'}
            <div class="space-y-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <span class="text-[11px] font-bold text-rose-400 uppercase tracking-wider block">
                Pesaje en Gancho Frigorífico
              </span>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label for="input-camal-vivo" class="block text-[11px] text-slate-400 mb-1">Peso Vivo (kg)</label>
                  <input
                    id="input-camal-vivo"
                    type="number"
                    step="0.5"
                    required
                    bind:value={pesoVivoFinalKg}
                    class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label for="input-camal-canal" class="block text-[11px] text-slate-400 mb-1">Canal Caliente (kg)</label>
                  <input
                    id="input-camal-canal"
                    type="number"
                    step="0.5"
                    required
                    bind:value={pesoCanalCalienteKg}
                    class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>
            </div>
          {:else if eventType === 'INSPECCION_POST_MORTEM'}
            <div class="space-y-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <span class="text-[11px] font-bold text-purple-400 uppercase tracking-wider block">
                Dictamen Sanitario
              </span>
              <div>
                <label for="input-dictamen-vet" class="block text-[11px] text-slate-400 mb-1">Dictamen Sanitario</label>
                <input
                  id="input-dictamen-vet"
                  type="text"
                  required
                  bind:value={dictamenSanitario}
                  class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-semibold"
                />
              </div>
              <div>
                <label for="input-vet-resp" class="block text-[11px] text-slate-400 mb-1">Médico Veterinario Colegiado</label>
                <input
                  id="input-vet-resp"
                  type="text"
                  required
                  bind:value={medicoVeterinario}
                  class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
            </div>
          {:else if eventType === 'TRATAMIENTO'}
            <div class="space-y-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <span class="text-[11px] font-bold text-yellow-400 uppercase tracking-wider block">
                Tratamiento Terapéutico
              </span>
              <div>
                <label for="input-farmaco" class="block text-[11px] text-slate-400 mb-1">Principio Activo / Fármaco</label>
                <input
                  id="input-farmaco"
                  type="text"
                  required
                  bind:value={farmaco}
                  class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label for="input-retiro" class="block text-[11px] text-slate-400 mb-1">Período de Retiro (días)</label>
                <input
                  id="input-retiro"
                  type="number"
                  min="0"
                  required
                  bind:value={diasRetiro}
                  class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                />
              </div>
            </div>
          {:else}
            <div class="space-y-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <div>
                <label for="input-nuevo-titular" class="block text-[11px] text-slate-400 mb-1">Nuevo Titular / Razón Social</label>
                <input
                  id="input-nuevo-titular"
                  type="text"
                  required
                  bind:value={nuevoPropietario}
                  class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
            </div>
          {/if}

          <!-- Token Opcional -->
          <div>
            <label for="input-token-evento" class="block text-[11px] font-medium text-slate-400 mb-1">
              Token JWT (opcional si ya inició sesión):
            </label>
            <input
              id="input-token-evento"
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
                <span>Sellando Hash...</span>
              {:else}
                <span>Sellar Evento en la Cadena</span>
              {/if}
            </button>
          </div>
        </form>
      {/if}
    </div>
  </div>
{/if}
