// SPDX-License-Identifier: GPL-3.0-or-later
import { useCallback, useEffect, useState } from 'react';
import { Pitch, Score } from '../../core/model';
import { AudioEngine, FakeEngine, Player, PreviewPlayer, ToneEngine } from '../../playback';
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

  useEffect(() => {
    player.setScore(score);
    setIsPlaying(player.state === 'playing');
    setIsPaused(player.state === 'paused');
  }, [score, player]);

  useEffect(() => {
    const unsub = player.onPosition((pos) => {
      setIsPlaying(player.state === 'playing');
      setIsPaused(player.state === 'paused');
      setActivePlaybackEventIds(pos.activeEventIds);
      setPlaybackSeconds(pos.seconds);
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
    handleTogglePlay,
    handleStop,
    handleChangeTempo,
    handleVolumeChange,
    handleToggleMute,
    handleTogglePreviewSound,
    handlePreviewPitches,
  };
}
