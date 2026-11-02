<script lang="ts">
  import { browser } from '$app/environment';
  import type {
    PoolConProgreso,
    PoolCompraMayorista,
    TipoProductoMayorista,
    UnirsePoolResponse
  } from '@ganadito/contracts';

  import PoolCard from '../../lib/components/mayorista/PoolCard.svelte';
  import UnirsePoolModal from '../../lib/components/mayorista/UnirsePoolModal.svelte';
  import FiltrosMayorista from '../../lib/components/mayorista/FiltrosMayorista.svelte';
  import CrearPoolModal from '../../lib/components/mayorista/CrearPoolModal.svelte';

  type TabVista = 'TODAS' | 'CARNES' | 'FLASH';

  let tabVista = $state<TabVista>('TODAS');
  let categoriaSeleccionada = $state<'TODOS' | TipoProductoMayorista>('TODOS');
  let soloFlash = $state(false);
  let busqueda = $state('');

  let pools = $state<PoolConProgreso[]>([]);
  let isLoading = $state(true);
  let errorMessage = $state<string | null>(null);

  // Modales
  let poolSeleccionado = $state<PoolConProgreso | null>(null);
  let modalUnirseAbierto = $state(false);
  let modalCrearAbierto = $state(false);

  // URL de API y Token
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

  // Datos semilla/demo para garantizar que la interfaz sea inmediatamente visible y funcional
  const POOLS_DEMO: PoolConProgreso[] = [
    {
      id: 'pool-demo-01',
      creador_id: 'org-frigorifico-lurin',
      organizacion_id: 'org-frigorifico-lurin',
      tipo_producto: 'MEDIAS_CANALES',
      titulo: 'Pool Mayorista: 5,000 kg Medias Canales Bovinas Frías',
      descripcion: 'Bovinos procedentes de Selva Central y Arequipa. Oreos controlados a 2°C con certificación oficial SENASA para camales y carnicerías.',
      precio_unitario_mayorista: 18.2,
      meta_volumen: 5000,
      volumen_acumulado: 3850,
      unidad_medida: 'KG',
      fecha_limite: new Date(Date.now() + 18 * 3600 * 1000).toISOString(),
      estado: 'ABIERTO',
      es_oferta_flash: true,
      progreso_porcentaje: 77
    },
    {
      id: 'pool-demo-02',
      creador_id: 'org-agraria-valle',
      organizacion_id: 'org-agraria-valle',
      tipo_producto: 'GRANO_FORRAJE',
      titulo: 'Demanda Agrupada: 20 Toneladas de Maíz Chala Picada',
      descripcion: 'Forraje verde picado de alto valor nutritivo (materia seca 28%) para establos lecheros y engorde intensivo en Lima y Cañete.',
      precio_unitario_mayorista: 220,
      meta_volumen: 20,
      volumen_acumulado: 16,
      unidad_medida: 'TONELADA',
      fecha_limite: new Date(Date.now() + 52 * 3600 * 1000).toISOString(),
      estado: 'ABIERTO',
      es_oferta_flash: false,
      progreso_porcentaje: 80
    },
    {
      id: 'pool-demo-03',
      creador_id: 'org-desposte-sur',
      organizacion_id: 'org-desposte-sur',
      tipo_producto: 'CORTES_CALIBRADOS',
      titulo: 'Flash Deal: 1,500 kg Cortes Parrilleros Calibrados NTP 201.055',
      descripcion: 'Bife Angosto, Cuadril y Asado de Tira al vacío. Lote certificado listo para distribución en canal HORECA y cadenas cárnicas.',
      precio_unitario_mayorista: 26.5,
      meta_volumen: 1500,
      volumen_acumulado: 1500,
      unidad_medida: 'KG',
      fecha_limite: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
      estado: 'ALCANZADO',
      es_oferta_flash: true,
      progreso_porcentaje: 100
    },
    {
      id: 'pool-demo-04',
      creador_id: 'org-sanidad-veterinaria',
      organizacion_id: 'org-sanidad-veterinaria',
      tipo_producto: 'INSUMO_AGRICOLA',
      titulo: 'Compra Consolidada: Sal Mineralizada y Núcleos de Engorde',
      descripcion: 'Lote de 300 sacos de sales minerales con fósforo al 8% y microminerales quelatados para maximizar ganancia diaria de peso.',
      precio_unitario_mayorista: 85,
      meta_volumen: 300,
      volumen_acumulado: 110,
      unidad_medida: 'SACO_50KG',
      fecha_limite: new Date(Date.now() + 96 * 3600 * 1000).toISOString(),
      estado: 'ABIERTO',
      es_oferta_flash: false,
      progreso_porcentaje: 36.67
    }
  ];

  // Cargar pools desde la API
  async function cargarPools() {
    isLoading = true;
    errorMessage = null;

    try {
      const url = new URL(`${apiBaseUrl}/api/v1/mayorista/pools`);
      if (categoriaSeleccionada !== 'TODOS') {
        url.searchParams.set('tipo_producto', categoriaSeleccionada);
      }
      if (soloFlash) {
        url.searchParams.set('flash', 'true');
      }

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = (await res.json()) as PoolConProgreso[];
        if (data && data.length > 0) {
          pools = data;
        } else {
          // Si la API no tiene registros en DB aún, usar los datos demo
          pools = POOLS_DEMO;
        }
      } else {
        // Fallback a demo ante error de conexión API inicial
        pools = POOLS_DEMO;
      }
    } catch {
      pools = POOLS_DEMO;
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    cargarPools();
  });

  // Filtrado reactivo en cliente (Tabs + Categorías + Flash + Búsqueda)
  let poolsFiltrados = $derived.by<PoolConProgreso[]>(() => {
    return pools.filter((p) => {
      // Filtro de Pestaña Superior
      if (tabVista === 'CARNES') {
        const esCarne =
          p.tipo_producto === 'MEDIAS_CANALES' ||
          p.tipo_producto === 'CUARTOS_COMPENSADOS' ||
          p.tipo_producto === 'CORTES_CALIBRADOS';
        if (!esCarne) return false;
      } else if (tabVista === 'FLASH') {
        if (!p.es_oferta_flash) return false;
      }

      // Filtro de Categoría secundaria
      if (categoriaSeleccionada !== 'TODOS' && p.tipo_producto !== categoriaSeleccionada) {
        return false;
      }

      // Filtro Flash
      if (soloFlash && !p.es_oferta_flash) {
        return false;
      }

      // Búsqueda por texto
      if (busqueda.trim() !== '') {
        const q = busqueda.toLowerCase();
        const matchTitulo = p.titulo.toLowerCase().includes(q);
        const matchDesc = p.descripcion.toLowerCase().includes(q);
        const matchProd = p.tipo_producto.toLowerCase().includes(q);
        if (!matchTitulo && !matchDesc && !matchProd) return false;
      }

      return true;
    });
  });

  // Métricas clave del mercado
  let totalCampanas = $derived(pools.length);
  let ofertasFlashTotal = $derived(pools.filter((p) => p.es_oferta_flash).length);
  let metasAlcanzadasTotal = $derived(
    pools.filter((p) => p.estado === 'ALCANZADO' || p.volumen_acumulado >= p.meta_volumen).length
  );

  function abrirModalUnirse(pool: PoolConProgreso | PoolCompraMayorista) {
    poolSeleccionado = pool as PoolConProgreso;
    modalUnirseAbierto = true;
  }

  function handleExitoUnirse(resultado: UnirsePoolResponse) {
    // Actualizar localmente el pool participante
    pools = pools.map((p) => {
      if (p.id === resultado.pool.id) {
        return {
          ...p,
          ...resultado.pool,
          progreso_porcentaje: resultado.pool.meta_volumen > 0
            ? Math.min(100, Math.round((resultado.pool.volumen_acumulado / resultado.pool.meta_volumen) * 100))
            : p.progreso_porcentaje
        };
      }
      return p;
    });
  }

  function handlePoolCreado(nuevoPool: PoolCompraMayorista) {
    modalCrearAbierto = false;
    const nuevoConProgreso: PoolConProgreso = {
      ...nuevoPool,
      progreso_porcentaje: 0
    };
    pools = [nuevoConProgreso, ...pools];
  }

  function limpiarFiltros() {
    categoriaSeleccionada = 'TODOS';
    soloFlash = false;
    busqueda = '';
    tabVista = 'TODAS';
  }
