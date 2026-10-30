import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { Pool } = pg;

let poolInstance: pg.Pool | null = null;

export interface DatabaseConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

/**
 * Obtiene la configuración de conexión leyendo variables de entorno.
 */
export function getDatabaseConfig(): DatabaseConfig {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString) {
    return {
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    };
  }

  return {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: Number(process.env.DATABASE_PORT ?? 5432),
    database: process.env.DATABASE_NAME ?? 'ganadito_dev',
    user: process.env.DATABASE_USER ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? 'postgres_local_password',
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  };
}

/**
 * Singleton de conexión Pool a PostgreSQL.
 */
export function getPool(configOverride?: DatabaseConfig): pg.Pool {
  if (!poolInstance) {
    const config = configOverride ?? getDatabaseConfig();
    poolInstance = new Pool(config);

    poolInstance.on('error', (err: Error) => {
      // Manejo preventivo de desconexiones o errores de red en el pool
      console.error('Error imprevisto en el cliente PostgreSQL del pool:', err);
    });
  }

  return poolInstance;
}

/**
 * Cierra ordenadamente el pool de conexiones (útil en tests o apagado graceful).
 */
export async function closePool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}

/**
 * Ejecutor de la migración SQL canónica inicial de Ganadito.
 */
export async function runInitialMigration(sqlPathOverride?: string): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    let sqlPath = sqlPathOverride;

    if (!sqlPath) {
      // Ubicar infrastructure/database/migrations/0001_initial_schema.sql relativo a la raíz
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      const candidatePaths = [
        path.resolve(currentDir, '../../../infrastructure/database/migrations/0001_initial_schema.sql'),
        path.resolve(process.cwd(), 'infrastructure/database/migrations/0001_initial_schema.sql'),
        path.resolve(process.cwd(), '../../infrastructure/database/migrations/0001_initial_schema.sql')
      ];

      for (const candidate of candidatePaths) {
        if (fs.existsSync(candidate)) {
          sqlPath = candidate;
          break;
        }
      }
    }

    if (!sqlPath || !fs.existsSync(sqlPath)) {
      throw new Error(`No se encontró el archivo de migración en las rutas esperadas.`);
    }

    const ddl = fs.readFileSync(sqlPath, 'utf8');

    await client.query('BEGIN');
    await client.query(ddl);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
