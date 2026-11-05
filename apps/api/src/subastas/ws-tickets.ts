import crypto from 'node:crypto';
import type pg from 'pg';

/** Vida del ticket: alcanza para abrir el socket justo después de pedirlo. */
export const TTL_TICKET_SEGUNDOS = 30;
/** Tope de tickets vigentes sin usar por usuario (evita llenar la tabla). */
export const MAX_TICKETS_VIGENTES_POR_USUARIO = 20;

export class TicketWsError extends Error {
  constructor(message: string, public statusCode: number, public code: string) {
    super(message);
    this.name = 'TicketWsError';
  }
}

const hashTicket = (ticket: string) => crypto.createHash('sha256').update(ticket).digest('hex');

/** Ticket opaco de 256 bits; en la base solo queda su SHA-256. */
export interface ContextoTicket {
  userId: string;
  organizacionId?: string;
  rol?: string;
}

export interface SesionWs {
  userId: string;
  organizacionId: string;
}

/** Probabilidad de limpiar tickets vencidos en cada emisión (no lo paga cada petición). */
export const PROBABILIDAD_LIMPIEZA = 0.05;

export async function emitirTicketWs(
  pool: pg.Pool,
  contexto: ContextoTicket,
  loteId: string,
  aleatorio: () => number = Math.random
): Promise<{ ticket: string; expira_en_segundos: number }> {
  const { userId, organizacionId, rol } = contexto;
  if (!organizacionId || !rol) {
    throw new TicketWsError('Se requiere un contexto organizacional activo.', 403, 'SIN_CONTEXTO');
  }
  const lote = await pool.query('SELECT 1 FROM lotes_subasta WHERE id = $1', [loteId]);
  if (lote.rowCount === 0) throw new TicketWsError('Lote de subasta no encontrado.', 404, 'LOTE_NO_ENCONTRADO');

  if (aleatorio() < PROBABILIDAD_LIMPIEZA) {
    await pool.query(`DELETE FROM ws_tickets WHERE expira_en < clock_timestamp() - interval '5 minutes'`);
  }

  const ticket = crypto.randomBytes(32).toString('base64url');
  // Tope e inserción en una sola sentencia. Bajo READ COMMITTED dos pedidos
  // simultáneos pueden pasar el tope por pocas unidades: aceptable para un límite
  // anti-abuso (no es un invariante de negocio).
  const res = await pool.query(
    `INSERT INTO ws_tickets (hash, user_id, organizacion_id, rol, lote_id, expira_en)
     SELECT $1, $2, $6, $7, $3, clock_timestamp() + make_interval(secs => $4)
     WHERE (SELECT count(*) FROM ws_tickets
            WHERE user_id = $2 AND usado_en IS NULL AND expira_en > clock_timestamp()) < $5`,
    [hashTicket(ticket), userId, loteId, TTL_TICKET_SEGUNDOS, MAX_TICKETS_VIGENTES_POR_USUARIO, organizacionId, rol]
  );
  if (res.rowCount === 0) {
    throw new TicketWsError('Demasiados tickets pendientes; use los emitidos o espere 30 s.', 429, 'DEMASIADOS_TICKETS');
  }
  return { ticket, expira_en_segundos: TTL_TICKET_SEGUNDOS };
}

/**
 * Consume el ticket de forma atómica: vigente, sin usar, del mismo lote y con la
 * membresía (organización + rol) con que se emitió TODAVÍA activa en PostgreSQL.
 * Devuelve la sesión o null. Un segundo intento con el mismo ticket siempre falla.
 */
export async function consumirTicketWs(pool: pg.Pool, ticket: string, loteId: string): Promise<SesionWs | null> {
  if (ticket.length < 20 || ticket.length > 100) return null;
  const res = await pool.query<{ user_id: string; organizacion_id: string }>(
    `UPDATE ws_tickets t SET usado_en = clock_timestamp()
     WHERE t.hash = $1 AND t.lote_id = $2 AND t.usado_en IS NULL AND t.expira_en > clock_timestamp()
       AND EXISTS (
         SELECT 1 FROM user_organizaciones_roles uor
         WHERE uor.user_id = t.user_id AND uor.organizacion_id = t.organizacion_id
           AND uor.rol = t.rol AND uor.is_active_context)
     RETURNING t.user_id, t.organizacion_id`,
    [hashTicket(ticket), loteId]
  );
  const fila = res.rows[0];
  return fila ? { userId: fila.user_id, organizacionId: fila.organizacion_id } : null;
}

/** Identidad asociada a cada socket abierto (para auditoría o eventos por usuario). */
export const sesionesWs = new WeakMap<object, SesionWs | { userId: string; organizacionId?: string }>();

/**
 * ?access_token= queda solo por compatibilidad mientras la web migra al ticket.
 * Por defecto se permite fuera de producción y se rechaza en producción; la variable
 * WS_PERMITIR_ACCESS_TOKEN_EN_URL ('true' | 'false') lo fuerza.
 */
export function permiteAccessTokenEnUrl(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = env.WS_PERMITIR_ACCESS_TOKEN_EN_URL;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return env.NODE_ENV !== 'production';
}
