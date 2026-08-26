import { ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { RequestUser } from '../common/request-user';

@Injectable()
export class StaffService {
  constructor(private readonly db: DatabaseService) {}

  private assertStaff(user: RequestUser) {
    if (!user.staffRole) throw new ForbiddenException({ code: 'STAFF_REQUIRED', message: 'Staff role required' });
  }

  private capabilities(role: RequestUser['staffRole']) {
    return {
      verification: role === 'reviewer' || role === 'verification_reviewer' || role === 'admin',
      professionalCarriers: role === 'reviewer' || role === 'verification_reviewer' || role === 'admin',
      disputes: role === 'reviewer' || role === 'dispute_reviewer' || role === 'admin',
      payoutIssues: role === 'reviewer' || role === 'dispute_reviewer' || role === 'admin',
      finance: role === 'reviewer' || role === 'admin',
    };
  }

  async overview(user: RequestUser) {
    this.assertStaff(user);
    const capabilities = this.capabilities(user.staffRole);
    const [verification, professionalCarriers, disputes, payouts] = await Promise.all([
      capabilities.verification ? this.db.query<{count:string}>("SELECT count(*)::text count FROM verification_review_case WHERE status IN ('queued','in_review')") : Promise.resolve({rows:[{count:'0'}]} as any),
      capabilities.professionalCarriers ? this.db.query<{count:string}>("SELECT count(*)::text count FROM carrier_profile WHERE mode='professional' AND professional_status='pending'") : Promise.resolve({rows:[{count:'0'}]} as any),
      capabilities.disputes ? this.db.query<{count:string}>("SELECT count(*)::text count FROM deal_dispute WHERE status IN ('open','under_review')") : Promise.resolve({rows:[{count:'0'}]} as any),
      capabilities.payoutIssues ? this.db.query<{count:string}>("SELECT count(*)::text count FROM payout p JOIN deal d ON d.id=p.deal_id WHERE p.status IN ('failed','manual_review') OR d.settlement_status='payout_failed'") : Promise.resolve({rows:[{count:'0'}]} as any),
    ]);
    return {
      role: user.staffRole,
      capabilities,
      counts: {
        verification: Number(verification.rows[0]?.count ?? 0),
        professionalCarriers: Number(professionalCarriers.rows[0]?.count ?? 0),
        disputes: Number(disputes.rows[0]?.count ?? 0),
        payoutIssues: Number(payouts.rows[0]?.count ?? 0),
      },
    };
  }

  async payoutIssues(user: RequestUser) {
    this.assertStaff(user);
    if (!this.capabilities(user.staffRole).payoutIssues) throw new ForbiddenException({ code: 'PAYOUT_REVIEWER_REQUIRED', message: 'Payout review permission required' });
    const r = await this.db.query<any>(`SELECT p.id,p.deal_id AS "dealId",p.status,p.amount_minor AS "amountMinor",p.currency,p.provider,p.attempts,p.last_error AS "lastError",p.created_at AS "createdAt",p.updated_at AS "updatedAt",d.settlement_status AS "settlementStatus",d.payment_status AS "paymentStatus",u.display_name AS "driverName",u.phone_e164 AS "driverPhone" FROM payout p JOIN deal d ON d.id=p.deal_id JOIN app_user u ON u.id=p.user_id WHERE p.status IN ('failed','manual_review') OR d.settlement_status='payout_failed' ORDER BY p.updated_at ASC LIMIT 100`);
    return r.rows.map((x:any)=>({
      ...x,
      amountMinor: Number(x.amountMinor),
      attempts: Number(x.attempts ?? 0),
    }));
  }
}
