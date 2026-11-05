<script lang="ts">
  import { goto } from '$app/navigation';
  let identificador = $state('');
</script>
<svelte:head><title>Buscar pasaporte bovino | Ganadito</title></svelte:head>
<div class="max-w-2xl mx-auto w-full px-4 py-10 space-y-5">
  <h1 class="text-3xl font-bold text-tinta">Trazabilidad bovina</h1>
  <p class="text-apagado">Consulta el pasaporte de un bovino por su identificador. La información disponible depende del acceso de tu sesión.</p>
  <form class="space-y-4 rounded-2xl border border-linea bg-superficie p-6" onsubmit={(event) => { event.preventDefault(); if (identificador.trim()) void goto('/trazabilidad/' + encodeURIComponent(identificador.trim())); }}>
    <label class="block text-sm text-tinta-2">Identificador del bovino<input class="block mt-2 w-full rounded-xl border border-linea bg-superficie p-3 text-tinta" required bind:value={identificador} autocomplete="off" /></label>
    <button type="submit" class="rounded-xl bg-pasto hover:bg-pasto-osc px-5 py-3 font-semibold text-white">Consultar pasaporte</button>
  </form>
</div>
