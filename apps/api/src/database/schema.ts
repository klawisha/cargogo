export const REQUIRED_SCHEMA_MIGRATION = '033_grant_readiness_foundation.sql';

export const REQUIRED_TABLES = [
  'app_user','user_session','cargo','vehicle','trip','trip_match','cargo_offer','deal','deal_event','deal_conversation','deal_message','deal_review',
  'user_notification','verification_request','identity_verification_profile','driver_license_verification','vehicle_verification','verification_event','deal_dispute','dispute_evidence','payment_attempt','payout_account','payout','finance_ledger_entry','operating_expense','client_error_event','server_diagnostic_event',
] as const;

export type SchemaReadiness = { ok:boolean; expectedMigration:string; migrationApplied:boolean; missingTables:string[] };
