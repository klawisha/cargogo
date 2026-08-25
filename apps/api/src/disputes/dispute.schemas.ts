import { z } from 'zod';
export const openDisputeSchema=z.object({reasonCode:z.enum(['cargo_damaged','cargo_missing','delivery_not_received','wrong_cargo','participant_unavailable','other']),description:z.string().trim().min(10).max(3000)});
export const evidenceSchema=z.object({text:z.string().trim().min(2).max(5000)});

export const disputePhotoUploadSchema=z.object({note:z.string().trim().max(500).optional()});
export const disputeAccessSchema=z.object({purpose:z.string().trim().min(3).max(300)});
export const disputeResolveSchema=z.object({winner:z.enum(['sender','driver']),note:z.string().trim().min(10).max(2000)});
