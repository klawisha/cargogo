import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VehicleModule } from '../vehicles/vehicle.module';
import { MatchingModule } from '../matching/matching.module';
import { RoutingModule } from '../routing/routing.module';
import { LocationModule } from '../locations/location.module';
import { TripController } from './trip.controller';
import { TripService } from './trip.service';
import { VerificationModule } from '../verification/verification.module';

@Module({
  imports:[AuthModule,VehicleModule,MatchingModule,RoutingModule,LocationModule,VerificationModule],
  controllers:[TripController],
  providers:[TripService],
  exports:[TripService],
})
export class TripModule {}
