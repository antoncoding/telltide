import pg from 'pg';
import { config } from '../config/index.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.database.url,
});

export const query = async <T = unknown>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> => {
  const start = Date.now();
  const res = await pool.query<T>(text, params);
  const duration = Date.now() - start;

  if (config.logging.level === 'debug') {
    console.log('Executed query', { text, duration, rows: res.rowCount });
  }

  return res;
};

export const getClient = async (): Promise<pg.PoolClient> => {
  return pool.connect();
};

// Test connection
export const testConnection = async (): Promise<boolean> => {
  try {
    const result = await query('SELECT NOW()');
    console.log('✅ Database connected:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
};
