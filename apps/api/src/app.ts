import Fastify, { type FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import type pg from 'pg';
import { getPool } from './db.js';
import { authRoutes } from './auth/auth.routes.js';
import { mapaRoutes } from './mapa/mapa.routes.js';
import { spotRoutes } from './spot/spot.routes.js';
import { getHealthStatus } from './index.js';

export interface AppOptions {
  pool?: pg.Pool;
  jwtSecret?: string;
  logger?: boolean;
}

export function buildApp(options: AppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? false
  });

  const pool = options.pool ?? getPool();
  const jwtSecret = options.jwtSecret ?? process.env.JWT_SECRET ?? 'ganadito_super_secret_local_dev_key_32_chars_min';

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

  return app;
}
