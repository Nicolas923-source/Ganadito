/**
 * @ganadito/contracts
 *
 * Contratos, tipos compartidos y esquemas de dominio de Ganadito.
 * Fuente única de verdad tipada para frontend (apps/web), backend (apps/api)
 * y servicios auxiliares.
 */

// 1. Tipos geoespaciales y PostGIS
export * from './geo.js';

// 2. Identidad, Contexto Organizacional y Establecimientos (RBAC dual)
export * from './identity.js';

// 3. Motor de Subastas (Core)
export * from './auctions.js';

// 4. Pizarra Spot y Mapa
export * from './spot.js';

// 5. Utilidades generales de contratos
export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  version: string;
  environment: string;
}
