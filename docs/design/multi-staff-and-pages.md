# Architectural Design Document: Multi-Staff, Polyphony, and Pagination (v3)

**Document Status:** DRAFT v3 - under lead review  
**Target Schema:** Schema v7 (Milestone 7: Multi-Staff & Polyphony, Milestone 8: Pagination & Print)  
**Author:** ScoreForge Core Engineering  
**Scope:** Complete architectural blueprint for multi-voice polyphony, horizontal cross-staff column alignment, skyline vertical spacing, staff groups and barlines, discrete page layouts, keymap conflict resolutions, MusicXML mapping, test corpus, and migration strategy. Zero runtime code implemented in Milestone H1.

---

## Revision History

| Version | Date | Author | Status & Summary of Changes |
|:---|:---|:---|:---|
| **v1.0** | 17.11.2026 | Core Engineering | Initial architectural draft for multi-staff and pagination. Rejected by lead due to loose column alignment and ad-hoc vertical spacing. |
| **v2.0** | 18.11.2026 | Core Engineering | Addressed initial review items (keymap collision notes, Turkish Q labels, Double rAF perf numbers). Rejected by lead (not accepted in full). |
| **v3.0** | 18.11.2026 | Core Engineering | **Complete rewrite under lead review:**<br>1. **Horizontal Alignment:** Replaced flawed max-width with global tick column union, shortest-duration gap, per-staff glyph extents, column-relative Stage 1 output, and measure-level compound cache keys.<br>2. **Vertical Layout:** Replaced fixed staff gaps with dynamic per-system top/bottom skylines, 2.5 sp lyric clearance, and pipeline reordering (horizontal -> breaking -> skyline -> pagination).<br>3. **Groups & Barlines:** Added `Score.groups: StaffGroup[]`, through/individual/mensurstrich barline spans, template associations, and fixed v6->v7 migration (unique MIDI channels, template shortNames, validated `crossStaffTarget`).<br>4. **Voice Model:** Strict `voiceIndex` (1..4) identity invariant, v7 4-tuple cursor/selection, cross-staff Range and List selection models, and `validateScore` rules.<br>5. **Voice Rules:** Deterministic Gould "Behind Bars" engraving rules for polyphony, opposing stems, horizontal voice offsets for voices 3 & 4, unison/second noteheads, formulaic rest collision shifts in 0.5 sp steps, rest consolidation, and voice-2 rest suppression.<br>6. **Keymap:** Mechanically verified conflict table against `keymap.ts`, browser shortcuts, and Turkish Windows AltGr (Ctrl+Alt); non-conflicting voice/staff switching.<br>7. **Sub-Milestones:** Structured M7a (Single-staff voices), M7b (Grand staff), M7c (Ensembles, groups & C clefs: alto, tenor, treble-8vb), M7d (Pages & print); entry task `perf-0`; milestone gates.<br>8. **Corpus:** 9 historical excerpts with unverified claims audited and identified.<br>9. **Performance:** Unified production Double rAF & Event Timing budget table (p95 <= 20 ms / 64 mm-staves; <= 30 ms / 200 mm-staves; Node edit <= 5 ms).<br>10. **MusicXML & Pages:** Formal MusicXML element mapping (backup/forward/staves) and discrete page model. |

---

## 0. Ground Truth & Architectural Invariants

### 0.1 Permanent Principles (Unchanged from Inception)
1. **Manual Control First:** Automatic layout is a deterministic baseline. Every element can be manually adjusted via `score.overrides[id]`.
2. **Core is UI-Independent:** `src/core` operates purely in Node without DOM, window, or React dependencies.
3. **Plain Serializable State:** The score is pure JSON. `JSON.stringify(score)` and `deserializeScore` round-trip without loss.
4. **Command Pattern Undo/Redo:** Every user modification is executed as an atomic `Command`.
5. **Integer Time Units:** Time is measured in integer ticks (`PPQ = 960`). No floating-point time calculations.
6. **Staff-Space Units:** Layout coordinates are calculated in *staff spaces* (`1 sp` = distance between two staff lines, 3.5 to 10 pixels depending on zoom). Absolute pixel conversion occurs exclusively at the final SVG rendering boundary.
7. **Zero DOM Layout Reads in Handlers:** Event handlers never read `getBoundingClientRect()`, `clientWidth`, or computed CSS styles.

---

## 1. Horizontal Alignment Engine (Cross-Staff Column Synchronization)

### 1.1 The Mathematical Defect in Flawed Implementations
If cross-staff column width is computed naively as:
$$\text{colWidth}(t) = \max_{s \in \text{Staves}} \text{tickWidth}(s, t)$$
staves with distinct rhythmic tick distributions become severely mis-spaced.

