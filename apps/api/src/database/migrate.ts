import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { config } from 'dotenv';

function resolveRepositoryRoot() {
  const cwd = process.cwd();
  if (cwd.endsWith(path.join('apps', 'api'))) return path.resolve(cwd, '../..');
  return cwd;
}

async function main() {
  const root = resolveRepositoryRoot();
  const envPath = path.join(root, '.env');
  config({ path: envPath });
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error(`DATABASE_URL missing; expected ${envPath}`);

  const pool = new Pool({ connectionString });
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS schema_migration(name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    const dir = path.join(root, 'infra/postgres/migrations');
    const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      const applied = await pool.query('SELECT 1 FROM schema_migration WHERE name=$1', [file]);
      if (applied.rowCount) {
        console.log(`Already applied ${file}`);
        continue;
      }
      const sql = await readFile(path.join(dir, file), 'utf8');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migration(name) VALUES($1)', [file]);
        await client.query('COMMIT');
        console.log(`Applied ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
    const latest = await pool.query<{ name: string; applied_at: string }>('SELECT name,applied_at FROM schema_migration ORDER BY name DESC LIMIT 1');
    console.log(`Schema ready. Latest migration: ${latest.rows[0]?.name ?? 'none'}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
