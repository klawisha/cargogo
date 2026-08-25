import { z } from 'zod';

export const dealIdSchema = z.string().uuid();
export const acceptOfferSchema = z.object({ offerId: z.string().uuid() });
export const cancelDealSchema = z.object({ reason: z.string().trim().min(3).max(500) });
export const verifyDealCodeSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'Code must contain exactly 6 digits') });
export const createReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export const handoverEvidenceUploadSchema = z.object({
  stage: z.enum(['pickup','delivery']),
  note: z.string().trim().max(500).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  accuracyMeters: z.coerce.number().min(0).max(10000).optional(),
  clientCapturedAt: z.string().datetime({ offset: true }).optional(),
  locationStatus: z.enum(['captured','permission_denied','unavailable']).optional(),
});
export const deliveryProblemSchema = z.object({
  reason: z.enum(['recipient_refuses_code','recipient_claims_damage','recipient_unavailable','other']),
  note: z.string().trim().min(3).max(1500),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracyMeters: z.number().min(0).max(10000).optional(),
  locationCapturedAt: z.string().datetime({ offset: true }).optional(),
  locationStatus: z.enum(['captured','permission_denied','unavailable']),
});
export const evidenceAccessSchema = z.object({ purpose: z.string().trim().min(3).max(200) });

export const handoverPresenceSchema = z.object({ latitude:z.number().min(-90).max(90).optional(), longitude:z.number().min(-180).max(180).optional(), accuracyMeters:z.number().min(0).max(10000).optional(), locationStatus:z.enum(['captured','permission_denied','unavailable']) });
