import { z } from 'zod';

export const offerIdSchema = z.string().uuid();
export const cargoIdSchema = z.string().uuid();
export const createOfferSchema = z.object({
  cargoId: z.string().uuid(),
  tripId: z.string().uuid(),
  amountMinor: z.number().int().min(1).max(100_000_000),
  currency: z.literal('UAH').default('UAH'),
  message: z.string().trim().max(500).optional(),
});
export type CreateOfferInput = z.infer<typeof createOfferSchema>;
