<script lang="ts">
  import type { Bovino } from '@ganadito/contracts';
  // Solo campos públicos: sirve para la vista COMPLETA y la PUBLICA (sin organización).
  let { bovino }: { bovino: Pick<Bovino, 'codigo_arete' | 'estado' | 'raza' | 'sexo' | 'fecha_nacimiento'> } = $props();
</script>
<div class="rounded-2xl border border-linea bg-superficie p-6 space-y-5">
  <div><p class="text-sm text-apagado">Código de arete registrado</p><h2 class="text-2xl font-mono font-bold text-tinta mt-1 break-all">{bovino.codigo_arete}</h2></div>
  <dl class="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
    <div><dt class="text-apagado">Estado registrado</dt><dd class="text-pasto font-semibold mt-1">{bovino.estado}</dd></div>
    <div><dt class="text-apagado">Raza</dt><dd class="text-tinta mt-1">{bovino.raza || 'No informada'}</dd></div>
    <div><dt class="text-apagado">Sexo</dt><dd class="text-tinta mt-1">{bovino.sexo}</dd></div>
    <div><dt class="text-apagado">Nacimiento</dt><dd class="text-tinta mt-1">{bovino.fecha_nacimiento ? new Date(bovino.fecha_nacimiento).toLocaleDateString('es-PE', { timeZone: 'UTC' }) : 'No informado'}</dd></div>
  </dl>
</div>
