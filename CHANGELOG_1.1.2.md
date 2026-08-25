# CargoGo 1.1.2 — Mobile UI overhaul

- Reworked global dark/light color system and semantic surfaces.
- Added a persistent, explicit Dark / Light segmented theme control in Profile.
- Added a visible `UI 1.1.2` build marker so device bundles are easy to verify.
- Reworked auth, home, profile, tabs, lists and location picker visuals.
- Bottom navigation now uses a floating card treatment with visible icons.
- Android immersive navigation hiding is applied on startup, theme change and app resume.
- Rebuilt LocationPicker render tree so every user-visible string is contained by `<Text>` and stale city requests are ignored.
- Existing API, payment, LiqPay, marketplace economics and deal lifecycle code were intentionally left unchanged.
