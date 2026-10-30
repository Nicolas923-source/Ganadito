import type { HealthCheckResponse } from '@ganadito/contracts';

export * from './db.js';

/**
 * Punto de entrada base para el servicio de API Ganadito.
 * Estructura hexagonal: controladores HTTP Fastify, adaptadores y servicios.
 */
export function getHealthStatus(): HealthCheckResponse {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    environment: process.env.NODE_ENV ?? 'development'
  };
}
