# MiLaSi Schema v6 -> v7 Architectural Migration Plan

> **Document Status:** PROPOSED (Architectural Blueprint — Milestone 7 Preparation)  
> **Target Version:** Schema v7  
> **Scope:** Data model invariants, migration algorithm, and validation criteria. No runtime implementation code is introduced in STEP 0.

---

## 1. Executive Summary & Rationale

Schema v6 served single-staff, single-voice workflows (Milestones 1 through 6). In Schema v6:
- `StaffMeasure.voices` was an array where voice identity often defaulted to array position `vIdx === 0`.
- Measure-local voice UUIDs (`voice.id`) could not guarantee cross-measure polyphonic voice continuity across barlines.
- `Score.groups` did not exist (all staves were flat under `parts[0].staves`).
- MIDI channel allocation was implicit (all parts shared default channel 0).

Schema v7 introduces multi-voice polyphony (Milestone 7a), grand staff staves (Milestone 7b), and ensemble score groups (Milestone 7c). This document establishes the migration invariants from Schema v6 to Schema v7.

---

## 2. Target Schema Invariants (Schema v7)

Every valid Schema v7 score must satisfy the following five structural invariants:

### Invariant 1: Explicit One-Based Voice Indexing (`voiceIndex: 1..4`)
- Every `Voice` object must have a mandatory `voiceIndex: 1 | 2 | 3 | 4`.
- Within every `StaffMeasure`, the `voices` array must be sorted in strictly ascending order:
  $$\text{voices}[0].\text{voiceIndex} < \text{voices}[1].\text{voiceIndex} < \dots$$
- Array position must never be used to infer voice identity; cross-measure continuity, stem direction, and range selection operate exclusively on `voiceIndex`.

### Invariant 2: Mandatory Voice 1 (`voiceIndex: 1`)
- Voice 1 is the primary musical voice and **must always be present** in every `StaffMeasure`.
- If a measure has notes only in Voice 2, Voice 1 must exist and contain explicit rest events filling the measure metrical duration.
- A `StaffMeasure` may never have `voices.length === 0`.

### Invariant 3: Score-Level Groups Initialization (`groups = []`)
- The `Score` object must include the field `groups: StaffGroup[]`.
- Migrated legacy scores without group definitions will default to `groups: []`.
- Brackets, braces, and system barlines will reference `StaffGroup` objects defined in this array.

### Invariant 4: Unique Part MIDI Channels (Channel 9 Exclusion)
- Each `Part` in `Score.parts` must be assigned a unique `midiChannel: number` ($0 \le \text{channel} \le 15$).
- **MIDI Channel 9 Exclusion Rule (0-based):** Channel 9 (MIDI Channel 10 in 1-based numbering) is globally reserved for General MIDI standard percussion. Melodic and choral parts in MiLaSi must never be assigned channel 9.
- Available melodic channel pool:
  $$\mathcal{C} = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15]$$

### Invariant 5: Storage and Serialization Envelope
- `schemaVersion` is bumped to `7`.
- Local storage and IndexedDB persistence keys remain unchanged (`scoreforge_db`, `.sfscore`, envelope headers) per `docs/LEGACY_IDENTIFIERS.md`.

---

## 3. Step-by-Step Migration Algorithm

```typescript
function migrateScoreV6toV7(v6Score: ScoreV6): ScoreV7 {
  // 1. Clone score deeply
  const v7Score = structuredClone(v6Score);

  // 2. Bump schema version
  v7Score.schemaVersion = 7;

  // 3. Initialize groups if missing
  if (!Array.isArray(v7Score.groups)) {
    v7Score.groups = [];
  }

  // 4. Allocate unique MIDI channels (excluding channel 9)
  const availableChannels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15];
  let channelIndex = 0;
  for (const part of v7Score.parts) {
    if (typeof part.midiChannel !== 'number' || part.midiChannel === 9) {
      part.midiChannel = availableChannels[channelIndex % availableChannels.length];
      channelIndex++;
    }
  }

  // 5. Normalize StaffMeasures and Voices
  for (const part of v7Score.parts) {
    for (const staff of part.staves) {
      for (const mDef of v7Score.measures) {
        let staffMeasure = staff.measures[mDef.id];
        if (!staffMeasure) {
          staffMeasure = { id: crypto.randomUUID(), voices: [] };
          staff.measures[mDef.id] = staffMeasure;
        }

        // Assign voiceIndex if missing
        for (let i = 0; i < staffMeasure.voices.length; i++) {
          const voice = staffMeasure.voices[i];
          if (typeof voice.voiceIndex !== 'number') {
            voice.voiceIndex = i + 1;
          }
        }

        // Sort voices strictly by voiceIndex ascending
        staffMeasure.voices.sort((a, b) => a.voiceIndex - b.voiceIndex);

        // Ensure Voice 1 is present
        const hasVoice1 = staffMeasure.voices.some((v) => v.voiceIndex === 1);
        if (!hasVoice1) {
          const targetDuration = mDef.actualTicks ?? measureTicks(mDef.timeSig);
          const defaultRest = createRest({ duration: targetDuration });
          staffMeasure.voices.unshift({
            id: crypto.randomUUID(),
            voiceIndex: 1,
            events: [defaultRest],
          });
        }
      }
    }
  }

  return v7Score;
}
```

---

## 4. Verification and Regression Testing Matrix

| Test Category | Target Check | Acceptance Criteria |
|:---|:---|:---|
| **Legacy Fixture Migration** | Load v1, v2, v3, v4, v5, v6 test fixture files | Successfully migrates to v7 without runtime exceptions. |
| **Voice Order Invariant** | Inspect all `staffMeasure.voices` post-migration | Voices are strictly sorted by `voiceIndex` ascending; Voice 1 is always present. |
| **MIDI Channel Integrity** | Verify allocated `part.midiChannel` across 16 parts | All allocated channels are distinct; Channel 9 is never allocated. |
| **Golden Snapshot Rendering** | Run 25 gallery snapshot tests on migrated v6 scores | 100% byte-for-byte visual equivalence in SVG DOM output. |
| **Undo / Redo Safety** | Perform edits on migrated scores, undo to load point | State round-trips cleanly without losing `voiceIndex` or `groups`. |
