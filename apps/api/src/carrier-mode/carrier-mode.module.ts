import { Global, Module } from '@nestjs/common';import { AuthModule } from '../auth/auth.module';import { CarrierModeController } from './carrier-mode.controller';import { CarrierModeService } from './carrier-mode.service';
@Global() @Module({imports:[AuthModule],controllers:[CarrierModeController],providers:[CarrierModeService],exports:[CarrierModeService]}) export class CarrierModeModule{}
