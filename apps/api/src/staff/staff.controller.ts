import { Body, Controller, ForbiddenException, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../common/request-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { StaffService } from './staff.service';
import { CarrierModeService } from '../carrier-mode/carrier-mode.service';
import { StaffFinanceService } from './staff-finance.service';

const professionalDecisionSchema=z.object({decision:z.enum(['verified','rejected']),note:z.string().trim().min(3).max(1000)});

@Controller('staff')
@UseGuards(AuthGuard)
export class StaffController {
  constructor(private readonly staff: StaffService,private readonly carrierMode:CarrierModeService,private readonly finance:StaffFinanceService) {}
  @Get('overview') overview(@CurrentUser() user: RequestUser) { return this.staff.overview(user); }
  @Get('professional-carriers') professionalCarriers(@CurrentUser() user:RequestUser){this.assertProfessionalReviewer(user);return this.carrierMode.listProfessionalPending();}
  @Patch('professional-carriers/:userId') reviewProfessional(@CurrentUser() user:RequestUser,@Param('userId') userId:string,@Body(new ZodValidationPipe(professionalDecisionSchema)) body:z.infer<typeof professionalDecisionSchema>){this.assertProfessionalReviewer(user);return this.carrierMode.reviewProfessional(user.id,userId,body.decision,body.note);}
  @Get('finance') financeDashboard(@CurrentUser() user:RequestUser){return this.finance.dashboard(user);}
  @Get('payout-issues') payoutIssues(@CurrentUser() user: RequestUser) { return this.staff.payoutIssues(user); }
  private assertProfessionalReviewer(user:RequestUser){if(!['reviewer','verification_reviewer','admin'].includes(user.staffRole??''))throw new ForbiddenException({code:'PROFESSIONAL_REVIEWER_REQUIRED',message:'Professional carrier review permission required'});}
}
