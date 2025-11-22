import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pool, testConnection } from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function migrate() {
  console.log('🔄 Running chain and cooldown migration...');

  try {
    // Test connection first
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Failed to connect to database');
    }

    // Read migration SQL
    const migrationPath = join(__dirname, 'migrations', 'add-chain-and-cooldown.sql');
    const migrationSql = readFileSync(migrationPath, 'utf-8');

    // Execute migration
    await pool.query(migrationSql);

    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
