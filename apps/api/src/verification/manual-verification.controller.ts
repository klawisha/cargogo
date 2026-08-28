import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';import { CurrentUser } from '../auth/current-user.decorator';import type { RequestUser } from '../common/request-user';import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ManualVerificationService } from './manual-verification.service';import { documentAccessSchema,multipartVerificationUploadSchema,reviewDecisionSchema,uuidSchema } from './manual-verification.schemas';
import { publicBaseUrl } from '../common/public-base-url';
@Controller('verification') @UseGuards(AuthGuard)
export class ManualVerificationController{
 constructor(private readonly manual:ManualVerificationService){}
 @Post('documents/upload') @UseInterceptors(FileInterceptor('file',{limits:{fileSize:10*1024*1024,files:1,fields:4,parts:5}}))
 upload(@CurrentUser()u:RequestUser,@UploadedFile()file:any,@Body(new ZodValidationPipe(multipartVerificationUploadSchema))b:any){
   if(!file?.buffer)throw new BadRequestException({code:'VERIFICATION_FILE_REQUIRED',message:'Verification file was not received'});
   return this.manual.uploadDocument(u,b,file);
 }
 @Get('documents') mine(@CurrentUser()u:RequestUser){return this.manual.listMine(u)}
 @Delete('documents/:id') remove(@CurrentUser()u:RequestUser,@Param('id',new ZodValidationPipe(uuidSchema))id:string){return this.manual.removeMine(u,id)}
 @Get('review/queue') queue(@CurrentUser()u:RequestUser,@Query('limit')limit?:string){return this.manual.queue(u,Number(limit??50))}
 @Post('review/:id/claim') claim(@CurrentUser()u:RequestUser,@Param('id',new ZodValidationPipe(uuidSchema))id:string){return this.manual.claim(u,id)}
 @Get('review/:id') detail(@CurrentUser()u:RequestUser,@Param('id',new ZodValidationPipe(uuidSchema))id:string){return this.manual.reviewDetail(u,id)}
 @Post('review/:caseId/documents/:documentId/access-url') access(@CurrentUser()u:RequestUser,@Param('caseId',new ZodValidationPipe(uuidSchema))caseId:string,@Param('documentId',new ZodValidationPipe(uuidSchema))documentId:string,@Body(new ZodValidationPipe(documentAccessSchema))b:any,@Req()req:Request){return this.manual.documentAccess(u,caseId,documentId,b.purpose,publicBaseUrl(req))}
 @Post('review/:id/decision') decision(@CurrentUser()u:RequestUser,@Param('id',new ZodValidationPipe(uuidSchema))id:string,@Body(new ZodValidationPipe(reviewDecisionSchema))b:any){return this.manual.decide(u,id,b)}
 @Post('review/purge-expired') purge(@CurrentUser()u:RequestUser){return this.manual.purgeExpired(u)}
}
