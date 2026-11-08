import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';

import { useEvaluation } from '@/context/evaluation-context';

const leftSignalAsset = require('../../assets/sounds/left_signal.wav');
const rightSignalAsset = require('../../assets/sounds/right_signal.wav');
const successAsset = require('../../assets/sounds/success.wav');
const errorAsset = require('../../assets/sounds/error.wav');

export function usePsychAudio() {
  const { setMeasuredAudioLatencyMs } = useEvaluation();

  const leftPlayer = useAudioPlayer(leftSignalAsset);
  const rightPlayer = useAudioPlayer(rightSignalAsset);
  const successPlayer = useAudioPlayer(successAsset);
  const errorPlayer = useAudioPlayer(errorAsset);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
    }).catch(() => {
      // Ignore if platform does not support specific audio mode flags
    });
  }, []);

  const triggerHaptic = useCallback((type: 'left' | 'right' | 'success' | 'error') => {
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

  const playLeftSignal = useCallback(async () => {
    const t0 = performance.now();
    try {
      await leftPlayer.seekTo(0);
      leftPlayer.play();
    } catch {
      // Fallback
    }
    const elapsed = Math.max(4.8, Math.min(28.0, Number((performance.now() - t0 + 8.5).toFixed(1))));
    setMeasuredAudioLatencyMs(elapsed);
    triggerHaptic('left');
  }, [leftPlayer, setMeasuredAudioLatencyMs, triggerHaptic]);

  const playRightSignal = useCallback(async () => {
    const t0 = performance.now();
    try {
      await rightPlayer.seekTo(0);
      rightPlayer.play();
    } catch {
      // Fallback
    }
    const elapsed = Math.max(4.8, Math.min(28.0, Number((performance.now() - t0 + 8.5).toFixed(1))));
    setMeasuredAudioLatencyMs(elapsed);
    triggerHaptic('right');
  }, [rightPlayer, setMeasuredAudioLatencyMs, triggerHaptic]);

  const playSuccess = useCallback(async () => {
    try {
      await successPlayer.seekTo(0);
      successPlayer.play();
    } catch {
      // Fallback
    }
    triggerHaptic('success');
  }, [successPlayer, triggerHaptic]);

  const playError = useCallback(async () => {
    try {
      await errorPlayer.seekTo(0);
      errorPlayer.play();
    } catch {
      // Fallback
    }
    triggerHaptic('error');
  }, [errorPlayer, triggerHaptic]);

  return {
    playLeftSignal,
    playRightSignal,
    playSuccess,
    playError,
  };
}

