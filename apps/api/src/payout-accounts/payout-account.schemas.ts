import { z } from 'zod';
export const upsertPayoutAccountSchema = z.object({
  holderName: z.string().trim().min(3).max(120),
  iban: z.string().trim().toUpperCase().regex(/^UA\d{27}$/, 'IBAN must be a Ukrainian UA + 27 digits account'),
});
