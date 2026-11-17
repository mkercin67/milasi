# ADR-008: Fault Resilience via React ErrorBoundary, Rolling IndexedDB Autosave, and Error Ring Buffer

**Status:** Accepted  
**Deciders:** ScoreForge Core Engineering  
**Date:** 2026-11-17 (Consolidated in Milestone H1)  

## Context
Unexpected runtime errors or corrupt score structures can cause React component trees to unmount completely, displaying a blank white screen. In music composition, an unhandled crash that causes the user to lose hours of unsaved creative work is unacceptable.

## Decision
1. **Application Error Boundary:** We wrap the canvas in `ErrorBoundary.tsx`. If a crash occurs:
   - Catches the error and logs it to the rolling error buffer.
   - Replaces the canvas with a non-destructive recovery screen providing 3 distinct recovery actions:
     a. "Son otomatik kaydı geri yükle" (restores the last valid autosave snapshot).
     b. "Mevcut eseri dosya olarak indir" (downloads an emergency `.sfscore` JSON backup).
     c. "Hata raporunu kopyala" (copies error message, stack trace, and ring buffer to clipboard).
2. **Rolling 5-Version Autosave:** `src/io/storage.ts` maintains a rolling history of the last 5 autosaves in IndexedDB (`scoreforge_autosaves`), storing full score snapshots along with ISO timestamps and measure counts.
3. **Global Error Ring Buffer:** A circular buffer on `window.__errorLog` stores the last 50 error and warning events, automatically capturing unhandled exceptions and promise rejections for immediate diagnostic triage.

## Consequences
### Positive
- Zero data loss: Users can always download their raw score data or restore a previous snapshot even if the rendering pipeline crashes.
- Clear diagnostic feedback when filing bug reports.
- Comprehensive automated test coverage in `tests/resilience/error_recovery.test.ts`.

### Negative
- Local IndexedDB storage requires client browser support, with in-memory fallback for headless or private environments.
