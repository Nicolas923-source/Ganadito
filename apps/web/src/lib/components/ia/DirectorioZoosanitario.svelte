<script lang="ts">
  interface ProfesionalVeterinario {
    id: string;
    nombre: string;
    titulo: string;
    cmvp: string;
    acreditacionSenasa: string;
    especialidad: string;
    region: string;
    distanciaKm: number;
    telefono: string;
    disponible: boolean;
    calificacion: number;
    servicios: string[];
  }

  const VETERINARIOS_DIRECTORIO: ProfesionalVeterinario[] = [
    {
      id: 'vet-01',
      nombre: 'M.V. Carlos Mendoza Rivas',
      titulo: 'Médico Veterinario Colegiado',
      cmvp: 'CMVP N.° 8421',
      acreditacionSenasa: 'SENASA-INSP-2024-041',
      especialidad: 'Bromatología, Inspección de Canal & Calidad de Carne',
      region: 'Lima — Lurín / Cañete',
      distanciaKm: 18.5,
      telefono: '+51 984 123 456',
      disponible: true,
      calificacion: 4.9,
      servicios: ['Evaluación CIELAB', 'Checklist RM 822-2018', 'Dictamen Ante/Post Mortem']
    },
    {
      id: 'vet-02',
      nombre: 'M.V. Zulema Huamán Poma',
      titulo: 'Médico Veterinario Zootecnista',
      cmvp: 'CMVP N.° 9152',
      acreditacionSenasa: 'SENASA-EVAL-2023-118',
      especialidad: 'Sanidad Bovina, Reproducción y Trazabilidad',
      region: 'Junín — Huancayo / Concepción',
      distanciaKm: 42.0,
      telefono: '+51 964 789 012',
      disponible: true,
      calificacion: 4.8,
      servicios: ['Areteado SENASA CSTI', 'Toma de Muestras Sanguíneas', 'Certificado de Tránsito']
    },
    {
      id: 'vet-03',
      nombre: 'M.V. Javier Schuler Egg',
      titulo: 'Médico Veterinario de Campo',
      cmvp: 'CMVP N.° 7833',
      acreditacionSenasa: 'SENASA-VAC-2022-094',
      especialidad: 'Medicina Pecuaria y Manejo de Lotes de Engorde',
      region: 'Pasco — Oxapampa / Pozuzo',
      distanciaKm: 65.0,
      telefono: '+51 972 345 678',
      disponible: false,
      calificacion: 4.9,
      servicios: ['Perfilado ExpoGanadito', 'Vacunación Aftosa/Carbunclo', 'Auditoría Sanitaria']
    },
    {
      id: 'vet-04',
      nombre: 'M.V. Rodrigo Benavides Almonte',
      titulo: 'Especialista en Inocuidad y Camales',
      cmvp: 'CMVP N.° 10244',
      acreditacionSenasa: 'SENASA-CAM-2025-007',
      especialidad: 'Supervisión de Beneficio y Cadena de Frío',
      region: 'Arequipa — Yura / Cerro Colorado',
      distanciaKm: 12.0,
      telefono: '+51 958 901 234',
      disponible: true,
      calificacion: 4.7,
      servicios: ['Calibración Termometría', 'Dictamen Decomisos', 'Capacitación en Buenas Prácticas']
    }
  ];

  let busqueda = $state('');
  let regionSeleccionada = $state('TODAS');
  let profesionalContactado = $state<ProfesionalVeterinario | null>(null);

  let veterinariosFiltrados = $derived.by(() => {
    return VETERINARIOS_DIRECTORIO.filter((v) => {
      if (regionSeleccionada !== 'TODAS' && !v.region.toLowerCase().includes(regionSeleccionada.toLowerCase())) {
        return false;
      }
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase();
        return (
          v.nombre.toLowerCase().includes(q) ||
          v.especialidad.toLowerCase().includes(q) ||
          v.cmvp.toLowerCase().includes(q) ||
          v.region.toLowerCase().includes(q)
        );
      }
      return true;
    });
  });
</script>

