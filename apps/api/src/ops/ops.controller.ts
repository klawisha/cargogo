import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';import { CurrentUser } from '../auth/current-user.decorator';import type { RequestUser } from '../common/request-user';import { OpsService } from './ops.service';
@Controller('ops') @UseGuards(AuthGuard)
export class OpsController{constructor(private readonly ops:OpsService){} @Post('client-error') error(@CurrentUser()u:RequestUser,@Body()b:any){return this.ops.reportClientError(u,b)} @Get('readiness') readiness(@CurrentUser()u:RequestUser){return this.ops.readiness(u)}}
