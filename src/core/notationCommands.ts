// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Notation commands: ties, accidentals, dynamics, articulations, slurs, lyrics, and auto-solfege.
 */

import { produce } from 'immer';
import { FermataPlacement, HairpinType, Id, NoteEvent, Pitch, PhraseMark, Score } from './model';
import { Command } from './commandTypes';
import { newId } from './factory';
import { eventsInRange, Selection } from './selection';

export function toggleTie(eventId: string, pitchIndex: number = 0): Command {
  return {
    name: 'Toggle Tie',
    apply(score: Score): Score {
      let foundStaffId: string | null = null;
      let foundVoiceIndex = 0;
      let startMIdx = -1;
      let startEvIdx = -1;
      let sourceNote: NoteEvent | null = null;

      for (const part of score.parts) {
        for (const staff of part.staves) {
          for (let mIdx = 0; mIdx < score.measures.length; mIdx++) {
            const mDef = score.measures[mIdx];
            const sm = staff.measures[mDef.id];
            if (!sm) continue;
            for (const v of sm.voices) {
              const idx = v.events.findIndex((e) => e.id === eventId);
              if (idx !== -1) {
                foundStaffId = staff.id;
                foundVoiceIndex = v.voiceIndex;
                startMIdx = mIdx;
                startEvIdx = idx;
                const ev = v.events[idx];
                if (ev.kind === 'note') sourceNote = ev;
                break;
              }
            }
          }
        }
      }

      if (!sourceNote || !sourceNote.pitches[pitchIndex]) {
        throw new Error('No matching next note to tie to');
      }

      const pitchToMatch = sourceNote.pitches[pitchIndex];

      let nextNote: NoteEvent | null = null;
      let searchDone = false;

      for (const part of score.parts) {
        for (const staff of part.staves) {
          if (staff.id !== foundStaffId) continue;
          for (let mIdx = startMIdx; mIdx < score.measures.length; mIdx++) {
            const mDef = score.measures[mIdx];
            const sm = staff.measures[mDef.id];
            if (!sm) continue;
            // Rule R3: voice identity is stable voiceIndex, never compare random voice IDs across measures
            const v = sm.voices.find((voice, idx) => (voice.voiceIndex ?? (idx + 1)) === foundVoiceIndex);
            if (!v) continue;
            const startI = mIdx === startMIdx ? startEvIdx + 1 : 0;
            for (let i = startI; i < v.events.length; i++) {
              const ev = v.events[i];
              if (ev.kind === 'note') {
                nextNote = ev;
                searchDone = true;
                break;
              }
            }
            if (searchDone) break;
          }
        }
      }

      if (!nextNote) {
        throw new Error('No matching next note to tie to');
      }

      const hasMatchingPitch = nextNote.pitches.some(
        (p) =>
          p.step === pitchToMatch.step &&
          p.octave === pitchToMatch.octave &&
          p.alter === pitchToMatch.alter
      );

      if (!hasMatchingPitch) {
        throw new Error('No matching next note to tie to');
      }

      return produce(score, (draft) => {
        for (const part of draft.parts) {
          for (const staff of part.staves) {
            for (const mDef of draft.measures) {
              const sm = staff.measures[mDef.id];
              if (!sm) continue;
              for (const v of sm.voices) {
                for (const ev of v.events) {
                  if (ev.id === eventId && ev.kind === 'note') {
                    const p = ev.pitches[pitchIndex];
                    if (p) {
                      p.tiedToNext = !p.tiedToNext;
                      ev.tiedToNext = ev.pitches.some((pi) => pi.tiedToNext);
                    }
                    return;
                  }
                }
              }
            }
          }
        }
      });
    },
  };
}

/**
 * Modifies accidental alter by delta (-2..+2).
 */
