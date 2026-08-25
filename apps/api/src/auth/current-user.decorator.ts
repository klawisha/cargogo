import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestUser } from '../common/request-user';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestUser => {
  return ctx.switchToHttp().getRequest<{ user: RequestUser }>().user;
});
