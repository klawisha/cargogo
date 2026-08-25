import { z } from 'zod';

const countryCode = z.string().trim().length(2).transform((v)=>v.toUpperCase());
const last4 = z.string().trim().min(2).max(4).regex(/^[A-Za-z0-9]+$/).transform((v)=>v.toUpperCase());

export const submitIdentitySchema = z.object({
  documentKind: z.enum(['passport','id_card']),
  documentCountry: countryCode,
  documentLast4: last4,
});

export const submitDriverLicenseSchema = z.object({
  countryCode,
  licenseLast4: last4,
  categories: z.array(z.string().trim().min(1).max(4).regex(/^[A-Za-z0-9]+$/)).min(1).max(10)
    .transform((items)=>Array.from(new Set(items.map((x)=>x.toUpperCase())))),
  expiresAt: z.string().datetime().optional(),
});

export const submitVehicleVerificationSchema = z.object({
  registrationCountry: countryCode,
  registrationNumber: z.string().trim().min(3).max(20),
  vinLast6: z.string().trim().min(4).max(6).regex(/^[A-HJ-NPR-Za-hj-npr-z0-9]+$/).transform((v)=>v.toUpperCase()),
  make: z.string().trim().min(2).max(80),
  model: z.string().trim().min(1).max(80),
  year: z.number().int().min(1950).max(2100),
  color: z.string().trim().min(2).max(40).optional(),
  insuranceRequired: z.boolean().default(true),
});

export const verificationVehicleIdSchema = z.string().uuid();
export const verificationSubjectSchema = z.enum(['identity','driver_license','vehicle']);
export const devResolveVerificationSchema = z.object({
  subject: verificationSubjectSchema,
  subjectId: z.string().uuid().optional(),
  status: z.enum(['verified','rejected','needs_resubmission','expired','suspended']),
  reason: z.string().trim().max(500).optional(),
});

// Backward-compatible alpha endpoint. New clients use /identity/submit.
export const startVerificationSchema = z.object({documentKind:z.enum(['passport','id_card'])});
export type SubmitIdentityInput=z.infer<typeof submitIdentitySchema>;
export type SubmitDriverLicenseInput=z.infer<typeof submitDriverLicenseSchema>;
export type SubmitVehicleVerificationInput=z.infer<typeof submitVehicleVerificationSchema>;