export function setExplicitAccidental(eventId: string, delta: number, pitchIndex: number = 0): Command {
  return {
    name: 'Set Explicit Accidental',
    apply(score: Score): Score {
      return produce(score, (draft) => {
        for (const part of draft.parts) {
          for (const staff of part.staves) {
            for (const mDef of draft.measures) {
              const sm = staff.measures[mDef.id];
              if (!sm) continue;
              for (const v of sm.voices) {
                for (const ev of v.events) {
                  if (ev.id === eventId && ev.kind === 'note') {
                    const p = ev.pitches[pitchIndex];
                    if (p) {
                      p.alter = Math.max(-2, Math.min(2, Math.round(p.alter + delta)));
                    }
                    return;
                  }
                }
              }
            }
          }
        }
      });
    },
  };
}

const SHARPS_ORDER: Pitch['step'][] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLATS_ORDER: Pitch['step'][] = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

/**
 * Resets accidental to key signature default.
 */
export function resetAccidentalToKeySig(eventId: string, pitchIndex: number = 0): Command {
  return {
    name: 'Reset Accidental',
    apply(score: Score): Score {
      return produce(score, (draft) => {
        for (const part of draft.parts) {
          for (const staff of part.staves) {
            for (const mDef of draft.measures) {
              const sm = staff.measures[mDef.id];
              if (!sm) continue;
              for (const v of sm.voices) {
                for (const ev of v.events) {
                  if (ev.id === eventId && ev.kind === 'note') {
                    const p = ev.pitches[pitchIndex];
                    if (p) {
                      const keySig = mDef.keySig;
                      let defaultAlter = 0;
                      if (keySig > 0 && SHARPS_ORDER.slice(0, keySig).includes(p.step)) {
                        defaultAlter = 1;
                      } else if (keySig < 0 && FLATS_ORDER.slice(0, Math.abs(keySig)).includes(p.step)) {
                        defaultAlter = -1;
                      }
                      p.alter = defaultAlter;
                    }
                    return;
                  }
                }
              }
            }
          }
        }
      });
    },
  };
}

function getTargetEventIds(score: Score, target: string | Selection): string[] {
  if (typeof target === 'string') return [target];
  if (target.kind === 'event') return [target.id];
  if (target.kind === 'range') return eventsInRange(score, target).map((e) => e.id);
  return [];
}

/** Sets or removes dynamic marking on a note or selection. */
export function setDynamic(target: string | Selection, dynamic: string | null): Command {
  return {
    name: dynamic ? `Set Dynamic ${dynamic}` : 'Clear Dynamic',
    apply(score: Score): Score {
      const targetIds = new Set(getTargetEventIds(score, target));
      if (targetIds.size === 0) return score;

      return produce(score, (draft) => {
        for (const part of draft.parts) {
          for (const staff of part.staves) {
            for (const mDef of draft.measures) {
              const sm = staff.measures[mDef.id];
              if (!sm) continue;
              for (const v of sm.voices) {
                for (const ev of v.events) {
                  if (targetIds.has(ev.id) && ev.kind === 'note') {
                    if (dynamic) {
                      ev.dynamic = dynamic;
                    } else {
                      delete ev.dynamic;
                    }
                  }
                }
              }
            }
          }
        }
      });
    },
  };
}

/** Toggles an articulation marking with conflict resolution (accent and marcato exclude each other). */
export function toggleArticulation(target: string | Selection, articulation: string): Command {
  return {
    name: `Toggle Articulation ${articulation}`,
    apply(score: Score): Score {
      const targetIds = new Set(getTargetEventIds(score, target));
      if (targetIds.size === 0) return score;

      return produce(score, (draft) => {
        for (const part of draft.parts) {
          for (const staff of part.staves) {
            for (const mDef of draft.measures) {
              const sm = staff.measures[mDef.id];
              if (!sm) continue;
              for (const v of sm.voices) {
                for (const ev of v.events) {
                  if (targetIds.has(ev.id) && ev.kind === 'note') {
                    if (!ev.articulations) ev.articulations = [];
                    const idx = ev.articulations.indexOf(articulation);
                    if (idx >= 0) {
                      ev.articulations.splice(idx, 1);
                    } else {
                      // Conflict resolution: accent and marcato exclude each other
                      if (articulation === 'accent') {
                        ev.articulations = ev.articulations.filter((a) => a !== 'marcato');
                      } else if (articulation === 'marcato') {
                        ev.articulations = ev.articulations.filter((a) => a !== 'accent');
                      }
                      ev.articulations.push(articulation);
                    }
                  }
                }
              }
            }
          }
        }
      });
    },
  };
}

