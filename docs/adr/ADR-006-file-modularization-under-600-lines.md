# ADR-006: Subsystem Decomposition and Strict 600-Line Ceiling per File

**Status:** Accepted  
**Deciders:** ScoreForge Core Engineering  
**Date:** 2026-11-17 (Consolidated in Milestone H1)  

## Context
As ScoreForge expanded from early prototypes through Milestones M1-M6d, key files grew excessively large: `commands.ts` exceeded 800 lines, `layoutScore.ts` exceeded 700 lines, `ScoreView.tsx` exceeded 800 lines, and `App.tsx` exceeded 800 lines. Monolithic files severely degrade code readability, encourage god-object anti-patterns, create merge conflicts, and increase cognitive load.

## Decision
1. **Strict 600-Line Limit:** Every source file in `src/` must remain strictly under 600 lines of code.
2. **Subsystem Modularization:**
   - `commands.ts` decomposed into `noteCommands.ts`, `measureCommands.ts`, `selectionCommands.ts`, and `notationCommands.ts`.
   - `ScoreView.tsx` decomposed into `useScoreVirtualization.ts`, `ScoreSvgLayers.tsx`, `ScoreInteractionOverlays.tsx`, and `ScoreViewLyricsInput.tsx`.
   - `App.tsx` decomposed into focused custom hooks (`useAppKeyboard.ts`, `useAppPlayback.ts`, `useAppStorage.ts`, `useAppScoreActions.ts`, `useAppVerificationStates.ts`, `useAppTestHooks.ts`) and modular dialogs (`AppModals.tsx`, `ConfirmModals.tsx`).
   - `layoutScore.ts` decomposed into `systemBreakPlanner.ts`, `systemLayoutPass.ts`, `beamGrouping.ts`, and `beamSlope.ts`.
3. **Automated Enforcement:** Import rules across boundaries are enforced by `scripts/checkImports.mjs` and ESLint checks on every commit.

## Consequences
### Positive
- High cohesion and single responsibility per module.
- Clean architectural boundaries making individual features easy to isolate, test, and profile.
- Zero monolithic files in the repository.

### Negative
- Slightly more files to navigate in the folder tree, mitigated by structured subdirectories.
