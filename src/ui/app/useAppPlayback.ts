// SPDX-License-Identifier: GPL-3.0-or-later
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pitch, Score } from '../../core/model';
import { AudioEngine, EMPTY_MIXER, FakeEngine, MixerState, Player, PreviewPlayer, ToneEngine, pruneMixer } from '../../playback';
import { setTempo, Command } from '../../core/commands';

export interface UseAppPlaybackParams {
  score: Score;
  selectedEventId: string | null;
  executeCommand: (cmd: Command) => Score;
}

interface AudioTestWindow extends Window {
  __audioLog?: unknown[];
  __audioEngine?: AudioEngine;
}

export function useAppPlayback({
  score,
  selectedEventId,
  executeCommand,
}: UseAppPlaybackParams) {
  const [audioEngine] = useState<AudioEngine>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('audio') === 'fake') {
        const fake = new FakeEngine();
        const testWin = window as unknown as AudioTestWindow;
        testWin.__audioLog = fake.logs;
        testWin.__audioEngine = fake;
        return fake;
      }
    }
    return new ToneEngine();
  });

  const [player] = useState<Player>(() => new Player(score, audioEngine));
  const [previewPlayer] = useState<PreviewPlayer>(() => new PreviewPlayer(audioEngine));

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [activePlaybackEventIds, setActivePlaybackEventIds] = useState<string[]>([]);
  const [playbackSeconds, setPlaybackSeconds] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [previewSound, setPreviewSound] = useState<boolean>(() => previewPlayer.enabled);

  const [mixer, setMixer] = useState<MixerState>(EMPTY_MIXER);

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  useEffect(() => {
    player.setScore(score);
    const nextPlaying = player.state === 'playing';
    const nextPaused = player.state === 'paused';
    if (nextPlaying !== isPlayingRef.current) {
      setIsPlaying(nextPlaying);
    }
    if (nextPaused !== isPausedRef.current) {
      setIsPaused(nextPaused);
    }
  }, [score, player]);

  // M7c-8: the mixer is a playback setting; drop entries of parts that no longer exist.
  useEffect(() => {
    setMixer((prev) => {
      const next = pruneMixer(prev, score.parts.map((p) => p.id));
      const same =
        next.muted.size === prev.muted.size && next.solo.size === prev.solo.size && next.volume.size === prev.volume.size;
      return same ? prev : next;
    });
  }, [score.parts]);

  useEffect(() => {
    player.setMixer(mixer);
  }, [player, mixer]);

  useEffect(() => {
    const unsub = player.onPosition((pos) => {
      const nextPlaying = player.state === 'playing';
      const nextPaused = player.state === 'paused';
      setIsPlaying((prev) => (prev === nextPlaying ? prev : nextPlaying));
      setIsPaused((prev) => (prev === nextPaused ? prev : nextPaused));
      setActivePlaybackEventIds((prev) => {
        if (prev.length === 0 && pos.activeEventIds.length === 0) return prev;
        if (
          prev.length === pos.activeEventIds.length &&
          prev.every((id, idx) => id === pos.activeEventIds[idx])
        ) {
          return prev;
        }
        return pos.activeEventIds;
      });
      setPlaybackSeconds((prev) => (prev === pos.seconds ? prev : pos.seconds));
    });
    return () => {
      unsub();
      player.dispose();
    };
  }, [player]);

  const handleTogglePlay = useCallback(() => {
    if (player.state === 'playing') {
      player.pause();
      setIsPlaying(false);
      setIsPaused(true);
    } else if (player.state === 'paused') {
      player.resume();
      setIsPlaying(true);
      setIsPaused(false);
    } else {
      player.play(selectedEventId ?? undefined).then(() => {
        setIsPlaying(player.state === 'playing');
        setIsPaused(player.state === 'paused');
      });
    }
  }, [player, selectedEventId]);

  const handleStop = useCallback(() => {
    player.stop();
    setIsPlaying(false);
    setIsPaused(false);
    setActivePlaybackEventIds([]);
    setPlaybackSeconds(0);
  }, [player]);

  const handleChangeTempo = useCallback(
    (bpm: number) => {
      if (player.state !== 'idle') {
        player.stop();
      }
      executeCommand(setTempo(0, { bpm }));
    },
    [player, executeCommand]
  );

  const handleVolumeChange = useCallback(
    (vol: number) => {
      setVolume(vol);
      audioEngine.setVolume(isMuted ? 0 : vol);
    },
    [audioEngine, isMuted]
  );

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      audioEngine.setVolume(next ? 0 : volume);
      return next;
    });
  }, [audioEngine, volume]);

  const handleTogglePreviewSound = useCallback(() => {
    setPreviewSound((prev) => {
      const next = !prev;
      previewPlayer.enabled = next;
      return next;
    });
  }, [previewPlayer]);

  const handlePreviewPitches = useCallback(
    (pitches: Pitch[]) => {
      if (previewSound && pitches.length > 0) {
        previewPlayer.previewPitches(pitches);
      }
    },
    [previewSound, previewPlayer]
  );

  return {
    player,
    previewPlayer,
    audioEngine,
    isPlaying,
    isPaused,
    activePlaybackEventIds,
    playbackSeconds,
    volume,
    isMuted,
    previewSound,
    mixer,
    setMixer,
    handleTogglePlay,
    handleStop,
    handleChangeTempo,
    handleVolumeChange,
    handleToggleMute,
    handleTogglePreviewSound,
    handlePreviewPitches,
  };
}