/** Toggles a slur over the range selection on a staff. */
export function toggleSlur(selection: Selection): Command {
  return {
    name: 'Toggle Slur',
    apply(score: Score): Score {
      if (selection.kind !== 'range') return score;
      const staffId = selection.staffId;
      const targetEvents = eventsInRange(score, selection);
      if (targetEvents.length < 2) return score;

      const firstId = targetEvents[0].id;
      const lastId = targetEvents[targetEvents.length - 1].id;

      return produce(score, (draft) => {
        for (const part of draft.parts) {
          for (const staff of part.staves) {
            if (staff.id === staffId) {
              if (!staff.slurs) staff.slurs = [];
              const existingIdx = staff.slurs.findIndex(
                (s) =>
                  (s.startEventId === firstId && s.endEventId === lastId) ||
                  (s.startEventId === lastId && s.endEventId === firstId)
              );
              if (existingIdx >= 0) {
                staff.slurs.splice(existingIdx, 1);
              } else {
                staff.slurs.push({
                  id: newId(),
                  startEventId: firstId,
                  endEventId: lastId,
                });
              }
              return;
            }
          }
        }
      });
    },
  };
}

/**
 * Toggles a hairpin over the range selection (M7c-2c): none -> this type; same type again removes it;
 * the other type switches it. Needs a range of at least two events.
 */
export function toggleHairpin(selection: Selection, type: HairpinType): Command {
  return {
    name: type === 'crescendo' ? 'Toggle Crescendo' : 'Toggle Diminuendo',
    apply(score: Score): Score {
      if (selection.kind !== 'range') return score;
      const targetEvents = eventsInRange(score, selection);
      if (targetEvents.length < 2) return score;
      const firstId = targetEvents[0].id;
      const lastId = targetEvents[targetEvents.length - 1].id;

      return produce(score, (draft) => {
        for (const part of draft.parts) {
          for (const staff of part.staves) {
            if (staff.id !== selection.staffId) continue;
            if (!staff.hairpins) staff.hairpins = [];
            const existing = staff.hairpins.findIndex((h) => h.startEventId === firstId && h.endEventId === lastId);
            if (existing >= 0) {
              if (staff.hairpins[existing].type === type) staff.hairpins.splice(existing, 1);
              else staff.hairpins[existing].type = type;
            } else {
              staff.hairpins.push({ id: newId(), type, startEventId: firstId, endEventId: lastId });
            }
            if (staff.hairpins.length === 0) delete staff.hairpins;
            return;
          }
        }
      });
    },
  };
}

/** Next state of the fermata cycle: none, above, below, none. */
function nextFermata(current: FermataPlacement | undefined): FermataPlacement | undefined {
  if (current === undefined) return 'above';
  if (current === 'above') return 'below';
  return undefined;
}

/**
 * Cycles the fermata of the selected notes and rests: none, above, below, none (M7c-2).
 * The next state is taken from the first selected event, so a mixed selection ends up uniform.
 */
export function cycleFermata(target: string | Selection): Command {
  return {
    name: 'Cycle Fermata',
    apply(score: Score): Score {
      const targetIds = getTargetEventIds(score, target);
      if (targetIds.length === 0) return score;
      const idSet = new Set(targetIds);

      let next: FermataPlacement | undefined;
      let decided = false;
      for (const part of score.parts) {
        for (const staff of part.staves) {
          for (const sm of Object.values(staff.measures)) {
            for (const v of sm.voices) {
              for (const ev of v.events) {
                if (!decided && idSet.has(ev.id)) {
                  next = nextFermata(ev.fermata);
                  decided = true;
                }
              }
            }
          }
        }
      }
      if (!decided) return score;

      return produce(score, (draft) => {
        for (const part of draft.parts) {
          for (const staff of part.staves) {
            for (const sm of Object.values(staff.measures)) {
              for (const v of sm.voices) {
                for (const ev of v.events) {
                  if (!idSet.has(ev.id)) continue;
                  if (next) ev.fermata = next;
                  else delete ev.fermata;
                }
              }
            }
          }
        }
      });
    },
  };
}

