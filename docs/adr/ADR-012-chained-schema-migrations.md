# ADR-012: Chained Forward Schema Migrations for Backward Compatibility

**Status:** Accepted  
**Deciders:** ScoreForge Core Engineering  
**Date:** 2026-11-17 (Consolidated in Milestone H1)  

## Context
As ScoreForge evolves from milestone to milestone (M1 through M6 and beyond), the score data model expands to accommodate new musical concepts:
- Schema v1: basic notes, rests, measures, staves.
- Schema v2: note-level ties migrated to pitch-level `tiedToNext`.
- Schema v3: staff-level `slurs` array.
- Schema v4: score metadata (title, subtitle, composer, arranger) and measure `endBarline`.
- Schema v5: repeat signs (`repeatStart`, `repeatEnd`), voltas, and lyric syllables.
- Schema v6: repeat string normalization and multi-verse lyrics array structure.

Scores saved in earlier milestones or shared by users must load reliably in current and future versions without data corruption or parsing failures.

## Decision
We implement a strict forward chained migration pipeline (`src/io/json.ts`):
1. **Explicit Schema Version:** Every saved score envelope includes `schemaVersion: number` (currently version 6). Unversioned or legacy files default to `schemaVersion = 1`.
2. **Deterministic Chained Steps:** Instead of complex N-to-M ad-hoc conversion scripts, migrations are defined strictly between consecutive versions:
   - `migrateV1ToV2`
   - `migrateV2ToV3`
   - `migrateV3ToV4`
   - `migrateV4ToV5`
   - `migrateV5ToV6`
3. **Automated Pipeline:** `deserializeScore` inspects `schemaVersion`. If the file version is less than `CURRENT_SCHEMA_VERSION`, it sequentially executes migrations step-by-step (`v = v1 -> v2 -> v3 ... -> v6`).
4. **Post-Migration Validation:** After migrations finish, `validateScore` runs against the migrated score to ensure structural integrity before rendering.

## Consequences
### Positive
- 100% backward compatibility: files saved in any prior version load seamlessly.
- Each migration is small, isolated, and covered by dedicated unit tests (`tests/io/migrations.test.ts`).
- New schema changes in future milestones (e.g. M7 multi-voice) simply append `migrateV6ToV7` without touching existing migrations.

### Negative
- Old schema fields must be preserved during intermediate migration steps until transformed to the latest representation.
