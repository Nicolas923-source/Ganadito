<script lang="ts">
  import { goto } from '$app/navigation';
  import { apiRequest } from '#lib/api.ts';
  import { session } from '#lib/session.ts';
  import CatalogoLotes from '#lib/components/subastas/CatalogoLotes.svelte';
  let id = $state('');
  let cantidad = $state<number | undefined>();
  let categoria = $state('');
  let raza = $state('');
  let descripcion = $state('');
  let code = $state('');
  let price = $state<number | undefined>();
  let increment = $state<number | undefined>();
  let closing = $state('');
  let submitting = $state(false);
  let uncertain = $state(false);
  let error = $state('');
  let created = $state<{ id: string; codigo_lote: string; estado: string } | null>(null);
  const contextKey = $derived(`${$session.token ?? ''}:${$session.organizationId ?? ''}:${$session.role ?? ''}`);
  let lastContext = $state('');
  $effect(() => {
    if (lastContext !== contextKey) {
      lastContext = contextKey;
      created = null;
      uncertain = false;
      error = '';
    }
  });

  async function publish(event: SubmitEvent) {
    event.preventDefault();
    if (submitting || uncertain || $session.status !== 'authenticated' || !$session.organizationId) return;
    if (!price || !Number.isFinite(price) || price <= 0 || !increment || !Number.isFinite(increment) || increment <= 0 ||
      !Number.isFinite(Date.parse(closing)) || Date.parse(closing) <= Date.now()) {
      error = 'Revisa los importes y elige una fecha de cierre futura.';
      return;
    }
    const key = contextKey;
    submitting = true;
    error = '';
    created = null;
    try {
      const result = await apiRequest<{ id: string; codigo_lote: string; estado: string }>('/api/v1/subastas', {
        method: 'POST', expectedStatus: 201, body: JSON.stringify({ codigo_lote: code.trim() || undefined,
          precio_base: price, incremento_minimo: increment, fecha_cierre: new Date(closing).toISOString(), estado: 'ACTIVO',
          cantidad_animales: cantidad && Number.isInteger(cantidad) ? cantidad : undefined,
          categoria: categoria.trim() || undefined, raza: raza.trim() || undefined, descripcion: descripcion.trim() || undefined })
      });
      if (contextKey !== key) return;
      if (!result || typeof result.id !== 'string' || !result.id || typeof result.codigo_lote !== 'string' || typeof result.estado !== 'string') {
        uncertain = true;
        throw new Error('No se recibió una confirmación completa. Comprueba el lote antes de volver a publicarlo.');
      }
      created = result;
    } catch (cause) {
      if (contextKey !== key) return;
      error = cause instanceof Error ? cause.message : 'No se pudo publicar el lote.';
      const status = cause && typeof cause === 'object' && 'status' in cause ? Number(cause.status) : 0;
      if (!(status >= 400 && status < 500)) uncertain = true;
    } finally { submitting = false; }
  }
</script>

