import type { TipoEstablecimiento, UbicacionPublica } from '@ganadito/contracts';

export interface CrearEstablecimientoInput {
  nombre_comercial: string;
  tipo: TipoEstablecimiento;
  latitud: number;
  longitud: number;
  direccion_texto: string;
  ubigeo: string;
  activo?: boolean;
}

export interface EstablecimientoResponse {
  id: string;
  organizacion_id: string;
  nombre_comercial: string;
  tipo: TipoEstablecimiento;
  latitud: number;
  longitud: number;
  direccion_texto: string;
  ubigeo: string;
  activo: boolean;
  distancia_km?: number;
  created_at: string;
  updated_at: string;
}

/** Resultado de /establecimientos/cercanos: posición pública y distancia. */
export interface EstablecimientoCercanoResponse extends EstablecimientoResponse, UbicacionPublica {
  distancia_km: number;
}

export interface BusquedaCercanosQuery {
  lat: number;
  lon: number;
  radio_km?: number;
  tipo?: TipoEstablecimiento;
  limit?: number;
  offset?: number;
}
