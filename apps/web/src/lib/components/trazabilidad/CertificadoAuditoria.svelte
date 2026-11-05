<script lang="ts">
  import type { VerificacionCadenaResponse } from '@ganadito/contracts';
  let { verificacion, isLoading = false, onReverificar }: { verificacion: VerificacionCadenaResponse | null; isLoading?: boolean; onReverificar?: () => void } = $props();
</script>
<section class="rounded-2xl border border-linea bg-superficie p-6 space-y-3" aria-label="Integridad de la cadena">
  <div class="flex flex-wrap items-center justify-between gap-3"><h2 class="text-lg font-semibold text-tinta">Integridad del registro</h2><button type="button" disabled={isLoading} onclick={onReverificar} class="secondary rounded-lg px-4 py-2 text-sm">{isLoading ? 'Verificando…' : 'Verificar cadena'}</button></div>
  {#if isLoading}<p role="status" class="text-apagado">Consultando la verificación del servidor…</p>
  {:else if verificacion}<p role="status" class={verificacion.integro ? 'text-pasto' : 'text-alerta'}>{verificacion.integro ? 'El servidor confirmó la integridad de la cadena.' : 'El servidor detectó una inconsistencia en la cadena.'}</p><p class="text-sm text-apagado">Eventos verificados: {verificacion.total_eventos}{verificacion.secuencia_corrupta === undefined ? '' : ' · Secuencia afectada: ' + verificacion.secuencia_corrupta}</p>{#if verificacion.detalle}<p class="text-sm text-tinta-2">{verificacion.detalle}</p>{/if}
  {:else}<p class="text-sm text-apagado">La cadena aún no ha sido verificada en esta consulta.</p>{/if}
</section>
