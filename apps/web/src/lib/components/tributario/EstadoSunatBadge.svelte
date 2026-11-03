<script lang="ts">
  import type { EstadoIntegracionTributaria, EstadoFactoringCavali } from '@ganadito/contracts';

  interface Props {
    estado: EstadoIntegracionTributaria | EstadoFactoringCavali | string;
    compacto?: boolean;
  }

  let { estado, compacto = false }: Props = $props();

  const CONFIG_ESTADOS: Record<
    string,
    { label: string; bg: string; text: string; border: string; icon: string }
  > = {
    CONFIRMADO: {
      label: 'Confirmado (CDR OK)',
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
      icon: '✓'
    },
    ENVIADO_PENDIENTE: {
      label: 'Enviado Pendiente',
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      border: 'border-amber-500/30',
      icon: '⏳'
    },
    RECHAZADO: {
      label: 'Rechazado SUNAT',
      bg: 'bg-rose-500/10',
      text: 'text-rose-400',
      border: 'border-rose-500/30',
      icon: '✕'
    },
    REQUIERE_CONCILIACION: {
      label: 'Requiere Conciliación',
      bg: 'bg-purple-500/10',
      text: 'text-purple-400',
      border: 'border-purple-500/30',
      icon: '🔄'
    },
    CREADO: {
      label: 'Creado / En Cola',
      bg: 'bg-blue-500/10',
      text: 'text-blue-400',
      border: 'border-blue-500/30',
      icon: '📝'
    },
    EN_DISPUTA: {
      label: 'En Disputa',
      bg: 'bg-orange-500/10',
      text: 'text-orange-400',
      border: 'border-orange-500/30',
      icon: '⚠️'
    }
  };

  let cfg = $derived(
    CONFIG_ESTADOS[estado] || {
      label: estado,
      bg: 'bg-slate-800',
      text: 'text-slate-300',
      border: 'border-slate-700',
      icon: '•'
    }
  );
</script>

<span
  class="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider rounded-full border {cfg.bg} {cfg.text} {cfg.border} {compacto
    ? 'px-2 py-0.5 text-[10px]'
    : 'px-2.5 py-1 text-xs'}"
  title={`Estado fiscal: ${cfg.label}`}
>
  <span class="text-[11px] leading-none">{cfg.icon}</span>
  <span>{cfg.label}</span>
</span>
