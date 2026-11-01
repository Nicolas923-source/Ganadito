import type {
  VideoAnalisisInput,
  VisionAnalisisResult,
  AnalisisBromatologicoInput,
  AnalisisBromatologicoResult,
  ChecklistMinsaInput,
  ChecklistMinsaResult
} from '@ganadito/contracts';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface AiClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  failureThreshold?: number;
  resetTimeoutMs?: number;
}

/**
 * Adaptador Resiliente para el Servicio Satélite de Inteligencia Artificial (Python FastAPI).
 *
 * Implementa:
 * - Timeout estricto de 5 segundos (por defecto 5000 ms) con AbortController.
 * - Patrón Circuit Breaker (CLOSED -> OPEN -> HALF_OPEN) para evitar cascadas de latencia.
 * - Fallback no bloqueante: Si el satélite Python está apagado, falla o excede 5s,
 *   responde con estado 'PENDIENTE_REVISION_MANUAL', servicio_disponible: false y fallback_manual: true.
 */
export class AiClientService {
  private baseUrl: string;
  private readonly timeoutMs: number;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  private circuitState: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private lastFailureTime = 0;

  constructor(options: AiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.AI_SERVICE_URL ?? 'http://localhost:8001').replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.failureThreshold = options.failureThreshold ?? 3;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 10000;
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public getCircuitState(): CircuitState {
    if (
      this.circuitState === 'OPEN' &&
      Date.now() - this.lastFailureTime >= this.resetTimeoutMs
    ) {
      this.circuitState = 'HALF_OPEN';
    }
    return this.circuitState;
  }

  public resetCircuit(): void {
    this.circuitState = 'CLOSED';
    this.consecutiveFailures = 0;
    this.lastFailureTime = 0;
  }

  private recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.circuitState = 'CLOSED';
  }

  private recordFailure(): void {
    this.consecutiveFailures += 1;
    this.lastFailureTime = Date.now();
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.circuitState = 'OPEN';
    }
  }

  private async postJson<TResponse>(path: string, payload: unknown): Promise<TResponse> {
    const currentState = this.getCircuitState();
    if (currentState === 'OPEN') {
      throw new Error('CIRCUIT_BREAKER_OPEN: Satélite de IA temporalmente en enfriamiento.');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(payload ?? {}),
        signal: controller.signal
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw new Error(`HTTP_${response.status}: ${errBody}`);
      }

      const data = (await response.json()) as TResponse;
      this.recordSuccess();
      return data;
    } catch (error) {
      this.recordFailure();
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Analiza video de lote ganadero de 15 segundos (ExpoGanadito Video Pipeline).
   * Si el servicio satélite no responde, retorna fallback con estado 'PENDIENTE_REVISION_MANUAL'.
   */
  async analizarVideo(input: VideoAnalisisInput): Promise<VisionAnalisisResult> {
    try {
      const data = await this.postJson<VisionAnalisisResult>(
        '/api/v1/vision/analizar-video',
        input
      );
      return {
        ...data,
        es_vinculante: false,
        estado: 'COMPLETADO',
        servicio_disponible: true,
        fallback_manual: false
      };
    } catch (err: any) {
      return {
        biotipo_sugerido: 'PENDIENTE_CLASIFICACION',
        condicion_corporal_score: 3.0,
        estimacion_dentaria: 'PENDIENTE_INSPECCION',
        confianza_score: 0,
        fotogramas_muestreados: 0,
        duracion_evaluada_seg: input.duracion_segundos ?? 15.0,
        es_vinculante: false,
        estado: 'PENDIENTE_REVISION_MANUAL',
        servicio_disponible: false,
        fallback_manual: true,
        motivo_fallback: err?.message ?? 'Satélite de visión computacional no disponible'
      };
    }
  }

  /**
   * Analiza colorimetría muscular en espacio CIELAB (Dr. Ganadito Bromatología).
   * Si el satélite Python falla o está apagado, degrada con gracia a 'PENDIENTE_REVISION_MANUAL'.
   */
  async analizarColorBromatologico(
    input: AnalisisBromatologicoInput
  ): Promise<AnalisisBromatologicoResult> {
    try {
      const data = await this.postJson<AnalisisBromatologicoResult>(
        '/api/v1/bromatologia/analizar-color',
        input
      );
      return {
        ...data,
        estado: 'COMPLETADO',
        servicio_disponible: true,
        fallback_manual: false
      };
    } catch (err: any) {
      return {
        l_star_promedio: null,
        a_star_promedio: null,
        b_star_promedio: null,
        alerta_dfd: false,
        diagnostico:
          'Satélite de visión CIELAB fuera de línea. Se deriva a revisión bromatológica manual.',
        recomendacion:
          'Continuar flujo comercial bajo estado PENDIENTE_REVISION_MANUAL con inspección organoléptica en recepción.',
        umbral_dfd_l_star: 46.0,
        estado: 'PENDIENTE_REVISION_MANUAL',
        servicio_disponible: false,
        fallback_manual: true,
        motivo_fallback: err?.message ?? 'Satélite bromatológico no disponible'
      };
    }
  }

  /**
   * Evalúa checklist sanitario RM N.° 822-2018/MINSA.
   * Si el satélite Python falla, responde sin bloquear con estado 'PENDIENTE_REVISION_MANUAL'.
   */
  async evaluarChecklistMinsa(input: ChecklistMinsaInput): Promise<ChecklistMinsaResult> {
    try {
      const data = await this.postJson<ChecklistMinsaResult>(
        '/api/v1/bromatologia/checklist-minsa',
        input
      );
      return {
        ...data,
        estado: 'COMPLETADO',
        servicio_disponible: true,
        fallback_manual: false
      };
    } catch (err: any) {
      const temp = Number(input.temperatura_recepcion_c ?? 0);
      const tempOk = temp >= 0 && temp <= 4.0;
      const colorOk =
        typeof input.color_organoleptico === 'boolean'
          ? input.color_organoleptico
          : ['NORMAL', 'ROJO_CEREZA_BRILLANTE', 'CONFORME', 'OPTIMO'].includes(
              String(input.color_organoleptico ?? 'NORMAL').toUpperCase()
            );
      const olorOk = input.ausencia_olores_extranos ?? true;
      const aprobado = tempOk && colorOk && olorOk;

      return {
        normativa_referencia: 'RM N.° 822-2018/MINSA',
        aprobado_sanitariamente: aprobado,
        rechazo_sanitario: !aprobado,
        temperatura_recepcion_c: temp,
        temperatura_conforme: tempOk,
        color_conforme: colorOk,
        olor_conforme: olorOk,
        dictamen: aprobado ? 'PENDIENTE_VALIDACION_OFICIAL' : 'RECHAZO_PREVENTIVO_TEMPERATURA',
        observaciones: [
          'Satélite IA no disponible; pre-evaluación de contingencia local aplicada. Requiere firma manual del inspector sanitario.'
        ],
        estado: 'PENDIENTE_REVISION_MANUAL',
        servicio_disponible: false,
        fallback_manual: true,
        motivo_fallback: err?.message ?? 'Satélite sanitario no disponible'
      };
    }
  }
}
