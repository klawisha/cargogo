import { z } from 'zod';

const password = z.string()
  .min(10, 'Password must contain at least 10 characters')
  .max(128, 'Password must contain at most 128 characters')
  .refine((v) => /[A-Za-z]/.test(v), 'Password must contain at least one letter')
  .refine((v) => /\d/.test(v), 'Password must contain at least one number');

export const registerSchema = z.object({
  phone: z.string().trim().min(8).max(24),
  email: z.string().trim().email().max(254).optional(),
  password,
  displayName: z.string().trim().min(2).max(60),
  acceptTerms: z.literal(true),
  acceptPrivacy: z.literal(true),
  legalVersion: z.string().min(8).max(32),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(128),
});

export const refreshSchema = z.object({ refreshToken: z.string().min(40).max(256) });
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
