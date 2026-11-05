<script lang="ts">
  import { untrack } from 'svelte';
  import { page } from '$app/state';
  import { apiRequest } from '#lib/api.ts';
  import { session } from '#lib/session.ts';
  import type { PasaporteDigitalVista, VerificacionCadenaResponse } from '@ganadito/contracts';
  import FichaBovinoHeader from '#lib/components/trazabilidad/FichaBovinoHeader.svelte';
  import CertificadoAuditoria from '#lib/components/trazabilidad/CertificadoAuditoria.svelte';
  import LineaTiempoEventos, { type EventoLectura } from '#lib/components/trazabilidad/LineaTiempoEventos.svelte';

  // Read existing history without claiming its names belong to the write enum.
  // All private fields and the PUBLICA/COMPLETA distinction stay unchanged.
  type PasaporteCompletoLectura = Omit<Extract<PasaporteDigitalVista, { vista: 'COMPLETA' }>, 'eventos'> & { readonly eventos: readonly EventoLectura[] };
  type PasaportePublico = Extract<PasaporteDigitalVista, { vista: 'PUBLICA' }>;
  type EventoPublicoLectura = Omit<PasaportePublico['eventos'][number], 'event_type'> & { readonly event_type: string };
  type PasaporteLectura = PasaporteCompletoLectura | (Omit<PasaportePublico, 'eventos'> & { readonly eventos: readonly EventoPublicoLectura[] });

  let identificador = $derived(page.params.id ?? '');
  let pasaporte = $state<PasaporteLectura | null>(null);
  let verificacion = $state<VerificacionCadenaResponse | null>(null);
  let cargando = $state(false);
  let auditando = $state(false);
  let errorConsulta = $state('');
  let errorAuditoria = $state('');
  let peticion: AbortController | undefined;
  let peticionAuditoria: AbortController | undefined;

  function esObjeto(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
  function esPasaporte(value: unknown, id: string, organizacionId: string | null): value is PasaporteLectura {
    if (!esObjeto(value) || !esObjeto(value.bovino) || (value.vista !== 'COMPLETA' && value.vista !== 'PUBLICA')) return false;
    const completa = value.vista === 'COMPLETA';
    const bovino = value.bovino;
    if (bovino.id !== id ||
        typeof bovino.codigo_arete !== 'string' ||
        (completa ? !organizacionId || bovino.organizacion_id !== organizacionId : bovino.organizacion_id !== null) ||
        typeof bovino.sexo !== 'string' || !['MACHO', 'HEMBRA'].includes(bovino.sexo) ||
        typeof bovino.estado !== 'string' || !['VIVO', 'FAENADO', 'DECESO', 'TRANSFERIDO'].includes(bovino.estado) ||
        !(bovino.raza === null || typeof bovino.raza === 'string') ||
        !(bovino.fecha_nacimiento === null || (typeof bovino.fecha_nacimiento === 'string' && Number.isFinite(Date.parse(bovino.fecha_nacimiento)))) ||
        !Array.isArray(value.eventos)) return false;
    const secuencias = new Set<number>();
    for (const evento of value.eventos) {
      if (!esObjeto(evento) || (typeof evento.id !== 'string' && !(typeof evento.id === 'number' && Number.isFinite(evento.id))) ||
          evento.bovino_id !== id || typeof evento.secuencia !== 'number' || !Number.isInteger(evento.secuencia) || evento.secuencia <= 0 ||
          secuencias.has(evento.secuencia) || typeof evento.event_type !== 'string' || !esObjeto(evento.metadata) ||
          typeof evento.created_at !== 'string' || !Number.isFinite(Date.parse(evento.created_at))) return false;
      if (completa) {
        if (typeof evento.autor_id !== 'string' || !evento.autor_id ||
            typeof evento.prev_hash !== 'string' || typeof evento.current_hash !== 'string' ||
            !/^[a-f0-9]{64}$/i.test(evento.prev_hash) || !/^[a-f0-9]{64}$/i.test(evento.current_hash)) return false;
      } else if (evento.autor_id !== null || 'prev_hash' in evento || 'current_hash' in evento) return false;
      secuencias.add(evento.secuencia);
    }
    return true;
  }
  function esVerificacion(value: unknown): value is VerificacionCadenaResponse {
    return esObjeto(value) && typeof value.integro === 'boolean' && typeof value.total_eventos === 'number' && Number.isInteger(value.total_eventos) && value.total_eventos >= 0 &&
      (value.secuencia_corrupta === undefined || (typeof value.secuencia_corrupta === 'number' && Number.isInteger(value.secuencia_corrupta))) &&
      (value.detalle === undefined || typeof value.detalle === 'string');
  }

  async function cargar(id: string) {
    peticion?.abort();
    peticionAuditoria?.abort();
    const controller = new AbortController();
    peticion = controller;
    const organizacionId = $session.organizationId;
    pasaporte = null;
    verificacion = null;
    errorConsulta = '';
    errorAuditoria = '';
    auditando = false;
    cargando = true;
    try {
      const data = await apiRequest<unknown>('/api/v1/trazabilidad/bovinos/' + encodeURIComponent(id) + '/pasaporte', { signal: controller.signal });
      if (!esPasaporte(data, id, organizacionId)) {
        throw new Error('La API no devolvió un pasaporte válido para el bovino solicitado.');
      }
      if (!controller.signal.aborted && identificador === id && $session.organizationId === organizacionId) pasaporte = data;
    } catch (error) {
      if (!controller.signal.aborted) errorConsulta = error instanceof Error ? error.message : 'No se pudo consultar el pasaporte.';
    } finally {
      if (!controller.signal.aborted) cargando = false;
    }
  }

  async function auditar() {
    if (pasaporte?.vista !== 'COMPLETA' || pasaporte.bovino.organizacion_id !== $session.organizationId || auditando) return;
    peticionAuditoria?.abort();
    const controller = new AbortController();
    peticionAuditoria = controller;
    const id = identificador;
    auditando = true;
    verificacion = null;
    errorAuditoria = '';
    try {
      const data = await apiRequest<unknown>('/api/v1/trazabilidad/bovinos/' + encodeURIComponent(id) + '/verificar', { signal: controller.signal });
      if (!esVerificacion(data)) throw new Error('La API no devolvió una verificación válida.');
      if (!controller.signal.aborted && identificador === id) verificacion = data;
    } catch (error) {
      if (!controller.signal.aborted) errorAuditoria = error instanceof Error ? error.message : 'No se pudo verificar la cadena.';
    } finally {
      if (!controller.signal.aborted) auditando = false;
    }
  }

  $effect(() => {
    const id = identificador;
    const estado = $session.status;
    $session.token;
    $session.organizationId;
    untrack(() => {
      peticion?.abort();
      peticionAuditoria?.abort();
      pasaporte = null;
      verificacion = null;
      errorConsulta = '';
      errorAuditoria = '';
      cargando = false;
      auditando = false;
      if (estado === 'authenticated' && id) void cargar(id);
    });
    return () => { peticion?.abort(); peticionAuditoria?.abort(); };
  });
</script>

<svelte:head><title>Pasaporte bovino | Ganadito</title></svelte:head>
<div class="max-w-6xl mx-auto w-full px-4 py-8 space-y-6">
  <div class="flex flex-wrap justify-between items-start gap-4"><div><a class="text-sm text-emerald-400 hover:underline" href="/trazabilidad">Buscar otro bovino</a><h1 class="text-3xl font-bold text-white mt-2">Pasaporte bovino</h1><p class="text-sm text-slate-400 mt-2 break-all">Identificador solicitado: {identificador}</p></div><button type="button" class="rounded-xl border border-slate-700 px-4 py-2 text-slate-200 disabled:opacity-50" disabled={cargando || $session.status !== 'authenticated'} onclick={() => void cargar(identificador)}>Actualizar pasaporte</button></div>
  {#if $session.status === 'checking'}<p role="status" class="text-slate-400">Comprobando sesión…</p>
  {:else if $session.status !== 'authenticated'}<div class="rounded-2xl border border-slate-800 bg-slate-900 p-6"><p class="text-slate-300">Inicia sesión para consultar este pasaporte.</p><a href="/acceso" class="inline-block text-emerald-400 mt-3">Ir al acceso</a></div>
  {:else if cargando}<p role="status" class="rounded-xl bg-slate-900 p-6 text-slate-400">Consultando pasaporte…</p>
  {:else if errorConsulta}<p role="alert" class="rounded-xl border border-rose-800 bg-rose-950/40 p-5 text-rose-200">{errorConsulta}</p>
  {:else if pasaporte?.vista === 'PUBLICA'}
    <p role="status" class="rounded-xl border border-amber-800 bg-slate-900 p-5 text-slate-300">La vista completa no está disponible para tu organización. La API devolvió una proyección pública con autor y organización reservados; la publicación del pasaporte público en la web todavía no está habilitada.</p>
  {:else if pasaporte?.vista === 'COMPLETA' && pasaporte.bovino.organizacion_id === $session.organizationId}
    <FichaBovinoHeader bovino={pasaporte.bovino} />
    <p class="text-sm text-slate-400">Los datos y eventos provienen del registro consultado. La integridad de la cadena no acredita certificaciones sanitarias ni verifica el contenido declarado.</p>
    <CertificadoAuditoria {verificacion} isLoading={auditando} onReverificar={() => void auditar()} />
    {#if errorAuditoria}<p role="alert" class="rounded-xl border border-rose-800 bg-rose-950/40 p-4 text-rose-200">{errorAuditoria}</p>{/if}
    <LineaTiempoEventos eventos={pasaporte.eventos} />
    <div class="rounded-xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-400"><button type="button" disabled class="rounded-lg bg-slate-800 px-4 py-2 opacity-60">Registrar evento no disponible</button><p class="mt-2">El registro de nuevos eventos y la publicación de un pasaporte público todavía no están habilitados.</p></div>
  {:else}<p role="status" class="text-slate-400">No hay un pasaporte disponible para esta consulta.</p>{/if}
</div>
