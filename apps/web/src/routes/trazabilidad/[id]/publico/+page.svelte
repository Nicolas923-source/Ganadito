<script lang="ts">
  import { page } from '$app/state';
</script>
<svelte:head><title>Pasaporte público no disponible | Ganadito</title><meta name="robots" content="noindex" /></svelte:head>
<div class="max-w-2xl mx-auto w-full px-4 py-12 space-y-5">
  <h1 class="text-3xl font-bold text-white">Consulta pública no disponible</h1>
  <p role="status" class="text-slate-300">Este pasaporte todavía no tiene una vista pública habilitada.</p>
  <p class="text-slate-400">Puedes iniciar sesión para consultar la información disponible para tu cuenta.</p>
  <a class="inline-block rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white" href={'/trazabilidad/' + encodeURIComponent(page.params.id ?? '')}>Consultar con mi sesión</a>
</div>
