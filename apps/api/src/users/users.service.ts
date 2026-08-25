import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { RequestUser } from '../common/request-user';

@Injectable()
export class UsersService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async profile(user: RequestUser) {
    const stats = await this.db.query<{ completed_count: string; review_count: string; rating_avg: string | null }>(`
      SELECT
        (SELECT COUNT(*)::text FROM deal d WHERE d.status='completed' AND (d.sender_id=$1 OR d.driver_id=$1)) AS completed_count,
        (SELECT COUNT(*)::text FROM deal_review r WHERE r.reviewee_id=$1) AS review_count,
        (SELECT ROUND(AVG(r.rating)::numeric,2)::text FROM deal_review r WHERE r.reviewee_id=$1) AS rating_avg
    `,[user.id]);
    const row = stats.rows[0];
    return {
      id:user.id, displayName:user.displayName, email:user.email, phone:user.phone, status:user.status,
      verification:{status:user.verificationStatus,provider:null,verifiedAt:null},
      reputation:{completedDeals:Number(row?.completed_count ?? 0),reviewCount:Number(row?.review_count ?? 0),rating:row?.rating_avg===null?null:Number(row?.rating_avg)},
    };
  }
}
