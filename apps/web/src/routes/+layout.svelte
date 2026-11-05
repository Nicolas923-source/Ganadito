<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { restoreSession, signOut } from '#lib/auth.ts';
  import { session } from '#lib/session.ts';
  let { children }: { children?: import('svelte').Snippet } = $props();
  onMount(() => { void restoreSession().catch(() => {}); });
  const enlaces = [
    { href: '/', texto: 'Mapa y Spot' },
    { href: '/subastas', texto: 'Subastas' },
    { href: '/ordenes', texto: 'Órdenes' },
    { href: '/trazabilidad', texto: 'Trazabilidad' }
  ];
  const actual = (href: string) => (href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href));
</script>
<svelte:head><title>Ganadito | Mercado ganadero</title><meta name="description" content="Consulta establecimientos, lotes y trazabilidad con información del servidor." /></svelte:head>
<div class="app-shell">
  <a class="skip-link" href="#contenido">Saltar al contenido</a>
  <header class="site-header">
    <div class="site-header-inner">
      <a class="brand" href="/"><span class="brand-mark" aria-hidden="true">G</span><span><span class="brand-name">Ganadito</span><small>Mercado ganadero del Perú</small></span></a>
      <nav class="site-nav" aria-label="Navegación principal">
        {#each enlaces as enlace (enlace.href)}<a href={enlace.href} aria-current={actual(enlace.href) ? 'page' : undefined}>{enlace.texto}</a>{/each}
      </nav>
      <div class="session-nav">
        {#if $session.status === 'authenticated'}
          <a href="/contexto">{$session.context?.razon_social || 'Seleccionar organización'}<small>{$session.role || 'Sin contexto activo'}</small></a>
          <button class="secondary" onclick={signOut}>Cerrar sesión</button>
        {:else if $session.status === 'checking'}
          <span role="status" class="muted">Validando sesión…</span>
        {:else}<a class="button" href="/acceso">Iniciar sesión</a>{/if}
      </div>
    </div>
  </header>
  {#if $session.message}<div class="notice" role="alert">{$session.message} <a href="/acceso">Ir al acceso</a></div>{/if}
  <main id="contenido">{@render children?.()}</main>
  <footer class="site-footer"><div class="site-footer-inner"><span><strong>Ganadito</strong> versión 0.1, entorno de desarrollo</span><span>Los pagos y las integraciones externas no están habilitados.</span></div></footer>
</div>
