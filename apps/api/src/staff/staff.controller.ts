import { Body, Controller, ForbiddenException, Get, Header, Param, Patch, Post, StreamableFile, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../common/request-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { StaffService } from './staff.service';
import { CarrierModeService } from '../carrier-mode/carrier-mode.service';
import { StaffFinanceService } from './staff-finance.service';

const expenseSchema=z.object({incurredOn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),category:z.enum(['infrastructure','maps','payments','developer_accounts','software','marketing','legal_accounting','equipment','refund_loss','other']),description:z.string().trim().min(2).max(240),amountMinor:z.number().int().positive().max(100_000_000),currency:z.enum(['UAH','USD','EUR']).default('UAH'),reference:z.string().trim().max(240).optional()});

const professionalDecisionSchema=z.object({decision:z.enum(['verified','rejected']),note:z.string().trim().min(3).max(1000)});

@Controller('staff')
@UseGuards(AuthGuard)
export class StaffController {
  constructor(private readonly staff: StaffService,private readonly carrierMode:CarrierModeService,private readonly finance:StaffFinanceService) {}
  @Get('overview') overview(@CurrentUser() user: RequestUser) { return this.staff.overview(user); }
  @Get('professional-carriers') professionalCarriers(@CurrentUser() user:RequestUser){this.assertProfessionalReviewer(user);return this.carrierMode.listProfessionalPending();}
  @Patch('professional-carriers/:userId') reviewProfessional(@CurrentUser() user:RequestUser,@Param('userId') userId:string,@Body(new ZodValidationPipe(professionalDecisionSchema)) body:z.infer<typeof professionalDecisionSchema>){this.assertProfessionalReviewer(user);return this.carrierMode.reviewProfessional(user.id,userId,body.decision,body.note);}
  @Get('finance') financeDashboard(@CurrentUser() user:RequestUser){return this.finance.dashboard(user);}
  @Get('finance/report.csv') @Header('Content-Type','text/csv; charset=utf-8') @Header('Content-Disposition','attachment; filename="cargogo-finance-report.csv"') financeReport(@CurrentUser()user:RequestUser){return this.finance.exportCsv(user);}
  @Get('finance/report.xlsx') @Header('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') @Header('Content-Disposition','attachment; filename="cargogo-finance-report.xlsx"') async financeXlsx(@CurrentUser()user:RequestUser){return new StreamableFile(await this.finance.exportXlsx(user));}
  @Get('finance/expenses') financeExpenses(@CurrentUser()user:RequestUser){return this.finance.listExpenses(user);}
  @Post('finance/expenses') addFinanceExpense(@CurrentUser()user:RequestUser,@Body(new ZodValidationPipe(expenseSchema))body:any){return this.finance.addExpense(user,body);}
  @Get('payout-issues') payoutIssues(@CurrentUser() user: RequestUser) { return this.staff.payoutIssues(user); }
  private assertProfessionalReviewer(user:RequestUser){if(!['reviewer','verification_reviewer','admin'].includes(user.staffRole??''))throw new ForbiddenException({code:'PROFESSIONAL_REVIEWER_REQUIRED',message:'Professional carrier review permission required'});}
}
