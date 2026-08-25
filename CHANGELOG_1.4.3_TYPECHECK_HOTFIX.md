# CargoGo 1.4.3 — carrier-mode typecheck hotfix

- Fixed TypeScript TS2349 caused by calling `query()` on the union `DatabaseService | PoolClient`.
- Introduced one minimal structural `QueryExecutor` contract, matching the established pattern already used by dispute/notification services.
- Removed generic calls through the incompatible union overload set.
- No carrier policy, database schema, limits, or runtime business behavior changed.