<svelte:head><title>Lotes y subastas | Ganadito</title></svelte:head>
<div class="max-w-6xl mx-auto w-full px-4 py-8 space-y-8">
  <div class="page-head"><h1>Lotes y subastas</h1><p>Explora los lotes activos, abre uno por su identificador o publica un lote para tu organización activa.</p></div>
  <CatalogoLotes />
  <section class="rounded-2xl border border-linea bg-superficie p-6 space-y-3">
    <h2 class="text-xl font-bold">Abrir un lote</h2>
    <form class="flex flex-wrap gap-3 items-end" onsubmit={(event) => { event.preventDefault(); if (id.trim()) void goto(`/subastas/${encodeURIComponent(id.trim())}`); }}>
      <div class="flex-1 min-w-52"><label for="lot-id" class="block text-sm mb-1">Identificador del lote</label><input id="lot-id" class="w-full rounded-lg border border-linea bg-superficie px-3 py-2" required maxlength="100" bind:value={id} /></div>
      <button class="rounded-lg bg-pasto px-5 py-2 font-semibold" type="submit">Consultar lote</button>
    </form>
  </section>
  <section id="publicar" class="rounded-2xl border border-linea bg-superficie p-6 space-y-4 scroll-mt-4">
    <h2 class="text-xl font-bold">Publicar un lote</h2>
    <p class="text-sm text-apagado">Se crea con estado activo si el servidor acepta la publicación. La organización y los permisos los confirma tu sesión en el servidor.</p>
    {#if $session.status !== 'authenticated'}<p><a href="/acceso" class="text-pasto underline">Inicia sesión</a> para publicar.</p>{:else if !$session.organizationId}<p><a href="/contexto" class="text-pasto underline">Selecciona tu organización</a> para publicar.</p>{/if}
    {#if error}<p role="alert" class="rounded-lg border border-alerta-linea p-3 text-alerta">{error}</p>{/if}
    {#if uncertain}<p role="status" class="text-aviso">El resultado de la publicación es incierto. Evita duplicarla y solicita verificar el registro. Esta operación aún no permite reintentos seguros.</p>{/if}
    {#if created}<div role="status" class="rounded-xl border border-pasto p-4 space-y-2"><p>El servidor confirmó el lote {created.codigo_lote} con estado {created.estado}.</p><p class="text-sm break-all">Identificador: {created.id}</p><a class="text-pasto underline" href={`/subastas/${encodeURIComponent(created.id)}`}>Abrir lote publicado</a></div>{/if}
    <form class="grid sm:grid-cols-2 gap-4" onsubmit={publish}>
      <div class="sm:col-span-2"><label class="block text-sm mb-1" for="lot-code">Código del lote (opcional)</label><input class="w-full rounded-lg border border-linea bg-superficie px-3 py-2" id="lot-code" maxlength="100" bind:value={code} /></div>
      <div><label class="block text-sm mb-1" for="lot-qty">Cantidad de animales (opcional)</label><input class="w-full rounded-lg border border-linea bg-superficie px-3 py-2" id="lot-qty" type="number" min="1" max="10000" step="1" bind:value={cantidad} /></div>
      <div><label class="block text-sm mb-1" for="lot-cat">Categoría (opcional)</label><input class="w-full rounded-lg border border-linea bg-superficie px-3 py-2" id="lot-cat" maxlength="40" placeholder="TORETE, VAQUILLONA…" bind:value={categoria} /></div>
      <div><label class="block text-sm mb-1" for="lot-breed">Raza (opcional)</label><input class="w-full rounded-lg border border-linea bg-superficie px-3 py-2" id="lot-breed" maxlength="60" bind:value={raza} /></div>
      <div class="sm:col-span-2"><label class="block text-sm mb-1" for="lot-desc">Descripción (opcional)</label><textarea class="w-full rounded-lg border border-linea bg-superficie px-3 py-2" id="lot-desc" maxlength="500" rows="2" bind:value={descripcion}></textarea></div>
      <div><label class="block text-sm mb-1" for="lot-price">Precio base del lote completo (S/)</label><input class="w-full rounded-lg border border-linea bg-superficie px-3 py-2" id="lot-price" type="number" min="0.01" step="0.01" required bind:value={price} /></div>
      <div><label class="block text-sm mb-1" for="lot-increment">Incremento mínimo (S/)</label><input class="w-full rounded-lg border border-linea bg-superficie px-3 py-2" id="lot-increment" type="number" min="0.01" step="0.01" required bind:value={increment} /></div>
      <div class="sm:col-span-2"><label class="block text-sm mb-1" for="lot-closing">Fecha y hora local de cierre</label><input class="w-full rounded-lg border border-linea bg-superficie px-3 py-2" id="lot-closing" type="datetime-local" required bind:value={closing} /></div>
      <button type="submit" class="sm:col-span-2 rounded-lg bg-pasto p-3 font-bold disabled:opacity-40" disabled={submitting || uncertain || $session.status !== 'authenticated' || !$session.organizationId}>{submitting ? 'Esperando confirmación…' : 'Publicar lote'}</button>
    </form>
  </section>
</div>
