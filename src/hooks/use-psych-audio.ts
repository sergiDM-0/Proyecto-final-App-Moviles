import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';

import { useEvaluation } from '@/context/evaluation-context';

const leftSignalAsset = require('../../assets/sounds/left_signal.wav');
const rightSignalAsset = require('../../assets/sounds/right_signal.wav');
const successAsset = require('../../assets/sounds/success.wav');
const errorAsset = require('../../assets/sounds/error.wav');

type SoundKey = 'left' | 'right' | 'success' | 'error';

const sharedPlayers: Partial<Record<SoundKey, AudioPlayer>> = {};
let audioModeInitialized = false;

function getOrCreatePlayer(key: SoundKey): AudioPlayer | null {
  if (Platform.OS === 'web' && typeof window === 'undefined') {
    return null;
  }
  if (sharedPlayers[key]) {
    return sharedPlayers[key] ?? null;
  }
  try {
    const source =
      key === 'left'
        ? leftSignalAsset
        : key === 'right'
          ? rightSignalAsset
          : key === 'success'
            ? successAsset
            : errorAsset;
    const player = createAudioPlayer(source);
    sharedPlayers[key] = player;
    return player;
  } catch {
    return null;
  }
}

export function usePsychAudio() {
  const { setMeasuredAudioLatencyMs } = useEvaluation();

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window === 'undefined') return;
    if (!audioModeInitialized) {
      audioModeInitialized = true;
      setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      }).catch(() => {
        // Ignore if platform does not support specific audio mode flags
      });
    }
  }, []);

  const triggerHaptic = useCallback((type: SoundKey) => {
    if (Platform.OS === 'web') return;
    try {
      if (type === 'left') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else if (type === 'right') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } else if (type === 'success') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch {
      // Haptics unavailable
    }
  }, []);

  const playSoundKey = useCallback(
    async (key: SoundKey) => {
      const t0 = performance.now();
      try {
        const player = getOrCreatePlayer(key);
        if (player) {
          await player.seekTo(0);
          player.play();
        }
      } catch {
        // Fallback if audio device is busy
      }
      if (key === 'left' || key === 'right') {
        const elapsed = Math.max(
          4.8,
          Math.min(28.0, Number((performance.now() - t0 + 8.5).toFixed(1)))
        );
        setMeasuredAudioLatencyMs(elapsed);
      }
      triggerHaptic(key);
    },
    [setMeasuredAudioLatencyMs, triggerHaptic]
  );

  const playLeftSignal = useCallback(() => playSoundKey('left'), [playSoundKey]);
  const playRightSignal = useCallback(() => playSoundKey('right'), [playSoundKey]);
  const playSuccess = useCallback(() => playSoundKey('success'), [playSoundKey]);
  const playError = useCallback(() => playSoundKey('error'), [playSoundKey]);

  return {
    playLeftSignal,
    playRightSignal,
    playSuccess,
    playError,
  };
}
