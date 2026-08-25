import { Body,Controller,Delete,Get,Post,UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard'; import { CurrentUser } from '../auth/current-user.decorator'; import type { RequestUser } from '../common/request-user'; import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { upsertPayoutAccountSchema } from './payout-account.schemas'; import { PayoutAccountService } from './payout-account.service';
@Controller('payout-accounts') @UseGuards(AuthGuard)
export class PayoutAccountController{constructor(private readonly service:PayoutAccountService){} @Get('me') get(@CurrentUser() u:RequestUser){return this.service.getMine(u)} @Post('me') upsert(@CurrentUser()u:RequestUser,@Body(new ZodValidationPipe(upsertPayoutAccountSchema))body:{holderName:string;iban:string}){return this.service.upsert(u,body)} @Delete('me') disable(@CurrentUser()u:RequestUser){return this.service.disable(u)}}
