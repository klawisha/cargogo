import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../common/request-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { createVehicleSchema } from './vehicle.schemas';
import { VehicleService } from './vehicle.service';

@Controller('vehicles')
@UseGuards(AuthGuard)
export class VehicleController {
  constructor(private readonly vehicles: VehicleService) {}

  @Get('mine')
  mine(@CurrentUser() user: RequestUser) {
    return this.vehicles.listMine(user);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(createVehicleSchema)) body: any) {
    return this.vehicles.create(user, body);
  }
}
