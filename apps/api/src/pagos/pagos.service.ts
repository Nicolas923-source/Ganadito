import type pg from 'pg';
import crypto from 'node:crypto';
import type { CheckoutInput, CheckoutResult, WebhookPagoPayload } from '@ganadito/contracts';

export class PagoError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = 'PagoError';
  }
}

/**
 * Genera la firma HMAC-SHA256 en formato hexadecimal.
 */
export function generateHmacSignature(
  rawBody: string,
  secret: string,
  timestamp?: string | number
): string {
  if (timestamp !== undefined) {
    return crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');
  }
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

/**
 * Valida la firma HMAC-SHA256 utilizando comparación en tiempo constante (timingSafeEqual)
 * para mitigar ataques de temporización (timing attacks).
 */
export function verifyHmacSignature(
  rawBody: string,
  signatureHex: string,
  secret: string,
  timestamp?: string | number
): boolean {
  if (!signatureHex || !secret) return false;

  const cleanSig = signatureHex.trim();

  // Candidato 1: HMAC directo del rawBody
  const hmac1 = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  const candidates = [hmac1];

  // Candidato 2: HMAC con timestamp prefijado `${timestamp}.${rawBody}`
  if (timestamp !== undefined) {
    const hmac2 = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');
    candidates.push(hmac2);
  }

  for (const cand of candidates) {
    if (cand.length === cleanSig.length) {
      const bufA = Buffer.from(cand, 'hex');
      const bufB = Buffer.from(cleanSig, 'hex');
      if (bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)) {
        return true;
      }
    }
  }

  return false;
}

export class PagosService {
  constructor(private pool: pg.Pool) {}

  /**
   * Registra una intención de pago en estado 'INICIADO' y genera la URL de checkout correspondiente.
   */
  async iniciarCheckout(
    userId: string,
    activeOrgId: string | undefined,
    input: CheckoutInput
  ): Promise<CheckoutResult> {
    const { orden_id, proveedor = 'MOCK_GATEWAY' } = input;

    if (!orden_id || !orden_id.trim()) {
      throw new PagoError('orden_id es obligatorio para iniciar el checkout.', 400);
    }

    // 1. Validar la existencia y estado de la orden de compra
    const ordenRes = await this.pool.query<{
      id: string;
      comprador_id: string;
      organizacion_compradora_id: string | null;
      total_a_pagar: string | number;
      estado: string;
    }>(
      `SELECT id, comprador_id, organizacion_compradora_id, total_a_pagar, estado
       FROM ordenes_compra
       WHERE id = $1`,
      [orden_id.trim()]
    );

    if (ordenRes.rows.length === 0) {
      throw new PagoError('Orden de compra no encontrada.', 404);
    }

    const orden = ordenRes.rows[0]!;

    if (orden.estado !== 'PENDIENTE_PAGO') {
      throw new PagoError(
        `La orden de compra no se encuentra pendiente de pago (estado actual: ${orden.estado}).`,
        409
      );
    }

    // 2. Validar que el usuario o su organización activa sea el comprador
    const isOwner =
      orden.comprador_id === userId ||
      (activeOrgId && orden.organizacion_compradora_id === activeOrgId);

    if (!isOwner) {
      throw new PagoError('No tiene autorización para realizar el pago de esta orden de compra.', 403);
    }

    // 3. Generar referencia externa y registrar transacción en 'pagos_transacciones'
    const transaccionId = crypto.randomUUID();
    const referenciaExterna = `GANADITO-PAY-${Date.now()}-${transaccionId.slice(0, 8).toUpperCase()}`;
    const montoTotal = Number(orden.total_a_pagar);
    const checkoutUrl = `https://checkout.ganadito.com/pay/${transaccionId}?ref=${referenciaExterna}&amount=${montoTotal}&currency=PEN`;

    await this.pool.query(
      `INSERT INTO pagos_transacciones (
         id, orden_id, monto, moneda, proveedor, referencia_externa, estado
       ) VALUES ($1, $2, $3, 'PEN', $4, $5, 'INICIADO')`,
      [transaccionId, orden.id, montoTotal, proveedor.trim(), referenciaExterna]
    );

    return {
      transaccion_id: transaccionId,
      orden_id: orden.id,
      monto: montoTotal,
      moneda: 'PEN',
      proveedor: proveedor.trim(),
      referencia_externa: referenciaExterna,
      checkout_url: checkoutUrl,
      estado: 'INICIADO'
    };
  }

