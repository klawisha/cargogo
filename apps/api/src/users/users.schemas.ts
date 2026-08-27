import { z } from 'zod';
export const contactVerificationRequestSchema=z.object({
  kind:z.enum(['primary_phone','primary_email','backup_email','backup_phone']),
  value:z.string().trim().min(5).max(254),
});
export const contactVerificationConfirmSchema=z.object({challengeId:z.string().uuid(),code:z.string().regex(/^\d{6}$/)});
