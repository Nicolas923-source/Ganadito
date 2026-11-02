<script lang="ts">
  import type { Bovino, EstadoBovino, SexoBovino } from '@ganadito/contracts';

  interface Props {
    bovino: Bovino;
    publicUrl?: string;
  }

  let { bovino, publicUrl }: Props = $props();

  let copiado = $state(false);

  // Mapeo estético de estados biológicos
  const BADGES_ESTADO: Record<EstadoBovino, { texto: string; clases: string; punto: string }> = {
    VIVO: {
      texto: 'EN PRODUCCIÓN / VIVO',
      clases: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      punto: 'bg-emerald-400 animate-pulse'
    },
    FAENADO: {
      texto: 'FAENADO (CANAL DISPONIBLE)',
      clases: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      punto: 'bg-amber-400'
    },
    DECESO: {
      texto: 'DECESO REGISTRADO',
      clases: 'bg-slate-800 text-slate-400 border-slate-700',
      punto: 'bg-slate-500'
    },
    TRANSFERIDO: {
      texto: 'TRANSFERIDO A OTRA ORGANIZACIÓN',
      clases: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      punto: 'bg-blue-400'
    }
  };

  let estadoInfo = $derived(
    BADGES_ESTADO[bovino.estado] || {
      texto: bovino.estado,
      clases: 'bg-slate-800 text-slate-300 border-slate-700',
      punto: 'bg-slate-400'
    }
  );

  // Formato de fecha de nacimiento y cálculo de edad
  let edadTexto = $derived.by(() => {
    if (!bovino.fecha_nacimiento) return 'No especificada';
    const fecha = new Date(bovino.fecha_nacimiento);
    if (isNaN(fecha.getTime())) return 'No especificada';

    const meses = Math.floor((Date.now() - fecha.getTime()) / (1000 * 60 * 60 * 24 * 30.4375));
    if (meses < 12) {
      return `${meses} meses`;
    }
    const anios = Math.floor(meses / 12);
    const mesesRestantes = meses % 12;
    return mesesRestantes > 0 ? `${anios} años, ${mesesRestantes} m` : `${anios} años`;
  });

  // URL para el código QR del pasaporte
  let urlDestino = $derived(
    publicUrl || (typeof window !== 'undefined' ? `${window.location.origin}/trazabilidad/${bovino.id}/publico` : `/trazabilidad/${bovino.id}/publico`)
  );

  let qrApiUrl = $derived(
    `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(urlDestino)}&bgcolor=020617&color=10b981&margin=4`
  );

  async function copiarEnlace() {
    try {
      await navigator.clipboard.writeText(urlDestino);
      copiado = true;
      setTimeout(() => {
        copiado = false;
      }, 3000);
    } catch {
      console.info('URL de pasaporte:', urlDestino);
    }
  }
</script>

<div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-6">
  <!-- Acento superior verde esmeralda fintech -->
  <div class="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500"></div>

  <div class="flex flex-col md:flex-row md:items-start justify-between gap-6">
    <!-- Información Principal del Bovino -->
    <div class="space-y-4 flex-1">
      <div class="flex flex-wrap items-center gap-2">
        <span class="px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-2 {estadoInfo.clases}">
          <span class="w-2 h-2 rounded-full {estadoInfo.punto}"></span>
          <span>{estadoInfo.texto}</span>
        </span>

        <span class="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-950 text-slate-300 border border-slate-800">
          SENASA DNI BOVINO
        </span>
      </div>

      <!-- Arete / Código Identificador -->
      <div>
        <div class="text-xs uppercase font-bold text-slate-400 tracking-wider">
          Código Oficial de Arete (Caravana)
        </div>
        <div class="text-3xl sm:text-4xl font-black font-mono text-white tracking-tight mt-1 flex items-center gap-3">
          <span>{bovino.codigo_arete}</span>
          <span class="text-emerald-400 text-2xl" title="Identificación Oficial Única">🏷️</span>
        </div>
      </div>

      <!-- Grilla de Atributos Zootécnicos -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
        <!-- Raza -->
        <div class="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
          <span class="text-[11px] font-medium text-slate-400 block">Raza Predominante</span>
          <span class="text-sm font-bold text-slate-200 mt-0.5 block truncate">
            {bovino.raza || 'Brahman x Nelore'}
          </span>
        </div>

        <!-- Sexo -->
        <div class="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
          <span class="text-[11px] font-medium text-slate-400 block">Sexo</span>
          <span class="text-sm font-bold text-slate-200 mt-0.5 block flex items-center gap-1">
            <span>{bovino.sexo === 'MACHO' ? 'Macho (Toro/Novillo)' : 'Hembra (Vaca/Vaquillona)'}</span>
          </span>
        </div>

        <!-- Edad -->
        <div class="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
          <span class="text-[11px] font-medium text-slate-400 block">Edad Estimada</span>
          <span class="text-sm font-bold text-slate-200 mt-0.5 block font-mono">
            {edadTexto}
          </span>
        </div>

        <!-- Titular / Organización -->
        <div class="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
          <span class="text-[11px] font-medium text-slate-400 block">Organización Titular</span>
          <span class="text-xs font-mono font-semibold text-emerald-400 mt-0.5 block truncate" title={bovino.organizacion_id}>
            {bovino.organizacion_id ? `ORG-${bovino.organizacion_id.slice(0, 8)}` : 'Ganadería San Pedro'}
          </span>
        </div>
      </div>
    </div>

    <!-- Módulo de Código QR para Escaneo Móvil -->
    <div class="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-center self-center md:self-start shrink-0 space-y-2.5">
      <div class="w-32 h-32 bg-slate-900 rounded-xl overflow-hidden p-1.5 border border-emerald-500/30 flex items-center justify-center relative group">
        <img
          src={qrApiUrl}
          alt={`Código QR de Trazabilidad para arete ${bovino.codigo_arete}`}
          class="w-full h-full object-contain rounded-lg"
          loading="lazy"
        />
      </div>

      <div class="space-y-1">
        <span class="text-[10px] font-bold text-emerald-400 block uppercase tracking-wider">
          Pasaporte QR Público
        </span>
        <button
          type="button"
          onclick={copiarEnlace}
          class="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors flex items-center gap-1 mx-auto"
        >
          <span>{copiado ? '✓ Copiado' : '🔗 Copiar URL QR'}</span>
        </button>
      </div>
    </div>
  </div>
</div>
