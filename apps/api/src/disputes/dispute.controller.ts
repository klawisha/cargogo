import { BadRequestException, Body, Controller, Get, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/auth.guard'; import { CurrentUser } from '../auth/current-user.decorator'; import type { RequestUser } from '../common/request-user'; import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { disputeAccessSchema,disputePhotoUploadSchema,disputeResolveSchema,evidenceSchema,openDisputeSchema } from './dispute.schemas'; import { DisputeService } from './dispute.service';
@Controller('disputes') @UseGuards(AuthGuard) export class DisputeController{constructor(private readonly disputes:DisputeService){}
@Get('mine') mine(@CurrentUser()u:RequestUser){return this.disputes.mine(u)}
@Get('review/queue') queue(@CurrentUser()u:RequestUser){return this.disputes.reviewQueue(u)}
@Get('review/:id') review(@CurrentUser()u:RequestUser,@Param('id')id:string){return this.disputes.reviewDetail(u,id)}
@Post('review/:id/claim') claim(@CurrentUser()u:RequestUser,@Param('id')id:string){return this.disputes.claim(u,id)}
@Post('review/:id/resolve') resolveReview(@CurrentUser()u:RequestUser,@Param('id')id:string,@Body(new ZodValidationPipe(disputeResolveSchema))b:any){return this.disputes.resolveReview(u,id,b.winner,b.note)}
@Get('deal/:dealId') forDeal(@CurrentUser()u:RequestUser,@Param('dealId')dealId:string){return this.disputes.forDeal(u,dealId)}
@Get(':id') get(@CurrentUser()u:RequestUser,@Param('id')id:string){return this.disputes.get(u,id)}
@Post('deal/:dealId') open(@CurrentUser()u:RequestUser,@Param('dealId')dealId:string,@Body(new ZodValidationPipe(openDisputeSchema))b:any){return this.disputes.open(u,dealId,b)}
@Post(':id/evidence') evidence(@CurrentUser()u:RequestUser,@Param('id')id:string,@Body(new ZodValidationPipe(evidenceSchema))b:any){return this.disputes.addEvidence(u,id,b.text)}
@Post(':id/evidence/photo') @UseInterceptors(FileInterceptor('file',{limits:{fileSize:10*1024*1024,files:1,fields:2,parts:3}}))
photo(@CurrentUser()u:RequestUser,@Param('id')id:string,@UploadedFile()file:any,@Body(new ZodValidationPipe(disputePhotoUploadSchema))b:any){if(!file?.buffer)throw new BadRequestException({code:'DISPUTE_PHOTO_REQUIRED',message:'Photo was not received'});return this.disputes.addPhoto(u,id,b.note,file)}
@Post(':id/evidence/:evidenceId/access-url') access(@CurrentUser()u:RequestUser,@Param('id')id:string,@Param('evidenceId')evidenceId:string,@Body(new ZodValidationPipe(disputeAccessSchema))b:any){return this.disputes.evidenceAccess(u,id,Number(evidenceId),b.purpose)}
}