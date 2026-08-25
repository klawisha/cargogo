# CargoGo 1.4.5 — Professional Carrier Review

- Added a dedicated `ФОП / бізнес` queue to Trust Workspace.
- Added manual professional-carrier reviewer screen with business identity, registration reference, phone, identity/license/vehicle verification context, mandatory reviewer note, approve/reject actions.
- Staff overview now reports pending professional carrier profiles.
- Replaced raw staff errors with proper 403 `ForbiddenException` for professional review endpoints.
- Professional review decisions are accepted only while the profile is still `pending`, preventing accidental double resolution.
- No database migration required; uses carrier mode schema introduced in migration 026.
