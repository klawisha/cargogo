import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { VerificationStorageService } from './verification-storage.service';

@Controller('files')
export class FileProxyController {
  constructor(private readonly storage: VerificationStorageService) {}

  @Get('object')
  async object(@Query('token') token: string | undefined, @Res() res: Response) {
    const key = this.storage.verifyProxyToken(token ?? '');
    const object = await this.storage.getObject(key);
    res.setHeader('Content-Type', object.mimeType);
    res.setHeader('Content-Length', String(object.bytes.length));
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    res.status(200).send(object.bytes);
  }
}
