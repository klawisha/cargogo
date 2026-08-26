import { BadRequestException, Body, Controller, Get, Headers, Ip, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../common/request-user';
import { LegalService } from './legal.service';

@Controller('legal')
export class LegalController{
 constructor(private readonly legal:LegalService){}
 @Get('documents') list(){return this.legal.list()}
 @Get('documents/:key') get(@Param('key') key:string){return this.legal.get(key)}
 @UseGuards(AuthGuard) @Get('me') status(@CurrentUser() u:RequestUser){return this.legal.status(u)}
 @UseGuards(AuthGuard) @Post('accept/:key') accept(@CurrentUser()u:RequestUser,@Param('key')key:string,@Body()body:any,@Headers('user-agent')ua:string|undefined,@Ip()ip:string){return this.legal.accept(u,key,String(body?.version??''),{ip,userAgent:ua})}
 @UseGuards(AuthGuard) @Post('privacy-requests') privacy(@CurrentUser()u:RequestUser,@Body()body:any){return this.legal.createPrivacyRequest(u,String(body?.type??''),body?.note,body?.details)}
 @UseGuards(AuthGuard) @Get('privacy-requests/me') myPrivacy(@CurrentUser()u:RequestUser){return this.legal.myPrivacyRequests(u)}
 @UseGuards(AuthGuard) @Get('privacy-requests/staff') staffPrivacy(@CurrentUser()u:RequestUser){return this.legal.staffPrivacyRequests(u)}
 @UseGuards(AuthGuard) @Patch('privacy-requests/:id') resolvePrivacy(@CurrentUser()u:RequestUser,@Param('id')id:string,@Body()b:any){const status=String(b?.status??'');if(!['in_review','completed','rejected'].includes(status))throw new BadRequestException({code:'PRIVACY_STATUS_INVALID',message:'Unsupported privacy request status'});return this.legal.updatePrivacyRequest(u,id,status as 'in_review'|'completed'|'rejected',String(b?.reviewerNote??b?.note??''))}
}
