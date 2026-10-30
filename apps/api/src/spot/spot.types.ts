import type { ProductoSpot, UnidadMedidaSpot } from '@ganadito/contracts';

export interface CrearCotizacionSpotInput {
  establecimiento_id: string;
  producto: ProductoSpot;
  categoria: string;
  calidad: string;
  unidad_medida: UnidadMedidaSpot;
  precio_unitario: number;
  moneda?: string;
  procedencia_ubigeo?: string;
  fecha_registro?: string;
  vigencia_hasta: string;
  verificado?: boolean;
}

export interface CotizacionSpotResponse {
  id: string;
  establecimiento_id: string;
  establecimiento_nombre?: string;
  establecimiento_tipo?: string;
  organizacion_id?: string;
  organizacion_nombre?: string;
  producto: ProductoSpot;
  categoria: string;
  calidad: string;
  unidad_medida: UnidadMedidaSpot;
  moneda: string;
  precio_unitario: number;
  procedencia_ubigeo: string;
  fecha_registro: string;
  vigencia_hasta: string;
  verificado: boolean;
  latitud?: number;
  longitud?: number;
  created_at: string;
}

export interface ConsultaPizarraQuery {
  producto?: ProductoSpot;
  ubigeo?: string;
  categoria?: string;
  calidad?: string;
  limit?: number;
  offset?: number;
}
