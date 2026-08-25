import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MatchingModule } from '../matching/matching.module';
import { LocationModule } from '../locations/location.module';
import { CargoController } from './cargo.controller';
import { CargoService } from './cargo.service';
import { VerificationModule } from '../verification/verification.module';

@Module({
  imports: [AuthModule, MatchingModule, LocationModule, VerificationModule],
  controllers: [CargoController],
  providers: [CargoService],
  exports: [CargoService],
})
export class CargoModule {}
