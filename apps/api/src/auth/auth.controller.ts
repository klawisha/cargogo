import { Body, Controller, Get, Headers, HttpCode, Ip, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { loginSchema, refreshSchema, registerSchema, type LoginInput, type RefreshInput, type RegisterInput } from './auth.schemas';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { RequestUser } from '../common/request-user';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body(new ZodValidationPipe(registerSchema)) body: RegisterInput, @Headers('user-agent') userAgent: string | undefined, @Ip() ip: string) {
    return this.auth.register(body, { userAgent, ip });
  }

  @HttpCode(200)
  @Post('login')
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput, @Headers('user-agent') userAgent: string | undefined, @Ip() ip: string) {
    return this.auth.login(body, { userAgent, ip });
  }

  @HttpCode(200)
  @Post('refresh')
  refresh(@Body(new ZodValidationPipe(refreshSchema)) body: RefreshInput, @Headers('user-agent') userAgent: string | undefined, @Ip() ip: string) {
    return this.auth.refresh(body.refreshToken, { userAgent, ip });
  }

  @UseGuards(AuthGuard)
  @HttpCode(200)
  @Post('logout')
  logout(@CurrentUser() user: RequestUser) { return this.auth.logout(user); }

  @UseGuards(AuthGuard)
  @HttpCode(200)
  @Post('logout-all')
  logoutAll(@CurrentUser() user: RequestUser) { return this.auth.logoutAll(user); }

  @UseGuards(AuthGuard)
  @Get('me')
  me(@CurrentUser() user: RequestUser) { return { user }; }
}
