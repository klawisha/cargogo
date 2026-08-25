import { createHash, randomBytes } from 'node:crypto';

export function newOpaqueToken(prefix: 'cga' | 'cgr'): string {
  return `${prefix}_${randomBytes(32).toString('base64url')}`;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
