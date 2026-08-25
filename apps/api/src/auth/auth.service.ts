import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { hashPassword, verifyPassword } from './password';
import { hashToken, newOpaqueToken } from './token';
import type { LoginInput, RegisterInput } from './auth.schemas';
import type { RequestUser } from '../common/request-user';

interface UserRow {
  id: string; email: string | null; phone_e164: string | null; display_name: string; password_hash: string; status: RequestUser['status'];
  verification_status: RequestUser['verificationStatus']; staff_role: RequestUser['staffRole'];
}
interface SessionUserRow extends UserRow { session_id: string; }

@Injectable()
export class AuthService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  private normalizeEmail(email: string) { return email.trim().toLowerCase(); }
  private normalizePhone(value: string) {
    const raw=value.trim().replace(/[\s()\-]/g,'');
    if (/^0\d{9}$/.test(raw)) return `+380${raw.slice(1)}`;
    if (/^380\d{9}$/.test(raw)) return `+${raw}`;
    if (/^\+\d{8,15}$/.test(raw)) return raw;
    throw new ConflictException({code:'PHONE_INVALID',message:'Enter a valid phone number in international format'});
  }

  private async issueSession(userId: string, metadata: { userAgent?: string; ip?: string }) {
    const accessToken = newOpaqueToken('cga');
    const refreshToken = newOpaqueToken('cgr');
    const accessTtl = this.config.getOrThrow<number>('ACCESS_TOKEN_TTL_SECONDS');
    const refreshTtl = this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_SECONDS');
    const row = await this.db.query<{ id: string }>(`INSERT INTO user_session
      (user_id, access_token_hash, refresh_token_hash, access_expires_at, refresh_expires_at, user_agent, last_ip)
      VALUES ($1,$2,$3,now()+($4::text||' seconds')::interval,now()+($5::text||' seconds')::interval,$6,$7)
      RETURNING id`, [userId, hashToken(accessToken), hashToken(refreshToken), accessTtl, refreshTtl, metadata.userAgent ?? null, metadata.ip ?? null]);
    return { accessToken, refreshToken, sessionId: row.rows[0].id, expiresIn: accessTtl };
  }

  async register(input: RegisterInput, metadata: { userAgent?: string; ip?: string }) {
    const phone = this.normalizePhone(input.phone);
    const existing = await this.db.query('SELECT 1 FROM app_user WHERE phone_e164=$1 LIMIT 1', [phone]);
    if (existing.rowCount) throw new ConflictException({ code: 'PHONE_IN_USE', message: 'Phone number is already registered' });
    const passwordHash = await hashPassword(input.password);
    const result = await this.db.query<UserRow>(`INSERT INTO app_user(phone_e164,display_name,password_hash)
      VALUES($1,$2,$3) RETURNING id,email,phone_e164,display_name,password_hash,status,verification_status,staff_role`, [phone, input.displayName.trim(), passwordHash]);
    const user = result.rows[0];
    const session = await this.issueSession(user.id, metadata);
    await this.audit(user.id, session.sessionId, 'auth.register');
    return { user: this.publicUser(user), session };
  }

  async login(input: LoginInput, metadata: { userAgent?: string; ip?: string }) {
    const identifier=input.identifier.trim();
    const isEmail=identifier.includes('@');
    const normalized=isEmail?this.normalizeEmail(identifier):this.normalizePhone(identifier);
    const result = await this.db.query<UserRow>(`SELECT id,email,phone_e164,display_name,password_hash,status,verification_status,staff_role
      FROM app_user WHERE ${isEmail?'email':'phone_e164'}=$1 LIMIT 1`, [normalized]);
    const user = result.rows[0];
    if (!user || !(await verifyPassword(input.password, user.password_hash))) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid phone/email or password' });
    }
    if (user.status !== 'active') throw new UnauthorizedException({ code: 'ACCOUNT_UNAVAILABLE', message: 'Account is unavailable' });
    const session = await this.issueSession(user.id, metadata);
    await this.audit(user.id, session.sessionId, 'auth.login');
    return { user: this.publicUser(user), session };
  }

  async authenticateAccessToken(token: string): Promise<RequestUser | null> {
    const result = await this.db.query<SessionUserRow>(`SELECT s.id AS session_id,u.id,u.email,u.phone_e164,u.display_name,u.password_hash,u.status,u.verification_status,u.staff_role
      FROM user_session s JOIN app_user u ON u.id=s.user_id
      WHERE s.access_token_hash=$1 AND s.revoked_at IS NULL AND s.access_expires_at>now() LIMIT 1`, [hashToken(token)]);
    const row = result.rows[0];
    if (!row || row.status !== 'active') return null;
    await this.db.query("UPDATE user_session SET last_seen_at=now() WHERE id=$1 AND last_seen_at < now()-interval '5 minutes'", [row.session_id]);
    return { id: row.id, sessionId: row.session_id, email: row.email, phone: row.phone_e164, displayName: row.display_name, status: row.status, verificationStatus: row.verification_status, staffRole: row.staff_role ?? null };
  }

  async refresh(refreshToken: string, metadata: { userAgent?: string; ip?: string }) {
    const tokenHash = hashToken(refreshToken);
    const outcome = await this.db.transaction(async (client) => {
      const reused = await client.query<{ id: string; user_id: string }>(
        'SELECT id,user_id FROM user_session WHERE previous_refresh_token_hash=$1 AND revoked_at IS NULL LIMIT 1 FOR UPDATE',
        [tokenHash],
      );
      if (reused.rows[0]) {
        await client.query('UPDATE user_session SET revoked_at=now() WHERE id=$1', [reused.rows[0].id]);
        await client.query(
          `INSERT INTO audit_event(actor_user_id,session_id,event_type,metadata) VALUES($1,$2,'auth.refresh_reuse_detected','{}'::jsonb)`,
          [reused.rows[0].user_id, reused.rows[0].id],
        );
        return { reuseDetected: true as const };
      }

      const result = await client.query<SessionUserRow>(`SELECT s.id AS session_id,u.id,u.email,u.phone_e164,u.display_name,u.password_hash,u.status,u.verification_status,u.staff_role
        FROM user_session s JOIN app_user u ON u.id=s.user_id
        WHERE s.refresh_token_hash=$1 AND s.revoked_at IS NULL AND s.refresh_expires_at>now() FOR UPDATE`, [tokenHash]);
      const row = result.rows[0];
      if (!row || row.status !== 'active') return { invalid: true as const };

      const accessToken = newOpaqueToken('cga');
      const nextRefreshToken = newOpaqueToken('cgr');
      const accessTtl = this.config.getOrThrow<number>('ACCESS_TOKEN_TTL_SECONDS');
      const refreshTtl = this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_SECONDS');
      await client.query(`UPDATE user_session SET access_token_hash=$1,previous_refresh_token_hash=refresh_token_hash,refresh_token_hash=$2,
        access_expires_at=now()+($3::text||' seconds')::interval,refresh_expires_at=now()+($4::text||' seconds')::interval,
        rotated_at=now(),last_seen_at=now(),user_agent=COALESCE($5,user_agent),last_ip=COALESCE($6,last_ip)
        WHERE id=$7`, [hashToken(accessToken), hashToken(nextRefreshToken), accessTtl, refreshTtl, metadata.userAgent ?? null, metadata.ip ?? null, row.session_id]);
      await client.query(`INSERT INTO audit_event(actor_user_id,session_id,event_type,metadata) VALUES($1,$2,'auth.refresh','{}'::jsonb)`, [row.id,row.session_id]);
      return { success: true as const, user: this.publicUser(row), session: { accessToken, refreshToken: nextRefreshToken, sessionId: row.session_id, expiresIn: accessTtl } };
    });

    if ('reuseDetected' in outcome) throw new UnauthorizedException({ code: 'REFRESH_TOKEN_REUSE', message: 'Session revoked' });
    if ('invalid' in outcome) throw new UnauthorizedException({ code: 'INVALID_REFRESH_TOKEN', message: 'Session expired' });
    return { user: outcome.user, session: outcome.session };
  }

  async logout(user: RequestUser) {
    await this.db.query('UPDATE user_session SET revoked_at=now() WHERE id=$1 AND user_id=$2', [user.sessionId,user.id]);
    await this.audit(user.id, user.sessionId, 'auth.logout');
    return { ok: true };
  }

  async logoutAll(user: RequestUser) {
    await this.db.query('UPDATE user_session SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [user.id]);
    await this.audit(user.id, user.sessionId, 'auth.logout_all');
    return { ok: true };
  }

  private publicUser(user: UserRow) {
    return { id: user.id, email: user.email, phone: user.phone_e164, displayName: user.display_name, status: user.status, verificationStatus: user.verification_status, staffRole: user.staff_role ?? null };
  }

  private async audit(userId: string, sessionId: string, eventType: string) {
    await this.db.query(`INSERT INTO audit_event(actor_user_id,session_id,event_type,metadata) VALUES($1,$2,$3,'{}'::jsonb)`, [userId,sessionId,eventType]);
  }
}
