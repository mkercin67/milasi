// SPDX-License-Identifier: GPL-3.0-or-later
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Command,
  changePitch,
  convertToRest,
  deleteRange,
  resetAccidentalToKeySig,
  setExplicitAccidental,
  toggleTie,
  transposeEvent,
  transposeRange,
} from '../../core/commands';
import { NoteEvent, Pitch, Score, ScoreEvent } from '../../core/model';
import {
  Selection,
  RangeSelection,
  eventsInRange,
  extendSelection,
  findEventContext,
  getRangeMeasureSpan,
  measureAllVoicesRange,
  nextEventId,
} from '../../core/selection';
import {
  ClipboardVoice,
  clipboardVoicesFromRange,
  deserializeClipboard,
  deserializeClipboardVoices,
  getMemoryClipboard,
  getMemoryClipboardVoices,
  pasteEvents,
  pasteVoices,
  serializeClipboard,
  serializeClipboardVoices,
  setMemoryClipboard,
  setMemoryClipboardVoices,
} from '../../core/clipboard';
import { EditorMode } from '../keymap';
import { ScoreCursor } from '../../core/input';
import { findStaff, firstStaff } from '../../core/staffLookup';

/** The staff that holds the given event (undefined for no id or an unknown event). */
function staffOfEvent(score: Score, eventId: string | null | undefined) {
  if (!eventId) return undefined;
  return findStaff(score, findEventContext(score, eventId)?.staffId);
}

export interface SelectedEventInfo {
  eventId: string;
  measureNumber: number;
  measureId?: string;
  event: ScoreEvent;
  isNote: boolean;
  isChord: boolean;
  isRest: boolean;
  pitches: Pitch[];
  baseType: ScoreEvent['baseType'];
  dots: number;
  dynamic?: string;
  articulations?: string[];
  hasSlur?: boolean;
}

export interface UseEditorSelectionParams {
  score: Score;
  scoreRef: React.MutableRefObject<Score>;
  executeCommand: (cmd: Command) => Score;
  triggerRejectedError: (msg: string) => void;
  cursor: ScoreCursor | null;
  cursorRef: React.MutableRefObject<ScoreCursor | null>;
  mode: EditorMode;
}

