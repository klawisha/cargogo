import { z } from 'zod';

const DEV_CODE_SECRET = 'local-development-only-cargogo-deal-code-secret-v1';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(12),
  CORS_ORIGINS: z.string().default('http://localhost:8081'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(3600).max(7776000).default(2592000),

  PUBLIC_BASE_URL: z.string().url().default('http://localhost:3000'),
  PAYMENTS_MODE: z.enum(['mock', 'liqpay_sandbox', 'liqpay_production', 'disabled']).default('mock'),
  LIQPAY_PUBLIC_KEY: z.string().optional(),
  LIQPAY_PRIVATE_KEY: z.string().optional(),
  LIQPAY_ACTION: z.enum(['hold']).default('hold'),
  ENABLE_REAL_PAYMENTS: z.coerce.boolean().default(false),
  TARGET_NET_MARGIN_BPS: z.coerce.number().int().min(0).max(1000).default(290),
  ACQUIRING_FEE_ESTIMATE_BPS: z.coerce.number().int().min(0).max(1000).default(130),
  PAYOUT_FEE_ESTIMATE_BPS: z.coerce.number().int().min(0).max(1000).default(30),
  MIN_MARKETPLACE_FEE_MINOR: z.coerce.number().int().min(0).max(100000).default(0),
  PAYOUT_SANDBOX_ACTUAL_FEE_BPS: z.coerce.number().int().min(0).max(1000).default(30),
  REFERENCE_PETROL_MINOR_PER_LITER: z.coerce.number().int().min(1000).max(20000).default(6000),
  REFERENCE_DIESEL_MINOR_PER_LITER: z.coerce.number().int().min(1000).max(20000).default(5800),
  REFERENCE_LPG_MINOR_PER_LITER: z.coerce.number().int().min(500).max(12000).default(3400),
  REFERENCE_ELECTRICITY_MINOR_PER_KWH: z.coerce.number().int().min(100).max(5000).default(500),
  PAYOUTS_MODE: z.enum(['sandbox','manual','disabled']).default('sandbox'),
  PAYOUT_DATA_SECRET: z.string().min(32).default('local-development-only-cargogo-payout-secret-v1'),
  ENABLE_REAL_PAYOUTS: z.coerce.boolean().default(false),

  KYC_MODE: z.enum(['mock', 'manual', 'disabled']).default('mock'),
  VERIFICATION_ENFORCEMENT: z.enum(['off','on']).default('on'),
  VERIFICATION_UPLOAD_MAX_BYTES: z.coerce.number().int().min(262144).max(10485760).default(10485760),
  VERIFICATION_UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(1800).default(600),
  VERIFICATION_REVIEW_URL_TTL_SECONDS: z.coerce.number().int().min(30).max(900).default(300),
  VERIFICATION_DOCUMENT_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  DEAL_CODE_SECRET: z.string().min(32).default(DEV_CODE_SECRET),
  MAPBOX_ACCESS_TOKEN: z.string().optional(),
  ROUTING_PROVIDER: z.enum(['auto','mapbox','fallback']).default('auto'),
  LEGAL_OPERATOR_NAME: z.string().optional(),
  LEGAL_OPERATOR_TAX_ID: z.string().optional(),
  LEGAL_OPERATOR_ADDRESS: z.string().optional(),
  LEGAL_EMAIL: z.string().email().optional(),
  PRIVACY_EMAIL: z.string().email().optional(),
  LEGAL_DOCS_APPROVED: z.coerce.boolean().default(false),
}).superRefine((value, ctx) => {
  if (value.NODE_ENV === 'production' && value.PAYMENTS_MODE === 'mock') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['PAYMENTS_MODE'], message: 'Mock payments are forbidden in production' });
  }
  if (value.NODE_ENV === 'production' && !value.S3_ENDPOINT.startsWith('https://')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['S3_ENDPOINT'], message: 'Production verification uploads require an HTTPS S3 endpoint' });
  }
  if (value.NODE_ENV === 'production' && value.KYC_MODE === 'mock') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['KYC_MODE'], message: 'Mock KYC is forbidden in production' });
  }
  if (value.NODE_ENV === 'production' && value.VERIFICATION_ENFORCEMENT !== 'on') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['VERIFICATION_ENFORCEMENT'], message: 'Production must enforce identity/driver/vehicle verification' });
  }
  if (value.NODE_ENV === 'production' && value.DEAL_CODE_SECRET === DEV_CODE_SECRET) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['DEAL_CODE_SECRET'], message: 'Production must provide a unique DEAL_CODE_SECRET' });
  }

  if (value.NODE_ENV === 'production') {
    for (const [key,val] of Object.entries({LEGAL_OPERATOR_NAME:value.LEGAL_OPERATOR_NAME,LEGAL_OPERATOR_TAX_ID:value.LEGAL_OPERATOR_TAX_ID,LEGAL_OPERATOR_ADDRESS:value.LEGAL_OPERATOR_ADDRESS,LEGAL_EMAIL:value.LEGAL_EMAIL,PRIVACY_EMAIL:value.PRIVACY_EMAIL})) {
      if (!val) ctx.addIssue({code:z.ZodIssueCode.custom,path:[key],message:`Production requires ${key}`});
    }
    if (!value.LEGAL_DOCS_APPROVED) ctx.addIssue({code:z.ZodIssueCode.custom,path:['LEGAL_DOCS_APPROVED'],message:'Production requires final legal review and approval'});
  }

  const liqpay = value.PAYMENTS_MODE === 'liqpay_sandbox' || value.PAYMENTS_MODE === 'liqpay_production';
  if (liqpay && !value.LIQPAY_PUBLIC_KEY) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['LIQPAY_PUBLIC_KEY'], message: 'LiqPay mode requires LIQPAY_PUBLIC_KEY' });
  }
  if (liqpay && !value.LIQPAY_PRIVATE_KEY) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['LIQPAY_PRIVATE_KEY'], message: 'LiqPay mode requires LIQPAY_PRIVATE_KEY' });
  }
  if (value.PAYMENTS_MODE === 'liqpay_sandbox' && value.LIQPAY_PUBLIC_KEY && !value.LIQPAY_PUBLIC_KEY.startsWith('sandbox_')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['LIQPAY_PUBLIC_KEY'], message: 'Sandbox LiqPay public key must start with sandbox_' });
  }
  if (value.NODE_ENV === 'production' && value.PAYOUTS_MODE === 'sandbox') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['PAYOUTS_MODE'], message: 'Sandbox payouts are forbidden in production' });
  }
  if (value.NODE_ENV === 'production' && value.PAYOUT_DATA_SECRET === 'local-development-only-cargogo-payout-secret-v1') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['PAYOUT_DATA_SECRET'], message: 'Production must provide a unique PAYOUT_DATA_SECRET' });
  }
  if (value.PAYOUTS_MODE === 'manual' && value.ENABLE_REAL_PAYOUTS) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ENABLE_REAL_PAYOUTS'], message: 'ENABLE_REAL_PAYOUTS requires a verified automatic payout provider, not manual mode' });
  }
  if (value.PAYMENTS_MODE === 'liqpay_production') {
    if (!value.ENABLE_REAL_PAYMENTS) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ENABLE_REAL_PAYMENTS'], message: 'Real payments are locked. Keep using liqpay_sandbox until production payment review is complete.' });
    }
    if (value.LIQPAY_PUBLIC_KEY?.startsWith('sandbox_')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['LIQPAY_PUBLIC_KEY'], message: 'Production LiqPay mode cannot use sandbox keys' });
    }
    if (!value.PUBLIC_BASE_URL.startsWith('https://')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['PUBLIC_BASE_URL'], message: 'Production payment mode requires a public HTTPS base URL' });
    }
  }
});

export type AppEnv = z.infer<typeof envSchema>;
export function validateEnv(config: Record<string, unknown>): AppEnv {
  return envSchema.parse(config);
}
