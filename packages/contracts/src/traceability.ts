import crypto from 'node:crypto';

export type EstadoBovino = 'VIVO' | 'FAENADO' | 'DECESO' | 'TRANSFERIDO';
export type SexoBovino = 'MACHO' | 'HEMBRA';

export type TipoEventoTrazabilidad =
  | 'REGISTRO_INICIAL'
  | 'VACUNACION'
  | 'TRATAMIENTO'
  | 'PESAJE'
  | 'MOVILIZACION_CSTI'
  | 'PESAJE_CAMAL'
  | 'INSPECCION_POST_MORTEM'
  | 'CAMBIO_PROPIEDAD';

export interface Bovino {
  id: string;
  codigo_arete: string;
  organizacion_id: string;
  raza: string | null;
  sexo: SexoBovino;
  fecha_nacimiento: string | Date | null;
  estado: EstadoBovino;
  created_at?: string | Date;
  updated_at?: string | Date;
}

export interface EventoTrazabilidad {
  id: number | string;
  bovino_id: string;
  secuencia: number;
  event_type: TipoEventoTrazabilidad;
  metadata: Record<string, unknown>;
  prev_hash: string;
  current_hash: string;
  autor_id: string;
  created_at: string | Date;
}

export const GENESIS_PREV_HASH = '0'.repeat(64);

export function canonicalJsonStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj ?? {});
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJsonStringify).join(',') + ']';
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return '{' + keys.map(k => `${JSON.stringify(k)}:${canonicalJsonStringify((obj as any)[k])}`).join(',') + '}';
}

export function calcularHashEvento(
  prevHash: string,
  bovinoId: string,
  secuencia: number,
  eventType: string,
  metadata: Record<string, unknown>
): string {
  const metadataStr = canonicalJsonStringify(metadata);
  const payload = `${prevHash}${bovinoId}${secuencia}${eventType}${metadataStr}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export interface RegistrarBovinoInput {
  codigo_arete: string;
  raza?: string;
  sexo: SexoBovino;
  fecha_nacimiento?: string;
  metadata?: Record<string, unknown>;
}

export interface AgregarEventoInput {
  event_type: TipoEventoTrazabilidad;
  metadata: Record<string, unknown>;
}

export interface PasaporteDigitalResponse {
  bovino: Bovino;
  eventos: EventoTrazabilidad[];
}

export interface VerificacionCadenaResponse {
  integro: boolean;
  total_eventos: number;
  secuencia_corrupta?: number;
  detalle?: string;
}
