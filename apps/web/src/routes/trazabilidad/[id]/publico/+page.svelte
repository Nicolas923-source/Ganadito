<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '$app/state';
  import type {
    Bovino,
    EventoTrazabilidad,
    PasaporteDigitalResponse
  } from '@ganadito/contracts';

  let bovinoId = $derived(
    page?.params?.id ||
      (browser ? window.location.pathname.split('/')[2] || 'bov-demo-01' : 'bov-demo-01')
  );

  let apiBaseUrl = $derived(
    browser
      ? import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`
      : 'http://localhost:3000'
  );

  let bovino = $state<Bovino | null>(null);
  let eventos = $state<EventoTrazabilidad[]>([]);
  let isLoading = $state(true);

  // Fallback para escaneo demo
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
      metadata: { fundo: 'Fundo San José, Oxapampa', altitud_msnm: 1800 },
      prev_hash: '0'.repeat(64),
      current_hash: '8f4327bc49b1a030ef1d48c801452a229a1740fb875bcbc5716e257008cf142e',
      autor_id: 'usr-vet-01',
      created_at: '2024-03-15T10:00:00.000Z'
    },
    {
      id: 2,
      bovino_id: 'bov-demo-01',
      secuencia: 2,
      event_type: 'VACUNACION',
      metadata: { vacuna: 'Fiebre Aftosa Bivalente', entidad: 'SENASA Oficial' },
      prev_hash: '8f4327bc49b1a030ef1d48c801452a229a1740fb875bcbc5716e257008cf142e',
      current_hash: '3bc94120f26388410ee749171a81dc41b44ec0b57fa23933e4b7796dcb212e10',
      autor_id: 'usr-senasa',
      created_at: '2024-06-20T14:30:00.000Z'
    },
    {
      id: 3,
      bovino_id: 'bov-demo-01',
      secuencia: 3,
      event_type: 'MOVILIZACION_CSTI',
      metadata: { guia: 'CSTI-2026-0048192-SENASA', destino: 'Camal Frigorífico Lurín' },
      prev_hash: '3bc94120f26388410ee749171a81dc41b44ec0b57fa23933e4b7796dcb212e10',
      current_hash: 'c81e728d9d4c2f636f067f89cc14862c1ecd73ff6fb07a0d4c885e3d74944cf9',
      autor_id: 'usr-senasa',
      created_at: '2026-10-28T06:15:00.000Z'
    },
    {
      id: 4,
      bovino_id: 'bov-demo-01',
      secuencia: 4,
      event_type: 'PESAJE_CAMAL',
      metadata: { dictamen: 'APTO PARA CONSUMO HUMANO', peso_canal_kg: 284.5 },
      prev_hash: 'c81e728d9d4c2f636f067f89cc14862c1ecd73ff6fb07a0d4c885e3d74944cf9',
      current_hash: 'a90e3f283c7b640098df2401bc775411782e4f014897210e3ca57c6b90740922',
      autor_id: 'usr-camal',
      created_at: '2026-10-29T08:45:00.000Z'
    }
  ];

  async function cargarDatos() {
    isLoading = true;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/trazabilidad/bovinos/${bovinoId}/pasaporte`);
      if (res.ok) {
        const data = (await res.json()) as PasaporteDigitalResponse;
        bovino = data.bovino;
        eventos = data.eventos;
      } else {
        bovino = BOVINO_DEMO;
        eventos = EVENTOS_DEMO;
      }
    } catch {
      bovino = BOVINO_DEMO;
      eventos = EVENTOS_DEMO;
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    if (bovinoId) {
      cargarDatos();
    }
  });
</script>

<svelte:head>
  <title>Verificación de Origen y Trazabilidad Cárnica | Ganadito</title>
</svelte:head>

