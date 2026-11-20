// SPDX-License-Identifier: GPL-3.0-or-later
import { useEffect, useState, useRef } from 'react';
import { Score } from '../../core/model';
import { validateScore, ValidationProblem } from '../../core/validate';

export interface UseAppValidationResult {
  validationProblems: ValidationProblem[];
  errorCount: number;
  warningCount: number;
  validateSynchronously: (scoreToValidate?: Score) => ValidationProblem[];
}

/**
 * P2: Validation Burst Controller managing debounce, max-wait ceilings,
 * and synchronous validation checkpoints.
 */
export class ValidationBurstController {
  private _debounceMs: number;
  private _maxWaitMs: number;
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
  private _latestScore: Score;
  private _problems: ValidationProblem[];
  private _listeners = new Set<(problems: ValidationProblem[]) => void>();

  constructor(initialScore: Score, options?: { debounceMs?: number; maxWaitMs?: number }) {
    this._debounceMs = options?.debounceMs ?? 100;
    this._maxWaitMs = options?.maxWaitMs ?? 250;
    this._latestScore = initialScore;
    this._problems = validateScore(initialScore);
  }

  get problems(): ValidationProblem[] {
    return this._problems;
  }

  get errorCount(): number {
    return this._problems.filter((p) => p.severity === 'error').length;
  }

  get warningCount(): number {
    return this._problems.filter((p) => p.severity === 'warning').length;
  }

  onScoreChange(newScore: Score): void {
    this._latestScore = newScore;

    // Reset debounce timer
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }
    this._debounceTimer = setTimeout(() => this._flush(), this._debounceMs);

    // Ensure maxWait timer is set
    if (!this._maxWaitTimer) {
      this._maxWaitTimer = setTimeout(() => this._flush(), this._maxWaitMs);
    }
  }

  validateSynchronously(scoreToValidate?: Score): ValidationProblem[] {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    if (this._maxWaitTimer) {
      clearTimeout(this._maxWaitTimer);
      this._maxWaitTimer = null;
    }
    const target = scoreToValidate ?? this._latestScore;
    this._latestScore = target;
    this._problems = validateScore(target);
    this._notify();
    return this._problems;
  }

  subscribe(listener: (problems: ValidationProblem[]) => void): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  dispose(): void {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    if (this._maxWaitTimer) clearTimeout(this._maxWaitTimer);
    this._listeners.clear();
  }

  private _flush(): void {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    if (this._maxWaitTimer) {
      clearTimeout(this._maxWaitTimer);
      this._maxWaitTimer = null;
    }
    this._problems = validateScore(this._latestScore);
    this._notify();
  }

  private _notify(): void {
    for (const listener of this._listeners) {
      listener(this._problems);
    }
  }
}

/**
 * P2 React hook for deferred validateScore execution during edit bursts with synchronous checkpoints.
 */
export function useAppValidation(
  score: Score,
  options?: { debounceMs?: number; maxWaitMs?: number }
): UseAppValidationResult {
  const controllerRef = useRef<ValidationBurstController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new ValidationBurstController(score, options);
  }
  const controller = controllerRef.current;

  const [problems, setProblems] = useState<ValidationProblem[]>(() => controller.problems);

  useEffect(() => {
    return controller.subscribe(setProblems);
  }, [controller]);

  useEffect(() => {
    controller.onScoreChange(score);
  }, [score, controller]);

  return {
    validationProblems: problems,
    errorCount: controller.errorCount,
    warningCount: controller.warningCount,
    validateSynchronously: (s?: Score) => controller.validateSynchronously(s),
  };
}
