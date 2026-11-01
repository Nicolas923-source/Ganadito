import type { FastifyPluginAsync } from 'fastify';
import type pg from 'pg';
import { SunatAdapter, SunatError } from './sunat.adapter.js';
import { CavaliAdapter, CavaliError } from './cavali.adapter.js';
import { createAuthMiddleware } from '../auth/auth.middleware.js';
import type {
  LiquidacionCompraInput,
  SolicitudFactoringInput
} from '@ganadito/contracts';

export interface TaxRoutesOptions {
  pool: pg.Pool;
  sunatAdapter?: SunatAdapter;
  cavaliAdapter?: CavaliAdapter;
}

export const taxRoutes: FastifyPluginAsync<TaxRoutesOptions> = async (fastify, options) => {
  const { pool } = options;
  const sunatAdapter = options.sunatAdapter ?? new SunatAdapter(pool);
  const cavaliAdapter = options.cavaliAdapter ?? new CavaliAdapter(pool);
  const authenticate = createAuthMiddleware(pool);

  // Exponer adaptadores en la instancia fastify para pruebas
  (fastify as any).sunatAdapter = sunatAdapter;
  (fastify as any).cavaliAdapter = cavaliAdapter;

  /**
   * POST /api/v1/tributario/liquidaciones-compra
   * Emite una Liquidación de Compra Electrónica (SEE-SUNAT) vinculada a orden liquidada.
   */
  fastify.post<{ Body: LiquidacionCompraInput }>(
    '/tributario/liquidaciones-compra',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        const resultado = await sunatAdapter.emitirLiquidacionCompra(request.body ?? ({} as any));
        return reply.status(201).send(resultado);
      } catch (err: any) {
        if (err instanceof SunatError) {
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
          message: 'Error al emitir la liquidación de compra electrónica.'
        });
      }
    }
  );

  /**
   * POST /api/v1/tributario/conciliar-pendientes
   * Job de conciliación asíncrono para comprobantes en estado 'ENVIADO_PENDIENTE'.
   */
  fastify.post(
    '/tributario/conciliar-pendientes',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        const resultado = await sunatAdapter.conciliarComprobantesPendientes();
        return reply.status(200).send(resultado);
      } catch (err: any) {
        request.log.error(err);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Error al conciliar comprobantes tributarios pendientes.'
        });
      }
    }
  );

  /**
   * GET /api/v1/tributario/comprobantes/:id
   * Obtiene el detalle de un comprobante tributario.
   */
  fastify.get<{ Params: { id: string } }>(
    '/tributario/comprobantes/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        const comprobante = await sunatAdapter.obtenerComprobantePorId(request.params.id);
        return reply.status(200).send(comprobante);
      } catch (err: any) {
        if (err instanceof SunatError) {
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
          message: 'Error al obtener el comprobante tributario.'
        });
      }
    }
  );

  /**
   * POST /api/v1/fintech/cavali/solicitar-factoring
   * Registra solicitud de factoring electrónico en CAVALI Factoring Stub.
   */
  fastify.post<{ Body: SolicitudFactoringInput }>(
    '/fintech/cavali/solicitar-factoring',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const session = request.userSession;
      try {
        const resultado = await cavaliAdapter.solicitarFactoring(
          request.body ?? ({} as any),
          session?.activeOrganizationId
        );
        return reply.status(201).send(resultado);
      } catch (err: any) {
        if (err instanceof CavaliError) {
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
          message: 'Error al procesar la solicitud de factoring CAVALI.'
        });
      }
    }
  );

  /**
   * GET /api/v1/fintech/cavali/:id
   * Consulta una anotación de factoring por ID.
   */
  fastify.get<{ Params: { id: string } }>(
    '/fintech/cavali/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        const factoring = await cavaliAdapter.obtenerFactoringPorId(request.params.id);
        return reply.status(200).send(factoring);
      } catch (err: any) {
        if (err instanceof CavaliError) {
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
          message: 'Error al obtener la solicitud de factoring.'
        });
      }
    }
  );
};
