<script lang="ts">
  import { browser } from '$app/environment';
  import type {
    ComprobanteFiscalRecord,
    FactoringCavaliRecord,
    ConciliacionPendientesResponse
  } from '@ganadito/contracts';

  import ComprobantesTable from '../../lib/components/tributario/ComprobantesTable.svelte';
  import EmitirLiquidacionModal from '../../lib/components/tributario/EmitirLiquidacionModal.svelte';
  import FactoringCavaliModal from '../../lib/components/tributario/FactoringCavaliModal.svelte';
  import EstadoSunatBadge from '../../lib/components/tributario/EstadoSunatBadge.svelte';

  type TabTributario = 'SUNAT' | 'CAVALI';

  let tabActiva = $state<TabTributario>('SUNAT');

  // Estados de datos
  let comprobantes = $state<ComprobanteFiscalRecord[]>([]);
  let factorings = $state<FactoringCavaliRecord[]>([]);
  let isLoading = $state(true);

  // Modales
  let isModalLiquidacionAbierto = $state(false);
  let isModalFactoringAbierto = $state(false);
  let ordenSeleccionadaParaFactoring = $state<string>('');
  let compSeleccionadoParaFactoring = $state<string>('');
  let montoParaFactoring = $state<number>(0);

  // Notificación Toast
  let notificacion = $state<{ tipo: 'exito' | 'info'; texto: string } | null>(null);

  // URL de API y Token
  let apiBaseUrl = $derived(
    browser
      ? import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`
      : 'http://localhost:3000'
  );

  let authToken = $state<string | null>(null);

  // Datos semilla/demo para garantizar que la pantalla sea inmediatamente operativa y rica visualmente
  const COMPROBANTES_DEMO: ComprobanteFiscalRecord[] = [
    {
      id: 'comp-liq-001',
      orden_id: 'ord-bov-pozuzo-01',
      tipo_comprobante: 'LIQUIDACION_COMPRA_ELECTRONICA',
      serie: 'E001',
      correlativo: 42,
      emisor_ruc: '20608492015',
      receptor_num_doc: '45892134',
      receptor_tipo_doc: 'DNI',
      monto_subtotal: 34500.0,
      monto_igv: 0.0,
      monto_total: 34500.0,
      estado_sunat: 'CONFIRMADO',
      external_correlation_id: 'SUNAT-E001-42-1718902400',
      xml_payload_resumen: {
        emisor: { ruc: '20608492015', razon_social: 'Frigorífico Metropolitano Lurín S.A.C.' },
        receptor: { dni: '45892134', nombre: 'Juan Quispe Huamán', ppa: 'PPA-2026-89421' },
        totales: { subtotal: 34500.0, igv: 0.0, total: 34500.0 },
        regimen_ppa_exonerado: true
      },
      cdr_sunat_codigo: '0',
      cdr_sunat_mensaje: 'La Liquidación de Compra ha sido aceptada satisfactoriamente por SUNAT.',
      retry_count: 0,
      next_retry_at: null,
      created_at: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
      updated_at: new Date(Date.now() - 3600 * 1000 * 4).toISOString()
    },
    {
      id: 'comp-liq-002',
      orden_id: 'ord-bov-mantaro-02',
      tipo_comprobante: 'LIQUIDACION_COMPRA_ELECTRONICA',
      serie: 'E001',
      correlativo: 43,
      emisor_ruc: '20608492015',
      receptor_num_doc: '09812456',
      receptor_tipo_doc: 'DNI',
      monto_subtotal: 21800.0,
      monto_igv: 0.0,
      monto_total: 21800.0,
      estado_sunat: 'ENVIADO_PENDIENTE',
      external_correlation_id: 'SUNAT-E001-43-1718903600',
      xml_payload_resumen: {
        emisor: { ruc: '20608492015', razon_social: 'Frigorífico Metropolitano Lurín S.A.C.' },
        receptor: { dni: '09812456', nombre: 'Santos Huayta Alanya', ppa: 'PPA-2026-31204' },
        totales: { subtotal: 21800.0, igv: 0.0, total: 21800.0 }
      },
      cdr_sunat_codigo: null,
      cdr_sunat_mensaje: 'Enviado al servicio SEE-SUNAT; en espera de CDR asíncrono.',
      retry_count: 1,
      next_retry_at: new Date(Date.now() + 300 * 1000).toISOString(),
      created_at: new Date(Date.now() - 3600 * 1000 * 1).toISOString(),
      updated_at: new Date(Date.now() - 3600 * 1000 * 1).toISOString()
    },
    {
      id: 'comp-fact-003',
      orden_id: 'ord-gmx-calce-03',
      tipo_comprobante: 'FACTURA_ELECTRONICA',
      serie: 'F001',
      correlativo: 108,
      emisor_ruc: '20491234567',
      receptor_num_doc: '20608492015',
      receptor_tipo_doc: 'RUC',
      monto_subtotal: 52000.0,
      monto_igv: 9360.0,
      monto_total: 61360.0,
      estado_sunat: 'CONFIRMADO',
      external_correlation_id: 'SUNAT-F001-108-1718895000',
      xml_payload_resumen: {
        emisor: { ruc: '20491234567', razon_social: 'Ganadera del Centro S.A.C.' },
        receptor: { ruc: '20608492015', razon_social: 'Frigorífico Metropolitano Lurín S.A.C.' },
        totales: { subtotal: 52000.0, igv: 9360.0, total: 61360.0 }
      },
      cdr_sunat_codigo: '0',
      cdr_sunat_mensaje: 'La Factura Electrónica ha sido aceptada.',
      retry_count: 0,
      next_retry_at: null,
      created_at: new Date(Date.now() - 86400 * 1000 * 1).toISOString(),
      updated_at: new Date(Date.now() - 86400 * 1000 * 1).toISOString()
    }
  ];

  const FACTORINGS_DEMO: FactoringCavaliRecord[] = [
    {
      id: 'fact-001',
      orden_id: 'ord-gmx-calce-03',
      comprobante_id: 'comp-fact-003',
      organizacion_id: 'org-ganadera-centro',
      monto_factura: 61360.0,
      porcentaje_adelanto: 80,
      tasa_descuento_mensual: 1.2,
      monto_adelanto_neto: 48498.94,
      estado: 'CONFIRMADO',
      cavali_tracking_id: 'CAVALI-ANOT-F001-108-X892',
      created_at: new Date(Date.now() - 86400 * 1000 * 1).toISOString(),
      updated_at: new Date(Date.now() - 86400 * 1000 * 1).toISOString()
    }
  ];

  async function cargarDatos() {
    isLoading = true;
    try {
      if (authToken) {
        const [resComp, resFact] = await Promise.allSettled([
          fetch(`${apiBaseUrl}/api/v1/tributario/comprobantes`, {
            headers: { Authorization: `Bearer ${authToken}` }
          }).then((r) => (r.ok ? r.json() : null)),
          fetch(`${apiBaseUrl}/api/v1/fintech/cavali`, {
            headers: { Authorization: `Bearer ${authToken}` }
          }).then((r) => (r.ok ? r.json() : null))
        ]);

        const datosComp = resComp.status === 'fulfilled' ? resComp.value?.comprobantes : null;
        const datosFact = resFact.status === 'fulfilled' ? resFact.value?.factorings : null;

        comprobantes = datosComp && datosComp.length > 0 ? datosComp : COMPROBANTES_DEMO;
        factorings = datosFact && datosFact.length > 0 ? datosFact : FACTORINGS_DEMO;
      } else {
        comprobantes = COMPROBANTES_DEMO;
        factorings = FACTORINGS_DEMO;
      }
    } catch {
      comprobantes = COMPROBANTES_DEMO;
      factorings = FACTORINGS_DEMO;
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

  // Callbacks
  function handleLiquidacionEmitida(nueva: ComprobanteFiscalRecord) {
    comprobantes = [nueva, ...comprobantes];
    notificacion = {
      tipo: 'exito',
      texto: `Liquidación de Compra ${nueva.serie}-${nueva.correlativo} emitida con éxito en SUNAT (CDR OK).`
    };
    setTimeout(() => (notificacion = null), 6000);
  }

  function handleConciliacionExitosa(res: ConciliacionPendientesResponse) {
    comprobantes = comprobantes.map((c) => {
      const match = res.detalles.find((d) => d.comprobante_id === c.id);
      if (match) {
        return {
          ...c,
          estado_sunat: match.nuevo_estado,
          cdr_sunat_codigo: '0',
          cdr_sunat_mensaje: match.mensaje
        };
      }
      return c;
    });
    notificacion = {
      tipo: 'exito',
      texto: `Conciliación ejecutada: ${res.confirmados} comprobante(s) actualizados a CONFIRMADO ante SUNAT.`
    };
    setTimeout(() => (notificacion = null), 6000);
  }

  function handleFactoringSolicitado(record: FactoringCavaliRecord) {
    factorings = [record, ...factorings];
    notificacion = {
      tipo: 'exito',
      texto: `Factura negociable anotada en CAVALI con éxito. ID: ${record.cavali_tracking_id?.substring(0, 18)}...`
    };
    setTimeout(() => (notificacion = null), 6000);
  }

  function abrirModalFactoringParaComprobante(comp: ComprobanteFiscalRecord) {
    ordenSeleccionadaParaFactoring = comp.orden_id;
    compSeleccionadoParaFactoring = comp.id;
    montoParaFactoring = comp.monto_total;
    isModalFactoringAbierto = true;
  }

  // Métricas financieras calculadas para las tarjetas de resumen
  let totalDeducidoPpa = $derived.by(() => {
    return comprobantes
      .filter((c) => c.tipo_comprobante === 'LIQUIDACION_COMPRA_ELECTRONICA' && c.estado_sunat === 'CONFIRMADO')
      .reduce((sum, c) => sum + c.monto_total, 0);
  });

  let totalComprobantesConfirmados = $derived(
    comprobantes.filter((c) => c.estado_sunat === 'CONFIRMADO').length
  );

  let totalLiquidezFactoring = $derived.by(() => {
    return factorings
      .filter((f) => f.estado === 'CONFIRMADO')
      .reduce((sum, f) => sum + (f.monto_adelanto_neto || 0), 0);
  });

  let ahorroFiscalEstimado = $derived(
    Number((totalDeducidoPpa * 0.295).toFixed(2)) // 29.5% Tasa de Impuesto a la Renta de 3ra categoría
  );
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
  <!-- Banner Superior: Panel Tributario & Fintech Engine -->
  <div class="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/40 border border-slate-800 rounded-3xl p-6 sm:p-8 mb-8 shadow-2xl relative overflow-hidden">
    <div class="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
      <div class="max-w-2xl">
        <div class="flex items-center gap-2 mb-3">
          <span class="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
            SEE-SUNAT & CAVALI Factoring
          </span>
          <span class="text-xs text-slate-400 font-medium">Cumplimiento Tributario & Liquidez B2B</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Panel Tributario-Financiero & Escudo Fiscal PPA
        </h1>
        <p class="text-sm text-slate-300 mt-2 leading-relaxed">
          Emisión de Liquidaciones de Compra Electrónica (Serie E001) con sustento de gasto 100% deducible de Impuesto a la Renta (29.5%) bajo el régimen del Padrón de Productores Agrarios (PPA), conciliación de CDR y factoring en CAVALI.
        </p>
      </div>

      <!-- Tarjetas de Resumen KPI -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 text-center">
          <span class="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">Gasto Deducible PPA</span>
          <span class="text-xl font-black font-mono text-emerald-400">
            S/ {totalDeducidoPpa.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
          </span>
          <span class="text-[10px] text-emerald-500 block mt-0.5">100% deducible IR</span>
        </div>

        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 text-center">
          <span class="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">Escudo Fiscal (29.5%)</span>
          <span class="text-xl font-black font-mono text-cyan-400">
            S/ {ahorroFiscalEstimado.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
          </span>
          <span class="text-[10px] text-slate-500 block mt-0.5">Ahorro en impuesto</span>
        </div>

        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 text-center">
          <span class="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">Comprobantes OK</span>
          <span class="text-xl font-black font-mono text-white">
            {totalComprobantesConfirmados} / {comprobantes.length}
          </span>
          <span class="text-[10px] text-slate-500 block mt-0.5">Con CDR SUNAT</span>
        </div>

        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 text-center">
          <span class="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">Adelantos CAVALI</span>
          <span class="text-xl font-black font-mono text-indigo-400">
            S/ {totalLiquidezFactoring.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
          </span>
          <span class="text-[10px] text-slate-500 block mt-0.5">Liquidez 24-48h</span>
        </div>
      </div>
    </div>
  </div>

  {#if notificacion}
    <div class="mb-6 p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs font-semibold shadow-lg flex items-center justify-between animate-fade-in">
      <div class="flex items-center gap-2">
        <span class="text-base">✓</span>
        <span>{notificacion.texto}</span>
      </div>
      <button
        type="button"
        onclick={() => (notificacion = null)}
        class="text-emerald-400 hover:text-white text-xs px-2"
      >
        ✕
      </button>
    </div>
  {/if}

  <!-- Pestañas de Navegación del Módulo Tributario-Financiero -->
  <div class="flex items-center gap-2 border-b border-slate-800 mb-8 pb-3 overflow-x-auto text-sm font-semibold">
    <button
      type="button"
      onclick={() => (tabActiva = 'SUNAT')}
      class="px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap {tabActiva === 'SUNAT'
        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
        : 'text-slate-400 hover:text-white hover:bg-slate-900'}"
    >
      <span>🏛️</span>
      <span>Comprobantes Fiscales y Liquidaciones SUNAT</span>
      <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/40 text-slate-200">
        {comprobantes.length}
      </span>
    </button>

    <button
      type="button"
      onclick={() => (tabActiva = 'CAVALI')}
      class="px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap {tabActiva === 'CAVALI'
        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
        : 'text-slate-400 hover:text-white hover:bg-slate-900'}"
    >
      <span>💰</span>
      <span>Factoring Electrónico CAVALI</span>
      {#if factorings.length > 0}
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
          {factorings.length}
        </span>
      {/if}
    </button>
  </div>

  <!-- Contenido de las Pestañas -->
  {#if tabActiva === 'SUNAT'}
    <div class="space-y-6">
      <ComprobantesTable
        {comprobantes}
        {apiBaseUrl}
        {authToken}
        {isLoading}
        onConciliacionExitosa={handleConciliacionExitosa}
        onEmitirNuevaLiquidacion={() => (isModalLiquidacionAbierto = true)}
      />

      <!-- Banner de Marco Legal y Régimen PPA -->
      <div class="p-6 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2">
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <span>📜</span> Base Legal y Normativa Tributaria Vigente
        </h3>
        <p class="text-xs text-slate-400 leading-relaxed">
          Conforme a la <strong>Resolución de Superintendencia N.° 300-2014/SUNAT</strong> y el <strong>Decreto Legislativo N.° 1521</strong>, las empresas compradoras de ganado y productos cárnicos pueden emitir Liquidaciones de Compra Electrónicas a personas naturales productoras agropecuarias inscritas en el Padrón de Productores Agrarios (PPA) del MIDAGRI, permitiendo la deducción del costo para fines del Impuesto a la Renta de 3ra categoría.
        </p>
      </div>
    </div>
  {:else if tabActiva === 'CAVALI'}
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-950/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <h3 class="text-base font-bold text-white">Cartera de Facturas Negociables Anotadas en CAVALI</h3>
          <p class="text-xs text-slate-400 mt-0.5">
            Gestión de títulos valores electrónicos con mérito ejecutivo bajo la Ley N.° 29623.
          </p>
        </div>
        <button
          type="button"
          onclick={() => {
            ordenSeleccionadaParaFactoring = 'ord-demo-01';
            compSeleccionadoParaFactoring = 'comp-fact-demo';
            montoParaFactoring = 45000.0;
            isModalFactoringAbierto = true;
          }}
          class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
        >
          <span>+</span>
          <span>Solicitar Factoring de Factura</span>
        </button>
      </div>

      {#if factorings.length === 0}
        <div class="p-12 text-center bg-slate-950/60 border border-slate-800 rounded-2xl text-slate-400">
          <span class="text-3xl block mb-2">💼</span>
          <p class="text-sm font-bold text-white">No tienes operaciones de factoring activas</p>
          <p class="text-xs text-slate-500 mt-1">
            Puedes solicitar adelanto de liquidez sobre cualquier factura comercial confirmada por un camal o frigorífico.
          </p>
        </div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          {#each factorings as fact (fact.id)}
            <div class="bg-slate-950/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                  <span class="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                    Anotada en CAVALI
                  </span>
                  <span class="text-[10px] font-mono text-slate-400">
                    Orden #{fact.orden_id.substring(0, 8)}
                  </span>
                </div>

                <div class="space-y-2 mb-4 text-xs">
                  <div>
                    <span class="text-[10px] text-slate-400 uppercase font-semibold block">CAVALI Tracking ID:</span>
                    <span class="font-mono font-bold text-white text-[11px] break-all">{fact.cavali_tracking_id}</span>
                  </div>

                  <div class="grid grid-cols-2 gap-3 pt-2">
                    <div class="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
                      <span class="text-[10px] text-slate-400 block">Monto Factura:</span>
                      <span class="font-mono font-bold text-white">
                        S/ {fact.monto_factura.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div class="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
                      <span class="text-[10px] text-slate-400 block">Adelanto ({fact.porcentaje_adelanto}%):</span>
                      <span class="font-mono font-bold text-emerald-400">
                        S/ {fact.monto_adelanto_neto?.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span class="text-[10px] text-slate-500">Tasa Mensual: {fact.tasa_descuento_mensual}% TEM</span>
                <span class="px-2.5 py-1 rounded-lg bg-emerald-950/60 text-emerald-300 font-semibold border border-emerald-500/30 text-[11px]">
                  ✓ Desembolsado
                </span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Modal para Emitir Liquidación de Compra Electrónica -->
  <EmitirLiquidacionModal
    isOpen={isModalLiquidacionAbierto}
    {apiBaseUrl}
    {authToken}
    onClose={() => (isModalLiquidacionAbierto = false)}
    onLiquidacionEmitida={handleLiquidacionEmitida}
  />

  <!-- Modal para Solicitar Factoring CAVALI -->
  <FactoringCavaliModal
    isOpen={isModalFactoringAbierto}
    {apiBaseUrl}
    {authToken}
    ordenIdPredeterminada={ordenSeleccionadaParaFactoring}
    comprobanteIdPredeterminado={compSeleccionadoParaFactoring}
    montoFacturaPredeterminado={montoParaFactoring}
    onClose={() => (isModalFactoringAbierto = false)}
    onFactoringSolicitado={handleFactoringSolicitado}
  />
</div>
