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
 * Ejecutor de las migraciones SQL canónicas de Ganadito (0001 a 0009) en orden secuencial.
 */
export async function runInitialMigration(sqlPathOverride?: string): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    if (sqlPathOverride) {
      const ddl = fs.readFileSync(sqlPathOverride, 'utf8');
      await client.query('BEGIN');
      await client.query(ddl);
      await client.query('COMMIT');
      return;
    }

    // Ubicar directorio de migraciones relativo a la raíz o workspace
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const candidateDirs = [
      path.resolve(currentDir, '../../../infrastructure/database/migrations'),
      path.resolve(process.cwd(), 'infrastructure/database/migrations'),
      path.resolve(process.cwd(), '../../infrastructure/database/migrations')
    ];

    let migrationsDir: string | null = null;
    for (const candidate of candidateDirs) {
      if (fs.existsSync(candidate)) {
        migrationsDir = candidate;
        break;
      }
    }

    if (!migrationsDir) {
      throw new Error(`No se encontró el directorio de migraciones en las rutas esperadas.`);
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    await client.query('BEGIN');
    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const ddl = fs.readFileSync(filePath, 'utf8');
      await client.query(ddl);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
