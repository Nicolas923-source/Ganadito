import Fastify, { type FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyWebsocket from '@fastify/websocket';
import type pg from 'pg';
import type { Redis } from 'ioredis';
import { getPool } from './db.js';
import { authRoutes } from './auth/auth.routes.js';
import { mapaRoutes } from './mapa/mapa.routes.js';
import { spotRoutes } from './spot/spot.routes.js';
import { subastasRoutes } from './subastas/subastas.routes.js';
import { subastasWsRoutes, SubastaWsHub } from './subastas/subastas.ws.js';
import { pagosRoutes } from './pagos/pagos.routes.js';
import { ordenesRoutes } from './subastas/ordenes.routes.js';
import { trazabilidadRoutes } from './trazabilidad/trazabilidad.routes.js';
import { getHealthStatus } from './index.js';

export interface AppOptions {
  pool?: pg.Pool;
  jwtSecret?: string;
  logger?: boolean;
  redisSubscriber?: Redis;
  wsHub?: SubastaWsHub;
}

export function buildApp(options: AppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? false
  });

  const pool = options.pool ?? getPool();
  const jwtSecret =
    options.jwtSecret ??
    process.env.JWT_SECRET ??
    'ganadito_super_secret_local_dev_key_32_chars_min';

  // Preservar rawBody para validación criptográfica de firmas HMAC
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (req, body, done) => {
      (req as any).rawBody = body;
      try {
        const json =
          typeof body === 'string' && body.trim().length > 0
            ? JSON.parse(body)
            : {};
        done(null, json);
      } catch (err: any) {
        err.statusCode = 400;
        done(err, undefined);
      }
    }
  );

  // Registrar plugin oficial de WebSockets
  app.register(fastifyWebsocket);

  // Registrar plugin oficial de JWT
  app.register(fastifyJwt, {
    secret: jwtSecret
  });

  // Ruta base de Health Check
  app.get('/health', async () => {
    return getHealthStatus();
  });

  // Registrar rutas de autenticación y RBAC dual
  app.register(authRoutes, {
    prefix: '/api/v1/auth',
    pool
  });

  // Registrar rutas geoespaciales de mapa y establecimientos
  app.register(mapaRoutes, {
    prefix: '/api/v1',
    pool
  });

  // Registrar rutas comerciales de cotizaciones en Pizarra Spot
  app.register(spotRoutes, {
    prefix: '/api/v1',
    pool
  });

  // Registrar motor transaccional de subastas en vivo (REST)
  app.register(subastasRoutes, {
    prefix: '/api/v1',
    pool
  });

  // Registrar difusión WebSocket de subastas en vivo (WebSockets)
  app.register(subastasWsRoutes, {
    prefix: '/api/v1',
    subscriber: options.redisSubscriber,
    hub: options.wsHub
  });

  // Registrar módulo financiero de pagos y webhooks de pasarelas
  app.register(pagosRoutes, {
    prefix: '/api/v1/pagos',
    pool
  });

  // Registrar ciclo de entrega y liquidaciones de órdenes de compra
  app.register(ordenesRoutes, {
    prefix: '/api/v1/ordenes',
    pool
  });

  // Registrar módulo de trazabilidad bovina y pasaporte digital inmutable
  app.register(trazabilidadRoutes, {
    prefix: '/api/v1/trazabilidad',
    pool
  });

  return app;
}
