<script lang="ts">
  import { page } from '$app/state';
  import { apiRequest } from '#lib/api.ts';
  import { apiWebSocketUrl } from '#lib/config.ts';
  import { session } from '#lib/session.ts';
  import { receivedOrder } from '#lib/auctions/orders.ts';
  import { parseSnapshot, parseAuctionEvent, type AuctionSnapshot, type AcceptedBid } from '#lib/auctions/state.ts';
  import PanelPujaRapida from '#lib/components/subastas/PanelPujaRapida.svelte';
  import EstadoConexionWs, { type EstadoConexion } from '#lib/components/subastas/EstadoConexionWs.svelte';

  const lotId = $derived(page.params.id ?? '');
  const contextKey = $derived(`${$session.token ?? ''}:${$session.organizationId ?? ''}:${$session.role ?? ''}`);
  let snapshot = $state<AuctionSnapshot | null>(null);
  let loading = $state(true);
  let error = $state('');
  let connection = $state<EstadoConexion>('SINCRONIZANDO');
  let retries = $state(0);
  let seconds = $state(0);
  let lastUpdated = $state('');
  let bids = $state<AcceptedBid[]>([]);
  let refresh: () => Promise<boolean> = async () => false;

  $effect(() => {
    const id = lotId;
    const key = contextKey;
    const checkingSession = $session.status === 'checking';
    snapshot = null;
    bids = [];
    error = '';
    loading = true;
    connection = 'SINCRONIZANDO';
    retries = 0;
    seconds = 0;
    receivedOrder.update(value => value?.contextKey === key ? value : null);
    // Do not open a short-lived transport while the stored session is being restored.
    // Anonymous visitors still connect normally after the session check resolves.
    if (checkingSession) {
      refresh = async () => false;
      return;
    }
    let disposed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let request: AbortController | undefined;
    let requestNumber = 0;
    let successfulAt = 0;
    let remainingAtSync = 0;
    let attempts = 0;
    let inFlight: Promise<boolean> | null = null;
    let refreshQueued = false;

    async function querySnapshot(): Promise<boolean> {
      if (disposed || !id) return false;
      const number = ++requestNumber;
      const querySocket = socket;
      const startedWithOpenSocket = querySocket?.readyState === WebSocket.OPEN;
      request = new AbortController();
      try {
        const result = await apiRequest<unknown>(`/api/v1/subastas/${encodeURIComponent(id)}/snapshot`, { signal: request.signal });
        if (disposed || number !== requestNumber) return false;
        const official = parseSnapshot(result, id);
        snapshot = official;
        remainingAtSync = official.tiempo_restante_segundos;
        successfulAt = Date.now();
        seconds = remainingAtSync;
        lastUpdated = new Date().toLocaleTimeString('es-PE');
        error = '';
        const recovered = startedWithOpenSocket && querySocket === socket && socket?.readyState === WebSocket.OPEN;
        connection = recovered ? 'CONECTADO' : socket?.readyState === WebSocket.OPEN ? 'SINCRONIZANDO' : 'DESCONECTADO';
        if (recovered) { attempts = 0; retries = 0; }
        return true;
      } catch (cause) {
        if (disposed || number !== requestNumber) return false;
        error = cause instanceof Error ? cause.message : 'No se pudo consultar este lote.';
        connection = 'DESCONECTADO';
        return false;
      } finally {
        if (!disposed && number === requestNumber) loading = false;
      }
    }
    function synchronize(): Promise<boolean> {
      if (disposed) return Promise.resolve(false);
      if (inFlight) {
        refreshQueued = true;
        return inFlight;
      }
      const operation = querySnapshot();
      inFlight = operation;
      void operation.then(() => {
        inFlight = null;
        if (refreshQueued && !disposed) {
          refreshQueued = false;
          void synchronize();
        }
      });
      return operation;
    }
    refresh = synchronize;

    function connect() {
      if (disposed) return;
      connection = attempts ? 'RECONECTANDO' : 'SINCRONIZANDO';
      try {
        const transport = new WebSocket(apiWebSocketUrl(`/api/v1/subastas/${encodeURIComponent(id)}/live`));
        socket = transport;
        transport.onopen = () => {
          if (disposed || socket !== transport) return;
          // Recover official state on every connection, including the first one.
          connection = 'SINCRONIZANDO';
          void synchronize();
        };
        transport.onmessage = (message) => {
          if (disposed || socket !== transport || contextKey !== key) return;
          try {
            const event = parseAuctionEvent(JSON.parse(String(message.data)), id);
            if (!event) return;
            if (event.kind === 'bid') recordBid(event.data);
            if (event.kind === 'order' && $session.status === 'authenticated' &&
              [event.data.organizacion_compradora_id, event.data.organizacion_vendedora_id].includes($session.organizationId ?? '')) {
              receivedOrder.set({ event: event.data, contextKey: key, receivedAt: new Date().toISOString() });
            }
            // Events trigger a query; they do not decide the official price, status or winner.
            void synchronize();
          } catch { void synchronize(); }
        };
        transport.onerror = () => {
          if (disposed || socket !== transport) return;
          connection = 'DESCONECTADO';
          transport.close();
        };
        transport.onclose = () => {
          if (disposed || socket !== transport) return;
          connection = 'RECONECTANDO';
          attempts += 1;
          retries = attempts;
          reconnectTimer = setTimeout(connect, Math.min(1000 * 2 ** Math.min(attempts, 5), 30000));
        };
      } catch {
        connection = 'DESCONECTADO';
        attempts += 1;
        retries = attempts;
        reconnectTimer = setTimeout(connect, 5000);
      }
    }

    void synchronize();
    connect();
    const polling = setInterval(() => { if (!inFlight) void synchronize(); }, 10000);
    const clock = setInterval(() => {
      if (successfulAt) seconds = Math.max(0, remainingAtSync - Math.floor((Date.now() - successfulAt) / 1000));
    }, 1000);
    const onVisible = () => { if (!document.hidden) void synchronize(); };
    const onOnline = () => { void synchronize(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      disposed = true;
      request?.abort();
      clearTimeout(reconnectTimer);
      clearInterval(polling);
      clearInterval(clock);
      socket?.close();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  });

  function recordBid(bid: AcceptedBid) {
    bids = [bid, ...bids.filter(item => item.puja_id !== bid.puja_id)].sort((a, b) => b.secuencia - a.secuencia).slice(0, 30);
  }
  function accepted(bid: AcceptedBid) { recordBid(bid); void refresh(); }
</script>

<svelte:head><title>Subasta | Ganadito</title></svelte:head>
<div class="max-w-6xl mx-auto w-full px-4 py-8 space-y-6">
  <div class="flex flex-wrap justify-between items-center gap-4">
    <div><a href="/subastas" class="text-sm text-emerald-300 underline">Volver a lotes</a><h1 class="text-3xl font-bold mt-2">Sala de subasta</h1></div>
    <EstadoConexionWs estado={connection} reintento={retries} />
  </div>
  <p class="text-sm text-slate-400 break-all">Identificador: {lotId}</p>
  {#if loading}<p role="status">Consultando el lote solicitado…</p>{/if}
  {#if error}
    <div role="alert" class="rounded-xl border border-rose-600 bg-rose-950/40 p-4 space-y-2"><p>{error}</p><button type="button" onclick={() => refresh()} class="underline">Reintentar consulta</button></div>
  {/if}
  {#if snapshot}
    <div class="grid lg:grid-cols-2 gap-6">
      <section class="rounded-2xl border border-slate-700 bg-slate-900 p-6 space-y-5" aria-label="Estado oficial del lote">
        <div class="flex justify-between gap-4"><h2 class="text-xl font-bold">{snapshot.codigo_lote}</h2><span class="text-emerald-300">{snapshot.estado}</span></div>
        <dl class="grid grid-cols-2 gap-5 text-sm">
          <div><dt class="text-slate-400">Precio actual</dt><dd class="text-2xl font-bold">S/ {snapshot.precio_actual.toFixed(2)}</dd></div>
          <div><dt class="text-slate-400">Precio base</dt><dd>S/ {snapshot.precio_base.toFixed(2)}</dd></div>
          <div><dt class="text-slate-400">Incremento mínimo</dt><dd>S/ {snapshot.incremento_minimo.toFixed(2)}</dd></div>
          <div><dt class="text-slate-400">Pujas registradas</dt><dd>{snapshot.secuencia_maxima}</dd></div>
        </dl>
        <div><p class="text-slate-400 text-sm">Tiempo orientativo restante</p><p class="font-mono text-3xl">{Math.floor(seconds / 3600).toString().padStart(2, '0')}:{Math.floor(seconds % 3600 / 60).toString().padStart(2, '0')}:{(seconds % 60).toString().padStart(2, '0')}</p></div>
        {#if seconds === 0 && snapshot.estado === 'ACTIVO'}<p role="status" class="text-amber-200">Esperando la confirmación del cierre por el servidor.</p>{/if}
        <p class="text-xs text-slate-400">Última consulta: {lastUpdated}. Versión {snapshot.version}. El reloj no adjudica el lote.</p>
        {#if ['ADJUDICADO', 'CERRADO', 'DESIERTO', 'CANCELADO'].includes(snapshot.estado)}
          <div class="border-t border-slate-700 pt-4 space-y-2"><p>Estado de cierre confirmado: {snapshot.estado}.</p><a href="/ordenes" class="text-emerald-300 underline">Consultar información de órdenes</a><p class="text-sm text-slate-400">Los pagos permanecen deshabilitados.</p></div>
        {/if}
      </section>
      {#key contextKey}
        <fieldset class="min-w-0" disabled={connection !== 'CONECTADO'} aria-label="Acciones de puja">
          <PanelPujaRapida subastaId={lotId} precioActual={snapshot.precio_actual} incrementoMinimo={snapshot.incremento_minimo} proximaPujaMinima={snapshot.proxima_puja_minima} esAbierta={snapshot.es_abierta && connection === 'CONECTADO' && !error && !loading} onPujaExitosa={accepted} />
        </fieldset>
      {/key}
    </div>
    <section class="rounded-2xl border border-slate-700 bg-slate-900 p-5 space-y-3">
      <h2 class="text-lg font-bold">Pujas recibidas durante esta visita</h2>
      <p class="text-sm text-slate-400">La consulta oficial informa {snapshot.secuencia_maxima} pujas en total. El historial anterior no está disponible en esta pantalla.</p>
      {#if bids.length === 0}<p class="text-slate-300">Todavía no se recibieron pujas en esta visita.</p>{:else}<ul class="space-y-2">{#each bids as bid (bid.puja_id)}<li class="flex justify-between border-t border-slate-800 pt-2"><span>Secuencia {bid.secuencia}</span><span>S/ {bid.monto.toFixed(2)}</span></li>{/each}</ul>{/if}
    </section>
  {:else if !loading && !error}<p>No hay información del lote solicitado.</p>{/if}
</div>
