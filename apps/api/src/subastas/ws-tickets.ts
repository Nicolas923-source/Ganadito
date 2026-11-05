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
export async function emitirTicketWs(
  pool: pg.Pool,
  userId: string,
  loteId: string
): Promise<{ ticket: string; expira_en_segundos: number }> {
  const lote = await pool.query('SELECT 1 FROM lotes_subasta WHERE id = $1', [loteId]);
  if (lote.rowCount === 0) throw new TicketWsError('Lote de subasta no encontrado.', 404, 'LOTE_NO_ENCONTRADO');

  // Limpieza oportunista de tickets vencidos hace más de 5 minutos.
  await pool.query(`DELETE FROM ws_tickets WHERE expira_en < clock_timestamp() - interval '5 minutes'`);

  const ticket = crypto.randomBytes(32).toString('base64url');
  // Tope e inserción en una sola sentencia. Bajo READ COMMITTED dos pedidos
  // simultáneos pueden pasar el tope por pocas unidades: aceptable para un límite
  // anti-abuso (no es un invariante de negocio).
  const res = await pool.query(
    `INSERT INTO ws_tickets (hash, user_id, lote_id, expira_en)
     SELECT $1, $2, $3, clock_timestamp() + make_interval(secs => $4)
     WHERE (SELECT count(*) FROM ws_tickets
            WHERE user_id = $2 AND usado_en IS NULL AND expira_en > clock_timestamp()) < $5`,
    [hashTicket(ticket), userId, loteId, TTL_TICKET_SEGUNDOS, MAX_TICKETS_VIGENTES_POR_USUARIO]
  );
  if (res.rowCount === 0) {
    throw new TicketWsError('Demasiados tickets pendientes; use los emitidos o espere 30 s.', 429, 'DEMASIADOS_TICKETS');
  }
  return { ticket, expira_en_segundos: TTL_TICKET_SEGUNDOS };
}

/**
 * Consume el ticket de forma atómica: vigente, sin usar y del mismo lote.
 * Devuelve el user_id o null. Un segundo intento con el mismo ticket siempre falla.
 */
export async function consumirTicketWs(pool: pg.Pool, ticket: string, loteId: string): Promise<string | null> {
  if (ticket.length < 20 || ticket.length > 100) return null;
  const res = await pool.query<{ user_id: string }>(
    `UPDATE ws_tickets SET usado_en = clock_timestamp()
     WHERE hash = $1 AND lote_id = $2 AND usado_en IS NULL AND expira_en > clock_timestamp()
     RETURNING user_id`,
    [hashTicket(ticket), loteId]
  );
  return res.rows[0]?.user_id ?? null;
}

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
