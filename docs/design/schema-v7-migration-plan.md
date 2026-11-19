# MiLaSi — Schema v6 to v7 Migration Plan

Status: SPECIFIED BY LEAD (implementation in M7a-1)

## 1. Facts about schema v6 (verify against code in Stage A)
- Voice has no voiceIndex field. Voice identity was the 0-based position of the
  voice in StaffMeasure.voices; Voice.id is a per-measure random id and must not
  be compared across measures.
- Part has no midiChannel and no shortName. Score has no groups.
- Ties are stored per pitch (Pitch.tiedToNext). Slurs are stored on Staff and
  refer to event ids. Overrides are keyed by element id.
- Measures may have actualTicks (pickup) and any time signature.

## 2. Schema v7 invariants
1. Voice.voiceIndex is mandatory, an integer 1..4, and is the SOLE voice
   identity. Array order has no meaning. voices are sorted by voiceIndex
   ascending on every write.
2. Voice 1 exists in every StaffMeasure. A StaffMeasure never has zero voices.
3. Score.groups: StaffGroup[] exists (empty for migrated scores).
4. Part.midiChannel (0..15) and Part.shortName exist.
   - Percussion parts use channel 9.
   - Non-percussion parts never use channel 9. They are assigned from
     [0,1,2,3,4,5,6,7,8,10,11,12,13,14,15] in part order. Channels are unique up
     to 15 non-percussion parts. Beyond 15, channels are reused and
     validateScore emits a WARNING (not an error).
   - shortName comes from the instrument catalogue (for example "Vln.",
     "Pno."). If the instrument is unknown, use the part name unchanged when it
     is at most 6 characters, else its first 4 characters followed by "."; this
     fallback is documented and tested. Never use plain string slicing when the
     catalogue knows the instrument.
5. schemaVersion = 7. Storage keys, the .sfscore extension and the envelope
   stay as listed in docs/LEGACY_IDENTIFIERS.md.
6. Existing ids (voice ids, event ids, measure ids, override keys) are never
   regenerated.

## 3. Migration algorithm (v6 to v7; the chain v1..v6 runs first)
Preconditions are checked BEFORE anything is changed. Any failure aborts the
load; the input is never modified.
P1. schemaVersion is 6 after the earlier migrations. A schemaVersion greater
    than 7 is rejected with a Turkish message (i18n).
P2. Every StaffMeasure has at most 4 voices. If a measure has more than 4, the
    load is rejected with a Turkish message naming the measure. No note is ever
    dropped or merged silently.
Steps:
S1. Work on a deep copy. The original object is never mutated.
S2. For each StaffMeasure: voiceIndex = array position + 1 (1..4). Existing
    voice ids are kept. Voices are sorted by voiceIndex.
S3. If a StaffMeasure is missing for a MeasureDef, or it has no voice 1, create
    voice 1 filled with rests using the existing "fill measure with rests"
    helper, which splits any length into valid rest values (dotted values and
    ties of rests where needed). The target length is MeasureDef.actualTicks
    when present, else the length from the time signature. Never create a rest
    with an arbitrary duration.
S4. Newly created ids are DETERMINISTIC: derived from stable inputs (measure id,
    staff id, voiceIndex, running counter) with a pure hash function in core. No
    crypto.randomUUID and no Math.random in migration. The same input gives a
    byte-identical output.
S5. Part.midiChannel and Part.shortName per invariant 4.
S6. groups = [].
S7. schemaVersion = 7.
S8. Postcondition: validateScore(v7 score) returns no errors. Warnings (for
    example more than 15 parts) are allowed. If the postcondition fails, abort;
    the input stays untouched and the autosave is not overwritten.

## 4. Ties and slurs
- A tie across a barline connects the pitch in measure N to the matching pitch
  in the NEXT measure of the SAME voiceIndex (not the same array position).
- Slurs keep their event ids and must stay inside one voice (validateScore).
- Migrating a v6 score must not change which events a tie or slur connects.

## 5. validateScore v7 rules
- Unique voiceIndex per StaffMeasure; at most 4 voices; voice 1 exists.
- Per-voice tick sum equals the measure length (actualTicks when present).
- Ties and slurs are intra-voice.
- A StaffMeasure exists for every MeasureDef in every staff.
- WARNING (not error): more than 15 non-percussion parts share channels.

## 6. Failure and data-safety policy
- A failed migration changes nothing: not the loaded file, not the autosave.
- Unknown future versions (> 7) are rejected with a clear message.
- Saving a migrated score writes schemaVersion 7; the original v6 file on disk
  is never overwritten unless the user saves over it.

## 7. Test matrix (all must exist and pass)
- Real saved .sfscore fixtures for v1, v2, v3, v4, v5, v6, created through the
  real app path (rule R1), each migrates to a valid v7 score.
- Idempotent: migrating a v7 score again changes nothing; migrate(v6) twice
  gives byte-identical output (determinism).
- Property/fuzz test over random valid v6 scores: the migrated score validates,
  serialises and deserialises to an equal score, and single-voice scores render
  identically to before (all 25 golden snapshots unchanged).
- Voice order: voices stored in different array order across measures still
  keep the same voiceIndex identity after migration and in selection.
- Missing voice 1 in 3/4, 5/8, 7/8, and in a pickup measure with actualTicks:
  rests are valid.
- More than 4 voices in one measure: load rejected, input untouched, Turkish
  message.
- schemaVersion 8: rejected.
- MIDI: 15 non-percussion parts get 15 distinct channels, none equals 9; a
  16-part score reuses channels and validateScore returns a warning; a
  percussion part gets 9.
- Ties across a barline in voice 1 and in voice 2 survive migration unchanged.
- Undo back to the load point keeps voiceIndex and groups.

## 8. Not in this step
Stem directions, voice offsets, rest shifts and gallery cards (M7a-2), keymap
and Tab voice switching (M7a-2), grand staff alignment (M7b), groups beyond the
empty array (M7c).
