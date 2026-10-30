import type { FastifyPluginAsync } from 'fastify';
import type pg from 'pg';
import { OrdenesEntregaService, EntregaError } from './ordenes-entrega.service.js';
import { createAuthMiddleware } from '../auth/auth.middleware.js';
import type { DespacharOrdenInput, ConfirmarRecepcionInput } from '@ganadito/contracts';

export interface OrdenesRoutesOptions {
  pool: pg.Pool;
}

export const ordenesRoutes: FastifyPluginAsync<OrdenesRoutesOptions> = async (fastify, options) => {
  const { pool } = options;
  const ordenesEntregaService = new OrdenesEntregaService(pool);
  const authenticate = createAuthMiddleware(pool);

  /**
   * POST /api/v1/ordenes/:id/despachar
   * Permite al vendedor/transportista confirmar el despacho hacia custodia física/transporte.
   */
  fastify.post<{ Params: { id: string }; Body: DespacharOrdenInput }>(
    '/:id/despachar',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const session = request.userSession!;
      const { id } = request.params;

      try {
        const resultado = await ordenesEntregaService.despacharOrden(
          session.userId,
          session.activeOrganizationId,
          id,
          request.body
        );

        return reply.status(200).send(resultado);
      } catch (err: any) {
        if (err instanceof EntregaError) {
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
          message: 'Error al procesar el despacho de la orden de compra.'
        });
      }
    }
  );

  /**
   * POST /api/v1/ordenes/:id/confirmar-recepcion
   * Permite al comprador confirmar la entrega conforme del ganado,
   * liberando los fondos en custodia y generando la liquidación neta al vendedor.
   */
  fastify.post<{ Params: { id: string }; Body: ConfirmarRecepcionInput }>(
    '/:id/confirmar-recepcion',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const session = request.userSession!;
      const { id } = request.params;

      try {
        const resultado = await ordenesEntregaService.confirmarRecepcion(
          session.userId,
          session.activeOrganizationId,
          id,
          request.body
        );

        return reply.status(200).send(resultado);
      } catch (err: any) {
        if (err instanceof EntregaError) {
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
          message: 'Error al confirmar la recepción de la orden de compra.'
        });
      }
    }
  );
};
