<script lang="ts">
  import { session } from '#lib/session.ts';
  import { receivedOrder } from '#lib/auctions/orders.ts';
  const contextKey = $derived(`${$session.token ?? ''}:${$session.organizationId ?? ''}:${$session.role ?? ''}`);
  $effect(() => { receivedOrder.update(value => value?.contextKey === contextKey ? value : null); });
  const receipt = $derived($session.status === 'authenticated' && $receivedOrder?.contextKey === contextKey ? $receivedOrder : null);
</script>

<svelte:head><title>Órdenes | Ganadito</title></svelte:head>
<div class="max-w-4xl mx-auto w-full px-4 py-8 space-y-6">
  <h1 class="text-3xl font-bold">Órdenes de compra</h1>
  <div class="rounded-xl border border-amber-600 bg-amber-950/30 p-4 space-y-2" role="status">
    <p>La consulta del estado actual de las órdenes todavía no está habilitada.</p>
    <p class="text-sm text-slate-300">Cuando se habilite, podrás recuperar tu orden después del cierre, una recarga o una reconexión. Los pagos permanecen deshabilitados.</p>
  </div>
  {#if $session.status !== 'authenticated'}
    <p><a href="/acceso" class="underline text-emerald-300">Inicia sesión</a> para consultar las órdenes cuando estén disponibles.</p>
  {:else if receipt}
    <section class="rounded-2xl border border-slate-700 bg-slate-900 p-5 space-y-3">
      <h2 class="text-xl font-bold">Aviso de cierre recibido</h2>
      <p class="text-sm text-slate-400">El canal de la subasta anunció esta referencia. Falta consultar la orden para confirmar su estado actual y acceso.</p>
      <dl class="space-y-2"><div><dt class="text-slate-400 text-sm">Referencia de orden anunciada</dt><dd class="break-all">{receipt.event.orden_id}</dd></div><div><dt class="text-slate-400 text-sm">Estado anunciado al cierre</dt><dd>{receipt.event.estado}</dd></div></dl>
      <a href={`/subastas/${encodeURIComponent(receipt.event.lote_id)}`} class="text-emerald-300 underline">Volver al lote</a>
    </section>
  {:else}
    <p class="text-slate-400">No hay avisos de cierre recibidos en esta sesión. Esto no significa que no tengas órdenes.</p>
  {/if}
  <button type="button" disabled class="rounded-lg bg-slate-700 px-5 py-3 text-slate-400 cursor-not-allowed">Pago no disponible</button>
  <div><a href="/subastas" class="text-emerald-300 underline">Ir a lotes y subastas</a></div>
</div>
