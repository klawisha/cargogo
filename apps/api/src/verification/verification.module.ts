import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { ManualVerificationController } from './manual-verification.controller';
import { ManualVerificationService } from './manual-verification.service';
import { VerificationStorageService } from './verification-storage.service';
@Module({imports:[AuthModule],controllers:[VerificationController,ManualVerificationController],providers:[VerificationService,ManualVerificationService,VerificationStorageService],exports:[VerificationService,VerificationStorageService]})
export class VerificationModule{}
