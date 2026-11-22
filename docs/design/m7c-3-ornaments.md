# M7c-3: Ornaments (trill, mordent, inverted mordent, turn)

Status: IMPLEMENTED (owner approved). Differences from the proposal: no keyboard shortcut in v1 (toolbar buttons only, like hairpins and courtesy accidentals); a fermata above on the same note is lifted above the ornament; an accent or marcato above the note lifts the ornament (the notation layer passes the articulation items to `layoutOrnaments`). The command is `toggleOrnament`.
Part of `docs/design/m7c-plan.md`. Follows the structure of `m7c-2-fermata.md`. Placement distances are a first
proposal and stay **UNVERIFIED until the owner compares the result with a public-domain edition** (Barge BWV 1030
mm. 10 ff. for the trill; BWV 772 for mordent and turn).

## 1. What is added
| Mark | SMuFL glyph | Meaning (Western convention) |
|---|---|---|
| Trill | `ornamentTrill` ("tr") | rapid alternation with the upper neighbour |
| Mordent | `ornamentMordent` | main note, lower neighbour, main note |
| Inverted mordent (upper mordent, "short trill") | `ornamentShortTrill` | main note, upper neighbour, main note |
| Turn | `ornamentTurn` | upper neighbour, main, lower neighbour, main |

Names differ between traditions (Baroque "Pralltriller" and "Mordent"). The program shows the glyph and the plain
description, and the Turkish tooltip names both, so nobody depends on one convention.

## 2. Model (optional field; no schema number change)
- `NoteEvent.ornament?: 'trill' | 'mordent' | 'invertedMordent' | 'turn'`. One ornament per note. Rests cannot carry one.
- Validation: unknown value is an error; an ornament on a rest is an error.
- Clipboard: the field lives on the event, so copy, cut and paste carry it (test).
- Cache: drawn by the notation layer (like fermatas), not in the measure chunk. A test proves that toggling shows the
  new state without clearing caches.

## 3. Layout
- New `layoutOrnaments(score, layout, index)` in `src/layout/notations.ts`, next to `layoutFermatas`.
- Position: centred on the notehead, above the event: `y = min(staffTop - 1.0, topY - 1.0)`, where `topY` covers
  noteheads and the stem (same rule as fermata). If the note also has a fermata above, the ornament goes **between** the
  note and the fermata; the fermata moves up by the ornament height (test).
- Interaction with articulations: staccato, accent and tenuto stay on the notehead side; the ornament is always on the
  outer side above. A stem-down note keeps the ornament above (convention for ornaments, unlike articulations).
- Skyline: items enter the staff skyline like any above-staff item.
- Glyphs `ornamentTrill`, `ornamentMordent`, `ornamentShortTrill`, `ornamentTurn` are added to
  `scripts/buildGlyphPaths.mjs` (whitelist) and the generated file is rebuilt.

## 4. Editing
- Command `setOrnament(selection, ornament | null)`: through `eventsInRange` (works on one note, a range, all voices of
  a measure). Applying the same ornament again removes it (toggle); a different one replaces it.
- Toolbar (notation panel): four small buttons (`tr`, mordent, inverted mordent, turn) with Turkish and English
  tooltips.
- Keyboard: none in v1. A shortcut is added later together with the hairpin and courtesy-accidental shortcuts, from the free keys of `docs/SHORTCUTS.md`.

## 5. Playback
Ignored (metrical playback unchanged). Real ornament playback is M11. The test names say so.

## 6. Not in this step
- Wavy continuation line for a trill over several notes or a long note (`tr~~~~`). Documented gap in
  `KNOWN_ISSUES.md`; the plain "tr" over one note is what Barge m. 10 needs.
- Accidentals above or below the ornament (for example a sharp under the trill sign). Gap.
- Arpeggio and glissando (separate gap in the parity matrix).
- Grace notes (M7c-3b).

## 7. Acceptance
- Unit tests: set, toggle, replace, range, rest rejected, validate errors, clipboard carry.
- Layout tests: height over a stem-up note, a stem-down note, a beamed group, a chord, with a fermata, with a staccato.
- Gallery card with the four ornaments; golden snapshots updated and reviewed.
- Corpus: the trill of the Barge flute part (owner enters it, we compare with the print).
