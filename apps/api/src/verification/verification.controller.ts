import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../common/request-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { devResolveVerificationSchema,startVerificationSchema,submitDriverLicenseSchema,submitIdentitySchema,submitVehicleVerificationSchema,verificationVehicleIdSchema } from './verification.schemas';
import { VerificationService } from './verification.service';

@Controller('verification') @UseGuards(AuthGuard)
export class VerificationController{
  constructor(private readonly verification:VerificationService){}
  @Get('me') mine(@CurrentUser()u:RequestUser){return this.verification.mine(u)}
  @Post('identity/submit') submitIdentity(@CurrentUser()u:RequestUser,@Body(new ZodValidationPipe(submitIdentitySchema))b:any){return this.verification.submitIdentity(u,b)}
  @Post('driver-license/submit') submitLicense(@CurrentUser()u:RequestUser,@Body(new ZodValidationPipe(submitDriverLicenseSchema))b:any){return this.verification.submitDriverLicense(u,b)}
  @Post('vehicles/:id/submit') submitVehicle(@CurrentUser()u:RequestUser,@Param('id',new ZodValidationPipe(verificationVehicleIdSchema))id:string,@Body(new ZodValidationPipe(submitVehicleVerificationSchema))b:any){return this.verification.submitVehicle(u,id,b)}
  // Old alpha endpoint remains for compatibility.
  @Post('start') start(@CurrentUser()u:RequestUser,@Body(new ZodValidationPipe(startVerificationSchema))b:any){return this.verification.start(u,b.documentKind)}
  @Post('dev/resolve') resolve(@CurrentUser()u:RequestUser,@Body(new ZodValidationPipe(devResolveVerificationSchema))b:any){return this.verification.devResolve(u,b)}
}
