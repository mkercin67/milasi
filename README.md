# MiLaSi ("Melodic Layout Studio")

MiLaSi is a high-performance, web-based music notation and engraving application built with TypeScript, React, and SMuFL (Standard Music Font Layout, using Bravura). It is designed from the ground up for sub-30ms keystroke-to-paint latency, immutable state architecture (Immer), pure deterministic layout without DOM measurement locks, and rigorous automated regression verification.

---

## Project Status

- **Current State:** Milestone H1 (Foundation Hardening) closed.
- **Completed Foundations:** Single-staff notation, flexible measure wrapping, rhythmic editing (whole to 32nd notes, tuplets, dots), ties per pitch, legato slurs, dynamics, articulations, barlines, repeat marks with 1st/2nd voltas, lyrics with hyphens and melisma extenders, Turkish solfege syllables, Web Audio lookahead playback scheduler with repeat expansion, and 25-card visual regression gallery.
- **Next Milestone:** Milestone 7 (Multi-Voice Polyphony and Multi-Staff Systems).

---

## Getting Started

### Prerequisites

- Node.js 20+ (Node 22 / 24 supported)
- npm 10+
- Google Chrome or Chromium (for Playwright benchmarks and visual snapshots)

### Installation

```bash
git clone https://github.com/mkercin67/milasi.git
cd milasi
npm install
```

### Development & Commands

- **Start Development Server:**
  ```bash
  npm run dev
  ```
  Runs Vite dev server at `http://localhost:5173`.

- **Run Full Verification Gate:**
  ```bash
  npm run check
  ```
  Executes TypeScript checks, folder boundary linting, license compliance audits, keyboard shortcut synchronization checks, ESLint, Knip dead-code analysis, full Vitest test suite, and production build. Must pass cleanly before every commit.

- **Run Automated Test Suite:**
  ```bash
  npm test
  ```
  Executes unit and integration test suites via Vitest.

- **Run Playwright i18n DOM Verification:**
  ```bash
  npm run test:i18n
  ```
  Runs headless Playwright DOM inspection verifying that no visible text node in the toolbar, status bar, or dialogs displays untranslated translation keys in Turkish and English with all dialogs opened.

- **Run Production Performance Benchmark:**
  ```bash
  npm run bench
  ```
  Builds the production distribution and executes an automated Playwright headless benchmark measuring keystroke-to-paint latency (Double rAF and Event Timing API) across 64-measure and 200-measure full-featured scores.

- **Preview Production Build:**
  ```bash
  npm run preview
  ```
  Serves the optimized production build from `dist/` at `http://localhost:4173`.

- **Generate Review Pack:**
  ```bash
  npm run reviewpack
  ```
  Generates a consolidated self-contained review document at `docs/review/REVIEW_PACK.md`.

---

## Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md):** Architectural principles, data model invariants, single source of truth, layout pipeline, and performance baselines.
- **[RULES.md](RULES.md):** Permanent engineering rules (R1 to R3, coding standards, commit protocols).
- **[docs/SHORTCUTS.md](docs/SHORTCUTS.md):** Complete physical keymap reference across Select, Note Input, Position, and Lyrics modes (supports Turkish Q and US standard keyboards).
- **[docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md):** Active technical limitations, non-goals, and workarounds.
- **[docs/design/multi-staff-and-pages.md](docs/design/multi-staff-and-pages.md):** Design document for Schema v7, multi-staff grand staves, voice polyphony, cross-staff synchronization, and discrete page layout.
- **`docs/screenshots/<milestone>/`:** Visual evidence and regression captures for each milestone.

---

## License

MiLaSi is free software licensed under the **GNU General Public License v3.0 or later (GPL-3.0-or-later)**. See the [LICENSE](LICENSE) file for the complete license text.

Copyright (C) 2026 Murat Kerçin

### Third-Party Licenses & Musical Scores
- **Bravura Font & Metadata:** The Bravura musical font and metadata assets (`public/fonts/`) remain licensed under the **SIL Open Font License, Version 1.1 (OFL-1.1)**. See [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) and [LICENSE-Bravura.txt](public/fonts/LICENSE-Bravura.txt).
- **Third-Party Musical Scores:** Proprietary engravings and copyrighted third-party scores are strictly **not** part of this repository. All committed musical fixtures conform to [docs/CORPUS_POLICY.md](docs/CORPUS_POLICY.md).
- **Runtime Dependencies:** All runtime production dependencies are verified by `npm run licenses` to be strictly compatible with GPL-3.0-or-later (MIT, 0BSD, OFL-1.1).

---

## Türkçe Özet

MiLaSi ("Melodic Layout Studio"), modern web tarayıcılarında profesyonel nota yazımı ve gravür imkânı sunan yüksek performanslı bir nota editörüdür. TypeScript, React ve SMuFL standartlarına uygun Bravura yazı tipiyle geliştirilmiştir.

- **Performans:** Tuş basımından ekrana çizime kadar (Double rAF / Next Paint) 30 ms'nin altında gecikme hedeflenmiştir.
- **Mimari:** Immutable veri modeli (Immer), DOM ölçümlerine bağımlı olmayan saf matematiksel yerleşim motoru, Web Audio tabanlı çalma motoru ve çift dilli (Türkçe / İngilizce) arayüz.
- **Kullanım:** `npm run dev` ile geliştirme sunucusunu başlatabilir, `npm run check` ile tüm sistem testlerini ve tip kontrollerini çalıştırabilirsiniz.
