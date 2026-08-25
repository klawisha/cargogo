import { z } from 'zod';
export const dealIdSchema=z.string().uuid();
export const sendMessageSchema=z.object({body:z.string().trim().min(1).max(2000)});
export const beforeIdSchema=z.coerce.number().int().positive().optional();
