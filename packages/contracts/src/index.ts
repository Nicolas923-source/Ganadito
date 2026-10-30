/**
 * @ganadito/contracts
 * Definiciones de tipos, esquemas de validación y DTOs compartidos.
 * (Sin lógica de negocio implementada en esta fase de inicio).
 */

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  version: string;
  environment: string;
}
