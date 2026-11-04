import type pg from 'pg';
import {
  type Bovino,
  type EventoTrazabilidad,
  type RegistrarBovinoInput,
  type AgregarEventoInput,
  type PasaporteDigitalResponse,
  type VerificacionCadenaResponse,
  GENESIS_PREV_HASH,
  calcularHashEvento
} from '@ganadito/contracts';

const EVENTOS_CAMAL = new Set(['PESAJE_CAMAL', 'INSPECCION_POST_MORTEM']);

export class TrazabilidadError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'TrazabilidadError';
  }
}

export class TrazabilidadService {
  constructor(private readonly pool: pg.Pool) {}

  /**
   * Registra un nuevo bovino y su correspondiente evento génesis (secuencia 1)
   * de forma atómica dentro de una transacción.
   */
  async registrarBovino(
    userId: string,
    activeOrgId: string,
    input: RegistrarBovinoInput
  ): Promise<{ bovino: Bovino; eventoGenesis: EventoTrazabilidad }> {
    if (!input.codigo_arete || typeof input.codigo_arete !== 'string' || input.codigo_arete.trim().length === 0) {
      throw new TrazabilidadError('El código de arete es obligatorio.', 400);
    }

    if (!input.sexo || (input.sexo !== 'MACHO' && input.sexo !== 'HEMBRA')) {
      throw new TrazabilidadError("El sexo del bovino debe ser 'MACHO' o 'HEMBRA'.", 400);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Verificar unicidad del código de arete
      const checkResult = await client.query(
        `SELECT id FROM bovinos WHERE codigo_arete = $1`,
        [input.codigo_arete.trim()]
      );

      if (checkResult.rows.length > 0) {
        throw new TrazabilidadError(
          `Ya existe un bovino registrado con el código de arete '${input.codigo_arete.trim()}'.`,
          409
        );
      }

      // 1. Insertar el registro principal del bovino
      const insertBovinoRes = await client.query<Bovino>(
        `INSERT INTO bovinos (codigo_arete, organizacion_id, raza, sexo, fecha_nacimiento, estado)
         VALUES ($1, $2, $3, $4, $5, 'VIVO')
         RETURNING *`,
        [
          input.codigo_arete.trim(),
          activeOrgId,
          input.raza?.trim() ?? null,
          input.sexo,
          input.fecha_nacimiento ?? null
        ]
      );
      const bovino = insertBovinoRes.rows[0]!;

      // 2. Generar el evento génesis
      const metadata = input.metadata ?? {};
      const secuencia = 1;
      const prevHash = GENESIS_PREV_HASH;
      const eventType = 'REGISTRO_INICIAL';
      const currentHash = calcularHashEvento(prevHash, bovino.id, secuencia, eventType, metadata);

      const insertEventRes = await client.query<EventoTrazabilidad>(
        `INSERT INTO pasaporte_bovino_events (bovino_id, secuencia, event_type, metadata, prev_hash, current_hash, autor_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          bovino.id,
          secuencia,
          eventType,
          JSON.stringify(metadata),
          prevHash,
          currentHash,
          userId
        ]
      );
      const eventoGenesis = insertEventRes.rows[0]!;

      // 3. Emisión de Outbox Event para sincronización y difusión
      await client.query(
        `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload)
         VALUES ($1, $2, $3, $4)`,
        [
          'BOVINO',
          bovino.id,
          'PASAPORTE_BOVINO_ACTUALIZADO',
          JSON.stringify({
            bovino_id: bovino.id,
            secuencia,
            event_type: eventType,
            current_hash: currentHash
          })
        ]
      );

      await client.query('COMMIT');
      return { bovino, eventoGenesis };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Añade un nuevo hito/evento a la cadena criptográfica del pasaporte bovino
   * con control de concurrencia pesimista (FOR UPDATE).
   */
  async agregarEvento(
    userId: string,
    activeOrgId: string,
    bovinoId: string,
    input: AgregarEventoInput,
    activeRole?: string
  ): Promise<EventoTrazabilidad> {
    if (!input.event_type) {
      throw new TrazabilidadError('El campo event_type es obligatorio.', 400);
    }
    const metadata = input.metadata ?? {};

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Bloqueo pesimista del bovino
      const bovinoRes = await client.query<Bovino>(
        `SELECT * FROM bovinos WHERE id = $1 FOR UPDATE`,
        [bovinoId]
      );
      if (bovinoRes.rows.length === 0) {
        throw new TrazabilidadError('Bovino no encontrado.', 404);
      }
      const bovino = bovinoRes.rows[0]!;

      // Autorización: la organización propietaria registra cualquier evento; un operador de
      // camal de otra organización solo puede registrar eventos de faena. Nadie más escribe
      // en un pasaporte ajeno, y solo el propietario transfiere la propiedad.
      const esPropietario = bovino.organizacion_id === activeOrgId;
      const esEventoCamal = EVENTOS_CAMAL.has(input.event_type);
      if (!esPropietario && !(esEventoCamal && activeRole === 'OPERADOR_CAMAL')) {
        throw new TrazabilidadError('No tiene permiso para registrar eventos en este bovino.', 403);
      }

      // 2. Obtener el último evento para calcular secuencia y prev_hash encadenado
      const lastEventRes = await client.query<EventoTrazabilidad>(
        `SELECT * FROM pasaporte_bovino_events
         WHERE bovino_id = $1
         ORDER BY secuencia DESC
         LIMIT 1
         FOR UPDATE`,
        [bovinoId]
      );
      if (lastEventRes.rows.length === 0) {
        throw new TrazabilidadError('Cadena de pasaporte corrupta: no se halló evento génesis.', 500);
      }
      const lastEvent = lastEventRes.rows[0]!;

      const nextSecuencia = Number(lastEvent.secuencia) + 1;
      const prevHash = lastEvent.current_hash;
      const currentHash = calcularHashEvento(
        prevHash,
        bovinoId,
        nextSecuencia,
        input.event_type,
        metadata
      );

      // Si el evento es PESAJE_CAMAL o INSPECCION_POST_MORTEM, transicionar a FAENADO
      if (input.event_type === 'PESAJE_CAMAL' || input.event_type === 'INSPECCION_POST_MORTEM') {
        await client.query(
          `UPDATE bovinos SET estado = 'FAENADO', updated_at = NOW() WHERE id = $1`,
          [bovinoId]
        );
      }

      // Si es CAMBIO_PROPIEDAD con nueva organización receptora
      if (input.event_type === 'CAMBIO_PROPIEDAD') {
        const nuevaOrgId = (metadata as any)?.nueva_organizacion_id;
        if (typeof nuevaOrgId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nuevaOrgId)) {
          throw new TrazabilidadError('CAMBIO_PROPIEDAD requiere metadata.nueva_organizacion_id.', 400);
        }
        const destino = await client.query('SELECT 1 FROM organizaciones WHERE id = $1', [nuevaOrgId]);
        if (destino.rowCount === 0) {
          throw new TrazabilidadError('La organización de destino no existe.', 400);
        }
        await client.query(
          `UPDATE bovinos SET organizacion_id = $1, estado = 'TRANSFERIDO', updated_at = NOW() WHERE id = $2`,
          [nuevaOrgId, bovinoId]
        );
      }

      // 3. Insertar el evento encadenado inmutable
      const insertEventRes = await client.query<EventoTrazabilidad>(
        `INSERT INTO pasaporte_bovino_events (bovino_id, secuencia, event_type, metadata, prev_hash, current_hash, autor_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          bovinoId,
          nextSecuencia,
          input.event_type,
          JSON.stringify(metadata),
          prevHash,
          currentHash,
          userId
        ]
      );
      const nuevoEvento = insertEventRes.rows[0]!;

      // 4. Emisión de Outbox Event
      await client.query(
        `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload)
         VALUES ($1, $2, $3, $4)`,
        [
          'BOVINO',
          bovinoId,
          'PASAPORTE_BOVINO_ACTUALIZADO',
          JSON.stringify({
            bovino_id: bovinoId,
            secuencia: nextSecuencia,
            event_type: input.event_type,
            current_hash: currentHash
          })
        ]
      );

      await client.query('COMMIT');
      return nuevoEvento;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Consulta el pasaporte digital completo: datos del bovino y eventos ordenados por secuencia.
   */
  async obtenerPasaporte(bovinoId: string): Promise<PasaporteDigitalResponse> {
    const bovinoRes = await this.pool.query<Bovino>(
      `SELECT * FROM bovinos WHERE id = $1`,
      [bovinoId]
    );
    if (bovinoRes.rows.length === 0) {
      throw new TrazabilidadError('Bovino no encontrado.', 404);
    }
    const bovino = bovinoRes.rows[0]!;

    const eventosRes = await this.pool.query<EventoTrazabilidad>(
      `SELECT * FROM pasaporte_bovino_events
       WHERE bovino_id = $1
       ORDER BY secuencia ASC`,
      [bovinoId]
    );

    return {
      bovino,
      eventos: eventosRes.rows
    };
  }

  /**
   * Auditoría de integridad criptográfica:
   * Valida secuencia contigua (1..N), continuidad de hashes encadenados
   * y correspondencia exacta de cada SHA-256.
   */
  async verificarIntegridadPasaporte(bovinoId: string): Promise<VerificacionCadenaResponse> {
    const bovinoRes = await this.pool.query<Bovino>(
      `SELECT id FROM bovinos WHERE id = $1`,
      [bovinoId]
    );
    if (bovinoRes.rows.length === 0) {
      throw new TrazabilidadError('Bovino no encontrado.', 404);
    }

    const eventosRes = await this.pool.query<EventoTrazabilidad>(
      `SELECT * FROM pasaporte_bovino_events
       WHERE bovino_id = $1
       ORDER BY secuencia ASC`,
      [bovinoId]
    );

    const eventos = eventosRes.rows;
    if (eventos.length === 0) {
      return {
        integro: false,
        total_eventos: 0,
        detalle: 'No existen eventos de trazabilidad registrados para este bovino.'
      };
    }

    for (let i = 0; i < eventos.length; i++) {
      const evento = eventos[i]!;
      const expectedSecuencia = i + 1;

      // 1. Validar secuencia contigua
      if (Number(evento.secuencia) !== expectedSecuencia) {
        return {
          integro: false,
          total_eventos: eventos.length,
          secuencia_corrupta: Number(evento.secuencia),
          detalle: `Secuencia inválida: se esperaba ${expectedSecuencia} pero se encontró ${evento.secuencia}.`
        };
      }

      // 2. Validar encadenamiento de prev_hash
      const expectedPrevHash = i === 0 ? GENESIS_PREV_HASH : eventos[i - 1]!.current_hash;
      if (evento.prev_hash !== expectedPrevHash) {
        return {
          integro: false,
          total_eventos: eventos.length,
          secuencia_corrupta: Number(evento.secuencia),
          detalle: `Discrepancia en prev_hash en la secuencia ${evento.secuencia}.`
        };
      }

      // 3. Recalcular y validar current_hash
      const recalculatedHash = calcularHashEvento(
        evento.prev_hash,
        bovinoId,
        Number(evento.secuencia),
        evento.event_type,
        evento.metadata
      );

      if (evento.current_hash !== recalculatedHash) {
        return {
          integro: false,
          total_eventos: eventos.length,
          secuencia_corrupta: Number(evento.secuencia),
          detalle: `Hash criptográfico alterado o inválido en la secuencia ${evento.secuencia}.`
        };
      }
    }

    return {
      integro: true,
      total_eventos: eventos.length
    };
  }
}
