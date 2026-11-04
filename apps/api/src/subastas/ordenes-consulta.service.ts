import type pg from 'pg';

export class ConsultaOrdenError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = 'ConsultaOrdenError';
  }
}

export interface OrdenResumen {
  id: string;
  lote_id: string;
  codigo_lote: string;
  estado: string;
  monto_adjudicado: number;
  comision_plataforma: number;
  total_a_pagar: number;
  organizacion_compradora_id: string | null;
  organizacion_vendedora_id: string;
  created_at: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SELECT_ORDEN = `
  SELECT o.id, o.lote_id, l.codigo_lote, o.estado,
         o.monto_adjudicado::float AS monto_adjudicado,
         o.comision_plataforma::float AS comision_plataforma,
         o.total_a_pagar::float AS total_a_pagar,
         o.organizacion_compradora_id, o.organizacion_vendedora_id, o.created_at
  FROM ordenes_compra o
  JOIN lotes_subasta l ON l.id = o.lote_id`;

function encodeCursor(row: { created_at: string | Date; id: string }): string {
  const ts = row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at;
  return Buffer.from(JSON.stringify([ts, row.id])).toString('base64url');
}

function decodeCursor(cursor: string): [string, string] {
  try {
    const [ts, id] = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof ts !== 'string' || isNaN(Date.parse(ts)) || typeof id !== 'string' || !UUID_RE.test(id)) {
      throw new Error();
    }
    return [ts, id];
  } catch {
    throw new ConsultaOrdenError('cursor inválido.', 400);
  }
}

/**
 * Lectura de órdenes restringida a la organización activa (compradora o vendedora).
 */
export class OrdenesConsultaService {
  constructor(private pool: pg.Pool) {}

  async listar(
    organizacionId: string,
    query: { rol?: string; limit?: string; cursor?: string }
  ): Promise<{ data: OrdenResumen[]; next_cursor: string | null }> {
    const limit = query.limit === undefined ? 20 : Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new ConsultaOrdenError('limit debe ser un entero entre 1 y 100.', 400);
    }

    let filtroRol: string;
    if (query.rol === undefined) {
      filtroRol = '(o.organizacion_compradora_id = $1 OR o.organizacion_vendedora_id = $1)';
    } else if (query.rol === 'comprador') {
      filtroRol = 'o.organizacion_compradora_id = $1';
    } else if (query.rol === 'vendedor') {
      filtroRol = 'o.organizacion_vendedora_id = $1';
    } else {
      throw new ConsultaOrdenError("rol debe ser 'comprador' o 'vendedor'.", 400);
    }

    const params: unknown[] = [organizacionId, limit + 1];
    let filtroCursor = '';
    if (query.cursor) {
      const [ts, id] = decodeCursor(query.cursor);
      params.push(ts, id);
      filtroCursor = 'AND (o.created_at, o.id) < ($3::timestamptz, $4::uuid)';
    }

    const res = await this.pool.query<OrdenResumen>(
      `${SELECT_ORDEN}
       WHERE ${filtroRol} ${filtroCursor}
       ORDER BY o.created_at DESC, o.id DESC
       LIMIT $2`,
      params
    );

    const hasMore = res.rows.length > limit;
    const data = hasMore ? res.rows.slice(0, limit) : res.rows;
    return { data, next_cursor: hasMore ? encodeCursor(data[data.length - 1]!) : null };
  }

  async obtener(id: string, organizacionId: string): Promise<OrdenResumen> {
    if (!UUID_RE.test(id)) {
      throw new ConsultaOrdenError('Orden de compra no encontrada.', 404);
    }
    const res = await this.pool.query<OrdenResumen>(
      `${SELECT_ORDEN}
       WHERE o.id = $1 AND (o.organizacion_compradora_id = $2 OR o.organizacion_vendedora_id = $2)`,
      [id, organizacionId]
    );
    if (res.rows.length === 0) {
      throw new ConsultaOrdenError('Orden de compra no encontrada.', 404);
    }
    return res.rows[0]!;
  }
}
