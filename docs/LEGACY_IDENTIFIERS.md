# MiLaSi — Preserved Legacy Identifiers & Backwards Compatibility

Following the project renaming from ScoreForge to **MiLaSi ("Melodic Layout Studio")**, certain internal identifiers, storage names, file extensions, and protocol constants are **intentionally preserved unchanged**. 

This document records all preserved legacy identifiers and the technical rationale for maintaining them.

---

## Preserved Identifiers Registry

| Identifier Type | Preserved Value | Defined In | Technical & Compatibility Rationale |
|:---|:---|:---|:---|
| **File Extension** | `.sfscore` | `src/io/json.ts`, `src/ui/Toolbar.tsx` | Native binary/JSON score file extension. Preserved so previously saved user files, test fixtures, and OS file associations continue to open and import without errors. |
| **IndexedDB Database** | `'scoreforge_db'` | `src/io/storage.ts` (`DB_NAME`) | Client-side browser storage database. Preserved so that user autosaves, in-progress edits, and crash recovery sessions created prior to the rename remain accessible without data loss. |
| **IndexedDB Object Stores** | `'autosaves'`, `'scores'` | `src/io/storage.ts` | Store table names within `scoreforge_db`. Preserved to maintain transactional schema integrity across browser sessions. |
| **JSON Envelope Tag** | `{ app: 'scoreforge' }` | `src/io/json.ts` (`ScoreForgeEnvelope`) | Header stamp on exported `.sfscore` JSON payloads. Preserved so existing score files pass schema signature verification upon load. |
| **Clipboard Protocol** | `{ app: 'scoreforge-clip' }` | `src/core/clipboard.ts` (`CLIPBOARD_APP_ID`) | Internal and system clipboard JSON mime format. Preserved so copied musical selections remain valid across sessions. |
| **LocalStorage Keys** | `'scoreforge.previewSound'` | `src/playback/preview.ts` | User preference persistence for audio note auditions. Preserved to prevent preference resets. |
| **Schema Versions** | `schemaVersion: 1..6` | `src/core/model.ts`, `src/io/json.ts` | Data model evolution markers. Historical version numbers are immutable data contracts and must never be altered retroactively. |
| **DOM CSS Classes** | `.scoreforge-glyph`, `.scoreforge-beam` | `index.html`, `src/render/renderSvg.ts`, `src/ui/SystemView.tsx` | CSS classes binding SMuFL font metrics and SVG beam styles. Preserved to prevent styling breakages and ensure all regression tests remain stable. |

---

## Policy Rule

Future migrations or features must **never** mutate these legacy keys without an explicit, versioned, automated migration strategy that migrates existing client IndexedDB stores and verifies backward compatibility with previously exported `.sfscore` files.
