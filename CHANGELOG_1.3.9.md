# CargoGo 1.3.9 — Live Experience

- Long-poll live invalidation bus backed by transactional PostgreSQL triggers for cargo, trips, deals, chats, notifications and disputes.
- Cargo/deal/chat screens subscribe to live revisions and refresh without manual reload.
- Expo push registration + transactional push outbox. Chat pushes are transient and do not pollute the notification inbox.
- Lifecycle notifications expanded for transit, recipient presence and handover start.
- Chats become read-only 24 hours after a completed deal; cancelled/refunded chats close immediately and remain archived for evidence/history.
- Notification inbox now supports archive/restore, archive-read, and automatic housekeeping of old read notifications.
- Visual system moved to a quieter graphite/indigo palette, updated navigation surfaces and a subtle Route Pulse waiting interaction.
