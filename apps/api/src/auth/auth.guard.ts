import { CanActivate, ExecutionContext, HttpException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { DatabaseService } from '../database/database.service';
import { LEGAL_VERSION } from '../legal/legal.documents';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(DatabaseService) private readonly db: DatabaseService,
  ) {}

  private async hasCurrentConsent(userId:string){
    const result=await this.db.query<{document_key:string}>(`SELECT DISTINCT document_key FROM legal_acceptance WHERE user_id=$1 AND document_version=$2 AND document_key = ANY($3::text[])`,[userId,LEGAL_VERSION,['terms-of-use','privacy-policy']]);
    return new Set(result.rows.map((x:{document_key:string})=>x.document_key)).size===2;
  }

  private requiresConsent(method:string,url:string){
    if(['GET','HEAD','OPTIONS'].includes(method.toUpperCase()))return false;
    const path=url.split('?')[0];
    return ['/cargo','/trips','/offers','/deals','/chats','/payments','/payout-accounts','/carrier-mode','/disputes'].some(prefix=>path.includes(`/v1${prefix}`)||path.startsWith(prefix));
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string }; user?: any; method?:string; url?:string }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException({ code: 'AUTH_REQUIRED', message: 'Authentication required' });
    const user = await this.auth.authenticateAccessToken(header.slice(7).trim());
    if (!user) throw new UnauthorizedException({ code: 'INVALID_ACCESS_TOKEN', message: 'Session expired' });
    request.user = user;
    if(!user.staffRole && this.requiresConsent(request.method??'GET',request.url??'')){
      const accepted=await this.hasCurrentConsent(user.id);
      if(!accepted)throw new HttpException({code:'LEGAL_RECONSENT_REQUIRED',message:'Please review and accept the current Terms of Use and Privacy Policy',legalVersion:LEGAL_VERSION},428);
    }
    return true;
  }
}