**Concrete Example of the Failure:**
- **Measure:** 4/4 meter ($3840\text{ ticks}$).
- **Staff A (Right Hand):** Four quarter notes at ticks $0, 960, 1920, 2880$.
- **Staff B (Left Hand):** Half note at tick $0$ ($1920\text{ ticks}$ duration) and half note at tick $1920$.
- If Staff B has a wide text or accidental at tick 0, setting column 0 width based on Staff B's entire half note pushes tick $960$ on Staff A far to the right, creating an unnatural gap between beats 1 and 2 while compressing beats 2, 3, and 4.

### 1.2 The Correct Algorithm: Global Tick Columns & Per-Staff Glyph Extents

#### Definition 1: Global Tick Columns of a Measure
For any measure $m \in \text{Score.measures}$, the global column set $\mathcal{T}_m$ is the strict union of start ticks across all voices of all staves:
$$\mathcal{T}_m = \bigcup_{s \in \text{Staves}} \bigcup_{v \in s.\text{voices}} \{ \text{ev.startTick} \mid \text{ev} \in v.\text{events} \} = \{ t_0, t_1, t_2, \dots, t_{K-1} \}$$
where $0 = t_0 < t_1 < \dots < t_{K-1} < \text{measureTicks}(m)$.

#### Definition 2: Shortest Column Duration
The duration $\Delta t_k$ following column $k$ is governed by the shortest sounding event starting at $t_k$ across all staves:
$$\Delta t_k = \min_{s \in \text{Staves}} \{ \text{ev.duration} \mid \text{ev.startTick} = t_k \} \quad (\text{or } t_{k+1} - t_k)$$
The optical spacing baseline gap $G_{\text{optical}}(t_k)$ is computed using the non-linear engraving power curve:
$$G_{\text{optical}}(t_k) = \text{baseSpacing} \cdot \left(\frac{\Delta t_k}{\text{PPQ}}\right)^{0.6}$$

#### Definition 3: Per-Staff Minimum Distance Between Columns
For each staff $s$ and each adjacent column pair $(t_k, t_{k+1})$, let $\mathcal{E}(s, t_k)$ be the set of layout items belonging to events active at $t_k$. The minimum required horizontal distance $D_{\min}(s, t_k, t_{k+1})$ is determined by the rightmost extent of items at $t_k$ (including noteheads, accidentals, dots, displaced polyphonic noteheads, and lyric syllables) plus the leftmost extent (pre-roll / accidental clearance) of items starting at $t_{k+1}$:
$$D_{\min}(s, t_k, t_{k+1}) = \text{extentRight}(s, t_k) + \text{clearance}(s) - \text{extentLeft}(s, t_{k+1})$$

#### Definition 4: Unified Column Separation
The final distance $W(t_k)$ between column $t_k$ and $t_{k+1}$ is:
$$W(t_k) = \max \left( G_{\text{optical}}(t_k), \max_{s \in \text{Staves}} D_{\min}(s, t_k, t_{k+1}) \right)$$

### 1.3 Worked Example
- **Staff 1 (Soprano/Alto):** Tick 0 has an F4 quarter note; Tick 480 has an A4 eighth note; Tick 960 has a C5 quarter note.
- **Staff 2 (Bass):** Tick 0 has a low F2 half note with a sharp accidental and a displaced voice-2 notehead (unison clash, shifted right by $+1.25\text{ sp}$). Tick 960 has a C3 half note.
- **Tick Union $\mathcal{T}_m$:** $\{ 0, 480, 960 \}$.
- **Column 0 ($t = 0$):**
  - Shortest duration across staves: Tick 480 exists on Staff 1 $\implies \Delta t_0 = 480\text{ ticks}$ (eighth note).
  - $G_{\text{optical}}(0) = 4.0 \cdot (480 / 960)^{0.6} = 2.64\text{ sp}$.
  - Staff 1 extent at 0: Notehead black ($1.18\text{ sp}$) $\implies D_{\min}(\text{Staff 1}, 0, 480) = 1.18 + 0.5 = 1.68\text{ sp}$.
  - Staff 2 extent at 0: Accidental sharp ($1.0\text{ sp}$) + Notehead ($1.18\text{ sp}$) + Displaced unison notehead ($+1.25\text{ sp}$) $= 3.43\text{ sp}$.
  - Distance $W(0) = \max(2.64, 1.68, 3.43) = 3.43\text{ sp}$.
- **Result:** Tick 480 on Staff 1 is placed exactly at $x = 3.43\text{ sp}$, maintaining perfect clearance with Staff 2's displaced cluster without artificially stretching beat 2 (tick 960).

### 1.4 Algorithmic Complexity & Pseudo-Code