/**
 * Sets a breath mark or caesura after the selected events, or removes it when every selected
 * event already carries that mark (M7c-2).
 */
export function togglePhraseMark(target: string | Selection, mark: PhraseMark): Command {
  return {
    name: `Toggle ${mark}`,
    apply(score: Score): Score {
      const targetIds = getTargetEventIds(score, target);
      if (targetIds.length === 0) return score;
      const idSet = new Set(targetIds);

      let found = 0;
      let carrying = 0;
      for (const part of score.parts) {
        for (const staff of part.staves) {
          for (const sm of Object.values(staff.measures)) {
            for (const v of sm.voices) {
              for (const ev of v.events) {
                if (!idSet.has(ev.id)) continue;
                found++;
                if (ev.phraseMark === mark) carrying++;
              }
            }
          }
        }
      }
      if (found === 0) return score;
      const remove = carrying === found;

      return produce(score, (draft) => {
        for (const part of draft.parts) {
          for (const staff of part.staves) {
            for (const sm of Object.values(staff.measures)) {
              for (const v of sm.voices) {
                for (const ev of v.events) {
                  if (!idSet.has(ev.id)) continue;
                  if (remove) delete ev.phraseMark;
                  else ev.phraseMark = mark;
                }
              }
            }
          }
        }
      });
    },
  };
}

/** Clears all dynamics, articulations, and slurs originating on the selection. */
export function clearSelectionNotations(selection: Selection): Command {
  return {
    name: 'Clear Selection Notations',
    apply(score: Score): Score {
      const targetIds = new Set(getTargetEventIds(score, selection));
      if (targetIds.size === 0) return score;

      return produce(score, (draft) => {
        for (const part of draft.parts) {
          for (const staff of part.staves) {
            if (staff.slurs) {
              staff.slurs = staff.slurs.filter(
                (s) => !targetIds.has(s.startEventId) && !targetIds.has(s.endEventId)
              );
            }
            for (const mDef of draft.measures) {
              const sm = staff.measures[mDef.id];
              if (!sm) continue;
              for (const v of sm.voices) {
                for (const ev of v.events) {
                  if (targetIds.has(ev.id) && ev.kind === 'note') {
                    delete ev.dynamic;
                    ev.articulations = [];
                  }
                }
              }
            }
          }
        }
      });
    },
  };
}

/** Sets or clears a lyric syllable on a note event for a given verse. */
export function setLyrics(eventId: Id, text: string | undefined, verse: number = 1): Command {
  return {
    name: 'Set Lyrics',
    apply(score: Score): Score {
      return produce(score, (draft) => {
        for (const part of draft.parts) {
          for (const staff of part.staves) {
            for (const mDef of draft.measures) {
              const sm = staff.measures[mDef.id];
              if (!sm) continue;
              for (const v of sm.voices) {
                for (const ev of v.events) {
                  if (ev.id === eventId && ev.kind === 'note') {
                    if (text !== undefined && text.trim().length > 0) {
                      const trimmed = text.trim();
                      if (!ev.lyrics) {
                        ev.lyrics = [{ verse, text: trimmed }];
                      } else {
                        const existingIdx = ev.lyrics.findIndex((l) => l.verse === verse);
                        if (existingIdx >= 0) {
                          ev.lyrics[existingIdx].text = trimmed;
                        } else {
                          ev.lyrics.push({ verse, text: trimmed });
                        }
                      }
                    } else if (ev.lyrics) {
                      ev.lyrics = ev.lyrics.filter((l) => l.verse !== verse);
                      if (ev.lyrics.length === 0) {
                        delete ev.lyrics;
                      }
                    }
                    return;
                  }
                }
              }
            }
          }
        }
      });
    },
  };
}

