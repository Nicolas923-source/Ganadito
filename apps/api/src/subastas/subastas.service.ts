import type pg from 'pg';
import crypto from 'node:crypto';
import type {
  CrearLoteSubastaInput,
  LoteSubastaResponse,
  LoteSnapshotResponse,
  EmitirPujaInput,
  PujaAceptadaResponse
} from './subastas.types.js';

export type CodigoErrorSubasta =
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'IDEMPOTENCY_IN_PROGRESS'
  | 'IDEMPOTENCY_KEY_OTRO_CONTEXTO'
  | 'PUJA_INSUFICIENTE'
  | 'LOTE_NO_ABIERTO'
  | 'PUJA_PROPIO_LOTE';

const ESTADOS_INICIALES_LOTE = new Set(['ACTIVO', 'BORRADOR']);

/** Convierte un monto a céntimos; null si no es un número con como máximo 2 decimales. */
function aCentimos(valor: unknown): number | null {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return null;
  const c = Math.round(valor * 100);
  return Math.abs(c - valor * 100) < 1e-6 ? c : null;
}

export class SubastaError extends Error {
  constructor(message: string, public statusCode: number = 400, public code?: CodigoErrorSubasta) {
    super(message);
    this.name = 'SubastaError';
  }
}

export class SubastasService {
  constructor(private pool: pg.Pool) {}

