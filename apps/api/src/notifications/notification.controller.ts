import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard'; import { CurrentUser } from '../auth/current-user.decorator'; import type { RequestUser } from '../common/request-user'; import { NotificationService } from './notification.service';
@Controller('notifications') @UseGuards(AuthGuard)
export class NotificationController { constructor(private readonly notifications:NotificationService){}
@Get() list(@CurrentUser() u:RequestUser,@Query('unread') unread?:string,@Query('archived') archived?:string){return this.notifications.list(u,unread==='1'||unread==='true',archived==='1'||archived==='true')}
@Get('unread-count') count(@CurrentUser() u:RequestUser){return this.notifications.unreadCount(u)}
@Post('push-token') token(@CurrentUser() u:RequestUser,@Body() body:any){return this.notifications.registerPushToken(u,String(body?.token??''),String(body?.platform??'unknown'))}
@Post('push-token/revoke') revoke(@CurrentUser() u:RequestUser,@Body() body:any){return this.notifications.revokePushToken(u,String(body?.token??''))}
@Post('read-all') all(@CurrentUser() u:RequestUser){return this.notifications.markAllRead(u)}
@Post('archive-read') archiveRead(@CurrentUser() u:RequestUser){return this.notifications.archiveRead(u)}
@Post(':id/read') read(@CurrentUser() u:RequestUser,@Param('id',ParseIntPipe) id:number){return this.notifications.markRead(u,id)}
@Post(':id/archive') archive(@CurrentUser() u:RequestUser,@Param('id',ParseIntPipe) id:number){return this.notifications.archive(u,id)}
@Post(':id/restore') restore(@CurrentUser() u:RequestUser,@Param('id',ParseIntPipe) id:number){return this.notifications.restore(u,id)} }
