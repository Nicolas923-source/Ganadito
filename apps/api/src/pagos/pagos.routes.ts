import type { FastifyPluginAsync } from 'fastify';
import type pg from 'pg';
import { PagosService, PagoError } from './pagos.service.js';
import { createAuthMiddleware } from '../auth/auth.middleware.js';
import type { CheckoutInput, WebhookPagoPayload } from '@ganadito/contracts';

export interface PagosRoutesOptions {
  pool: pg.Pool;
}

export const pagosRoutes: FastifyPluginAsync<PagosRoutesOptions> = async (fastify, options) => {
  const { pool } = options;
  const pagosService = new PagosService(pool);
  const authenticate = createAuthMiddleware(pool);

  /**
   * POST /api/v1/pagos/checkout
   * Inicia la intención de pago para una orden de compra en estado PENDIENTE_PAGO.
   */
  fastify.post<{ Body: CheckoutInput }>(
    '/checkout',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const session = request.userSession;

      if (!session) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Sesión no autenticada.'
        });
      }

      try {
        const resultado = await pagosService.iniciarCheckout(
          session.userId,
          session.activeOrganizationId,
          request.body
        );

        return reply.status(201).send(resultado);
      } catch (err: any) {
        if (err instanceof PagoError) {
          return reply.status(err.statusCode).send({
            statusCode: err.statusCode,
            error: err.name,
            message: err.message
          });
        }
        request.log.error(err);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Error al iniciar la intención de pago.'
        });
      }
    }
  );

  /**
   * POST /api/v1/pagos/webhook
   * Callback seguro para notificaciones de pasarelas de pago externas.
   * Valida firma HMAC-SHA256, ventana anti-replay y confirma transacciones atómicamente.
   */
  fastify.post<{ Body: WebhookPagoPayload }>(
    '/webhook',
    async (request, reply) => {
      try {
        const rawBody = (request as any).rawBody ?? JSON.stringify(request.body);

        const resultado = await pagosService.procesarWebhook(
          request.headers,
          rawBody,
          request.body
        );

        return reply.status(200).send(resultado);
      } catch (err: any) {
        if (err instanceof PagoError) {
          return reply.status(err.statusCode).send({
            statusCode: err.statusCode,
            error: err.name,
            message: err.message
          });
        }
        request.log.error(err);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Error al procesar el webhook de pago.'
        });
      }
    }
  );
};