  /**
   * Crea un nuevo lote de subasta en PostgreSQL.
   */
  async crearLote(
    vendedorOrgId: string,
    input: CrearLoteSubastaInput,
    creadoPorUserId?: string
  ): Promise<LoteSubastaResponse> {
    const {
      codigo_lote,
      precio_base,
      incremento_minimo,
      fecha_inicio,
      fecha_cierre,
      anti_sniping_seconds = 60,
      anti_sniping_extension = 120,
      estado = 'ACTIVO'
    } = input;

    if (typeof precio_base !== 'number' || precio_base <= 0) {
      throw new SubastaError('precio_base debe ser un número positivo mayor a 0.', 400);
    }
    if (typeof incremento_minimo !== 'number' || incremento_minimo <= 0) {
      throw new SubastaError('incremento_minimo debe ser un número positivo mayor a 0.', 400);
    }
    if (!fecha_cierre) {
      throw new SubastaError('fecha_cierre es obligatoria.', 400);
    }
    if (!ESTADOS_INICIALES_LOTE.has(estado)) {
      throw new SubastaError('estado inicial inválido: solo se admite ACTIVO o BORRADOR.', 400);
    }
    for (const [campo, valor] of [
      ['anti_sniping_seconds', anti_sniping_seconds],
      ['anti_sniping_extension', anti_sniping_extension]
    ] as const) {
      if (!Number.isInteger(valor) || valor < 0 || valor > 3600) {
        throw new SubastaError(`${campo} debe ser un entero entre 0 y 3600.`, 400);
      }
    }
    if (aCentimos(precio_base) === null || aCentimos(incremento_minimo) === null) {
      throw new SubastaError('precio_base e incremento_minimo admiten como máximo 2 decimales.', 400);
    }

    const fechaInicioDate = fecha_inicio ? new Date(fecha_inicio) : new Date();
    const fechaCierreDate = new Date(fecha_cierre);

    if (isNaN(fechaInicioDate.getTime())) {
      throw new SubastaError('fecha_inicio no es una fecha válida.', 400);
    }
    if (isNaN(fechaCierreDate.getTime())) {
      throw new SubastaError('fecha_cierre no es una fecha válida.', 400);
    }
    if (fechaCierreDate.getTime() <= fechaInicioDate.getTime()) {
      throw new SubastaError('fecha_cierre debe ser posterior a la fecha de inicio.', 400);
    }

    const codigoFinal =
      codigo_lote?.trim() ||
      `LOTE-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const res = await this.pool.query<LoteSubastaResponse>(
      `INSERT INTO lotes_subasta (
         codigo_lote,
         vendedor_id,
         estado,
         precio_base,
         precio_actual,
         incremento_minimo,
         fecha_inicio,
         fecha_cierre,
         anti_sniping_seconds,
         anti_sniping_extension,
         version,
         creado_por_user_id
       )
       VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8, $9, 1, $10)
       RETURNING
         id,
         codigo_lote,
         vendedor_id,
         estado,
         precio_base::float,
         precio_actual::float,
         incremento_minimo::float,
         postor_ganador_id,
         fecha_inicio,
         fecha_cierre,
         anti_sniping_seconds,
         anti_sniping_extension,
         version,
         created_at,
         updated_at`,
      [
        codigoFinal,
        vendedorOrgId,
        estado,
        precio_base,
        incremento_minimo,
        fechaInicioDate.toISOString(),
        fechaCierreDate.toISOString(),
        anti_sniping_seconds,
        anti_sniping_extension,
        creadoPorUserId ?? null
      ]
    );

    return res.rows[0]!;
  }

  /**
   * Consulta el Snapshot oficial en tiempo real del lote sin bloqueos transaccionales.
   * Calcula el tiempo restante oficial del reloj del servidor de base de datos.
   */
  async obtenerSnapshot(loteId: string): Promise<LoteSnapshotResponse> {
    const res = await this.pool.query<{
      id: string;
      codigo_lote: string;
      estado: any;
      precio_base: number;
      precio_actual: number;
      incremento_minimo: number;
      proxima_puja_minima: number;
      postor_ganador_id: string | null;
      postor_ganador_nombre: string | null;
      tiempo_restante_segundos: number;
      fecha_cierre: string;
      secuencia_maxima: number;
      version: number;
      iniciado: boolean;
      antes_del_cierre: boolean;
    }>(
      `SELECT
         l.id,
         l.codigo_lote,
         l.estado,
         l.precio_base::float,
         l.precio_actual::float,
         l.incremento_minimo::float,
         (l.precio_actual + l.incremento_minimo)::float AS proxima_puja_minima,
         l.postor_ganador_id,
         u.nombre AS postor_ganador_nombre,
         GREATEST(0, ROUND(EXTRACT(EPOCH FROM (l.fecha_cierre - NOW()))))::int AS tiempo_restante_segundos,
         (l.fecha_inicio <= NOW()) AS iniciado,
         (l.fecha_cierre > NOW()) AS antes_del_cierre,
         l.fecha_cierre,
         COALESCE(MAX(p.secuencia), 0)::int AS secuencia_maxima,
         l.version
       FROM lotes_subasta l
       LEFT JOIN users u ON u.id = l.postor_ganador_id
       LEFT JOIN subasta_pujas p ON p.lote_id = l.id
       WHERE l.id = $1
       GROUP BY l.id, u.nombre`,
      [loteId]
    );

    if (res.rows.length === 0) {
      throw new SubastaError('Lote de subasta no encontrado.', 404);
    }

    const { iniciado, antes_del_cierre, ...row } = res.rows[0]!;
    // Misma regla que la escritura: ACTIVO, ya iniciado y antes del cierre oficial.
    const esAbierta = row.estado === 'ACTIVO' && iniciado && antes_del_cierre;

    return {
      ...row,
      es_abierta: esAbierta
    };
  }

  /**
   * Procesa la emisión de una puja con control estricto de concurrencia pesimista (FOR UPDATE),
   * verificación de idempotencia, anti-sniping y generación de outbox en una transacción ACID en PostgreSQL.
   */
  async emitirPuja(
    userId: string,
    activeOrgId: string | undefined,
    loteId: string,
    input: EmitirPujaInput
  ): Promise<PujaAceptadaResponse> {
    const { monto, idempotency_key } = input;

    if (!idempotency_key || typeof idempotency_key !== 'string' || !idempotency_key.trim()) {
      throw new SubastaError('idempotency_key es obligatoria para emitir una puja.', 400);
    }
    const trimmedKey = idempotency_key.trim();
    if (trimmedKey.length > 100) {
      throw new SubastaError('idempotency_key admite como máximo 100 caracteres.', 400);
    }
    const montoCentimos = aCentimos(monto);
    if (montoCentimos === null || montoCentimos <= 0) {
      throw new SubastaError('monto debe ser un número positivo con como máximo 2 decimales.', 400);
    }
    if (!activeOrgId) {
      throw new SubastaError('Debe pujar con una organización activa.', 403);
    }

    // La huella identifica la operación lógica: mismo usuario + lote + monto.
    const payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ userId, loteId, montoCentimos }))
      .digest('hex');

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Reservar la clave. Si otra transacción la está insertando, este INSERT espera a que
      //    termine: si confirmó, no inserta (rowCount 0) y leemos su resultado; si revirtió, inserta.
      const reserva = await client.query(
        `INSERT INTO idempotency_records (user_id, operation, key, payload_hash, status, organizacion_id)
         VALUES ($1, 'EMITIR_PUJA', $2, $3, 'PROCESANDO', $4)
         ON CONFLICT (user_id, operation, key) DO NOTHING`,
        [userId, trimmedKey, payloadHash, activeOrgId]
      );

      if (reserva.rowCount === 0) {
        const previo = await client.query<{
          status: string;
          payload_hash: string;
          response_body: PujaAceptadaResponse;
          organizacion_id: string | null;
        }>(
          `SELECT status, payload_hash, response_body, organizacion_id
           FROM idempotency_records
           WHERE user_id = $1 AND operation = 'EMITIR_PUJA' AND key = $2
           FOR UPDATE`,
          [userId, trimmedKey]
        );
        const record = previo.rows[0];

        // Misma clave desde OTRA organización activa: conflicto de contexto, nunca una
        // repetición (devolvería una puja atribuida a la organización anterior).
        // organizacion_id NULL = registro anterior a la migración 0014 (heredado).
        if (record && record.organizacion_id !== null && record.organizacion_id !== activeOrgId) {
          throw new SubastaError(
            'La clave de idempotencia ya se usó con otra organización activa. Genere una clave nueva.',
            409,
            'IDEMPOTENCY_KEY_OTRO_CONTEXTO'
          );
        }
        if (record && record.payload_hash !== payloadHash) {
          throw new SubastaError(
            'La clave de idempotencia ya se usó con otra solicitud (lote o monto distinto).',
            422,
            'IDEMPOTENCY_KEY_REUSED'
          );
        }
        if (!record || record.status !== 'COMPLETED') {
          throw new SubastaError(
            'Existe una puja en proceso con esta misma clave de idempotencia.',
            409,
            'IDEMPOTENCY_IN_PROGRESS'
          );
        }
        await client.query('COMMIT');
        return record.response_body;
      }

      // 2. Bloqueo pesimista del lote.
      const loteRes = await client.query<{
        id: string;
        vendedor_id: string;
        estado: string;
        precio_actual_centimos: string;
        incremento_minimo_centimos: string;
        anti_sniping_seconds: number;
        anti_sniping_extension: number;
      }>(
        `SELECT
           id,
           vendedor_id,
           estado,
           ROUND(precio_actual * 100)::bigint AS precio_actual_centimos,
           ROUND(incremento_minimo * 100)::bigint AS incremento_minimo_centimos,
           anti_sniping_seconds,
           anti_sniping_extension
         FROM lotes_subasta
         WHERE id = $1
         FOR UPDATE`,
        [loteId]
      );

      if (loteRes.rows.length === 0) {
        throw new SubastaError('Lote de subasta no encontrado.', 404);
      }

      // 2b. Reloj real de PostgreSQL leído DESPUÉS de obtener el bloqueo. NOW() conserva el
      //     inicio de la transacción: una puja que esperó el FOR UPDATE se evaluaría con la hora
      //     anterior y podría aceptarse tras el cierre. clock_timestamp() es la hora actual, y
      //     la sentencia separada garantiza que se evalúa ya con la fila bloqueada.
      const relojRes = await client.query<{
        no_iniciado: boolean;
        segundos_restantes: number;
        fecha_cierre: Date;
      }>(
        `SELECT
           fecha_inicio > clock_timestamp() AS no_iniciado,
           EXTRACT(EPOCH FROM (fecha_cierre - clock_timestamp()))::float AS segundos_restantes,
           fecha_cierre
         FROM lotes_subasta
         WHERE id = $1`,
        [loteId]
      );

      const lote = { ...loteRes.rows[0]!, ...relojRes.rows[0]! };

      if (lote.estado !== 'ACTIVO') {
        throw new SubastaError(
          `El lote no se encuentra activo para recibir ofertas (estado: ${lote.estado}).`,
          400,
          'LOTE_NO_ABIERTO'
        );
      }
      if (lote.no_iniciado) {
        throw new SubastaError('La subasta todavía no ha iniciado.', 400, 'LOTE_NO_ABIERTO');
      }
      if (lote.segundos_restantes <= 0) {
        throw new SubastaError('La subasta ha expirado y no admite nuevas pujas.', 400, 'LOTE_NO_ABIERTO');
      }

      // 3. Nadie de la organización vendedora (con cualquier rol) puja por el lote.
      const miembroVendedor = await client.query(
        `SELECT 1 FROM user_organizaciones_roles WHERE user_id = $1 AND organizacion_id = $2 LIMIT 1`,
        [userId, lote.vendedor_id]
      );
      if (activeOrgId === lote.vendedor_id || (miembroVendedor.rowCount ?? 0) > 0) {
        throw new SubastaError(
          'El vendedor no puede pujar por su propio lote de subasta.',
          403,
          'PUJA_PROPIO_LOTE'
        );
      }

      const minRequeridoCentimos =
        Number(lote.precio_actual_centimos) + Number(lote.incremento_minimo_centimos);
      if (montoCentimos < minRequeridoCentimos) {
        throw new SubastaError(
          `El monto ofertado (${monto}) es inferior al mínimo requerido (${(minRequeridoCentimos / 100).toFixed(2)}).`,
          400,
          'PUJA_INSUFICIENTE'
        );
      }

      // 4. Anti-sniping: extender desde la fecha de cierre vigente.
      const extensionAplicada = lote.segundos_restantes <= lote.anti_sniping_seconds;
      const fechaCierreActual = new Date(lote.fecha_cierre);
      const nuevaFechaCierre = extensionAplicada
        ? new Date(fechaCierreActual.getTime() + lote.anti_sniping_extension * 1000)
        : fechaCierreActual;

      // 5. Secuencia monótona (protegida por el FOR UPDATE del lote y uq_lote_secuencia).
      const seqRes = await client.query<{ next_secuencia: number }>(
        `SELECT COALESCE(MAX(secuencia), 0) + 1 AS next_secuencia
         FROM subasta_pujas
         WHERE lote_id = $1`,
        [loteId]
      );
      const siguienteSecuencia = Number(seqRes.rows[0]!.next_secuencia);
      const montoFinal = montoCentimos / 100;

      const pujaRes = await client.query<{ id: string; created_at: string }>(
        `INSERT INTO subasta_pujas (lote_id, postor_id, organizacion_postora_id, monto, secuencia, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, created_at`,
        [loteId, userId, activeOrgId, montoFinal, siguienteSecuencia, trimmedKey]
      );
      const puja = pujaRes.rows[0]!;

      const updateLoteRes = await client.query<{ version: number }>(
        `UPDATE lotes_subasta
         SET precio_actual = $1,
             postor_ganador_id = $2,
             organizacion_ganadora_id = $3,
             fecha_cierre = $4,
             version = version + 1,
             updated_at = NOW()
         WHERE id = $5
         RETURNING version`,
        [montoFinal, userId, activeOrgId, nuevaFechaCierre.toISOString(), loteId]
      );
      const nuevaVersion = updateLoteRes.rows[0]!.version;

      const responsePayload: PujaAceptadaResponse = {
        puja_id: puja.id,
        lote_id: loteId,
        monto: montoFinal,
        secuencia: siguienteSecuencia,
        nueva_version: nuevaVersion,
        nuevo_precio_actual: montoFinal,
        extension_aplicada: extensionAplicada,
        nueva_fecha_cierre: nuevaFechaCierre.toISOString(),
        idempotency_key: trimmedKey,
        created_at: puja.created_at
      };

      // 6. Evento outbox en la misma transacción. El payload público no lleva la clave de
      //    idempotencia (es un dato del cliente que puja).
      const { idempotency_key: _clavePrivada, ...eventoPublico } = responsePayload;
      await client.query(
        `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, status)
         VALUES ('LOTE_SUBASTA', $1, 'PUJA_ACEPTADA', $2, 'PENDIENTE')`,
        [loteId, JSON.stringify(eventoPublico)]
      );

      await client.query(
        `UPDATE idempotency_records
         SET status = 'COMPLETED',
             response_code = 201,
             response_body = $1,
             updated_at = NOW()
         WHERE user_id = $2 AND operation = 'EMITIR_PUJA' AND key = $3`,
        [JSON.stringify(responsePayload), userId, trimmedKey]
      );

      await client.query('COMMIT');

      return responsePayload;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
}