<div class="space-y-6">
  <!-- Filtros del Directorio -->
  <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
    <div class="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
      <button
        type="button"
        onclick={() => (regionSeleccionada = 'TODAS')}
        class="px-3 py-1.5 rounded-lg transition-colors {regionSeleccionada === 'TODAS'
          ? 'bg-emerald-500 text-white shadow-sm'
          : 'bg-slate-900 text-slate-400 hover:text-white'}"
      >
        Todas las Regiones ({VETERINARIOS_DIRECTORIO.length})
      </button>
      <button
        type="button"
        onclick={() => (regionSeleccionada = 'Lima')}
        class="px-3 py-1.5 rounded-lg transition-colors {regionSeleccionada === 'Lima'
          ? 'bg-emerald-500 text-white shadow-sm'
          : 'bg-slate-900 text-slate-400 hover:text-white'}"
      >
        Lima
      </button>
      <button
        type="button"
        onclick={() => (regionSeleccionada = 'Junín')}
        class="px-3 py-1.5 rounded-lg transition-colors {regionSeleccionada === 'Junín'
          ? 'bg-emerald-500 text-white shadow-sm'
          : 'bg-slate-900 text-slate-400 hover:text-white'}"
      >
        Junín
      </button>
      <button
        type="button"
        onclick={() => (regionSeleccionada = 'Pasco')}
        class="px-3 py-1.5 rounded-lg transition-colors {regionSeleccionada === 'Pasco'
          ? 'bg-emerald-500 text-white shadow-sm'
          : 'bg-slate-900 text-slate-400 hover:text-white'}"
      >
        Pasco (Selva Central)
      </button>
      <button
        type="button"
        onclick={() => (regionSeleccionada = 'Arequipa')}
        class="px-3 py-1.5 rounded-lg transition-colors {regionSeleccionada === 'Arequipa'
          ? 'bg-emerald-500 text-white shadow-sm'
          : 'bg-slate-900 text-slate-400 hover:text-white'}"
      >
        Arequipa
      </button>
    </div>

    <div class="relative w-full sm:w-64">
      <input
        type="text"
        placeholder="Buscar por médico, CMVP o especialidad..."
        bind:value={busqueda}
        class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />
    </div>
  </div>

  <!-- Grid de Profesionales Veterinarios -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
    {#each veterinariosFiltrados as vet (vet.id)}
      <div class="bg-slate-950/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all">
        <div>
          <!-- Header de Tarjeta -->
          <div class="flex items-start justify-between gap-3 pb-3 mb-3 border-b border-slate-800/80">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-600 to-emerald-700 flex items-center justify-center text-white font-bold text-lg shadow-md flex-shrink-0">
                👨‍⚕️
              </div>
              <div>
                <h3 class="text-sm font-bold text-white tracking-tight">{vet.nombre}</h3>
                <p class="text-xs text-slate-400 font-medium">{vet.titulo}</p>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    {vet.cmvp}
                  </span>
                  <span class="text-[10px] font-mono text-slate-400">
                    {vet.acreditacionSenasa}
                  </span>
                </div>
              </div>
            </div>

            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold {vet.disponible
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'bg-slate-800 text-slate-400'}">
              {vet.disponible ? '● Disponible' : 'En Consulta'}
            </span>
          </div>

          <!-- Especialidad y Región -->
          <div class="space-y-2 mb-4 text-xs">
            <div>
              <span class="text-[10px] text-slate-400 uppercase font-semibold block">Especialidad Principal:</span>
              <p class="text-slate-200 font-medium">{vet.especialidad}</p>
            </div>

            <div class="flex items-center justify-between text-slate-400 text-[11px] pt-1">
              <span class="flex items-center gap-1">
                <span>📍</span>
                <span>{vet.region}</span>
              </span>
              <span class="font-mono text-slate-300">~{vet.distanciaKm} km de distancia</span>
            </div>

            <!-- Tags de Servicios -->
            <div class="flex flex-wrap gap-1.5 pt-2">
              {#each vet.servicios as srv}
                <span class="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] text-slate-300">
                  {srv}
                </span>
              {/each}
            </div>
          </div>
        </div>

        <!-- Acciones de Contacto -->
        <div class="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
          <div class="flex items-center gap-1 text-amber-400 text-xs font-semibold">
            <span>⭐</span>
            <span>{vet.calificacion.toFixed(1)}</span>
            <span class="text-[10px] text-slate-500">(SENASA Validado)</span>
          </div>

          <button
            type="button"
            onclick={() => (profesionalContactado = vet)}
            class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 active:scale-95"
          >
            <span>💬 Contactar Oficial</span>
          </button>
        </div>
      </div>
    {/each}
  </div>

  <!-- Modal de Contacto -->
  {#if profesionalContactado}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 class="text-base font-bold text-white">Contacto Profesional Habilitado</h3>
          <button
            type="button"
            onclick={() => (profesionalContactado = null)}
            class="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-xs"
          >
            ✕
          </button>
        </div>

        <div class="my-4 space-y-3 text-xs text-slate-300">
          <div class="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1">
            <p class="font-bold text-sm text-white">{profesionalContactado.nombre}</p>
            <p class="text-emerald-400 font-mono text-[11px]">{profesionalContactado.cmvp} — {profesionalContactado.acreditacionSenasa}</p>
            <p class="text-slate-400">{profesionalContactado.region}</p>
          </div>

          <div class="space-y-2 pt-1">
            <a
              href="https://wa.me/{profesionalContactado.telefono.replace(/[^0-9]/g, '')}?text=Hola%20Dr.%20Ganadito,%20requiero%20asistencia%20t%C3%A9cnica%20zoosanitaria"
              target="_blank"
              rel="noreferrer"
              class="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <span>📱 Abrir Chat de WhatsApp Oficial</span>
            </a>

            <a
              href="tel:{profesionalContactado.telefono.replace(/[^0-9]/g, '')}"
              class="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <span>📞 Llamada Telefónica Directa: {profesionalContactado.telefono}</span>
            </a>
          </div>
        </div>

        <div class="pt-2 border-t border-slate-800 text-[10px] text-slate-400 text-center">
          Profesional registrado en el Colegio Médico Veterinario del Perú y habilitado para emisión de certificados pecuarios.
        </div>
      </div>
    </div>
  {/if}
</div>
