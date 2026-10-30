import type pg from 'pg';
import { SubastasCloserService, type ResultadoCierreBatch } from './subastas-closer.service.js';

export interface SubastasCloserWorkerOptions {
  pool: pg.Pool;
  intervalMs?: number;
  batchSize?: number;
  logger?: boolean;
}

/**
 * Worker en segundo plano encargado de cerrar automáticamente las subastas expiradas cada 5 segundos.
 * Controla el ciclo con protección inFlight contra solapamientos y apagado ordenado.
 */
export class SubastasCloserWorker {
  private active = false;
  private timer: NodeJS.Timeout | null = null;
  private inFlight = false;
  private readonly closerService: SubastasCloserService;
  private readonly intervalMs: number;
  private readonly batchSize: number;
  private readonly logger: boolean;

  constructor(options: SubastasCloserWorkerOptions) {
    this.closerService = new SubastasCloserService(options.pool);
    this.intervalMs = options.intervalMs ?? 5000;
    this.batchSize = options.batchSize ?? 20;
    this.logger = options.logger ?? false;
  }

  /**
   * Ejecuta un ciclo inmediato de liquidación de lotes expirados.
   */
  async tick(): Promise<ResultadoCierreBatch> {
    return this.closerService.cerrarLotesExpirados(this.batchSize);
  }

  /**
   * Inicia el ciclo periódico de fondo (cada 5s por defecto).
   */
  start(): void {
    if (this.active) return;
    this.active = true;

    const poll = async () => {
      if (!this.active) return;
      if (this.inFlight) {
        this.scheduleNext();
        return;
      }

      this.inFlight = true;
      try {
        const res = await this.tick();
        if (this.logger && (res.adjudicados > 0 || res.desiertos > 0)) {
          console.log(
            `[SubastasCloserWorker] Evaluados: ${res.totalEvaluados}, Adjudicados: ${res.adjudicados}, Desiertos: ${res.desiertos}, Órdenes: ${res.ordenesGeneradas}`
          );
        }
      } catch (err) {
        if (this.logger) {
          console.error('[SubastasCloserWorker] Error durante ciclo de liquidación:', err);
        }
      } finally {
        this.inFlight = false;
        if (this.active) {
          this.scheduleNext();
        }
      }
    };

    setImmediate(poll);
  }

  private scheduleNext(): void {
    if (!this.active) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.active) {
        this.start();
      }
    }, this.intervalMs);
  }

  /**
   * Detiene el worker ordenadamente.
   */
  async stop(): Promise<void> {
    this.active = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  get isRunning(): boolean {
    return this.active;
  }
}
