import { z } from 'zod';
export const subjectSchema=z.enum(['identity','driver_license','vehicle']);
export const documentKindSchema=z.enum(['identity_front','identity_back','selfie','driver_license_front','driver_license_back','vehicle_registration_front','vehicle_registration_back','vehicle_front','vehicle_rear','vehicle_left','vehicle_right','insurance']);
export const createVerificationUploadSchema=z.object({subjectType:subjectSchema,subjectId:z.string().uuid().optional(),documentKind:documentKindSchema,mimeType:z.enum(['image/jpeg','image/png','application/pdf']),sizeBytes:z.number().int().min(1).max(10485760)});
export const multipartVerificationUploadSchema=z.object({subjectType:subjectSchema,subjectId:z.string().uuid().optional(),documentKind:documentKindSchema});
export const uuidSchema=z.string().uuid();
export const reviewDecisionSchema=z.object({decision:z.enum(['verified','rejected','needs_resubmission']),reason:z.string().trim().min(3).max(1000)});
export const documentAccessSchema=z.object({purpose:z.string().trim().min(3).max(200)});
