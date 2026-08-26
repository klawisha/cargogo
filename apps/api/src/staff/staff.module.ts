import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { StaffFinanceService } from './staff-finance.service';

@Module({ imports: [AuthModule], controllers: [StaffController], providers: [StaffService,StaffFinanceService] })
export class StaffModule {}
