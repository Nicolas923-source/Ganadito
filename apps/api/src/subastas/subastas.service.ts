import type pg from 'pg';
import crypto from 'node:crypto';
import type {
  CrearLoteSubastaInput,
  LoteSubastaResponse,
  LoteSnapshotResponse,
  EmitirPujaInput,
  PujaAceptadaResponse
} from './subastas.types.js';

export class SubastaError extends Error {
  constructor(message: string, public statusCode: number = 400) {
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
    input: CrearLoteSubastaInput
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

    const fechaInicioDate = fecha_inicio ? new Date(fecha_inicio) : new Date();
    const fechaCierreDate = new Date(fecha_cierre);

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
         version
       )
       VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8, $9, 1)
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
        anti_sniping_extension
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

    const row = res.rows[0]!;
    const esAbierta = row.estado === 'ACTIVO' && row.tiempo_restante_segundos > 0;

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

    if (!idempotency_key || !idempotency_key.trim()) {
      throw new SubastaError('idempotency_key es obligatoria para emitir una puja.', 400);
    }
    if (typeof monto !== 'number' || monto <= 0) {
      throw new SubastaError('monto debe ser un número positivo mayor a 0.', 400);
    }

    const trimmedKey = idempotency_key.trim();
    const payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ loteId, monto }))
      .digest('hex');

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Comprobar y reservar idempotencia
      const idempRes = await client.query<{
        status: string;
        response_code: number;
        response_body: PujaAceptadaResponse;
      }>(
        `SELECT status, response_code, response_body
         FROM idempotency_records
         WHERE user_id = $1 AND operation = 'EMITIR_PUJA' AND key = $2
         FOR UPDATE`,
        [userId, trimmedKey]
      );

      if (idempRes.rows.length > 0) {
        const record = idempRes.rows[0]!;
        if (record.status === 'PROCESANDO') {
          throw new SubastaError('Existe una puja en proceso con esta misma clave de idempotencia.', 409);
        }
        if (record.status === 'COMPLETED') {
          // Devolver el resultado anterior sin reejecutar (Idempotencia pura)
          await client.query('COMMIT');
          return record.response_body;
        }
      } else {
        // Reservar en estado PROCESANDO
        await client.query(
          `INSERT INTO idempotency_records (user_id, operation, key, payload_hash, status)
           VALUES ($1, 'EMITIR_PUJA', $2, $3, 'PROCESANDO')`,
          [userId, trimmedKey, payloadHash]
        );
      }

      // 2. Bloqueo pesimista de la fila del lote en subasta (FOR UPDATE)
      const loteRes = await client.query<{
        id: string;
        vendedor_id: string;
        estado: string;
        precio_actual: number;
        incremento_minimo: number;
        fecha_cierre: string;
        anti_sniping_seconds: number;
        anti_sniping_extension: number;
        version: number;
      }>(
        `SELECT
           id,
           vendedor_id,
           estado,
           precio_actual::float,
           incremento_minimo::float,
           fecha_cierre,
           anti_sniping_seconds,
           anti_sniping_extension,
           version
         FROM lotes_subasta
         WHERE id = $1
         FOR UPDATE`,
        [loteId]
      );

      if (loteRes.rows.length === 0) {
        throw new SubastaError('Lote de subasta no encontrado.', 404);
      }

      const lote = loteRes.rows[0]!;

      // 3. Validaciones transaccionales del lote
      if (lote.estado !== 'ACTIVO') {
        throw new SubastaError(`El lote no se encuentra activo para recibir ofertas (estado: ${lote.estado}).`, 400);
      }

      const fechaCierreCurrent = new Date(lote.fecha_cierre);
      const ahora = new Date();

      if (fechaCierreCurrent.getTime() <= ahora.getTime()) {
        throw new SubastaError('La subasta ha expirado y no admite nuevas pujas.', 400);
      }

      if (activeOrgId && lote.vendedor_id === activeOrgId) {
        throw new SubastaError('El vendedor no puede pujar por su propio lote de subasta.', 403);
      }

      const minRequerido = Number((lote.precio_actual + lote.incremento_minimo).toFixed(2));
      if (monto < minRequerido) {
        throw new SubastaError(
          `El monto ofertado (${monto}) es inferior al mínimo requerido (${minRequerido}).`,
          400
        );
      }

      // 4. Regla Anti-sniping
      const segundosRestantes = (fechaCierreCurrent.getTime() - ahora.getTime()) / 1000;
      let extensionAplicada = false;
      let nuevaFechaCierre = fechaCierreCurrent;

      if (segundosRestantes <= lote.anti_sniping_seconds) {
        extensionAplicada = true;
        nuevaFechaCierre = new Date(fechaCierreCurrent.getTime() + lote.anti_sniping_extension * 1000);
      }

      // 5. Asignar secuencia incremental estrictamente monótona del lote
      const seqRes = await client.query<{ next_secuencia: number }>(
        `SELECT COALESCE(MAX(secuencia), 0) + 1 AS next_secuencia
         FROM subasta_pujas
         WHERE lote_id = $1`,
        [loteId]
      );
      const siguienteSecuencia = Number(seqRes.rows[0]!.next_secuencia);

      // 6. Insertar en subasta_pujas
      const pujaRes = await client.query<{ id: string; created_at: string }>(
        `INSERT INTO subasta_pujas (lote_id, postor_id, monto, secuencia, idempotency_key)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, created_at`,
        [loteId, userId, monto, siguienteSecuencia, trimmedKey]
      );
      const puja = pujaRes.rows[0]!;

      // 7. Actualizar el lote con nuevo precio, ganador, versión y nueva fecha de cierre si hubo extensión
      const updateLoteRes = await client.query<{ version: number }>(
        `UPDATE lotes_subasta
         SET precio_actual = $1,
             postor_ganador_id = $2,
             fecha_cierre = $3,
             version = version + 1,
             updated_at = NOW()
         WHERE id = $4
         RETURNING version`,
        [monto, userId, nuevaFechaCierre.toISOString(), loteId]
      );
      const nuevaVersion = updateLoteRes.rows[0]!.version;

      // 8. Construir payload de respuesta
      const responsePayload: PujaAceptadaResponse = {
        puja_id: puja.id,
        lote_id: loteId,
        monto,
        secuencia: siguienteSecuencia,
        nueva_version: nuevaVersion,
        nuevo_precio_actual: monto,
        extension_aplicada: extensionAplicada,
        nueva_fecha_cierre: nuevaFechaCierre.toISOString(),
        idempotency_key: trimmedKey,
        created_at: puja.created_at
      };

      // 9. Registrar evento en outbox_events para publicación asíncrona hacia WebSockets
      await client.query(
        `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, status)
         VALUES ('LOTE_SUBASTA', $1, 'PUJA_ACEPTADA', $2, 'PENDIENTE')`,
        [loteId, JSON.stringify(responsePayload)]
      );

      // 10. Actualizar registro de idempotencia a COMPLETED
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
