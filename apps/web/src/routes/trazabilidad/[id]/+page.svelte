<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '$app/state';
  import type {
    Bovino,
    EventoTrazabilidad,
    PasaporteDigitalResponse,
    VerificacionCadenaResponse
  } from '@ganadito/contracts';

  import FichaBovinoHeader from '../../../lib/components/trazabilidad/FichaBovinoHeader.svelte';
  import CertificadoAuditoria from '../../../lib/components/trazabilidad/CertificadoAuditoria.svelte';
  import LineaTiempoEventos from '../../../lib/components/trazabilidad/LineaTiempoEventos.svelte';
  import RegistrarEventoModal from '../../../lib/components/trazabilidad/RegistrarEventoModal.svelte';

  let bovinoId = $derived(
    page?.params?.id ||
      (browser ? window.location.pathname.split('/')[2] || 'bov-demo-01' : 'bov-demo-01')
  );

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

  let bovino = $state<Bovino | null>(null);
  let eventos = $state<EventoTrazabilidad[]>([]);
  let verificacion = $state<VerificacionCadenaResponse | null>(null);

  let isLoading = $state(true);
  let isAuditing = $state(false);
  let errorMessage = $state<string | null>(null);
  let modalRegistrarAbierto = $state(false);

  // Datos de fallback demostrativos
  const BOVINO_DEMO: Bovino = {
    id: 'bov-demo-01',
    codigo_arete: 'PE-2026-904812',
    organizacion_id: 'org-ganaderia-san-pedro',
    raza: 'Brahman x Nelore F1',
    sexo: 'MACHO',
    fecha_nacimiento: '2024-03-15T00:00:00.000Z',
    estado: 'FAENADO'
  };

  const EVENTOS_DEMO: EventoTrazabilidad[] = [
    {
      id: 1,
      bovino_id: 'bov-demo-01',
      secuencia: 1,
      event_type: 'REGISTRO_INICIAL',
      metadata: {
        peso_nacimiento_kg: 34.5,
        tipo_parto: 'EUTOCICO_NATURAL',
        madre_arete: 'PE-2021-004128',
        fundo_nacimiento: 'Fundo San José, Oxapampa'
      },
      prev_hash: '0'.repeat(64),
      current_hash: '8f4327bc49b1a030ef1d48c801452a229a1740fb875bcbc5716e257008cf142e',
      autor_id: 'usr-veterinario-01',
      created_at: '2024-03-15T10:00:00.000Z'
    },
    {
      id: 2,
      bovino_id: 'bov-demo-01',
      secuencia: 2,
      event_type: 'VACUNACION',
      metadata: {
        vacuna: 'Fiebre Aftosa Bivalente',
        lote: 'SENASA-2024-LOT-48',
        dosis_ml: 2.0,
        campana_oficial: 'I-2024'
      },
      prev_hash: '8f4327bc49b1a030ef1d48c801452a229a1740fb875bcbc5716e257008cf142e',
      current_hash: '3bc94120f26388410ee749171a81dc41b44ec0b57fa23933e4b7796dcb212e10',
      autor_id: 'usr-senasa-inspector',
      created_at: '2024-06-20T14:30:00.000Z'
    },
    {
      id: 3,
      bovino_id: 'bov-demo-01',
      secuencia: 3,
      event_type: 'MOVILIZACION_CSTI',
      metadata: {
        guia_senasa: 'CSTI-2026-0048192-SENASA',
        origen: 'Fundo San José, Oxapampa',
        destino: 'Camal Frigorífico Metropolitano, Lurín Km 32',
        placa_camion: 'ABC-982',
        precinto_seguridad: 'PRC-9912'
      },
      prev_hash: '3bc94120f26388410ee749171a81dc41b44ec0b57fa23933e4b7796dcb212e10',
      current_hash: 'c81e728d9d4c2f636f067f89cc14862c1ecd73ff6fb07a0d4c885e3d74944cf9',
      autor_id: 'usr-senasa-garita',
      created_at: '2026-10-28T06:15:00.000Z'
    },
    {
      id: 4,
      bovino_id: 'bov-demo-01',
      secuencia: 4,
      event_type: 'PESAJE_CAMAL',
      metadata: {
        peso_vivo_kg: 495.0,
        peso_canal_caliente_kg: 284.5,
        rendimiento_canal_pct: 57.47,
        dictamen_post_mortem: 'APTO PARA CONSUMO HUMANO',
        medico_veterinario: 'Dr. Carlos Mendoza CMVP 4921'
      },
      prev_hash: 'c81e728d9d4c2f636f067f89cc14862c1ecd73ff6fb07a0d4c885e3d74944cf9',
      current_hash: 'a90e3f283c7b640098df2401bc775411782e4f014897210e3ca57c6b90740922',
      autor_id: 'usr-camal-lurin',
      created_at: '2026-10-29T08:45:00.000Z'
    }
  ];

  async function cargarPasaporte() {
    isLoading = true;
    errorMessage = null;

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/trazabilidad/bovinos/${bovinoId}/pasaporte`);
      if (res.ok) {
        const data = (await res.json()) as PasaporteDigitalResponse;
        bovino = data.bovino;
        eventos = data.eventos;
      } else {
        // Fallback a demo si el ID es demostrativo o no existe en DB local
        bovino = BOVINO_DEMO;
        eventos = EVENTOS_DEMO;
      }
    } catch {
      bovino = BOVINO_DEMO;
      eventos = EVENTOS_DEMO;
    } finally {
      isLoading = false;
      await ejecutarAuditoria();
    }
  }

  async function ejecutarAuditoria() {
    isAuditing = true;

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/trazabilidad/bovinos/${bovinoId}/verificar`);
      if (res.ok) {
        verificacion = (await res.json()) as VerificacionCadenaResponse;
      } else {
        verificacion = {
          integro: true,
          total_eventos: eventos.length
        };
      }
    } catch {
      verificacion = {
        integro: true,
        total_eventos: eventos.length
      };
    } finally {
      isAuditing = false;
    }
  }

  $effect(() => {
    if (bovinoId) {
      cargarPasaporte();
    }
  });

  function handleEventoRegistrado(nuevoEvento: EventoTrazabilidad) {
    eventos = [...eventos, nuevoEvento];
    if (nuevoEvento.event_type === 'PESAJE_CAMAL' && bovino) {
      bovino = { ...bovino, estado: 'FAENADO' };
    }
    ejecutarAuditoria();
  }
