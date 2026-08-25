import { z } from 'zod';

const optionalDimension = z.number().finite().positive().max(1000).optional();

export const vehicleIdSchema = z.string().uuid();

export const createVehicleSchema = z.object({
  label: z.string().trim().min(2).max(80),
  bodyType: z.enum(['sedan', 'hatchback', 'wagon', 'suv', 'van', 'pickup', 'other']),
  maxPayloadKg: z.number().finite().positive().max(50_000).optional(),
  cargoLengthCm: optionalDimension,
  cargoWidthCm: optionalDimension,
  cargoHeightCm: optionalDimension,
  // Not a secret. Used only to make mobile retries idempotent.
  clientReference: z.string().trim().min(12).max(120).regex(/^[A-Za-z0-9._:-]+$/).optional(),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
