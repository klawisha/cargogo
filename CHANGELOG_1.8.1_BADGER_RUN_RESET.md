# CargoGo 1.8.1 — Badger Run reset hotfix

- Fixed the home-page Badger Run interactive so a lost run actually starts from a clean state.
- On the last lost life: current streak resets to 0, round counter resets to 1, lives restore to 3, runner and beacon return to their initial positions.
- BEST remains persisted in SecureStore and is never cleared by a lost run.
- Non-terminal misses still consume one life, reset the current streak, and advance the round.
