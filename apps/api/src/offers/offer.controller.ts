import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../common/request-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { cargoIdSchema, createOfferSchema, offerIdSchema } from './offer.schemas';
import { OfferService } from './offer.service';

@Controller('offers')
@UseGuards(AuthGuard)
export class OfferController {
  constructor(private readonly offers:OfferService){}
  @Post() create(@CurrentUser() user:RequestUser,@Body(new ZodValidationPipe(createOfferSchema)) body:any){return this.offers.createOrReplace(user,body);}
  @Get('mine') mine(@CurrentUser() user:RequestUser){return this.offers.listSent(user);}
  @Get('cargo/:cargoId') forCargo(@CurrentUser() user:RequestUser,@Param('cargoId',new ZodValidationPipe(cargoIdSchema)) cargoId:string){return this.offers.listForCargo(user,cargoId);}
  @Post(':id/withdraw') withdraw(@CurrentUser() user:RequestUser,@Param('id',new ZodValidationPipe(offerIdSchema)) id:string){return this.offers.withdraw(user,id);}
  @Post(':id/reject') reject(@CurrentUser() user:RequestUser,@Param('id',new ZodValidationPipe(offerIdSchema)) id:string){return this.offers.reject(user,id);}
}
