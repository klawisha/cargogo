import { BadRequestException, Body, Controller, Get, Param, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../common/request-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { acceptOfferSchema, cancelDealSchema, createReviewSchema, dealIdSchema, evidenceAccessSchema, handoverEvidenceUploadSchema, deliveryProblemSchema, handoverPresenceSchema, verifyDealCodeSchema } from './deal.schemas';
import { DealService } from './deal.service';
import { publicBaseUrl } from '../common/public-base-url';

@Controller('deals')
@UseGuards(AuthGuard)
export class DealController {
  constructor(private readonly deals: DealService) {}

  @Post('accept-offer')
  accept(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(acceptOfferSchema)) body: { offerId: string }) {
    return this.deals.acceptOffer(user, body.offerId);
  }

  @Get('mine')
  mine(@CurrentUser() user: RequestUser) { return this.deals.listMine(user); }

  @Post(':id/dev/secure-payment')
  devSecurePayment(@CurrentUser() user: RequestUser, @Param('id', new ZodValidationPipe(dealIdSchema)) id: string) {
    return this.deals.devSecurePayment(user, id);
  }


  @Post(':id/evidence/upload')
  @UseInterceptors(FileInterceptor('file',{limits:{fileSize:10*1024*1024,files:1,fields:8,parts:9}}))
  uploadEvidence(
    @CurrentUser() user: RequestUser,
    @Param('id', new ZodValidationPipe(dealIdSchema)) id: string,
    @UploadedFile() file: any,
    @Body(new ZodValidationPipe(handoverEvidenceUploadSchema)) body: {stage:'pickup'|'delivery';note?:string;latitude?:number;longitude?:number;accuracyMeters?:number;clientCapturedAt?:string;locationStatus?:'captured'|'permission_denied'|'unavailable'},
  ) {
    if (!file?.buffer) throw new BadRequestException({code:'EVIDENCE_FILE_REQUIRED',message:'Evidence photo was not received'});
    return this.deals.uploadHandoverEvidence(user,id,body,file);
  }

  @Post(':id/evidence/:evidenceId/access-url')
  evidenceAccess(
    @CurrentUser() user: RequestUser,
    @Param('id', new ZodValidationPipe(dealIdSchema)) id: string,
    @Param('evidenceId', new ZodValidationPipe(dealIdSchema)) evidenceId: string,
    @Body(new ZodValidationPipe(evidenceAccessSchema)) body: {purpose:string},
    @Req() req: Request,
  ) { return this.deals.handoverEvidenceAccess(user,id,evidenceId,body.purpose,publicBaseUrl(req)); }

  @Post(':id/pickup/confirm')
  confirmPickup(@CurrentUser() user: RequestUser, @Param('id', new ZodValidationPipe(dealIdSchema)) id: string, @Body(new ZodValidationPipe(verifyDealCodeSchema)) body: { code: string }) {
    return this.deals.confirmPickup(user, id, body.code);
  }

  @Post(':id/transit/start')
  startTransit(@CurrentUser() user: RequestUser, @Param('id', new ZodValidationPipe(dealIdSchema)) id: string) {
    return this.deals.startTransit(user, id);
  }

  @Post(':id/arrive')
  arrive(@CurrentUser() user: RequestUser, @Param('id', new ZodValidationPipe(dealIdSchema)) id: string) {
    return this.deals.markArrived(user, id);
  }

  @Post(':id/handover/recipient-present')
  recipientPresent(@CurrentUser() user: RequestUser, @Param('id', new ZodValidationPipe(dealIdSchema)) id: string, @Body(new ZodValidationPipe(handoverPresenceSchema)) body: any) {
    return this.deals.markRecipientPresent(user,id,body);
  }

  @Post(':id/handover/start')
  startHandover(@CurrentUser() user: RequestUser, @Param('id', new ZodValidationPipe(dealIdSchema)) id: string) {
    return this.deals.startHandoverSession(user,id);
  }

  @Post(':id/delivery/report-problem')
  reportDeliveryProblem(
    @CurrentUser() user: RequestUser,
    @Param('id', new ZodValidationPipe(dealIdSchema)) id: string,
    @Body(new ZodValidationPipe(deliveryProblemSchema)) body: {
      reason:'recipient_refuses_code'|'recipient_claims_damage'|'recipient_unavailable'|'other';
      note:string; latitude?:number; longitude?:number; accuracyMeters?:number; locationCapturedAt?:string;
      locationStatus:'captured'|'permission_denied'|'unavailable';
    },
  ) { return this.deals.reportDeliveryProblem(user,id,body); }

  @Post(':id/delivery/confirm')
  confirmDelivery(@CurrentUser() user: RequestUser, @Param('id', new ZodValidationPipe(dealIdSchema)) id: string, @Body(new ZodValidationPipe(verifyDealCodeSchema)) body: { code: string }) {
    return this.deals.confirmDelivery(user, id, body.code);
  }

  @Post(':id/reviews')
  review(@CurrentUser() user: RequestUser, @Param('id', new ZodValidationPipe(dealIdSchema)) id: string, @Body(new ZodValidationPipe(createReviewSchema)) body: { rating: number; comment?: string }) {
    return this.deals.createReview(user, id, body);
  }

  @Get(':id/reviews')
  reviews(@CurrentUser() user: RequestUser, @Param('id', new ZodValidationPipe(dealIdSchema)) id: string) {
    return this.deals.listReviews(user, id);
  }

  @Get(':id')
  get(@CurrentUser() user: RequestUser, @Param('id', new ZodValidationPipe(dealIdSchema)) id: string) {
    return this.deals.getMine(user, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: RequestUser, @Param('id', new ZodValidationPipe(dealIdSchema)) id: string, @Body(new ZodValidationPipe(cancelDealSchema)) body: { reason: string }) {
    return this.deals.cancelAwaitingPayment(user, id, body.reason);
  }
}
