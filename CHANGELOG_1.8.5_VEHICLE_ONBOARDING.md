# CargoGo 1.8.5 — Vehicle onboarding fix

## Problem fixed
The driver flow could require a verified vehicle before opening trip creation while vehicle creation itself lived inside trip creation. That created an onboarding deadlock for a new driver who needed to upload a vehicle registration certificate before the first trip.

## New flow
1. Profile → **Мої автомобілі**.
2. Create a vehicle independently of any trip or verification status.
3. Open **Центр верифікації** and upload vehicle registration, vehicle photos and insurance for that vehicle.
4. Wait for manual review.
5. Once identity, driver licence, at least one vehicle and carrier rules are ready, create a trip.

## UI changes
- Added `app/vehicles.tsx` as a standalone garage / vehicle onboarding screen.
- Added **Мої автомобілі** to Profile.
- Verification empty state now links directly to vehicle creation.
- Driver readiness separates licence and vehicle into distinct visible actions.
- Driver readiness progress is now 4 steps: identity, licence, vehicle, carrier mode/rules.
- Trip creation no longer contains an inline vehicle-creation form.
- Trip creation only offers vehicles whose vehicle verification status is `verified`.
- Trip creation links back to the garage when another vehicle is needed.

## Backend
No verification bypass was added. Existing server enforcement remains unchanged: publishing a trip still requires verified identity, verified driver licence and the selected verified vehicle.