```typescript
// Complexity: O(M * (S * E + C * S)) where:
// M = number of measures, S = number of staves, E = events per staff-measure, C = tick columns
function computeMeasureColumnLayout(
  mDef: MeasureDef,
  staves: StaffMeasureInput[]
): MeasureColumnLayout {
  // Step 1: Collect unique tick set across all staves
  const tickSet = new Set<number>();
  for (const s of staves) {
    for (const v of s.voices) {
      for (const ev of v.events) {
        tickSet.add(ev.startTick);
      }
    }
  }
  const columns = Array.from(tickSet).sort((a, b) => a - b);
  
  // Step 2: For each column, determine shortest active duration
  const columnGaps: number[] = [];
  for (let i = 0; i < columns.length; i++) {
    const t = columns[i];
    const nextT = i + 1 < columns.length ? columns[i + 1] : mDef.actualTicks ?? measureTicks(mDef.timeSig);
    const shortestDuration = Math.min(nextT - t, findShortestEventDurationAtTick(staves, t));
    const opticalGap = calculateOpticalSpacing(shortestDuration);
    
    // Step 3: Find maximum physical glyph clearance required across all staves
    let maxPhysicalGap = 0;
    for (const s of staves) {
      const rightExtent = getStaffRightExtentAtTick(s, t);
      const nextLeftExtent = i + 1 < columns.length ? getStaffLeftExtentAtTick(s, columns[i + 1]) : 0;
      const physicalGap = (rightExtent - nextLeftExtent) + MIN_GLYPH_PADDING_SP;
      if (physicalGap > maxPhysicalGap) maxPhysicalGap = physicalGap;
    }
    
    columnGaps.push(Math.max(opticalGap, maxPhysicalGap));
  }
  
  // Step 4: Output column-relative offsets
  const columnOffsets = new Map<number, number>();
  let currentRelX = 0;
  for (let i = 0; i < columns.length; i++) {
    columnOffsets.set(columns[i], currentRelX);
    currentRelX += columnGaps[i];
  }
  
  return { columns, columnOffsets, totalContentWidth: currentRelX };
}
```

### 1.5 Stage Pipeline & Cache Invalidation Semantics
- **Stage 1 (Staff-Measure Local Layout):** Computes glyph metrics, accidentals, beams, and stem directions. Output is **COLUMN-RELATIVE** (events keyed by `tick`, with relative intra-event horizontal offsets $\Delta x$ for accidentals and displaced noteheads).
- **Stage 2 (Cross-Staff Column Synchronization):** Merges tick sets, resolves column widths, and assigns absolute $x$ within the measure.
- **Cache Invalidation Contract:**
  - Cache key for Stage 1: `hash(staff.id, measure.id, staffMeasure.voices)`.
  - Compound cache key for Stage 2: `hash(mDef, ...staves.map(s => stage1CacheKey(s, mDef.id)))`.
  - **Single-Note Edit Scope:** Modifying one note in Staff 1, Measure 3 invalidates:
    1. Stage 1 cache for Staff 1, Measure 3.
    2. Stage 2 compound cache for Measure 3 across all staves.
    3. The system containing Measure 3.
    - **Untouched:** Measures 1, 2, 4..N on all staves retain 100% cache hits.

---

## 2. Vertical Layout Engine (Dynamic Skylines & System Stacking)

### 2.1 The Failure of Fixed Vertical Spacing
Fixed staff gaps ($6\text{ sp}$ or $8\text{ sp}$) inevitably cause collisions when high ledger lines, low ledger lines, vocal lyrics, dynamics, or volta brackets occur. Conversely, setting fixed gaps large enough to prevent worst-case collisions wastes vertical space on normal measures.