  /**
   * Procesa el callback webhook de la pasarela de pagos con validación estricta de firma HMAC,
   * ventana anti-replay de 5 minutos y transición atómica e idempotente en PostgreSQL.
   */
  async procesarWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
    parsedBody: WebhookPagoPayload
  ): Promise<{
    status: string;
    transaccion_id: string;
    orden_id: string;
    estado: string;
    idempotente: boolean;
  }> {
    // 1. Validación de presencia de cabecera de firma
    const signatureHeader = headers['x-signature'];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

    if (!signature || !signature.trim()) {
      throw new PagoError('Firma HMAC requerida en la cabecera x-signature.', 401);
    }

    // 2. Validación de timestamp anti-replay (máximo 5 minutos de antigüedad)
    const timestampHeader = headers['x-timestamp'] ?? parsedBody?.timestamp;

    if (!timestampHeader) {
      throw new PagoError('Timestamp requerido para validación de seguridad anti-replay.', 401);
    }

    const firstHeader = Array.isArray(timestampHeader) ? timestampHeader[0] : timestampHeader;
    if (!firstHeader) {
      throw new PagoError('Timestamp requerido para validación de seguridad anti-replay.', 401);
    }

    const rawTsStr = String(firstHeader);
    let timestampMs = Number(rawTsStr);

    if (isNaN(timestampMs)) {
      timestampMs = new Date(rawTsStr).getTime();
    } else if (timestampMs < 1e11) {
      // Si fue provisto en segundos Unix
      timestampMs *= 1000;
    }

    if (isNaN(timestampMs)) {
      throw new PagoError('Timestamp inválido en el webhook.', 401);
    }

    const now = Date.now();
    const diferenciaMs = Math.abs(now - timestampMs);
    const cincoMinutosMs = 5 * 60 * 1000;

    if (diferenciaMs > cincoMinutosMs) {
      throw new PagoError(
        'Timestamp expirado o desfasado (posible replay attack detectado).',
        401
      );
    }

    // 3. Verificación criptográfica de firma HMAC-SHA256 en tiempo constante
    const webhookSecret =
      process.env.WEBHOOK_SECRET ?? 'ganadito_webhook_secret_dev_32_bytes_min';

    const isValidSignature = verifyHmacSignature(rawBody, signature, webhookSecret, rawTsStr);

    if (!isValidSignature) {
      throw new PagoError('Firma HMAC inválida o firma adulterada.', 401);
    }

    // 4. Procesamiento transaccional atómico en PostgreSQL con FOR UPDATE
    const refExterna = parsedBody.referencia_externa;
    const txId = parsedBody.transaccion_id;

    if (!refExterna && !txId) {
      throw new PagoError('El webhook debe incluir "referencia_externa" o "transaccion_id".', 400);
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // a) Bloqueo pesimista de la transacción en pagos_transacciones
      const txRes = await client.query<{
        id: string;
        orden_id: string;
        monto: string | number;
        moneda: string;
        estado: string;
        referencia_externa: string;
      }>(
        `SELECT id, orden_id, monto, moneda, estado, referencia_externa
         FROM pagos_transacciones
         WHERE ($1::varchar IS NOT NULL AND referencia_externa = $1)
            OR ($2::uuid IS NOT NULL AND id = $2)
         FOR UPDATE`,
        [refExterna ?? null, txId ?? null]
      );

      if (txRes.rows.length === 0) {
        throw new PagoError('Transacción de pago no encontrada.', 404);
      }

      const tx = txRes.rows[0]!;

      // b) Idempotencia financiera: si ya está 'CONFIRMADO', responder HTTP 200 inmediatamente
      if (tx.estado === 'CONFIRMADO') {
        await client.query('COMMIT');
        return {
          status: 'success',
          transaccion_id: tx.id,
          orden_id: tx.orden_id,
          estado: 'CONFIRMADO',
          idempotente: true
        };
      }

      // Bloquear la orden de compra vinculada
      const ordenRes = await client.query<{
        id: string;
        estado: string;
        total_a_pagar: string | number;
      }>(
        `SELECT id, estado, total_a_pagar
         FROM ordenes_compra
         WHERE id = $1
         FOR UPDATE`,
        [tx.orden_id]
      );

      if (ordenRes.rows.length === 0) {
        throw new PagoError('Orden de compra vinculada no encontrada.', 404);
      }

      const orden = ordenRes.rows[0]!;

      // c) Actualizar 'pagos_transacciones' a 'CONFIRMADO'
      await client.query(
        `UPDATE pagos_transacciones
         SET estado = 'CONFIRMADO',
             raw_webhook = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(parsedBody), tx.id]
      );

      // d) Actualizar 'ordenes_compra' a 'PAGADO'
      await client.query(
        `UPDATE ordenes_compra
         SET estado = 'PAGADO',
             updated_at = NOW()
         WHERE id = $1`,
        [orden.id]
      );

      // e) Insertar en 'outbox_events' el evento 'ORDEN_PAGADA'
      const outboxPayload = {
        orden_id: orden.id,
        transaccion_id: tx.id,
        referencia_externa: tx.referencia_externa,
        monto: Number(tx.monto),
        moneda: tx.moneda,
        estado: 'PAGADO',
        timestamp: new Date().toISOString()
      };

      await client.query(
        `INSERT INTO outbox_events (
           aggregate_type, aggregate_id, event_type, payload, status
         ) VALUES ('ORDEN_COMPRA', $1, 'ORDEN_PAGADA', $2, 'PENDIENTE')`,
        [orden.id, JSON.stringify(outboxPayload)]
      );

      await client.query('COMMIT');

      return {
        status: 'success',
        transaccion_id: tx.id,
        orden_id: orden.id,
        estado: 'CONFIRMADO',
        idempotente: false
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
}
