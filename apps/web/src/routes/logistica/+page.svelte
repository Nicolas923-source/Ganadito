<script lang="ts">
  import { browser } from '$app/environment';
  import type { SolicitudFlete, UnidadTransporte } from '@ganadito/contracts';

  import CotizadorFlete from '../../lib/components/logistica/CotizadorFlete.svelte';
  import SolicitudesFleteList from '../../lib/components/logistica/SolicitudesFleteList.svelte';
  import RegistrarUnidadModal from '../../lib/components/logistica/RegistrarUnidadModal.svelte';
  import EstadoViajeCard from '../../lib/components/logistica/EstadoViajeCard.svelte';

  type TabLogistica = 'COTIZADOR' | 'TABLERO_CARGAS' | 'MIS_VIAJES';

  let tabActiva = $state<TabLogistica>('COTIZADOR');

  // Estados de datos
  let solicitudes = $state<SolicitudFlete[]>([]);
  let unidades = $state<UnidadTransporte[]>([]);
  let isLoading = $state(true);
  let isModalRegistrarAbierto = $state(false);

  // URL de API y Token
  let apiBaseUrl = $derived(
    browser
      ? import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`
      : 'http://localhost:3000'
  );

  let authToken = $state<string | null>(null);

  // Datos semilla/demo para garantizar que la pantalla esté completa y 100% visualizable inmediatamente
  const SOLICITUDES_DEMO: SolicitudFlete[] = [
    {
      id: 'sol-carga-001',
      solicitante_id: 'usr-fundo-pozuzo',
      origen_establecimiento_id: 'est-oxapampa-01',
      destino_establecimiento_id: 'est-lurin-01',
      tipo_carga: 'GANADO_EN_PIE',
      peso_toneladas: 14.5,
      distancia_km: 395,
      costo_flete_bruto: 2154.63,
      comision_referral_fee: 107.73,
      comision_plataforma_fee: 107.73,
      total_flete: 2262.36,
      costo_total_pagar: 2262.36,
      estado: 'PENDIENTE_ASIGNACION',
      created_at: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 3600 * 1000 * 2).toISOString()
    },
    {
      id: 'sol-carga-002',
      solicitante_id: 'usr-camal-arequipa',
      origen_establecimiento_id: 'est-arequipa-01',
      destino_establecimiento_id: 'est-lurin-01',
      tipo_carga: 'CARNE_CANAL',
      peso_toneladas: 18.0,
      distancia_km: 1015,
      costo_flete_bruto: 9285.00,
      comision_referral_fee: 464.25,
      comision_plataforma_fee: 464.25,
      total_flete: 9749.25,
      costo_total_pagar: 9749.25,
      estado: 'PENDIENTE_ASIGNACION',
      created_at: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
      updated_at: new Date(Date.now() - 3600 * 1000 * 5).toISOString()
    },
    {
      id: 'sol-carga-003',
      solicitante_id: 'usr-establo-mantaro',
      origen_establecimiento_id: 'est-huancayo-01',
      destino_establecimiento_id: 'est-lurin-01',
      tipo_carga: 'INSUMOS_GRANOS',
      peso_toneladas: 22.0,
      distancia_km: 310,
      costo_flete_bruto: 2537.00,
      comision_referral_fee: 126.85,
      comision_plataforma_fee: 126.85,
      total_flete: 2663.85,
      costo_total_pagar: 2663.85,
      estado: 'PENDIENTE_ASIGNACION',
      created_at: new Date(Date.now() - 3600 * 1000 * 8).toISOString(),
      updated_at: new Date(Date.now() - 3600 * 1000 * 8).toISOString()
    },
    {
      id: 'sol-viaje-activo-01',
      solicitante_id: 'usr-fundo-pozuzo',
      origen_establecimiento_id: 'est-oxapampa-01',
      destino_establecimiento_id: 'est-lurin-01',
      tipo_carga: 'GANADO_EN_PIE',
      peso_toneladas: 15.0,
      distancia_km: 395,
      costo_flete_bruto: 2223.75,
      comision_referral_fee: 111.19,
      comision_plataforma_fee: 111.19,
      total_flete: 2334.94,
      costo_total_pagar: 2334.94,
      unidad_id: 'unid-demo-01',
      transportista_id: 'usr-demo-transportista',
      estado: 'EN_TRANSITO',
      created_at: new Date(Date.now() - 3600 * 1000 * 14).toISOString(),
      updated_at: new Date(Date.now() - 3600 * 1000 * 3).toISOString()
    },
    {
      id: 'sol-viaje-activo-02',
      solicitante_id: 'usr-agropecuaria-moche',
      origen_establecimiento_id: 'est-trujillo-01',
      destino_establecimiento_id: 'est-lurin-01',
      tipo_carga: 'CARNE_CANAL',
      peso_toneladas: 12.0,
      distancia_km: 560,
      costo_flete_bruto: 3510.00,
      comision_referral_fee: 175.50,
      comision_plataforma_fee: 175.50,
      total_flete: 3685.50,
      costo_total_pagar: 3685.50,
      unidad_id: 'unid-demo-02',
      transportista_id: 'usr-demo-transportista',
      estado: 'ASIGNADO',
      created_at: new Date(Date.now() - 3600 * 1000 * 1).toISOString(),
      updated_at: new Date(Date.now() - 3600 * 1000 * 1).toISOString()
    }
  ];

  const UNIDADES_DEMO: UnidadTransporte[] = [
    {
      id: 'unid-demo-01',
      transportista_id: 'usr-demo-transportista',
      organizacion_id: 'org-demo-transporte',
      placa: 'V7T-824',
      tipo_unidad: 'CAMION_JAULA_SIMPLE',
      capacidad_toneladas: 16,
      capacidad_cabezas: 28,
      tiene_termoregistrador: false,
      activa: true,
      created_at: new Date(Date.now() - 86400 * 1000 * 30).toISOString()
    },
    {
      id: 'unid-demo-02',
      transportista_id: 'usr-demo-transportista',
      organizacion_id: 'org-demo-transporte',
      placa: 'D4F-892',
      tipo_unidad: 'FURGON_ISOTERMICO_REFRIGERADO',
      capacidad_toneladas: 18,
      capacidad_cabezas: null,
      tiene_termoregistrador: true,
      activa: true,
      created_at: new Date(Date.now() - 86400 * 1000 * 15).toISOString()
    }
  ];

  async function cargarDatos() {
    isLoading = true;
    try {
      if (authToken) {
        // Carga desde API si hay sesión
        const [resSol, resUni] = await Promise.allSettled([
          fetch(`${apiBaseUrl}/api/v1/logistica/solicitudes`, {
            headers: { Authorization: `Bearer ${authToken}` }
          }).then((r) => (r.ok ? r.json() : null)),
          fetch(`${apiBaseUrl}/api/v1/logistica/unidades`, {
            headers: { Authorization: `Bearer ${authToken}` }
          }).then((r) => (r.ok ? r.json() : null))
        ]);

        const datosSol = resSol.status === 'fulfilled' ? resSol.value?.solicitudes : null;
        const datosUni = resUni.status === 'fulfilled' ? resUni.value?.unidades : null;

        solicitudes = datosSol && datosSol.length > 0 ? datosSol : SOLICITUDES_DEMO;
        unidades = datosUni && datosUni.length > 0 ? datosUni : UNIDADES_DEMO;
      } else {
        // Modo demostración offline/autónomo
        solicitudes = SOLICITUDES_DEMO;
        unidades = UNIDADES_DEMO;
      }
    } catch {
      solicitudes = SOLICITUDES_DEMO;
      unidades = UNIDADES_DEMO;
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    if (browser) {
      authToken = localStorage.getItem('token');
      cargarDatos();
    }
  });

  // Callbacks para acciones reactivas
  function handleSolicitudPublicada(nueva: SolicitudFlete) {
    solicitudes = [nueva, ...solicitudes];
    tabActiva = 'TABLERO_CARGAS';
  }

  function handleUnidadRegistrada(nuevaUnidad: UnidadTransporte) {
    unidades = [nuevaUnidad, ...unidades];
  }

  function handleTomarFleteExito(solicitudId: string, unidadId: string) {
    solicitudes = solicitudes.map((sol) => {
      if (sol.id === solicitudId) {
        return {
          ...sol,
          estado: 'ASIGNADO',
          unidad_id: unidadId,
          transportista_id: 'usr-demo-transportista'
        };
      }
      return sol;
    });
    tabActiva = 'MIS_VIAJES';
  }

  function handleEstadoActualizado(solicitudId: string, nuevoEstado: 'EN_TRANSITO' | 'ENTREGADO') {
    solicitudes = solicitudes.map((sol) => {
      if (sol.id === solicitudId) {
        return {
          ...sol,
          estado: nuevoEstado,
          updated_at: new Date().toISOString()
        };
      }
      return sol;
    });
  }

  // Métricas calculadas para la barra superior
  let totalCargasDisponibles = $derived(
    solicitudes.filter((s) => s.estado === 'PENDIENTE_ASIGNACION').length
  );

  let misViajesActivos = $derived(
    solicitudes.filter((s) => s.estado === 'ASIGNADO' || s.estado === 'EN_TRANSITO')
  );

  let totalEntregados = $derived(
    solicitudes.filter((s) => s.estado === 'ENTREGADO').length
  );
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
  <!-- Banner Superior: Ganadito Cargo & Express -->
  <div class="bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950/40 border border-slate-800 rounded-3xl p-6 sm:p-8 mb-8 shadow-2xl relative overflow-hidden">
    <div class="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
      <div class="max-w-2xl">
        <div class="flex items-center gap-2 mb-3">
          <span class="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            Ganadito Cargo & Express UI
          </span>
          <span class="text-xs text-slate-400 font-medium">Logística Pecuaria Especializada</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Pasarela Logística Integrada & Fletes Geodésicos
        </h1>
        <p class="text-sm text-slate-300 mt-2 leading-relaxed">
          Cotización automática por tonelada-kilómetro (MTC / PostGIS), tablero de cargas en tiempo real y asignación concurrente protegida para transportistas homologados con jaula y furgón refrigerado SENASA.
        </p>
      </div>

      <!-- Tarjetas de Métricas Rápidas -->
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 text-center">
          <span class="text-[11px] uppercase tracking-wider text-slate-400 block font-semibold">Cargas en Espera</span>
          <span class="text-2xl font-black font-mono text-emerald-400">{totalCargasDisponibles}</span>
          <span class="text-[10px] text-slate-500 block mt-0.5">Listas para despacho</span>
        </div>

        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 text-center">
          <span class="text-[11px] uppercase tracking-wider text-slate-400 block font-semibold">Viajes en Ruta</span>
          <span class="text-2xl font-black font-mono text-amber-400">{misViajesActivos.length}</span>
          <span class="text-[10px] text-slate-500 block mt-0.5">Monitoreo activo</span>
        </div>

        <div class="col-span-2 sm:col-span-1 bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 text-center">
          <span class="text-[11px] uppercase tracking-wider text-slate-400 block font-semibold">Flota Homologada</span>
          <span class="text-2xl font-black font-mono text-cyan-400">{unidades.length}</span>
          <span class="text-[10px] text-slate-500 block mt-0.5">Unidades activas</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Pestañas de Navegación del Módulo Logístico -->
  <div class="flex items-center gap-2 border-b border-slate-800 mb-8 pb-3 overflow-x-auto text-sm font-semibold">
    <button
      type="button"
      onclick={() => (tabActiva = 'COTIZADOR')}
      class="px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap {tabActiva === 'COTIZADOR'
        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
        : 'text-slate-400 hover:text-white hover:bg-slate-900'}"
    >
      <span>📊</span>
      <span>Cotizar y Solicitar Flete</span>
    </button>

    <button
      type="button"
      onclick={() => (tabActiva = 'TABLERO_CARGAS')}
      class="px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap relative {tabActiva === 'TABLERO_CARGAS'
        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
        : 'text-slate-400 hover:text-white hover:bg-slate-900'}"
    >
      <span>🚛</span>
      <span>Tablero de Cargas Disponibles</span>
      {#if totalCargasDisponibles > 0}
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
          {totalCargasDisponibles}
        </span>
      {/if}
    </button>

    <button
      type="button"
      onclick={() => (tabActiva = 'MIS_VIAJES')}
      class="px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap {tabActiva === 'MIS_VIAJES'
        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
        : 'text-slate-400 hover:text-white hover:bg-slate-900'}"
    >
      <span>🛣️</span>
      <span>Mis Unidades y Viajes ({unidades.length})</span>
      {#if misViajesActivos.length > 0}
        <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
      {/if}
    </button>
  </div>

  <!-- Contenido de las Pestañas -->
  {#if tabActiva === 'COTIZADOR'}
    <div class="space-y-8">
      <CotizadorFlete
        {apiBaseUrl}
        {authToken}
        onSolicitudPublicada={handleSolicitudPublicada}
      />

      <!-- Tabla Informativa de Tarifas Oficiales y Factores de Ajuste -->
      <div class="bg-slate-950/60 border border-slate-800 rounded-2xl p-6">
        <h3 class="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <span>📋</span> Tabla Referencial de Tarifas Unitarias por Tonelada-Kilómetro (MTC / Ganadito)
        </h3>
        <div class="overflow-x-auto">
          <table class="w-full text-xs text-left text-slate-300">
            <thead class="bg-slate-900/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th class="px-4 py-2.5">Configuración Vehicular</th>
                <th class="px-4 py-2.5">Factor (S/ por km·TM)</th>
                <th class="px-4 py-2.5">Capacidad Típica</th>
                <th class="px-4 py-2.5">Aplicación Pecuaria</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60">
              <tr>
                <td class="px-4 py-3 font-semibold text-white">Camión Jaula Simple</td>
                <td class="px-4 py-3 font-mono text-emerald-400">S/ 0.3500</td>
                <td class="px-4 py-3">12 a 16 TM</td>
                <td class="px-4 py-3">Ganado bovino en pie, terneros y engorde</td>
              </tr>
              <tr>
                <td class="px-4 py-3 font-semibold text-white">Camión Jaula Doble Piso</td>
                <td class="px-4 py-3 font-mono text-emerald-400">S/ 0.4500</td>
                <td class="px-4 py-3">24 a 30 TM</td>
                <td class="px-4 py-3">Transporte interprovincial masivo de hacienda</td>
              </tr>
              <tr>
                <td class="px-4 py-3 font-semibold text-white">Furgón Isotérmico Refrigerado</td>
                <td class="px-4 py-3 font-mono text-cyan-400">S/ 0.5000</td>
                <td class="px-4 py-3">15 a 22 TM</td>
                <td class="px-4 py-3">Medias canales colgadas con termoregistrador (0°C - 4°C)</td>
              </tr>
              <tr>
                <td class="px-4 py-3 font-semibold text-white">Furgón Seco Cerrado</td>
                <td class="px-4 py-3 font-mono text-amber-400">S/ 0.3000</td>
                <td class="px-4 py-3">10 a 25 TM</td>
                <td class="px-4 py-3">Insumos forrajeros, balanceado, granos y ensilaje</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  {:else if tabActiva === 'TABLERO_CARGAS'}
    <SolicitudesFleteList
      {solicitudes}
      unidadesDisponibles={unidades}
      {isLoading}
      {authToken}
      {apiBaseUrl}
      onTomarFleteExito={handleTomarFleteExito}
      onAbrirRegistrarUnidad={() => (isModalRegistrarAbierto = true)}
    />
  {:else if tabActiva === 'MIS_VIAJES'}
    <div class="space-y-8">
      <!-- Sección: Flota Vehicular Homologada -->
      <div>
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-base font-bold text-white">Flota Vehicular Homologada</h3>
            <p class="text-xs text-slate-400">Unidades de transporte registradas para tomar fletes en la red Ganadito Express.</p>
          </div>
          <button
            type="button"
            onclick={() => (isModalRegistrarAbierto = true)}
            class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2"
          >
            <span>+</span>
            <span>Homologar Nueva Unidad</span>
          </button>
        </div>

        {#if unidades.length === 0}
          <div class="p-8 bg-slate-950/60 border border-slate-800 rounded-2xl text-center">
            <p class="text-xs text-slate-400 mb-3">No tienes unidades de transporte homologadas todavía.</p>
            <button
              type="button"
              onclick={() => (isModalRegistrarAbierto = true)}
              class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-white font-semibold"
            >
              Registrar Primera Unidad
            </button>
          </div>
        {:else}
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {#each unidades as unidad (unidad.id)}
              <div class="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-base font-black font-mono text-white">{unidad.placa}</span>
                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
                      Homologada MTC
                    </span>
                  </div>
                  <p class="text-xs text-slate-300 font-medium mt-1">
                    {unidad.tipo_unidad}
                  </p>
                  <p class="text-[11px] text-slate-400 mt-0.5">
                    Capacidad: {unidad.capacidad_toneladas} TM {#if unidad.capacidad_cabezas}({unidad.capacidad_cabezas} cabezas){/if}
                  </p>
                  {#if unidad.tiene_termoregistrador}
                    <span class="inline-flex items-center gap-1 text-[10px] text-cyan-400 font-medium mt-1">
                      <span>❄️</span> Termoregistrador Digital Activo
                    </span>
                  {/if}
                </div>
                <div class="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-lg">
                  🚛
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Sección: Viajes Asignados, en Tránsito y Entregados -->
      <div>
        <div class="mb-4">
          <h3 class="text-base font-bold text-white">Monitoreo de Viajes y Despachos</h3>
          <p class="text-xs text-slate-400">Seguimiento en vivo de cargas adjudicadas: avance de etapas y confirmación de entrega.</p>
        </div>

        {#if solicitudes.filter((s) => s.estado !== 'PENDIENTE_ASIGNACION').length === 0}
          <div class="p-8 bg-slate-950/60 border border-slate-800 rounded-2xl text-center">
            <p class="text-xs text-slate-400 mb-2">No tienes viajes en curso en este momento.</p>
            <button
              type="button"
              onclick={() => (tabActiva = 'TABLERO_CARGAS')}
              class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-white font-semibold"
            >
              Explorar Cargas Disponibles en el Tablero
            </button>
          </div>
        {:else}
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {#each solicitudes.filter((s) => s.estado !== 'PENDIENTE_ASIGNACION') as viaje (viaje.id)}
              <EstadoViajeCard
                solicitud={viaje}
                unidad={unidades.find((u) => u.id === viaje.unidad_id) || null}
                {authToken}
                {apiBaseUrl}
                onEstadoActualizado={handleEstadoActualizado}
              />
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Modal para Homologar Unidad -->
  <RegistrarUnidadModal
    isOpen={isModalRegistrarAbierto}
    {apiBaseUrl}
    {authToken}
    onClose={() => (isModalRegistrarAbierto = false)}
    onUnidadRegistrada={handleUnidadRegistrada}
  />
</div>