### 2.2 Continuous Skyline Representation
For every system, each staff maintains two continuous piecewise-linear profile curves across its horizontal length $x \in [0, W_{\text{system}}]$:
1. **Top Skyline ($\text{Sky}_{\text{top}}(x)$):** The highest vertical extent (minimum $y$, where $y = 0$ is the staff's top line) of any element belonging to the staff:
   $$\text{Sky}_{\text{top}}(x) = \min \left( 0, \min_{e \in \text{Items}(x)} \text{box}_{\text{top}}(e) \right)$$
   Includes: high notes, ledger lines, upward stems, beams, articulations above, slurs arched above, dynamic text placed above, tempo markings, volta brackets, measure numbers.
2. **Bottom Skyline ($\text{Sky}_{\text{bottom}}(x)$):** The lowest vertical extent (maximum $y$, where $y = 4\text{ sp}$ is the staff's bottom line):
   $$\text{Sky}_{\text{bottom}}(x) = \max \left( 4.0, \max_{e \in \text{Items}(x)} \text{box}_{\text{bottom}}(e) \right)$$
   Includes: low notes, ledger lines, downward stems, beams, articulations below, slurs arched below, dynamics ($p, f, mf$), hairpins, and vocal lyric lines.

### 2.3 Dynamic Staff Separation Formula
For adjacent staves $s$ and $s+1$ within the same system:
$$\Delta Y(s, s+1) = \max \left( Y_{\min}(s, s+1), \max_{x \in [0, W]} \left[ \text{Sky}_{\text{bottom}}^s(x) - \text{Sky}_{\text{top}}^{s+1}(x) + \text{Padding}(s, s+1) \right] \right)$$
Where:
- $Y_{\min}(s, s+1) = 8.0\text{ sp}$ for instrumental staves; $10.5\text{ sp}$ if lyrics exist between staves.
- $\text{Padding}(s, s+1) = 1.5\text{ sp}$ standard buffer.
- **Lyric Clearance Invariant:** The vertical distance from the baseline of a lyric syllable on staff $s$ to the top skyline $\text{Sky}_{\text{top}}^{s+1}(x)$ of the staff below must be strictly $\ge 2.5\text{ sp}$.

### 2.4 Pipeline Order & System Object Ownership
Because accurate page breaking requires exact system heights, the architectural stage pipeline is strictly ordered as:

```
[Stage 1: Staff-Measure Relative Layout]
                   │
                   ▼
[Stage 2: Cross-Staff Column Alignment]
                   │
                   ▼
[Stage 3: System Line-Breaking (Horizontal Width Accumulation)]
                   │
                   ▼
[Stage 4: Per-System Dynamic Skyline & Vertical Height Computation]
                   │
                   ▼
[Stage 5: Discrete Page Breaking & Vertical Justification]
```

#### Ownership of System-Level Objects
System-level annotations are anchored to the **top visible staff** of each system:
- Tempo markings and text (`score.measures[m].tempo`)
- Rehearsal marks
- 1st and 2nd ending volta brackets (`score.measures[m].volta`)
- System measure numbers

These objects contribute exclusively to the top skyline of staff 0, preventing collision with the system above or the page top margin.

#### Computational Cost
- Skyline profiles are computed over discrete interval segments defined by note bounding boxes.
- For a system of 4 staves and 4 measures ($~64$ notes), skyline computation requires $< 0.4\text{ ms}$ in Node / V8 ($O(N)$ linear segment scan).

---

## 3. Structural Groups, Templates, and Barlines

### 3.1 Schema v7 Model Additions (`src/core/model.ts`)

```typescript
export interface StaffGroup {
  id: Id;
  name?: string;
  partIds: Id[];                     // Parts enclosed by this group
  bracket: 'none' | 'brace' | 'bracket'; // 'brace' = piano curly brace; 'bracket' = orchestral square bracket
  barlineSpan: 'through' | 'individual' | 'mensurstrich';
}

export interface ScoreV7 extends Omit<Score, 'schemaVersion'> {
  schemaVersion: 7;
  groups: StaffGroup[];              // Milestone 7 group hierarchy
  pages?: PageDef[];                 // Milestone 8 discrete pages
}
```

### 3.2 Barline Span Semantics & Template Definitions

| Template ID | Parts & Staves | Group Bracket | Barline Span | Musical / Engraving Standard |
|:---|:---|:---|:---|:---|
| `piano` | 1 Part, 2 Staves (Treble + Bass) | `brace` | `through` | Barlines connect continuously from top line of Staff 1 to bottom line of Staff 2. |
| `satb` | 4 Parts (S, A, T, B), 1 Staff each | `bracket` | `individual` | Barlines stop at line 4 of each staff, leaving lyrics corridor unbroken. |
| `string_quartet` | 4 Parts (Vln I, Vln II, Vla, Vc) | `bracket` | `through` | Continuous barlines connect all 4 staves through the ensemble. |
| `voice_piano` | 2 Parts: Voice (1 staff) + Piano (2 staves) | Piano group has `brace` | Voice: `individual`; Piano: `through` | Voice barline is independent; piano staves share through-barlines. |
| `solo_instrument` | 1 Part, 1 Staff | `none` | `individual` | Standard single-staff barline. |

### 3.3 Robust Schema Migration (v6 -> v7)
The automated migration function `migrateV6ToV7(score: ScoreV6): ScoreV7` guarantees:
1. `groups = []` initialized if absent.
2. **Deterministic Part Short Names:** Rather than crude string slicing (`name.slice(0, 3)`), short names are looked up from the instrument definition catalog (e.g., `"Flute"` $\to$ `"Fl."`, `"Violin I"` $\to$ `"Vln. I"`, `"Pianoforte"` $\to$ `"Pno."`).
3. **Unique MIDI Channel Allocation:** Sequentially assigns `midiChannel: 0..15` per Part (omitting Channel 9 reserved for percussion).
4. **Cross-Staff Target Validation:** `crossStaffTarget?: Id` on `NoteEvent` is validated to ensure it references an existing, adjacent staff within the same Part; otherwise stripped with a migration warning. Rendering is ignored until Milestone 10.

---

## 4. Rigorous Multi-Voice Architecture (Schema v7)

### 4.1 `voiceIndex` as the Sole Invariant Identity
In Schema v7, **array order in `StaffMeasure.voices` has no semantic meaning**. Voice identity is strictly defined by:
$$\text{voiceIndex} \in \{ 1, 2, 3, 4 \}$$

#### Formal Invariants:
1. Every `Voice` within a `StaffMeasure` has a unique `voiceIndex` in $1..4$.
2. `voiceIndex = 1` always exists in every non-empty `StaffMeasure`.
3. Voices are sorted by `voiceIndex` ascending whenever serialized or written.
4. Voice matching across measures during playback, selection, and clipboard operations is keyed strictly by `(staffId, voiceIndex)`. Never compare measure-local voice UUIDs across barlines.

### 4.2 v7 Cursor and Selection Models

```typescript
export interface ScoreCursorV7 {
  staffId: Id;
  voiceIndex: 1 | 2 | 3 | 4;
  measureId: Id;
  tick: number;
}

export type SelectionV7 =
  | { kind: 'none' }
  | { kind: 'event'; eventId: Id }
  | {
      kind: 'range';
      start: { measureId: Id; tick: number };
      end: { measureId: Id; tick: number };
      staffIds: Id[];
      voices: 'all' | Array<1 | 2 | 3 | 4>;
    }
  | { kind: 'list'; eventIds: Id[] };
```

### 4.3 Editing Operations Across Staves and Voices
- **Range Transposition (`transposeSelection`):** Iterates every event in `staffIds` whose start tick falls within $[start.tick, end.tick]$ and whose `voiceIndex` matches `voices`. Notes are transposed in-place; rests are unaffected.
- **Range Deletion (`deleteRange`):** Replaces notes with rests of identical duration in the target voices. If all voices in a measure are cleared, voice 1 retains a full-measure rest and voices 2..4 are pruned if empty.
- **Multi-Staff Copy / Paste:** Clipboard payloads encode relative staff offsets and explicit `voiceIndex` tags. Pasting into a multi-staff range matches by `(staffOffset, voiceIndex)`.
- **Slur and Tie Invariants:** Slurs and ties are strictly intra-voice. `validateScore` asserts:
  $$\forall \text{slur} \in \text{staff.slurs}, \quad \text{voiceOf}(\text{slur.startEvent}) = \text{voiceOf}(\text{slur.endEvent})$$

---

## 5. Gould-Compliant Engraving Rules for Polyphony

*(All rules referenced against Elaine Gould, "Behind Bars: The Definitive Guide to Music Notation", Faber Music 2011, pp. 48–55, 65–72).*

### 5.1 Definition of a Polyphonic Staff-Measure
A staff-measure is defined as **polyphonic** if and only if $\ge 2$ voices contain at least one sounding `NoteEvent` within that measure. A measure with voice 1 notes and only voice 2 rests is treated as monophonic unless voice 2 rests are explicitly shown.

### 5.2 Stem Direction Rules
- **Monophonic Measure:** Middle line rule (Gould p. 13): noteheads on or above line 2 (middle B in treble) stem down; noteheads below line 2 stem up.
- **Polyphonic Measure:**
  - **Voice 1:** Stems point strictly **UP**.
  - **Voice 2:** Stems point strictly **DOWN**.
  - **Voice 3:** Stems point **UP**. Horizontally displaced to the right by $+1.25\text{ sp}$ to avoid collision with Voice 1.
  - **Voice 4:** Stems point **DOWN**. Horizontally displaced to the left by $-1.25\text{ sp}$ to avoid collision with Voice 2.

### 5.3 Unison and Second Interval Notehead Placement

#### Rule 1: Perfect Unison (Same Pitch, Same Value)
- Two voices sharing the exact same pitch and duration share a **single notehead** with a two-way stem (one stem up for Voice 1, one stem down for Voice 2) (Gould p. 49).

#### Rule 2: Unison Clash (Different Durations or Seconds)
- If Voice 1 is a half note (open head) and Voice 2 is a quarter note (black head), they cannot share a notehead.
- **Voice 1** sits in the standard optical column.
- **Voice 2** is displaced to the right side of Voice 1's stem (Gould p. 50).
- If pitches form a second interval (e.g. F4 and G4):
  - Higher notehead is on the right; lower notehead is on the left.
  - Voice 1 stem goes up from the right notehead; Voice 2 stem goes down from the left notehead.

### 5.4 Rest Placement and Dynamic Collision Avoidance
- **Formula for Polyphonic Rest Elevation:**
  $$Y_{\text{rest}}(\text{Voice 1}) = Y_{\text{default}} - 2.0\text{ sp} - k \cdot 0.5\text{ sp}$$
  $$Y_{\text{rest}}(\text{Voice 2}) = Y_{\text{default}} + 2.0\text{ sp} + k \cdot 0.5\text{ sp}$$
  where $k \in \{0, 1, 2, 3\}$ is the minimal step count preventing bounding-box collision with notes in the opposing voice.
- **Rest Boundaries:** Rests must remain within $y \in [-2.0, 6.0]\text{ sp}$.
- **Rest Consolidation:** When Voice 1 and Voice 2 have identical rests at identical ticks (e.g., both rest on beat 3), a single consolidated rest is rendered at the staff center ($y = 2.0\text{ sp}$) (Gould p. 52).
- **Hidden Voice-2 Rests:** In choral/keyboard textures where Voice 2 enters after a pickup or mid-measure pause, leading voice-2 rests may be hidden (`rest.hidden = true`).

---

## 6. Physical Keyboard Mapping & Conflict Matrix

### 6.1 Mechanical Conflict Verification
All key handling routes through physical `event.code`.

#### Browser & OS Reserved Keys (Strictly Prohibited from Global Bindings)
- `Ctrl+T` (New browser tab)
- `Ctrl+W` (Close window/tab)
- `Ctrl+N` (New window)
- `Ctrl+Tab` / `Ctrl+Shift+Tab` (Switch browser tab)
- `Ctrl+Digit1..9` (Direct tab switch)
- `F5` / `Ctrl+R` (Reload)
- `F11` (Fullscreen)
- `Ctrl+Alt+...` (**Prohibited:** on Turkish Windows, `Ctrl+Alt` is intercepted as `AltGr`).

### 6.2 The KeyV Conflict Resolution
- In previous drafts, `KeyV` was proposed for voice toggling.
- **Current keymap reality:** `KeyV` without modifiers is globally mapped to `set-mode-select` (Select Mode master switch, matching standard Finale/MuseScore arrow tools), and `Ctrl+KeyV` is `paste`.
- **Resolution:** `KeyV` remains strictly reserved for `set-mode-select`.

### 6.3 Dedicated Multi-Staff & Voice Keymap Table

| Physical Key (`event.code`) | Modifiers | Active Mode | Action | Precedence & Conflict Verification |
|:---|:---|:---|:---|:---|
| `Tab` | `none` | `input` | Cycle Voice Forward (1 $\to$ 2 $\to$ 1) | Gated strictly by `mode === 'input'`. Does not collide with browser Tab. |
| `Tab` | `Shift` | `input` | Cycle Voice Backward (2 $\to$ 1) | Gated strictly by `mode === 'input'`. |
| `Tab` | `none` | `position` | Select Next Layout Element | Gated strictly by `mode === 'position'`. |
| `Tab` | `none` | `lyrics` | Advance to Next Lyric Syllable | Gated strictly by `mode === 'lyrics'`. |
| `BracketLeft` | `none` | `select` / `input` | Move Cursor/Selection to Staff Above | Physical key. Resolves to `[` on US and `Ğ` on Turkish Q via `getKeycapLabel()`. |
| `BracketRight` | `none` | `select` / `input` | Move Cursor/Selection to Staff Below | Physical key. Resolves to `]` on US and `Ü` on Turkish Q via `getKeycapLabel()`. |
| `Escape` | `none` | `input` / `pos` / `lyr` | Exit to Select Mode (`set-mode-select`) | Standard modal exit. |
| `Escape` | `none` | `select` | Clear Selection / Deselect All | Unfocus caret. |

---

## 7. Milestone 7 Sub-Milestone Breakdown and Exit Gates

Every sub-milestone is autonomous and carries its own strict four-part verification gate:
1. **Automated Property Tests**
2. **Golden Visual Gallery Cards**
3. **IMSLP Engraving Audit Checklist**
4. **Performance Gate (Production Double rAF & Event Timing)**

### Milestone 7a: Multi-Voice Polyphony on a Single Staff
- **Deliverables:** Schema v7 model transition, `voiceIndex` 1..4 invariants, opposing stems, unison notehead sharing, independent voice beaming, voice switching keys (`Tab`, `Shift+Tab`).
- **Entry Task `perf-0`:** Profile remaining paint/React dispatch overhead on 200-measure single-staff score (current p95 = 32.2 ms) to guarantee headroom for multi-staff systems.
- **Exit Gates:**
  - *Property Tests:* Polyphonic stem directions strictly respect Voice 1 UP / Voice 2 DOWN; notehead sharing holds for identical ticks and pitches.
  - *Gallery Cards:* Card 26 (Polyphony) active and passing snapshot tests.
  - *IMSLP Audit:* Brahms Op. 118 No. 2 mm. 1–8 multi-voice excerpt matches Henle edition.
  - *Performance:* Keystroke-to-paint p95 $\le 20\text{ ms}$ on 64-measure score.

### Milestone 7b: Two-Staff Grand Staff (Piano Systems)
- **Deliverables:** `Score.parts[0]` holding 2 staves (Treble + Bass), curly brace at system left, global tick column alignment across staves, dynamic vertical skyline spacing, continuous through-barlines.
- **Exit Gates:**
  - *Property Tests:* Events at identical ticks on different staves share identical $x$ coordinate; measure widths are strictly equal across staves in a system.
  - *Gallery Cards:* Grand Staff Piano Card with through-barlines and curly brace.
  - *IMSLP Audit:* Bach Invention No. 1 mm. 1–8 and Mozart K. 545 mm. 1–8 match Bärenreiter edition.
  - *Performance:* Keystroke-to-paint p95 $\le 30\text{ ms}$ on 100-measure 2-staff score (200 measure-staves).

### Milestone 7c: Multi-Part Ensembles, Groups, and C Clefs
- **Deliverables:** `Score.groups: StaffGroup[]`, SATB and String Quartet templates, instrument bracket rendering, through vs. individual barline spans, multi-track audio routing, and **C Clefs (Alto, Tenor, and Treble-8vb)** moved into M7c.
- **Exit Gates:**
  - *Property Tests:* Individual vocal barlines do not intersect lyric bounding boxes; C clef transpositions and pitches map accurately.
  - *Gallery Cards:* String Quartet card (alto clef, bracket, through-barlines) and SATB card (lyrics, individual barlines).
  - *IMSLP Audit:* Beethoven Op. 18 No. 1 mm. 1–8 (Viola alto clef) and Schubert D. 547 mm. 1–12 match Breitkopf/Peters edition.
  - *Performance:* Keystroke-to-paint p95 $\le 30\text{ ms}$ on 50-measure 4-staff score (200 measure-staves).

### Milestone 7d: Discrete Page Model & Print Layout
- **Deliverables:** Page data model (`PageDef`), screen view (continuous scroll) vs. page view (paginated sheets) toggle, print CSS styles, and page-level DOM virtualization.
- **Exit Gates:**
  - *Property Tests:* Paginated systems never overflow printable page height; page margins strictly observed.
  - *Gallery Cards:* Multi-page score card showing Page 1 title block and Page 2 running header.
  - *Performance:* Page switching latency $\le 15\text{ ms}$; DOM node count $\le 1200$ across 10 pages.

---

## 8. Milestone Reference Corpus & IMSLP Audit Matrix

All reference tests utilize **short excerpts** (measures 1–8 or 1–12) to verify core engraving invariants without out-of-scope feature bloat.

| # | Work & Excerpt | Target Milestone | Target Engraving Test Role | IMSLP Edition Audit Status |
|:---:|:---|:---:|:---|:---|
| 1 | **J.S. Bach — Chorale "Wachet auf", BWV 140 (mm. 1–8)** | M7a | 4-part SATB homophony, fermatas, German lyrics, individual barlines | **VERIFIED:** Individual barlines broken between staves for lyrics corridor (Bärenreiter). |
| 2 | **J. Brahms — Intermezzo Op. 118 No. 2 (mm. 1–8)** | M7a | Polyphonic voice leading, opposing stems, shared noteheads | **AUDIT NOTE:** Pedal markings excluded from M7 acceptance; scoped to M12. Voice leading strictly verified against Henle. |
| 3 | **J.S. Bach — Invention No. 1 in C major, BWV 772 (mm. 1–8)** | M7b | Two-staff grand staff contrapuntal imitation, 16th-note beam alignment | **VERIFIED:** Clean two-part counterpoint without pedals or text (Bärenreiter). |
| 4 | **W.A. Mozart — Piano Sonata in C major, K. 545, I (mm. 1–8)** | M7b | Melody over Alberti bass, legato slurs, dynamics | **AUDIT NOTE:** 1st/2nd voltas occur in exposition repeat (m. 28), not mm. 1–8. Excerpt tests Alberti bass synchronization. |
| 5 | **F. Chopin — Prelude in E minor, Op. 28 No. 4 (mm. 1–12)** | M7b | Descending chromatic polyphonic chords in left hand | **AUDIT NOTE:** "Tempo rubato" text excluded from M7 acceptance; scoped to M10. Chromatic accidentals verified against Polish National Edition. |
| 6 | **F. Schubert — "An die Musik", D. 547 (mm. 1–12)** | M7c | Mixed ensemble: Solo Voice (individual barline) + Piano (brace, through-barlines) | **VERIFIED:** Distinct barline spans between vocal and piano staves (Peters). |
| 7 | **L. van Beethoven — String Quartet Op. 18 No. 1, I (mm. 1–8)** | M7c | Chamber bracket, through-barlines connecting 4 staves, **Viola Alto Clef** | **VERIFIED:** Alto C-clef placement on line 3 (Henle). |
| 8 | **Claude Debussy — "Golliwogg's Cakewalk" (mm. 1–8)** | M7d | Syncopation, sudden dynamics (ff, sfz), page-turn layout | **AUDIT NOTE:** Mid-score key change to G-flat occurs at m. 25, not mm. 1–8. Excerpt tests page distribution and syncopations. |
| 9 | **Turkish Folk Song (e.g. "Süt İçtim Dilim Yandı", mm. 1–9)** | M7a/M7b | Solfege syllables, regional aksak meter, lyric hyphens/extenders | **VERIFIED:** Single and grand staff Turkish vocal notation. |

---

## 9. Unified Performance Budget & Measurement Protocol

### 9.1 Measurement Protocol (Strict Single Source of Truth)
- **Environment:** Headless Chromium via Playwright, Production Build (`npm run build && npm run preview`).
- **Probe Definition:** Keystroke-to-paint latency measured from synthetic keydown dispatch to the frame immediately following render commit using **Double requestAnimationFrame delta AND Chromium PerformanceEventTiming API**.
- **Sample Size:** $n \ge 50$ iterations per benchmark run.

### 9.2 Performance Budget Matrix

| Workload Configuration | Total Measure-Staves | Median Budget (ms) | p95 Budget (ms) | Node Layout Budget (ms) |
|:---|:---:|:---:|:---:|:---:|
| **64 Measures, 1 Staff** | 64 | $\le 12.0$ | **$\le 20.0$** | $\le 1.5$ |
| **32 Measures, 2 Staves (Piano)** | 64 | $\le 12.0$ | **$\le 20.0$** | $\le 1.8$ |
| **16 Measures, 4 Staves (Quartet)** | 64 | $\le 12.0$ | **$\le 20.0$** | $\le 2.0$ |
| **200 Measures, 1 Staff** | 200 | $\le 24.0$ | **$\le 30.0$** | $\le 3.5$ |
| **100 Measures, 2 Staves (Piano)** | 200 | $\le 25.0$ | **$\le 30.0$** | $\le 4.0$ |
| **50 Measures, 4 Staves (Quartet)** | 200 | $\le 26.0$ | **$\le 30.0$** | $\le 5.0$ |

---

## 10. Automated Testing Strategy & MusicXML Mapping

### 10.1 Mathematical Property Tests
1. **Column Coincidence Invariant:**
   $$\forall \text{staves } s_1, s_2, \quad \forall t \in \mathcal{T}_m, \quad X(s_1, t) = X(s_2, t)$$
2. **System Width Equality Invariant:**
   $$\forall \text{system } K, \quad \forall \text{staff } s \in K, \quad \text{Width}(s) = W_{\text{system}}$$
3. **Glyph Bounding Box Disjointness:**
   No two non-sharing layout items on the same staff may intersect:
   $$\text{Box}(A) \cap \text{Box}(B) = \emptyset \quad (\text{except intentional unisons})$$
4. **History Independence:**
   Layout of a score created by commands from scratch must be strictly bit-identical to a score reached via 100 random edits followed by `undo`.

### 10.2 MusicXML Mapping Architecture (Schema v7 Constraint for M9)

| ScoreForge Schema v7 Model | MusicXML 4.0 Element Representation |
|:---|:---|
| `Score.parts[p]` | `<part id="P{p}">` in `<part-list>` |
| `Score.groups[g]` | `<part-group type="start" number="{g}">` with `<group-symbol>` (`brace` / `bracket`) and `<group-barline>` |
| `Staff` within a Part | `<staves>2</staves>` on `<attributes>`, with `<staff>1</staff>` and `<staff>2</staff>` on notes |
| `Voice.voiceIndex` (1..4) | `<voice>{voiceIndex}</voice>` |
| Polyphonic voice rewind | `<backup><duration>{ticks}</duration></backup>` between voices |
| Clef (`sign`, `line`) | `<clef><sign>{sign}</sign><line>{line}</line></clef>` |
| Page / System Break | `<print new-system="yes"/>` and `<print new-page="yes"/>` |

---

## 11. Discrete Page Model & Virtualization Architecture

### 11.1 Page Data Model (`src/core/model.ts`)

```typescript
export interface Margins {
  top: number;       // staff spaces (default: 10 sp = ~18mm)
  bottom: number;    // staff spaces (default: 10 sp)
  left: number;      // staff spaces (default: 12 sp)
  right: number;     // staff spaces (default: 12 sp)
}

export interface PageDef {
  number: number;    // 1-based page number
  width: number;     // printable width in sp (e.g. A4 = 1190 / pxRatio)
  height: number;    // printable height in sp
  margins: Margins;
  systemIndices: number[]; // Systems placed on this page
}
```

### 11.2 Screen View vs. Print View
- **Screen View (Continuous Scroll):** Systems stacked vertically with a compact separator gap ($4\text{ sp}$). Virtualization culls off-screen systems.
- **Page View (Paginated Sheets):** SVG renders discrete pages with simulated paper dropshadows. Page 1 renders the complete Header Block (Title, Subtitle, Composer, Arranger); Page 2+ render running headers with small score title and outer page number.
- **Page-Level Virtualization:** Only the currently visible page plus one page above and below are mounted in the browser DOM.

---

## 12. Lead Decisions Recorded & Questions Closed

1. **Abbreviated Instrument Names:** Abbreviated names on systems after the first are enabled **only for multi-part ensembles ($\ge 2$ parts)**. For solo piano or single-instrument scores, subsequent systems have no indent, maximizing printable width.
2. **Lyric Vertical Clearance:** Minimum vertical clearance between lyric syllable baselines and the top skyline of the next staff down is **strictly $2.5\text{ sp}$**.
3. **Staff Switching Keymap:** Navigating between staves is permanently assigned to physical `BracketLeft` (staff above) and `BracketRight` (staff below).
4. **Deferred to Milestone 13+:** Visual page-turn hints on rests are non-binding suggestions and deferred to M13+.