export function useEditorSelection({
  score,
  scoreRef,
  executeCommand,
  triggerRejectedError,
  cursor,
  cursorRef,
  mode,
}: UseEditorSelectionParams) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>(() => ({ kind: 'none' }));

  const selectionRef = useRef<Selection>({ kind: 'none' });
  const selectedEventIdRef = useRef<string | null>(null);
  const rangeEventsRef = useRef<ScoreEvent[]>([]);
  const selectedEventInfoRef = useRef<SelectedEventInfo | null>(null);
  const modeRef = useRef<EditorMode>(mode);
  modeRef.current = mode;

  const selectEvent = useCallback((id: string | null) => {
    selectedEventIdRef.current = id;
    const newSel: Selection = id ? { kind: 'event', id } : { kind: 'none' };
    selectionRef.current = newSel;
    rangeEventsRef.current = [];
    setSelectedEventId(id);
    setSelection(newSel);
  }, []);

  const setRangeSelection = useCallback((range: RangeSelection | null) => {
    selectedEventIdRef.current = null;
    if (range) {
      const newSel: Selection = { kind: 'range', ...range };
      selectionRef.current = newSel;
      rangeEventsRef.current = eventsInRange(scoreRef.current, range);
      setSelection(newSel);
      setSelectedEventId(null);
    } else {
      selectionRef.current = { kind: 'none' };
      rangeEventsRef.current = [];
      setSelection({ kind: 'none' });
      setSelectedEventId(null);
    }
  }, [scoreRef]);

  const extendSelectionTo = useCallback(
    (targetEventId: string, forceAllVoices = false) => {
      const curScore = scoreRef.current;
      const baseSel: Selection =
        selectionRef.current.kind !== 'none'
          ? selectionRef.current
          : selectedEventIdRef.current
          ? { kind: 'event', id: selectedEventIdRef.current }
          : { kind: 'none' };
      let nextSel = extendSelection(curScore, baseSel, targetEventId);
      if (forceAllVoices && nextSel.kind === 'range') nextSel = { ...nextSel, allVoices: true };
      selectionRef.current = nextSel;
      if (nextSel.kind === 'event') {
        selectedEventIdRef.current = nextSel.id;
        rangeEventsRef.current = [];
        setSelectedEventId(nextSel.id);
      } else if (nextSel.kind === 'range') {
        selectedEventIdRef.current = null;
        rangeEventsRef.current = eventsInRange(curScore, nextSel);
        setSelectedEventId(null);
      } else {
        selectedEventIdRef.current = null;
        rangeEventsRef.current = [];
        setSelectedEventId(null);
      }
      setSelection(nextSel);
    },
    [scoreRef]
  );

  const extendSelectionDirection = useCallback(
    (direction: 'prev' | 'next', allVoices = false) => {
      const curScore = scoreRef.current;
      const curSel = selectionRef.current;
      const currentEventId =
        curSel.kind === 'range'
          ? curSel.focusId
          : curSel.kind === 'event'
          ? curSel.id
          : selectedEventIdRef.current;
      if (!currentEventId) return;
      const staffId = findEventContext(curScore, currentEventId)?.staffId;
      if (!staffId) return;
      const nextId = nextEventId(curScore, staffId, currentEventId, direction);
      if (nextId) {
        extendSelectionTo(nextId, allVoices);
      }
    },
    [extendSelectionTo, scoreRef]
  );

  /** Ctrl+Shift+A (M7a-5): selects every voice of the measure of the selection, else of the cursor. */
  const selectMeasureAllVoices = useCallback(() => {
    const curScore = scoreRef.current;
    const curSel = selectionRef.current;
    const anchorEventId =
      curSel.kind === 'range' ? curSel.focusId : curSel.kind === 'event' ? curSel.id : selectedEventIdRef.current;
    const ctx = anchorEventId ? findEventContext(curScore, anchorEventId) : null;
    const staffId = ctx?.staffId ?? cursorRef.current?.staffId;
    const measureId = ctx?.measureId ?? cursorRef.current?.measureId;
    if (!staffId || !measureId) return;
    const range = measureAllVoicesRange(curScore, staffId, measureId);
    if (!range) return;
    const nextSel: Selection = { ...range, kind: 'range' };
    selectionRef.current = nextSel;
    selectedEventIdRef.current = null;
    rangeEventsRef.current = eventsInRange(curScore, nextSel);
    setSelection(nextSel);
    setSelectedEventId(null);
  }, [scoreRef, cursorRef]);

  const selectAllInStaff = useCallback(() => {
    const curScore = scoreRef.current;
    const curSel = selectionRef.current;
    const anchorEventId =
      curSel.kind === 'range' ? curSel.focusId : curSel.kind === 'event' ? curSel.id : selectedEventIdRef.current;
    const staff =
      staffOfEvent(curScore, anchorEventId) ?? findStaff(curScore, cursorRef.current?.staffId) ?? firstStaff(curScore);
    if (!staff) return;
    const allEvents: ScoreEvent[] = [];
    for (const mDef of curScore.measures) {
      const sm = staff.measures[mDef.id];
      if (sm) {
        for (const v of sm.voices) {
          allEvents.push(...v.events);
        }
      }
    }
    if (allEvents.length > 0) {
      const firstEv = allEvents[0];
      const lastEv = allEvents[allEvents.length - 1];
      const firstCtx = findEventContext(curScore, firstEv.id);
      const voiceIndex = (firstCtx?.voiceIndex ?? 1) as 1 | 2 | 3 | 4;
      const nextSel: Selection = {
        kind: 'range',
        staffId: staff.id,
        voiceIndex,
        anchorId: firstEv.id,
        focusId: lastEv.id,
      };
      selectionRef.current = nextSel;
      selectedEventIdRef.current = null;
      rangeEventsRef.current = eventsInRange(curScore, nextSel);
      setSelection(nextSel);
      setSelectedEventId(null);
    }
  }, [scoreRef, cursorRef]);

  const selectNext = useCallback(
    (direction: 'prev' | 'next') => {
      const staffId = (staffOfEvent(score, selectedEventId) ?? findStaff(score, cursor?.staffId) ?? firstStaff(score))?.id;
      if (!staffId) return;
      const nextId = nextEventId(score, staffId, selectedEventId, direction);
      if (nextId) {
        setSelectedEventId(nextId);
        setSelection({ kind: 'event', id: nextId });
      }
    },
    [score, selectedEventId, cursor?.staffId]
  );

  const selectedEventInfo = useMemo<SelectedEventInfo | null>(() => {
    if (!selectedEventId) return null;

    const staff = staffOfEvent(score, selectedEventId);
    if (!staff) return null;

    for (let mIdx = 0; mIdx < score.measures.length; mIdx++) {
      const mDef = score.measures[mIdx];
      const sm = staff.measures[mDef.id];
      if (!sm) continue;

      for (const voice of sm.voices) {
        const ev = voice.events.find((e) => e.id === selectedEventId);
        if (ev) {
          const isNote = ev.kind === 'note';
          const isRest = ev.kind === 'rest';
          const pitches = isNote ? (ev as NoteEvent).pitches : [];
          const noteEv = isNote ? (ev as NoteEvent) : null;
          const hasSlur = Boolean(
            staff.slurs?.some((s) => s.startEventId === ev.id || s.endEventId === ev.id)
          );
          return {
            eventId: ev.id,
            measureNumber: mIdx + 1,
            measureId: mDef.id,
            event: ev,
            isNote,
            isChord: pitches.length > 1,
            isRest,
            pitches,
            baseType: ev.baseType,
            dots: ev.dots,
            dynamic: noteEv?.dynamic,
            articulations: noteEv?.articulations ?? [],
            hasSlur,
          };
        }
      }
    }
    return null;
  }, [score, selectedEventId]);

  const currentMeasureNumber = useMemo(() => {
    if (!cursor) return 1;
    const idx = score.measures.findIndex((m) => m.id === cursor.measureId);
    return idx >= 0 ? idx + 1 : 1;
  }, [score, cursor]);

  const selectedRange = useMemo<RangeSelection | null>(
    () => (selection.kind === 'range' ? selection : null),
    [selection]
  );

  const rangeEvents = useMemo<ScoreEvent[]>(
    () => (selectedRange ? eventsInRange(score, selectedRange) : []),
    [score, selectedRange]
  );

  const selectedEventIds = useMemo<Set<string>>(() => {
    if (selectedRange) return new Set(rangeEvents.map((e) => e.id));
    if (selectedEventId) return new Set([selectedEventId]);
    return new Set<string>();
  }, [selectedRange, rangeEvents, selectedEventId]);

  const rangeInfo = useMemo(() => {
    if (!selectedRange || rangeEvents.length === 0) return null;
    return getRangeMeasureSpan(score, rangeEvents);
  }, [score, selectedRange, rangeEvents]);

  selectionRef.current = selection;
  selectedEventIdRef.current = selectedEventId;
  rangeEventsRef.current = rangeEvents;
  selectedEventInfoRef.current = selectedEventInfo;

  const deleteSelection = useCallback(() => {
    const curSel = selectionRef.current;
    if (curSel.kind === 'range') {
      executeCommand(deleteRange(curSel));
      selectionRef.current = { kind: 'none' };
      rangeEventsRef.current = [];
      setSelection({ kind: 'none' });
    } else if (selectedEventIdRef.current) {
      executeCommand(convertToRest(selectedEventIdRef.current));
      selectedEventIdRef.current = null;
      selectionRef.current = { kind: 'none' };
      setSelectedEventId(null);
      setSelection({ kind: 'none' });
    }
  }, [executeCommand]);

  const transposeSelection = useCallback(
    (semitones: number) => {
      if (selection.kind === 'range') {
        try {
          executeCommand(transposeRange(selection, semitones));
        } catch {
          triggerRejectedError('Perde MIDI sınırları dışında (21..108)');
        }
      } else if (selectedEventId) {
        try {
          executeCommand(transposeEvent(selectedEventId, semitones));
        } catch {
          triggerRejectedError('Perde MIDI sınırları dışında (21..108)');
        }
      }
    },
    [selection, selectedEventId, executeCommand, triggerRejectedError]
  );

  const toggleTieSelection = useCallback(() => {
    if (selectedEventId) {
      try {
        executeCommand(toggleTie(selectedEventId, 0));
      } catch {
        triggerRejectedError('Bağlanacak sonraki nota bulunamadı');
      }
    } else if (selection.kind === 'range') {
      try {
        for (const ev of rangeEvents) {
          if (ev.kind === 'note') {
            executeCommand(toggleTie(ev.id, 0));
          }
        }
      } catch {
        triggerRejectedError('Bağlanacak sonraki nota bulunamadı');
      }
    }
  }, [selectedEventId, selection, rangeEvents, executeCommand, triggerRejectedError]);

  const cycleAccidentalSelection = useCallback(
    (delta: number) => {
      if (selectedEventId) {
        executeCommand(setExplicitAccidental(selectedEventId, delta, 0));
      } else if (selection.kind === 'range') {
        for (const ev of rangeEvents) {
          if (ev.kind === 'note') {
            executeCommand(setExplicitAccidental(ev.id, delta, 0));
          }
        }
      } else if (mode === 'input' && cursor) {
        const sm = findStaff(score, cursor.staffId)?.measures[cursor.measureId];
        const v = sm?.voices.find((vo) => vo.voiceIndex === cursor.voiceIndex);
        if (v) {
          const lastNote = [...v.events].reverse().find((e) => e.kind === 'note');
          if (lastNote) {
            executeCommand(setExplicitAccidental(lastNote.id, delta, 0));
          }
        }
      }
    },
    [selectedEventId, selection, rangeEvents, mode, cursor, score, executeCommand]
  );

  const resetAccidentalSelection = useCallback(() => {
    if (selectedEventId) {
      executeCommand(resetAccidentalToKeySig(selectedEventId, 0));
    } else if (selection.kind === 'range') {
      for (const ev of rangeEvents) {
        if (ev.kind === 'note') {
          executeCommand(resetAccidentalToKeySig(ev.id, 0));
        }
      }
    }
  }, [selectedEventId, selection, rangeEvents, executeCommand]);

  const copySelection = useCallback(() => {
    let evs: ScoreEvent[] = [];
    const curSel = selectionRef.current;
    if (curSel.kind === 'range' && curSel.allVoices) {
      const voices = clipboardVoicesFromRange(scoreRef.current, curSel);
      if (voices.length > 0) {
        setMemoryClipboardVoices(voices);
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(serializeClipboardVoices(voices)).catch(() => {});
        }
      }
      return;
    }
    if (curSel.kind === 'range') {
      evs = rangeEventsRef.current;
    } else if (selectedEventInfoRef.current) {
      evs = [selectedEventInfoRef.current.event];
    }
    if (evs.length > 0) {
      setMemoryClipboardVoices(null);
      setMemoryClipboard(evs);
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(serializeClipboard(evs)).catch(() => {});
      }
    }
  }, [scoreRef]);

  const cutSelection = useCallback(() => {
    copySelection();
    deleteSelection();
  }, [copySelection, deleteSelection]);

  const pasteClipboard = useCallback(async () => {
    let eventsToPaste = getMemoryClipboard();
    let voicesToPaste: ClipboardVoice[] | null = getMemoryClipboardVoices();
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      try {
        const text = await navigator.clipboard.readText();
        const voices = deserializeClipboardVoices(text);
        const deserialized = deserializeClipboard(text);
        if (voices && voices.length > 0) {
          voicesToPaste = voices;
        } else if (deserialized && deserialized.length > 0) {
          eventsToPaste = deserialized;
          voicesToPaste = null;
        }
      } catch {
        // Fallback to in-memory clipboard
      }
    }
    if (!voicesToPaste && eventsToPaste.length === 0) return;

    const curScore = scoreRef.current;
    const curSel = selectionRef.current;
    const curRangeEvents = rangeEventsRef.current;
    const curEventId = selectedEventIdRef.current;
    const curCursor = cursorRef.current;

    // Paste goes to the staff of the cursor (input mode), else the staff of the selection.
    const staff =
      (modeRef.current === 'input' ? findStaff(curScore, curCursor?.staffId) : undefined) ??
      (curSel.kind === 'range' ? staffOfEvent(curScore, curRangeEvents[0]?.id) : undefined) ??
      staffOfEvent(curScore, curEventId) ??
      findStaff(curScore, curCursor?.staffId) ??
      firstStaff(curScore);
    if (!staff) return;

    let startMId = curScore.measures[0]?.id;
    let startOffset = 0;
    let targetVoiceIndex: 1 | 2 | 3 | 4 = 1;

    if (modeRef.current === 'input' && curCursor) {
      startMId = curCursor.measureId;
      targetVoiceIndex = curCursor.voiceIndex;
      startOffset = curCursor.tick;
    } else if (curSel.kind === 'range') {
      const firstEv = curRangeEvents[0];
      if (firstEv) {
        const loc = findEventContext(curScore, firstEv.id);
        if (loc) {
          startMId = loc.measureId;
          targetVoiceIndex = loc.voiceIndex;
          const sm = staff.measures[startMId];
          const v = sm?.voices.find((vo) => vo.voiceIndex === targetVoiceIndex);
          if (v) {
            let t = 0;
            for (const ev of v.events) {
              if (ev.id === firstEv.id) {
                startOffset = t;
                break;
              }
              t += ev.duration;
            }
          }
        }
      }
    } else if (curEventId) {
      const loc = findEventContext(curScore, curEventId);
      if (loc) {
        startMId = loc.measureId;
        targetVoiceIndex = loc.voiceIndex;
        const sm = staff.measures[startMId];
        const v = sm?.voices.find((vo) => vo.voiceIndex === targetVoiceIndex);
        if (v) {
          let t = 0;
          for (const ev of v.events) {
            if (ev.id === curEventId) {
              startOffset = t;
              break;
            }
            t += ev.duration;
          }
        }
      }
    } else if (curCursor) {
      startMId = curCursor.measureId;
      targetVoiceIndex = curCursor.voiceIndex;
      startOffset = curCursor.tick;
    }

    if (startMId && voicesToPaste) {
      const voices = voicesToPaste;
      const placedIds: string[] = [];
      executeCommand({
        name: 'Paste Voices',
        apply: (s) =>
          pasteVoices(s, { staffId: staff.id, startMeasureId: startMId, startOffsetTicks: startOffset }, voices, placedIds),
      });
      if (placedIds.length > 0) {
        setRangeSelection({
          staffId: staff.id,
          voiceIndex: voices[0].voiceIndex,
          anchorId: placedIds[0],
          focusId: placedIds[placedIds.length - 1],
          allVoices: true,
        });
      }
    } else if (startMId) {
      const placedIds: string[] = [];
      executeCommand({
        name: 'Paste Events',
        apply: (s) =>
          pasteEvents(
            s,
            {
              staffId: staff.id,
              voiceIndex: targetVoiceIndex,
              startMeasureId: startMId,
              startOffsetTicks: startOffset,
            },
            eventsToPaste,
            placedIds
          ),
      });

      if (placedIds.length > 0) {
        const firstId = placedIds[0];
        const lastId = placedIds[placedIds.length - 1];
        if (firstId === lastId) {
          selectEvent(firstId);
        } else {
          setRangeSelection({
            staffId: staff.id,
            voiceIndex: targetVoiceIndex,
            anchorId: firstId,
            focusId: lastId,
          });
        }
      }
    }
  }, [executeCommand, selectEvent, setRangeSelection, scoreRef, cursorRef]);

  const changeEventPitch = useCallback((eventId: string, pitches: Pitch[]) => {
    executeCommand(changePitch(eventId, pitches));
  }, [executeCommand]);

  return {
    selectedEventId,
    setSelectedEventId,
    selection,
    setSelection,
    selectionRef,
    selectedEventIdRef,
    rangeEventsRef,
    selectedEventInfoRef,
    selectedRange,
    rangeEvents,
    selectedEventIds,
    rangeInfo,
    selectedEventInfo,
    currentMeasureNumber,
    selectEvent,
    setRangeSelection,
    extendSelectionTo,
    extendSelectionDirection,
    selectMeasureAllVoices,
    selectAllInStaff,
    selectNext,
    deleteSelection,
    transposeSelection,
    toggleTieSelection,
    cycleAccidentalSelection,
    resetAccidentalSelection,
    copySelection,
    cutSelection,
    pasteClipboard,
    changeEventPitch,
  };
}
