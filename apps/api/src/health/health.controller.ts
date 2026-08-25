import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Controller('health')
export class HealthController {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  @Get('live')
  live() {
    return { status: 'ok', service: 'cargogo-api', version: '0.5.1' };
  }

  @Get('ready')
  async ready() {
    try {
      const database = await this.database.ping();
      const schema = await this.database.schemaReadiness();
      if (!database || !schema.ok) {
        throw new ServiceUnavailableException({
          status: 'not_ready',
          database: database ? 'up' : 'down',
          schema,
          action: 'Run npm run db:migrate from the repository root.',
        });
      }
      return { status: 'ok', database: 'up', schema };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException({ status: 'not_ready', database: 'down', message: 'Database readiness check failed' });
    }
  }
}