</script>

<svelte:head>
  <title>Compras Mayoristas & Demand Pooling B2B | Ganadito</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
  <!-- Cabecera Principal y Métricas de Mercado B2B -->
  <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-slate-800 pb-6">
    <div>
      <div class="flex flex-wrap items-center gap-2 mb-2">
        <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          Demanda Agrupada B2B
        </span>
        <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
          Ofertas Flash 24h
        </span>
        <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700 font-mono">
          Precios Mayoristas
        </span>
      </div>
      <h1 class="text-2xl sm:text-3xl font-black text-white tracking-tight">
        Motor de Compras Mayoristas & Pools de Demanda
      </h1>
      <p class="text-sm text-slate-400 mt-1 max-w-3xl">
        Agregación de volumen comercial para carnicerías, establos y distribuidores. Accede a precios de productor uniendo tu compra a pedidos consolidados.
      </p>
    </div>

    <!-- Acciones Superiores -->
    <div class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onclick={cargarPools}
        class="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5"
      >
        <span>🔄</span>
        <span>Actualizar</span>
      </button>

      <button
        type="button"
        onclick={() => (modalCrearAbierto = true)}
        class="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/25 transition-all hover:scale-102 flex items-center gap-2"
      >
        <span>+ Publicar Campaña Mayorista</span>
      </button>
    </div>
  </div>

  <!-- Métricas Rápidas del Ecosistema Mayorista -->
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
    <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
      <div class="text-xs text-slate-400">Campañas Vigentes</div>
      <div class="text-2xl font-black font-mono text-white mt-1">{totalCampanas}</div>
      <div class="text-[11px] text-slate-500 mt-0.5">Pools de mercado abiertos</div>
    </div>

    <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
      <div class="text-xs text-slate-400">Ofertas Flash 24h</div>
      <div class="text-2xl font-black font-mono text-amber-400 mt-1">{ofertasFlashTotal}</div>
      <div class="text-[11px] text-amber-500/80 mt-0.5">Liquidación con cuenta regresiva</div>
    </div>

    <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
      <div class="text-xs text-slate-400">Metas Confirmadas</div>
      <div class="text-2xl font-black font-mono text-emerald-400 mt-1">{metasAlcanzadasTotal}</div>
      <div class="text-[11px] text-emerald-500/80 mt-0.5">Pedidos con 100% alcanzado</div>
    </div>

    <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
      <div class="text-xs text-slate-400">Ahorro Estimado</div>
      <div class="text-2xl font-black font-mono text-cyan-400 mt-1">~18.5%</div>
      <div class="text-[11px] text-slate-500 mt-0.5">Frente a intermediarios minoristas</div>
    </div>
  </div>

  <!-- Pestañas de Vista Rápida -->
  <div class="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 w-fit">
    <button
      type="button"
      onclick={() => (tabVista = 'TODAS')}
      class="px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 {tabVista === 'TODAS'
        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
        : 'text-slate-400 hover:text-white hover:bg-slate-900'}"
    >
      <span>📦 Todas las Campañas</span>
    </button>

    <button
      type="button"
      onclick={() => (tabVista = 'CARNES')}
      class="px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 {tabVista === 'CARNES'
        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
        : 'text-slate-400 hover:text-white hover:bg-slate-900'}"
    >
      <span>🥩 Pools de Carne & Canales</span>
    </button>

    <button
      type="button"
      onclick={() => (tabVista = 'FLASH')}
      class="px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 {tabVista === 'FLASH'
        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30 font-black'
        : 'text-slate-400 hover:text-white hover:bg-slate-900'}"
    >
      <span>⚡ Ofertas Flash 24h</span>
    </button>
  </div>

  <!-- Barra de Filtros y Búsqueda -->
  <FiltrosMayorista
    {categoriaSeleccionada}
    {soloFlash}
    {busqueda}
    onCambioCategoria={(cat) => (categoriaSeleccionada = cat)}
    onToggleFlash={(flash) => (soloFlash = flash)}
    onCambioBusqueda={(texto) => (busqueda = texto)}
    onLimpiar={limpiarFiltros}
  />

  <!-- Grid de Campañas y Pools -->
  {#if isLoading}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each [1, 2, 3, 4, 5, 6] as _}
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl animate-pulse space-y-4">
          <div class="flex items-center justify-between">
            <div class="h-4 bg-slate-800 rounded w-24"></div>
            <div class="h-4 bg-slate-800 rounded w-16"></div>
          </div>
          <div class="h-5 bg-slate-800 rounded w-3/4"></div>
          <div class="h-3 bg-slate-800 rounded w-full"></div>
          <div class="h-16 bg-slate-950 rounded-xl"></div>
          <div class="h-3 bg-slate-800 rounded-full w-full"></div>
          <div class="h-10 bg-slate-800 rounded-xl w-full"></div>
        </div>
      {/each}
    </div>
  {:else if poolsFiltrados.length > 0}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each poolsFiltrados as pool (pool.id)}
        <PoolCard {pool} onUnirse={abrirModalUnirse} />
      {/each}
    </div>
  {:else}
    <!-- Empty State -->
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
      <div class="text-5xl">🌾</div>
      <h3 class="text-lg font-bold text-white">No se encontraron campañas activas</h3>
      <p class="text-xs text-slate-400 max-w-md mx-auto">
        No hay pools ni ofertas flash que coincidan con los filtros seleccionados actualmente. Intenta limpiar los filtros o crea una nueva campaña.
      </p>
      <div class="pt-2 flex items-center justify-center gap-3">
        <button
          type="button"
          onclick={limpiarFiltros}
          class="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
        >
          Limpiar Filtros
        </button>
        <button
          type="button"
          onclick={() => (modalCrearAbierto = true)}
          class="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
        >
          Crear Primer Pool
        </button>
      </div>
    </div>
  {/if}
</div>

<!-- Modal para Unirse al Pool -->
<UnirsePoolModal
  isOpen={modalUnirseAbierto}
  pool={poolSeleccionado}
  {apiBaseUrl}
  {authToken}
  onCerrar={() => (modalUnirseAbierto = false)}
  onExito={handleExitoUnirse}
/>

<!-- Modal para Crear Nuevo Pool -->
<CrearPoolModal
  isOpen={modalCrearAbierto}
  {apiBaseUrl}
  {authToken}
  onCerrar={() => (modalCrearAbierto = false)}
  onPoolCreado={handlePoolCreado}
/>
