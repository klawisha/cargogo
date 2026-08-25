# CargoGo v1.4.6 Current Trip Hotfix

- Fixed "Make current for matching" feedback and persistence UX.
- Current trip selection now emits a user-scoped live `trip` signal so Home updates without manual refresh.
- Added an audit event `trip.current_selected`.
- Trip detail now loads current context, shows active state, and safely parses API responses.
- Included the two mobile TypeScript fixes reported after v1.4.6 (`Trip.message` error handling and nullable vehicle id).
