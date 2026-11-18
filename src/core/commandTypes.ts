// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Command interfaces and History stack for ScoreForge core.
 */

import { Id, NoteEvent, RestEvent, Score } from './model';

/** Interface for all operations that transform a Score. */
export interface Command {
  /** Descriptive name of the command. */
  name: string;
  /**
   * Applies the command to the given score, returning a new Score instance.
   *
   * @param score - Current score state.
   * @returns Updated score state.
   */
  apply(score: Score): Score;
}

/**
 * Manages an undo/redo stack of Score states.
 */
export class History {
  private past: Score[] = [];
  private current: Score;
  private future: Score[] = [];
  private cleanScore: Score;

  constructor(initialScore: Score) {
    this.current = initialScore;
    this.cleanScore = initialScore;
  }

  /** Gets the current score state. */
  get score(): Score {
    return this.current;
  }

  /** Marks the current state as saved/clean. */
  markClean(): void {
    this.cleanScore = this.current;
  }

  /** Checks whether the score has unsaved changes compared to the clean state. */
  isDirty(): boolean {
    return this.current !== this.cleanScore;
  }

  /** Clears history and resets to a new clean score state. */
  clear(newScore: Score): void {
    this.past = [];
    this.future = [];
    this.current = newScore;
    this.cleanScore = newScore;
  }

  /**
   * Executes a command, recording history and clearing the redo stack.
   *
   * @param command - Command to apply.
   * @returns The updated current score.
   */
  do(command: Command): Score {
    const prev = this.current;
    try {
      const next = command.apply(prev);
      this.past.push(prev);
      this.current = next;
      this.future = [];
      return this.current;
    } catch (err) {
      // Command failed: keep current score and history completely untouched
      this.current = prev;
      throw err;
    }
  }

  /**
   * Undoes the last executed command.
   *
   * @returns The restored score, or undefined if undo is not possible.
   */
  undo(): Score | undefined {
    if (!this.canUndo()) {
      return undefined;
    }
    const previous = this.past.pop()!;
    this.future.push(this.current);
    this.current = previous;
    return this.current;
  }

  /**
   * Redoes the last undone command.
   *
   * @returns The restored score, or undefined if redo is not possible.
   */
  redo(): Score | undefined {
    if (!this.canRedo()) {
      return undefined;
    }
    const next = this.future.pop()!;
    this.past.push(this.current);
    this.current = next;
    return this.current;
  }

  /**
   * Checks whether an undo operation can be performed.
   *
   * @returns True if there are previous states in the stack.
   */
  canUndo(): boolean {
    return this.past.length > 0;
  }

  /**
   * Checks whether a redo operation can be performed.
   *
   * @returns True if there are future states in the stack.
   */
  canRedo(): boolean {
    return this.future.length > 0;
  }
}

/** Parameters for the insertNote command. */
export interface InsertNoteParams {
  partId: Id;
  staffId?: Id;
  measureId: Id;
  voiceIndex?: number;
  voiceId?: Id;
  index?: number;
  event: NoteEvent | RestEvent;
}