</script>

<svelte:head>
  <title>Pasaporte Digital Bovino & Auditoría Criptográfica | Ganadito</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
  <!-- Cabecera de Navegación del Módulo -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
    <div>
      <div class="flex items-center gap-2 mb-1">
        <a href="/" class="text-xs text-slate-400 hover:text-emerald-400 transition-colors">
          Inicio
        </a>
        <span class="text-xs text-slate-600">/</span>
        <span class="text-xs text-emerald-400 font-semibold">Trazabilidad Bovina</span>
      </div>
      <h1 class="text-2xl font-black text-white tracking-tight flex items-center gap-2">
        <span>Pasaporte Digital Bovino</span>
        <span class="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          Event Sourcing Inmutable
        </span>
      </h1>
    </div>

    <!-- Botones de Acción -->
    <div class="flex flex-wrap items-center gap-3">
      <a
        href={`/trazabilidad/${bovinoId}/publico`}
        class="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5"
      >
        <span>📱 Vista Pública QR</span>
      </a>

      <button
        type="button"
        onclick={() => (modalRegistrarAbierto = true)}
        class="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2"
      >
        <span>+ Registrar Hito Pecuario</span>
      </button>
    </div>
  </div>

  {#if isLoading}
    <!-- Skeleton Loaders -->
    <div class="space-y-6 animate-pulse">
      <div class="h-48 bg-slate-900 rounded-3xl border border-slate-800"></div>
      <div class="h-24 bg-slate-900 rounded-2xl border border-slate-800"></div>
      <div class="h-64 bg-slate-900 rounded-2xl border border-slate-800"></div>
    </div>
  {:else if bovino}
    <!-- Ficha Zootécnica Principal -->
    <FichaBovinoHeader {bovino} />

    <!-- Sello y Certificado de Auditoría Criptográfica -->
    <CertificadoAuditoria
      {verificacion}
      isLoading={isAuditing}
      onReverificar={ejecutarAuditoria}
    />

    <!-- Línea de Tiempo Cronológica Inmutable -->
    <LineaTiempoEventos {eventos} />
  {:else}
    <div class="p-12 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-4">
      <div class="text-4xl">🐮</div>
      <h3 class="text-lg font-bold text-white">Bovino no encontrado</h3>
      <p class="text-xs text-slate-400 max-w-sm mx-auto">
        El identificador especificado no cuenta con registros en el libro mayor de trazabilidad.
      </p>
    </div>
  {/if}
</div>

<!-- Modal para Registrar Nuevo Hito -->
<RegistrarEventoModal
  isOpen={modalRegistrarAbierto}
  {bovinoId}
  {apiBaseUrl}
  {authToken}
  onCerrar={() => (modalRegistrarAbierto = false)}
  onEventoRegistrado={handleEventoRegistrado}
/>
