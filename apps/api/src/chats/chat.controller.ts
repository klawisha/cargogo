import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../common/request-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { beforeIdSchema, dealIdSchema, sendMessageSchema } from './chat.schemas';
import { ChatService } from './chat.service';

@Controller('chats')
@UseGuards(AuthGuard)
export class ChatController{
  constructor(private readonly chats:ChatService){}
  @Get() list(@CurrentUser() user:RequestUser){return this.chats.listMine(user);}
  @Get(':dealId/state') state(@CurrentUser() user:RequestUser,@Param('dealId',new ZodValidationPipe(dealIdSchema)) dealId:string){return this.chats.chatState(user,dealId);}
  @Get(':dealId/messages') messages(@CurrentUser() user:RequestUser,@Param('dealId',new ZodValidationPipe(dealIdSchema)) dealId:string,@Query('beforeId',new ZodValidationPipe(beforeIdSchema)) beforeId?:number){return this.chats.messages(user,dealId,beforeId);}
  @Post(':dealId/messages') send(@CurrentUser() user:RequestUser,@Param('dealId',new ZodValidationPipe(dealIdSchema)) dealId:string,@Body(new ZodValidationPipe(sendMessageSchema)) body:any){return this.chats.send(user,dealId,body.body);}
}
