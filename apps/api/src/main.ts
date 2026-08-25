import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { DatabaseService } from './database/database.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const database = app.get(DatabaseService);

  const schema = await database.schemaReadiness();
  if (!schema.ok) {
    throw new Error(
      `Database schema is not ready. Expected ${schema.expectedMigration}; ` +
      `migrationApplied=${schema.migrationApplied}; missingTables=${schema.missingTables.join(',') || 'none'}. ` +
      `Run \"npm run db:migrate\" from the repository root before starting the API.`,
    );
  }

  const port = config.getOrThrow<number>('API_PORT');
  const origins = config.getOrThrow<string>('CORS_ORIGINS').split(',').map((v) => v.trim()).filter(Boolean);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.enableCors({ origin: origins, credentials: false, methods: ['GET','POST','PUT','PATCH','DELETE'], allowedHeaders: ['Content-Type','Authorization','Idempotency-Key'] });
  app.setGlobalPrefix('v1');
  app.enableShutdownHooks();
  await app.listen(port, '0.0.0.0');
  console.log(`CargoGo API v0.9.0 listening on :${port}`);
}

bootstrap().catch((error: unknown) => {
  console.error('Fatal bootstrap error', error);
  process.exit(1);
});
