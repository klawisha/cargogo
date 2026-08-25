import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { REQUIRED_SCHEMA_MIGRATION, REQUIRED_TABLES, type SchemaReadiness } from './schema';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.pool = new Pool({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      allowExitOnIdle: false,
    });
  }

  query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, values);
  }

  async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async ping(): Promise<boolean> {
    const result = await this.pool.query<{ ok: number }>('SELECT 1 AS ok');
    return result.rows[0]?.ok === 1;
  }

  async schemaReadiness(): Promise<SchemaReadiness> {
    const migrationTable = await this.pool.query<{ table_name: string | null }>("SELECT to_regclass('public.schema_migration')::text AS table_name");
    if (!migrationTable.rows[0]?.table_name) {
      return { ok: false, expectedMigration: REQUIRED_SCHEMA_MIGRATION, migrationApplied: false, missingTables: [...REQUIRED_TABLES] };
    }

    const migration = await this.pool.query('SELECT 1 FROM schema_migration WHERE name=$1', [REQUIRED_SCHEMA_MIGRATION]);
    const tableChecks = await Promise.all(REQUIRED_TABLES.map(async (table) => {
      const result = await this.pool.query<{ table_name: string | null }>('SELECT to_regclass($1)::text AS table_name', [`public.${table}`]);
      return result.rows[0]?.table_name ? null : table;
    }));
    const missingTables = tableChecks.reduce<string[]>((missing, value) => {
      if (value !== null) missing.push(value);
      return missing;
    }, []);
    const migrationApplied = Boolean(migration.rowCount);
    return { ok: migrationApplied && missingTables.length === 0, expectedMigration: REQUIRED_SCHEMA_MIGRATION, migrationApplied, missingTables };
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
