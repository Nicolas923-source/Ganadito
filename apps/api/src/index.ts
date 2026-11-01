import type { HealthCheckResponse } from '@ganadito/contracts';

export * from './db.js';
export * from './app.js';
export * from './auth/types.js';
export * from './auth/auth.service.js';
export * from './auth/crypto.js';
export * from './mapa/mapa.service.js';
export * from './mapa/mapa.types.js';
export * from './spot/spot.service.js';
export * from './spot/spot.types.js';
export * from './subastas/subastas.service.js';
export * from './subastas/subastas.types.js';
export * from './trazabilidad/trazabilidad.service.js';
export * from './mayorista/mayorista.service.js';
export * from './gmx/gmx.service.js';
export * from './logistica/logistica.service.js';
export * from './integraciones/ai-client.service.js';
export * from './integraciones/sunat.adapter.js';
export * from './integraciones/cavali.adapter.js';

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