/** Pastes whitespace-delimited syllables across consecutive non-tied notes starting at startEventId. */
export function pasteLyrics(startEventId: Id, text: string, _score?: Score, verse: number = 1): Command {
  const syllables = text.trim().split(/\s+/).filter(Boolean);
  return {
    name: 'Paste Lyrics',
    apply(currentScore: Score): Score {
      return produce(currentScore, (draft) => {
        if (syllables.length === 0) return;

        // Collect all eligible notes in sequential order
        const eligibleNotes: NoteEvent[] = [];
        let startCollecting = false;

        for (const part of draft.parts) {
          for (const staff of part.staves) {
            let prevTied = false;
            for (const mDef of draft.measures) {
              const sm = staff.measures[mDef.id];
              if (!sm) continue;
              for (const v of sm.voices) {
                for (const ev of v.events) {
                  const isSecondTied = prevTied;
                  if (ev.kind === 'note') {
                    prevTied = Boolean(ev.tiedToNext || ev.pitches.some((p) => p.tiedToNext));
                    if (!startCollecting) {
                      if (ev.id === startEventId) {
                        startCollecting = true;
                      }
                    }
                    if (startCollecting && !isSecondTied) {
                      eligibleNotes.push(ev);
                    }
                  } else {
                    prevTied = false;
                  }
                }
              }
            }
          }
        }

        for (let i = 0; i < syllables.length && i < eligibleNotes.length; i++) {
          const note = eligibleNotes[i];
          const syllText = syllables[i];
          if (!note.lyrics) {
            note.lyrics = [{ verse, text: syllText }];
          } else {
            const existingIdx = note.lyrics.findIndex((l) => l.verse === verse);
            if (existingIdx >= 0) {
              note.lyrics[existingIdx].text = syllText;
            } else {
              note.lyrics.push({ verse, text: syllText });
            }
          }
        }
      });
    },
  };
}

/**
 * Removes all lyrics (every verse) from the selected notes, or from the whole score when the
 * selection is empty. Dynamics, articulations, ties and slurs are left alone.
 */
export function clearLyrics(selection: Selection): Command {
  return {
    name: 'Clear Lyrics',
    apply(score: Score): Score {
      const wholeScore = selection.kind === 'none';
      const targetIds = new Set(wholeScore ? [] : getTargetEventIds(score, selection));
      if (!wholeScore && targetIds.size === 0) return score;

      return produce(score, (draft) => {
        for (const part of draft.parts) {
          for (const staff of part.staves) {
            for (const mDef of draft.measures) {
              const sm = staff.measures[mDef.id];
              if (!sm) continue;
              for (const v of sm.voices) {
                for (const ev of v.events) {
                  if (ev.kind === 'note' && ev.lyrics && (wholeScore || targetIds.has(ev.id))) {
                    delete ev.lyrics;
                  }
                }
              }
            }
          }
        }
      });
    },
  };
}

const SOLFEGE_MAP: Record<string, string> = {
  C: 'Do',
  D: 'Re',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Si',
};

/** Automatically assigns Turkish solfege syllables (Do, Re, Mi, Fa, Sol, La, Si) to notes based on pitch step. */
export function autoSolfege(targetMeasureIdOrScoreId?: Id): Command {
  return {
    name: 'Auto Solfege',
    apply(score: Score): Score {
      return produce(score, (draft) => {
        for (const part of draft.parts) {
          for (const staff of part.staves) {
            for (const mDef of draft.measures) {
              if (
                targetMeasureIdOrScoreId &&
                targetMeasureIdOrScoreId !== score.id &&
                mDef.id !== targetMeasureIdOrScoreId
              ) {
                continue;
              }
              const sm = staff.measures[mDef.id];
              if (!sm) continue;
              for (const v of sm.voices) {
                for (const ev of v.events) {
                  if (ev.kind === 'note' && ev.pitches.length > 0) {
                    const step = ev.pitches[0].step;
                    const syllable = SOLFEGE_MAP[step] ?? step;
                    ev.lyrics = [{ verse: 1, text: syllable }];
                  }
                }
              }
            }
          }
        }
      });
    },
  };
}
