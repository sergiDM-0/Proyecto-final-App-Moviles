import { useEffect, useRef, useState } from 'react';

import { useEvaluation } from '@/context/evaluation-context';

export interface TelemetryData {
  fps: number;
  frameTimeMs: number;
  audioLatencyMs: number;
  systemStatus: 'ÓPTIMO' | 'ESTABLE' | 'CARGA ALTA';
}

export function useTelemetry(): TelemetryData {
  const { measuredAudioLatencyMs } = useEvaluation();
  const [fps, setFps] = useState<number>(60);
  const [frameTimeMs, setFrameTimeMs] = useState<number>(16.6);
  const [jitterMs, setJitterMs] = useState<number>(0);

  const frameCountRef = useRef(0);
  const lastSampleTimeRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;
    lastSampleTimeRef.current = performance.now();
    frameCountRef.current = 0;

    const loop = (now: number) => {
      if (!mounted) return;
      frameCountRef.current += 1;
      const elapsed = now - lastSampleTimeRef.current;

      if (elapsed >= 650) {
        const currentFps = Math.min(120, Math.max(15, Math.round((frameCountRef.current * 1000) / elapsed)));
        const avgFrame = Number((elapsed / frameCountRef.current).toFixed(1));
        setFps(currentFps);
        setFrameTimeMs(avgFrame);
        setJitterMs(Number(((Math.random() - 0.5) * 0.8).toFixed(1)));
        frameCountRef.current = 0;
        lastSampleTimeRef.current = now;
      }

      rafIdRef.current = requestAnimationFrame(loop);
    };

    rafIdRef.current = requestAnimationFrame(loop);

    return () => {
      mounted = false;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  const audioLatencyMs = Number(Math.max(4.2, measuredAudioLatencyMs + jitterMs).toFixed(1));
  const systemStatus = fps >= 55 ? 'ÓPTIMO' : fps >= 40 ? 'ESTABLE' : 'CARGA ALTA';

  return {
    fps,
    frameTimeMs,
    audioLatencyMs,
    systemStatus,
  };
}

