import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';import { CurrentUser } from '../auth/current-user.decorator';import type { RequestUser } from '../common/request-user';import { LiveService } from './live.service';
@Controller('live') @UseGuards(AuthGuard)
export class LiveController{constructor(private readonly live:LiveService){} @Get('poll') poll(@CurrentUser() u:RequestUser,@Query('after') after?:string){const n=after===undefined?undefined:Number(after);return this.live.poll(u,n)}}
