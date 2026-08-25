import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { RequestUser } from '../common/request-user';

@Injectable()
export class LiveService {
  private polls=0;constructor(private readonly db:DatabaseService){}
  private async current(userId:string){const r=await this.db.query<{id:string}>(`SELECT COALESCE(MAX(id),0)::text id FROM live_signal WHERE user_id IS NULL OR user_id=$1`,[userId]);return Number(r.rows[0]?.id??0)}
  async poll(user:RequestUser,after?:number){if(++this.polls%200===0)void this.db.query(`DELETE FROM live_signal WHERE created_at<now()-interval '7 days'`).catch(()=>{});
    if(after===undefined||!Number.isFinite(after))return {cursor:await this.current(user.id),events:[]};
    const safe=Math.max(0,Math.floor(after));
    for(let i=0;i<30;i++){
      const r=await this.db.query<any>(`SELECT id,topic,entity_id,created_at FROM live_signal WHERE id>$1 AND (user_id IS NULL OR user_id=$2) ORDER BY id ASC LIMIT 100`,[safe,user.id]);
      if(r.rows.length){const cursor=Number(r.rows[r.rows.length-1].id);return{cursor,events:r.rows.map(x=>({id:Number(x.id),topic:x.topic,entityId:x.entity_id,createdAt:x.created_at}))}}
      await new Promise(resolve=>setTimeout(resolve,500));
    }
    return {cursor:Math.max(safe,await this.current(user.id)),events:[]};
  }
}
