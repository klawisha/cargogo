import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Observable, catchError, throwError } from 'rxjs';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class DiagnosticsInterceptor implements NestInterceptor {
  constructor(private readonly db:DatabaseService){}
  intercept(context:ExecutionContext,next:CallHandler):Observable<any>{
    if(context.getType()!=='http')return next.handle();
    const req=context.switchToHttp().getRequest<any>();
    return next.handle().pipe(catchError((error:unknown)=>{
      const status=error instanceof HttpException?error.getStatus():500;
      if(status>=500){
        const e=error as any; const message=String(e?.message??'Unhandled server error').slice(0,2000);
        const fingerprint=createHash('sha256').update(`${e?.name??'Error'}|${req?.method??''}|${String(req?.route?.path??req?.url??'').split('?')[0]}|${message}`).digest('hex').slice(0,40);
        void this.db.query(`INSERT INTO server_diagnostic_event(user_id,session_id,severity,method,path,status_code,error_name,message,stack,fingerprint,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,[
          req?.user?.id??null,req?.user?.sessionId??null,status>=500?'error':'warning',String(req?.method??'').slice(0,12)||null,String(req?.url??'').split('?')[0].slice(0,300)||null,status,String(e?.name??'Error').slice(0,120),message,String(e?.stack??'').slice(0,12000)||null,fingerprint,JSON.stringify({source:'api_interceptor'})
        ]).catch(()=>undefined);
      }
      return throwError(()=>error);
    }));
  }
}
