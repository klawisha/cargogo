import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { NotificationModule } from '../notifications/notification.module';
@Module({imports:[AuthModule,NotificationModule],controllers:[ChatController],providers:[ChatService],exports:[ChatService]})
export class ChatModule{}
