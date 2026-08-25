# Structured locations

User-facing coordinates are removed in v0.7. Cargo and trips use structured places: country code, catalog city id, and an optional private street/address. The backend resolves a city to a temporary city-centre point used by the rough matcher.

The alpha catalog is intentionally Ukraine-first (30 major cities) because the initial marketplace is domestic. `LocationService` is a provider boundary: a complete worldwide city dataset/geocoding provider can replace the in-memory catalog without changing Cargo/Trip API payloads or mobile screens.
