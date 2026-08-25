import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../common/request-user';
import { PaymentService } from './payment.service';

@Controller('payments')
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  @Post('deals/:dealId/checkout')
  @UseGuards(AuthGuard)
  checkout(@CurrentUser() user: RequestUser, @Param('dealId') dealId: string) {
    return this.payments.createCheckout(user, dealId);
  }

  @Post('deals/:dealId/sync')
  @UseGuards(AuthGuard)
  sync(@CurrentUser() user: RequestUser, @Param('dealId') dealId: string) {
    return this.payments.syncDeal(user, dealId);
  }

  @Get('liqpay/checkout/:paymentId')
  async checkoutPage(@Param('paymentId') paymentId: string, @Query('token') token: string, @Res() res: any) {
    const html = await this.payments.checkoutHtml(paymentId, token);
    res.type('html').send(html);
  }

  @Get('liqpay/result/:paymentId')
  async resultPage(@Param('paymentId') paymentId: string, @Query('token') token: string, @Res() res: any) {
    const html = await this.payments.resultHtml(paymentId, token);
    res.type('html').send(html);
  }

  @Post('liqpay/callback')
  callback(@Body() body: { data?: string; signature?: string }) {
    return this.payments.callback(body);
  }
}
