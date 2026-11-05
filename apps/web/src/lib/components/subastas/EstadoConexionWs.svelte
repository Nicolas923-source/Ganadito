<script lang="ts">
  export type EstadoConexion = 'CONECTADO' | 'PERIODICO' | 'SINCRONIZANDO' | 'RECONECTANDO' | 'DESCONECTADO';

  interface Props {
    estado: EstadoConexion;
    reintento?: number;
    latenciaMs?: number | null;
  }

  let { estado = 'CONECTADO', reintento = 0, latenciaMs = null }: Props = $props();
</script>

<div
  class="estado-conexion inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border"
  data-estado={estado === 'PERIODICO' ? 'CONECTADO' : estado === 'DESCONECTADO' ? 'RECONECTANDO' : estado}
  role="status"
  aria-live="polite"
>
  <!-- Indicador luminoso / ping -->
  <span class="relative flex h-2.5 w-2.5">
    {#if estado === 'CONECTADO' || estado === 'PERIODICO'}
      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-pasto opacity-75"></span>
      <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-pasto"></span>
    {:else if estado === 'SINCRONIZANDO'}
      <span class="animate-pulse absolute inline-flex h-full w-full rounded-full bg-aviso opacity-60"></span>
      <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-aviso"></span>
    {:else}
      <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-alerta animate-pulse"></span>
    {/if}
  </span>

  <span class="font-semibold tracking-wide">
    {#if estado === 'PERIODICO'}
      Actualización periódica
    {:else if estado === 'CONECTADO'}
      En Vivo
    {:else if estado === 'SINCRONIZANDO'}
      Sincronizando
    {:else if estado === 'RECONECTANDO'}
      Reconectando{#if reintento > 0} (intento {reintento}){/if}
    {:else}
      Sin Conexión
    {/if}
  </span>

  {#if latenciaMs !== null && estado === 'CONECTADO'}
    <span class="text-[10px] tabular-nums opacity-70">
      {latenciaMs}ms
    </span>
  {/if}
</div>

<style>
  .estado-conexion[data-estado='CONECTADO'] { background: var(--color-pasto-claro); border-color: var(--color-pasto); color: var(--color-pasto-osc); }
  .estado-conexion[data-estado='SINCRONIZANDO'] { background: var(--color-aviso-fondo); border-color: var(--color-aviso-linea); color: var(--color-aviso); }
  .estado-conexion[data-estado='RECONECTANDO'] { background: var(--color-alerta-fondo); border-color: var(--color-alerta-linea); color: var(--color-alerta); }
</style>
