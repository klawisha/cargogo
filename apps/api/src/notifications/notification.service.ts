import { Inject, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import type { RequestUser } from '../common/request-user';

type NotifyInput={userId:string;type:string;title:string;body:string;entityType?:string;entityId?:string;metadata?:Record<string,unknown>};
type QueryExecutor={query:(text:string,values?:any[])=>Promise<any>};
@Injectable()
export class NotificationService implements OnModuleInit,OnModuleDestroy {
  private timer:NodeJS.Timeout|null=null;private readonly log=new Logger(NotificationService.name);private flushing=false;
  constructor(@Inject(DatabaseService) private readonly db:DatabaseService){}
  onModuleInit(){this.timer=setInterval(()=>{void this.flushPushOutbox()},5000);this.timer.unref?.()}
  onModuleDestroy(){if(this.timer)clearInterval(this.timer)}

  async create(input:NotifyInput, client?:PoolClient){
    const q:QueryExecutor=client??this.db;
    const r=await q.query(`INSERT INTO user_notification(user_id,type,title,body,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING id`,[input.userId,input.type,input.title,input.body,input.entityType??null,input.entityId??null,JSON.stringify(input.metadata??{})]);
    const notificationId=Number(r.rows[0].id);
    await q.query(`INSERT INTO push_delivery_outbox(user_id,notification_id,title,body,data) VALUES($1,$2,$3,$4,$5::jsonb)`,[input.userId,notificationId,input.title,input.body,JSON.stringify({type:input.type,entityType:input.entityType??null,entityId:input.entityId??null,...(input.metadata??{})})]);
    return{notificationId};
  }
  async pushTransient(userId:string,title:string,body:string,data:Record<string,unknown>,client?:PoolClient){const q:QueryExecutor=client??this.db;await q.query(`INSERT INTO push_delivery_outbox(user_id,title,body,data) VALUES($1,$2,$3,$4::jsonb)`,[userId,title,body,JSON.stringify(data)])}
  async registerPushToken(user:RequestUser,token:string,platform:string){if(!/^ExponentPushToken\[[A-Za-z0-9_-]+\]$/.test(token))return{ok:false,reason:'invalid_token'};await this.db.query(`INSERT INTO push_device(user_id,expo_push_token,platform,enabled,last_seen_at) VALUES($1,$2,$3,true,now()) ON CONFLICT(expo_push_token) DO UPDATE SET user_id=excluded.user_id,platform=excluded.platform,enabled=true,last_seen_at=now()`,[user.id,token,['android','ios'].includes(platform)?platform:'unknown']);return{ok:true}}
  async revokePushToken(user:RequestUser,token:string){await this.db.query(`UPDATE push_device SET enabled=false,last_seen_at=now() WHERE user_id=$1 AND expo_push_token=$2`,[user.id,token]);return{ok:true}}

  private async housekeeping(userId:string){await this.db.query(`UPDATE user_notification SET archived_at=COALESCE(archived_at,now()) WHERE user_id=$1 AND archived_at IS NULL AND read_at IS NOT NULL AND (created_at<now()-interval '30 days' OR id NOT IN (SELECT id FROM user_notification WHERE user_id=$1 AND archived_at IS NULL ORDER BY created_at DESC LIMIT 150))`,[userId])}
  async list(user:RequestUser, unreadOnly=false,archived=false){await this.housekeeping(user.id);const r=await this.db.query<any>(`SELECT id,type,title,body,entity_type,entity_id,metadata,read_at,archived_at,created_at FROM user_notification WHERE user_id=$1 AND archived_at IS ${archived?'NOT NULL':'NULL'} ${unreadOnly?'AND read_at IS NULL':''} ORDER BY created_at DESC LIMIT 150`,[user.id]);return r.rows.map(x=>({id:Number(x.id),type:x.type,title:x.title,body:x.body,entityType:x.entity_type,entityId:x.entity_id,metadata:x.metadata,readAt:x.read_at,archivedAt:x.archived_at,createdAt:x.created_at}));}
  async unreadCount(user:RequestUser){const r=await this.db.query<{count:string}>('SELECT COUNT(*)::text count FROM user_notification WHERE user_id=$1 AND read_at IS NULL AND archived_at IS NULL',[user.id]);return {count:Number(r.rows[0]?.count??0)};}
  async markRead(user:RequestUser,id:number){const r=await this.db.query('UPDATE user_notification SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND user_id=$2 RETURNING id',[id,user.id]);if(!r.rowCount)throw new NotFoundException({code:'NOTIFICATION_NOT_FOUND',message:'Notification not found'});return {ok:true};}
  async markAllRead(user:RequestUser){await this.db.query('UPDATE user_notification SET read_at=COALESCE(read_at,now()) WHERE user_id=$1 AND read_at IS NULL AND archived_at IS NULL',[user.id]);return {ok:true};}
  async archive(user:RequestUser,id:number){const r=await this.db.query('UPDATE user_notification SET archived_at=COALESCE(archived_at,now()),read_at=COALESCE(read_at,now()) WHERE id=$1 AND user_id=$2 RETURNING id',[id,user.id]);if(!r.rowCount)throw new NotFoundException({code:'NOTIFICATION_NOT_FOUND',message:'Notification not found'});return{ok:true}}
  async archiveRead(user:RequestUser){await this.db.query('UPDATE user_notification SET archived_at=COALESCE(archived_at,now()) WHERE user_id=$1 AND read_at IS NOT NULL AND archived_at IS NULL',[user.id]);return{ok:true}}
  async restore(user:RequestUser,id:number){const r=await this.db.query('UPDATE user_notification SET archived_at=NULL WHERE id=$1 AND user_id=$2 RETURNING id',[id,user.id]);if(!r.rowCount)throw new NotFoundException({code:'NOTIFICATION_NOT_FOUND',message:'Notification not found'});return{ok:true}}

  private async flushPushOutbox(){if(this.flushing)return;this.flushing=true;try{await this.db.query(`DELETE FROM push_delivery_outbox WHERE created_at<now()-interval '7 days' OR (delivered_at IS NOT NULL AND delivered_at<now()-interval '2 days')`);const rows=await this.db.query<any>(`SELECT o.id,o.title,o.body,o.data,d.expo_push_token FROM push_delivery_outbox o JOIN push_device d ON d.user_id=o.user_id AND d.enabled=true WHERE o.delivered_at IS NULL AND o.available_at<=now() AND o.attempts<5 ORDER BY o.id ASC LIMIT 50`);for(const x of rows.rows){try{const response=await fetch('https://exp.host/--/api/v2/push/send',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({to:x.expo_push_token,title:x.title,body:x.body,sound:'default',priority:'high',channelId:'deal-events',data:x.data??{}})});const text=await response.text();if(!response.ok)throw new Error(`Expo ${response.status}: ${text.slice(0,300)}`);await this.db.query('UPDATE push_delivery_outbox SET delivered_at=now(),attempts=attempts+1,last_error=NULL WHERE id=$1',[x.id])}catch(e){const message=e instanceof Error?e.message:String(e);await this.db.query(`UPDATE push_delivery_outbox SET attempts=attempts+1,last_error=$2,available_at=now()+((LEAST(attempts+1,5)*30)||' seconds')::interval WHERE id=$1`,[x.id,message.slice(0,1000)])}}}catch(e){this.log.warn(`push outbox: ${e instanceof Error?e.message:String(e)}`)}finally{this.flushing=false}}
}
