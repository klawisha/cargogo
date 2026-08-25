import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../common/request-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { cargoIdSchema, createCargoSchema, updateCargoSchema } from './cargo.schemas';
import { CargoService } from './cargo.service';

@Controller('cargo')
@UseGuards(AuthGuard)
export class CargoController {
  constructor(private readonly cargo: CargoService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(createCargoSchema)) body: any) { return this.cargo.create(user, body); }

  @Get('mine')
  mine(@CurrentUser() user: RequestUser) { return this.cargo.listMine(user); }

  @Get('discover')
  discover(@CurrentUser() user: RequestUser, @Query('limit') limit?: string) { return this.cargo.discover(user, Number(limit ?? 50)); }

  @Get(':id')
  getMine(@CurrentUser() user: RequestUser, @Param('id', new ZodValidationPipe(cargoIdSchema)) id: string) { return this.cargo.getMine(user, id); }

  @Patch(':id')
  update(@CurrentUser() user: RequestUser, @Param('id', new ZodValidationPipe(cargoIdSchema)) id: string, @Body(new ZodValidationPipe(updateCargoSchema)) body: any) { return this.cargo.update(user, id, body); }

  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id', new ZodValidationPipe(cargoIdSchema)) id: string) { return this.cargo.remove(user, id); }

  @Post(':id/publish')
  publish(@CurrentUser() user: RequestUser, @Param('id', new ZodValidationPipe(cargoIdSchema)) id: string) { return this.cargo.publish(user, id); }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: RequestUser, @Param('id', new ZodValidationPipe(cargoIdSchema)) id: string) { return this.cargo.cancel(user, id); }
}
