# Test Fixtures

This directory contains test score fixtures used for backward compatibility and migration verification.

## Legacy Schema Fixtures (`scores/*_generated.sfscore`)

The fixtures `v1_generated.sfscore` through `v6_generated.sfscore` are generated programmatically by `scripts/generateLegacyFixtures.mjs`.

### How They Are Generated
`scripts/generateLegacyFixtures.mjs` defines the historical schema shapes and structures for versions 1 through 6:
- **v1_generated.sfscore (schemaVersion: 1):** Flat event-level `tiedToNext` property on note events, no `part.midiChannel`, no `shortName`, no `groups`.
- **v2_generated.sfscore (schemaVersion: 2):** Pitch-level `tiedToNext` property inside `pitches[]`, no staff-level slurs.
- **v3_generated.sfscore (schemaVersion: 3):** Introduces `staff.slurs: []`, unstyled barlines.
- **v4_generated.sfscore (schemaVersion: 4):** Introduces `meta.subtitle`, `meta.arranger`, and explicit `endBarline: 'single' | 'final'`.
- **v5_generated.sfscore (schemaVersion: 5):** String repeat types (`repeat: 'start' | 'end'`) and string lyrics (`lyrics: string`).
- **v6_generated.sfscore (schemaVersion: 6):** Modern boolean repeat markers (`repeatStart`, `repeatEnd`) and structured `LyricWord[]` objects, prior to schema v7 multi-voice additions.

These files are programmatically synthesized historical fixtures (not historical user saves from prior production versions), and are named `*_generated.sfscore` to accurately reflect their origin.
