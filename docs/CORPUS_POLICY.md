# MiLaSi Musical Corpus & Fixture Policy

This document establishes the mandatory intellectual property and copyright standards for all musical fixtures, test scores, transcriptions, audio, lyrics, and image assets committed to the ScoreForge repository.

---

## 1. Public & Free Software Repository Standards

ScoreForge is an open-source project licensed under the **GNU General Public License v3.0 or later (GPL-3.0-or-later)**. All code and assets committed to this repository are publicly visible and freely redistributable.

To protect the integrity of the project and its users:
- Every committed score fixture, transcription, melodic fragment, lyric set, and visual test case must be **Public Domain**, **Traditional Folk Material**, **Original Work Created for ScoreForge**, or released under **Creative Commons Zero (CC0 1.0)**.
- Musical notes and notation structures must be entered by hand from public-domain editions or constructed programmatically using ScoreForge core factory commands.

---

## 2. Absolute Prohibition on Third-Party & Restricted Engravings

The following materials are **STRICTLY PROHIBITED** from being committed to this repository under any circumstances:

1. **Third-Party PDFs & Commercial Scans:** No sheet music PDF, engraving PDF, or publisher scan may be committed to version control.
2. **Creative Commons NonCommercial (NC) Material:** Works licensed under CC BY-NC, CC BY-NC-SA, or any other NonCommercial terms (for example, the CC BY-NC-SA 4.0 MuseScore engraving of BWV 140.7 by R. Casadesus-Masanell) are **legally incompatible** with GPL-3.0 and must never enter the repository.
3. **Creative Commons ShareAlike (SA) Engravings:** External CC-BY-SA music engravings may not be copied into the project without legal compatibility review.
4. **Screenshots of Proprietary Engravings:** No screenshot, crop, or visual artifact depicting copyrighted modern editions or restricted CC-NC/SA engravings may be committed to docs, tests, or fixtures.

---

## 3. Local-Only Private Testing (`tests/private/`)

Developers working with reference scores, comparative PDF engravings, or local transcription exercises (such as Aşık Veysel's *"Uzun İnce Bir Yoldayım"* or historical choral scans) must place all such files exclusively in:

```
tests/private/
```

- `tests/private/` is permanently registered in `.gitignore`.
- Files in this directory are never staged, never committed, and never pushed to remote remotes.
- Reference PDFs kept locally serve solely as visual references for the developer during manual verification and must never be distributed with the repository.

---

## 4. Mandatory Score Fixture Header Metadata

Every musical score fixture or standalone reference score generator committed to `src/` or `tests/` must contain a standardized header comment recording:

```typescript
/**
 * Source: <Public domain historical edition, e.g. Bach-Gesellschaft 1851-1899, or Traditional>
 * Composer: <Composer Name>
 * Composer Death Year: <YYYY or 'Traditional / Pre-1900' (must be >= 70 years p.m.a.)>
 * License: <Public Domain | CC0-1.0 | GPL-3.0-or-later>
 */
```

---

## 5. Automated Verification

Compliance with this policy is enforced automatically via automated tests (`tests/core/corpus_policy.test.ts`):
1. **PDF Tracking Gate:** Fails if any `.pdf` file is tracked by Git anywhere in the repository.
2. **Fixture Header Gate:** Fails if any score fixture in the repository lacks the required `Source:`, `Composer Death Year:`, and `License:` metadata declarations.