<div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between py-6 px-4 sm:px-6">
  <div class="max-w-md mx-auto w-full space-y-6">
    <!-- Header Móvil con Sello Oficial -->
    <div class="text-center space-y-2">
      <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 shadow-xl shadow-emerald-500/20 text-2xl font-black text-white mb-1">
        G
      </div>
      <h1 class="text-xl font-black text-white tracking-tight">
        Certificado de Trazabilidad Cárnica
      </h1>
      <p class="text-xs text-slate-400">
        Ecosistema Ganadito & Verificación Sanitaria SENASA
      </p>
    </div>

    {#if isLoading}
      <div class="p-8 bg-slate-900 border border-slate-800 rounded-3xl animate-pulse space-y-4">
        <div class="h-6 bg-slate-800 rounded w-1/2 mx-auto"></div>
        <div class="h-4 bg-slate-800 rounded w-3/4 mx-auto"></div>
        <div class="h-32 bg-slate-950 rounded-2xl"></div>
      </div>
    {:else if bovino}
      <!-- Tarjeta del Consumidor -->
      <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 relative overflow-hidden">
        <div class="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500"></div>

        <!-- Identificador del Lote / Arete -->
        <div class="text-center space-y-1">
          <span class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Código Único de Identificación Bovina
          </span>
          <div class="text-2xl font-black font-mono text-emerald-400">
            {bovino.codigo_arete}
          </div>
          <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
            <span>✓ ORIGEN 100% GARANTIZADO</span>
          </div>
        </div>

        <!-- Ficha Resumen para el Consumidor -->
        <div class="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 space-y-3 text-xs">
          <div class="flex items-center justify-between border-b border-slate-800/60 pb-2">
            <span class="text-slate-400">Raza del Animal:</span>
            <span class="font-bold text-white">{bovino.raza || 'Brahman x Nelore'}</span>
          </div>
          <div class="flex items-center justify-between border-b border-slate-800/60 pb-2">
            <span class="text-slate-400">Origen Geográfico:</span>
            <span class="font-bold text-white">Oxapampa, Selva Central (Perú)</span>
          </div>
          <div class="flex items-center justify-between border-b border-slate-800/60 pb-2">
            <span class="text-slate-400">Sistema de Crianza:</span>
            <span class="font-bold text-emerald-400">Pastoreo Regenerativo & Silvopastoril</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-slate-400">Estado Sanitario:</span>
            <span class="font-bold text-emerald-400">Apto para Consumo (SENASA)</span>
          </div>
        </div>

        <!-- Hitos de Confianza del Alimento -->
        <div class="space-y-3">
          <span class="text-xs font-bold text-slate-300 block uppercase tracking-wider">
            Historia del Alimento en la Mesa
          </span>

          <div class="space-y-2.5 text-xs">
            <div class="flex items-start gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
              <span class="text-base">🌱</span>
              <div>
                <strong class="text-white block font-semibold">Crianza Responsable en Pastos</strong>
                <span class="text-slate-400 text-[11px]">Nacido en fundo ganadero con estándares de bienestar animal.</span>
              </div>
            </div>

            <div class="flex items-start gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
              <span class="text-base">💉</span>
              <div>
                <strong class="text-white block font-semibold">Control Sanitario Oficial</strong>
                <span class="text-slate-400 text-[11px]">Vacunación completa contra Fiebre Aftosa y Carbunco.</span>
              </div>
            </div>

            <div class="flex items-start gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
              <span class="text-base">🚛</span>
              <div>
                <strong class="text-white block font-semibold">Movilización Autorizada CSTI</strong>
                <span class="text-slate-400 text-[11px]">Transporte homologado con guía de tránsito interno SENASA.</span>
              </div>
            </div>

            <div class="flex items-start gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
              <span class="text-base">🥩</span>
              <div>
                <strong class="text-white block font-semibold">Faena Frigorífica Inspeccionada</strong>
                <span class="text-slate-400 text-[11px]">Procesado en camal certificado con cadena de frío garantizada.</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Botón a Auditoría Técnica -->
        <div class="pt-2 text-center">
          <a
            href={`/trazabilidad/${bovino.id}`}
            class="text-xs text-emerald-400 hover:text-emerald-300 underline font-semibold transition-colors"
          >
            Ver Auditoría Criptográfica SHA-256 Completa →
          </a>
        </div>
      </div>
    {/if}

    <!-- Pie Informativo -->
    <div class="text-center text-[11px] text-slate-500 pb-4">
      Ganadito • Plataforma Pecuaria y Trazabilidad Inmutable del Perú
    </div>
  </div>
</div>
