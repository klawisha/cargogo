# Matching v2

v0.7 keeps routing intentionally simple: each trip is a line between the selected city centres. The matcher no longer treats every corridor hit as equivalent.

Score is 0–100 and is persisted with a breakdown:
- city compatibility: 0–45 (exact origin/destination city pair wins)
- route proximity: 0–20
- direction: 0–10
- capacity fit: 0–10
- time compatibility: 0–10
- reward signal: 0–5

`match_kind` is `exact_city_pair`, `nearby_city_pair`, or `corridor`. Exact city pairs sort first naturally via the score. When a real routing provider is added later, only the proximity/detour inputs need replacement; the marketplace contract remains stable.
