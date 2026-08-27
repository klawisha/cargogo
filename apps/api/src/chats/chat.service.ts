import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { RequestUser } from '../common/request-user';
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class ChatService{
  constructor(@Inject(DatabaseService) private readonly db:DatabaseService,private readonly notifications:NotificationService){}

  private paymentUnlocked(row:any){return ['secured','captured','released'].includes(String(row.payment_status??''));}

  private state(row:any){
    const completedAt=(row.delivery_verified_at??row.completed_at)?new Date(row.delivery_verified_at??row.completed_at):null;
    const closesAt=completedAt?new Date(completedAt.getTime()+24*60*60*1000):null;
    const terminal=['cancelled','refunded'].includes(row.status);
    const expired=!!closesAt&&closesAt.getTime()<=Date.now();
    const paymentUnlocked=this.paymentUnlocked(row);
    return{paymentUnlocked,readOnly:!paymentUnlocked||terminal||expired,closesAt:closesAt?.toISOString()??null,archived:terminal||expired};
  }

  async listMine(user:RequestUser){
    const r=await this.db.query<any>(`SELECT dc.deal_id,d.status,d.payment_status,d.completed_at,d.delivery_verified_at,d.sender_id,d.driver_id,c.title AS cargo_title,
      sender.display_name AS sender_name,driver.display_name AS driver_name,
      lm.id AS last_message_id,lm.body AS last_message_body,lm.created_at AS last_message_at
      FROM deal_conversation dc JOIN deal d ON d.id=dc.deal_id JOIN cargo c ON c.id=d.cargo_id
      JOIN app_user sender ON sender.id=d.sender_id JOIN app_user driver ON driver.id=d.driver_id
      LEFT JOIN LATERAL (SELECT id,body,created_at FROM deal_message WHERE conversation_id=dc.id ORDER BY id DESC LIMIT 1) lm ON true
      WHERE (d.sender_id=$1 OR d.driver_id=$1) AND d.payment_status IN ('secured','captured','released') ORDER BY COALESCE(lm.created_at,dc.created_at) DESC LIMIT 100`,[user.id]);
    return r.rows.map((x:any)=>({dealId:x.deal_id,dealStatus:x.status,cargoTitle:x.cargo_title,otherParty:{displayName:x.sender_id===user.id?x.driver_name:x.sender_name},lastMessage:x.last_message_id?{id:Number(x.last_message_id),body:x.last_message_body,createdAt:x.last_message_at}:null,...this.state(x)}));
  }

  async chatState(user:RequestUser,dealId:string){const conv=await this.requireConversation(user.id,dealId);return{dealStatus:conv.status,...this.state(conv)}}

  async messages(user:RequestUser,dealId:string,beforeId?:number){
    const conv=await this.requireConversation(user.id,dealId);
    const r=await this.db.query<any>(`SELECT m.id,m.sender_id,m.body,m.created_at,u.display_name FROM deal_message m JOIN app_user u ON u.id=m.sender_id
      WHERE m.conversation_id=$1 AND ($2::bigint IS NULL OR m.id<$2) ORDER BY m.id DESC LIMIT 50`,[conv.conversationId,beforeId??null]);
    return r.rows.reverse().map((x:any)=>({id:Number(x.id),senderId:x.sender_id,senderName:x.display_name,isMine:x.sender_id===user.id,body:x.body,createdAt:x.created_at}));
  }

  async send(user:RequestUser,dealId:string,body:string){
    return this.db.transaction(async(client)=>{
      const dealResult=await client.query<any>('SELECT id,sender_id,driver_id,status,payment_status,completed_at,delivery_verified_at FROM deal WHERE id=$1 FOR UPDATE',[dealId]);
      const deal=dealResult.rows[0];
      if(!deal)throw new NotFoundException({code:'DEAL_NOT_FOUND',message:'Deal not found'});
      if(deal.sender_id!==user.id&&deal.driver_id!==user.id)throw new ForbiddenException({code:'CHAT_FORBIDDEN',message:'Not your deal'});
      if(!this.paymentUnlocked(deal))throw new ConflictException({code:'CHAT_PAYMENT_REQUIRED',message:'Chat becomes available after payment is secured'});
      if(this.state(deal).readOnly)throw new ConflictException({code:'CHAT_READ_ONLY',message:'Chat closes 24 hours after completed delivery or immediately after cancellation/refund'});
      const conv=await client.query<{id:string}>('SELECT id FROM deal_conversation WHERE deal_id=$1',[dealId]);
      if(!conv.rows[0])throw new ConflictException({code:'CHAT_NOT_READY',message:'Conversation is not initialized'});
      const inserted=await client.query<any>(`INSERT INTO deal_message(conversation_id,sender_id,body) VALUES($1,$2,$3) RETURNING id,body,created_at`,[conv.rows[0].id,user.id,body]);
      const other=deal.sender_id===user.id?deal.driver_id:deal.sender_id;
      await this.notifications.pushTransient(other,`Нове повідомлення від ${user.displayName}`,body.length>120?`${body.slice(0,117)}…`:body,{type:'chat.message',entityType:'deal',entityId:dealId},client);
      return {id:Number(inserted.rows[0].id),senderId:user.id,senderName:user.displayName,isMine:true,body:inserted.rows[0].body,createdAt:inserted.rows[0].created_at};
    });
  }

  private async requireConversation(userId:string,dealId:string){
    const r=await this.db.query<any>(`SELECT dc.id AS conversation_id,d.sender_id,d.driver_id,d.status,d.payment_status,d.completed_at,d.delivery_verified_at FROM deal_conversation dc JOIN deal d ON d.id=dc.deal_id WHERE d.id=$1`,[dealId]);
    const row=r.rows[0];if(!row)throw new NotFoundException({code:'CHAT_NOT_FOUND',message:'Chat not found'});if(row.sender_id!==userId&&row.driver_id!==userId)throw new ForbiddenException({code:'CHAT_FORBIDDEN',message:'Not your deal'});if(!this.paymentUnlocked(row))throw new ConflictException({code:'CHAT_PAYMENT_REQUIRED',message:'Chat becomes available after payment is secured'});return {conversationId:row.conversation_id,status:row.status,payment_status:row.payment_status,completed_at:row.completed_at,delivery_verified_at:row.delivery_verified_at};
  }
}
