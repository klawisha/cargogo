import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard'; import { CurrentUser } from '../auth/current-user.decorator'; import type { RequestUser } from '../common/request-user'; import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { createTripSchema,tripIdSchema,tripMatchQuerySchema,updateTripSchema } from './trip.schemas'; import { TripService } from './trip.service';
@Controller('trips') @UseGuards(AuthGuard) export class TripController{constructor(private readonly trips:TripService){}
 @Post() create(@CurrentUser()u:RequestUser,@Body(new ZodValidationPipe(createTripSchema))b:any){return this.trips.create(u,b)}
 @Get('mine') mine(@CurrentUser()u:RequestUser){return this.trips.listMine(u)}
 @Get('current') current(@CurrentUser()u:RequestUser){return this.trips.current(u)}
 @Get(':id') get(@CurrentUser()u:RequestUser,@Param('id',new ZodValidationPipe(tripIdSchema))id:string){return this.trips.getMine(u,id)}
 @Post(':id/current') setCurrent(@CurrentUser()u:RequestUser,@Param('id',new ZodValidationPipe(tripIdSchema))id:string){return this.trips.setCurrent(u,id)}
 @Patch(':id') update(@CurrentUser()u:RequestUser,@Param('id',new ZodValidationPipe(tripIdSchema))id:string,@Body(new ZodValidationPipe(updateTripSchema))b:any){return this.trips.update(u,id,b)}
 @Delete(':id') remove(@CurrentUser()u:RequestUser,@Param('id',new ZodValidationPipe(tripIdSchema))id:string){return this.trips.remove(u,id)}
 @Get(':id/matches') matches(@CurrentUser()u:RequestUser,@Param('id',new ZodValidationPipe(tripIdSchema))id:string,@Query(new ZodValidationPipe(tripMatchQuerySchema))q:any){return this.trips.matches(u,id,q)}
 @Post(':id/matches/refresh') refresh(@CurrentUser()u:RequestUser,@Param('id',new ZodValidationPipe(tripIdSchema))id:string){return this.trips.refreshMatches(u,id)}
 @Post(':id/cancel') cancel(@CurrentUser()u:RequestUser,@Param('id',new ZodValidationPipe(tripIdSchema))id:string){return this.trips.cancel(u,id)}
}
