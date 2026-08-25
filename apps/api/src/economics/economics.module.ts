import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EconomicsController } from './economics.controller';
import { EconomicsService } from './economics.service';

@Module({ imports: [AuthModule], controllers: [EconomicsController], providers: [EconomicsService], exports: [EconomicsService] })
export class EconomicsModule {}
