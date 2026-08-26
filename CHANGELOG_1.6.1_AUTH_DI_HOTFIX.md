# CargoGo v1.6.1 — Auth DI hotfix

## Fixed
- `LegalModule` now imports `AuthModule`, so `AuthGuard` can resolve `AuthService` for protected legal/privacy endpoints.
- `OpsModule` now imports `AuthModule`, preventing the same Nest dependency-resolution failure on protected operations endpoints.
- `verify:modules` was added to the release gate so the Nest module graph is instantiated before the rest of the release checks.

## Root cause
`AuthGuard` is exported by `AuthModule` and depends on `AuthService`. Controllers in `LegalModule` and `OpsModule` used `@UseGuards(AuthGuard)` without importing `AuthModule`, so Nest attempted to resolve the guard in a module context where `AuthService` was unavailable.

## Validation note
Static inspection confirms every controller currently using `AuthGuard` has an owning module that imports `AuthModule` (with `AuthModule` itself as the expected exception). Runtime verification is provided by `npm run verify:modules` and is now part of `npm run release:gate`.
