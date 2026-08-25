# CargoGo 1.3.0 test report

Automated source/architecture fixtures executed in packaging environment:

- `verify:handover-evidence`: PASS
- `verify:verification`: PASS
- `verify:verification-upload`: PASS
- `verify:verification-mobile`: PASS
- `verify:economics`: PASS
- `verify:payments`: PASS (LiqPay signature fixture)

`npm install` could not finish within the packaging environment timeout, so dependency-resolved `npm run typecheck` must be run after extraction. The new native dependency is `expo-image-picker ~57.0.10`; the user's Android development build must be rebuilt once after `npm install`.

Device regression checklist:
1. Driver at `awaiting_pickup`: code input unavailable before photo.
2. Camera permission requested; camera opens (not gallery).
3. Capture one pickup photo; upload succeeds and deal refreshes.
4. Sender refresh: pickup code appears only after pickup evidence exists.
5. Wrong pickup code increments existing lockout; correct code advances to `picked_up` and erases code secret.
6. Transit → arrival.
7. Delivery code unavailable before delivery evidence.
8. Capture delivery photo; sender code appears; correct code completes delivery.
9. Evidence list opens through signed URL (`adb reverse tcp:9000 tcp:9000` is required for local MinIO browser viewing).
10. Open a dispute and verify immutable pickup/delivery evidence is shown automatically.
