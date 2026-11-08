import React, { createContext, useContext, useState } from 'react';

export type AptitudeGrade = 'EXCELENTE' | 'APTO' | 'NO APTO' | 'PENDIENTE';

export interface ReactionResult {
  avgMs: number;
  leftAvgMs: number;
  rightAvgMs: number;
  bestMs: number;
  accuracyPct: number;
  falseStarts: number;
  wrongHandCount: number;
  grade: AptitudeGrade;
  completedAt: string;
}

export interface LatheResult {
  precisionPct: number;
  leftPrecisionPct: number;
  rightPrecisionPct: number;
  offTrackSeconds: number;
  speedLevel: string;
  grade: AptitudeGrade;
  completedAt: string;
}

export interface ManeuverResult {
  elapsedSeconds: number;
  collisions: number;
  alignmentPct: number;
  scenarioTitle: string;
  grade: AptitudeGrade;
  completedAt: string;
}

interface EvaluationContextValue {
  reactionResult: ReactionResult | null;
  latheResult: LatheResult | null;
  maneuverResult: ManeuverResult | null;
  measuredAudioLatencyMs: number;
  setReactionResult: (res: ReactionResult) => void;
  setLatheResult: (res: LatheResult) => void;
  setManeuverResult: (res: ManeuverResult) => void;
  setMeasuredAudioLatencyMs: (ms: number) => void;
  resetAllEvaluations: () => void;
}

const EvaluationContext = createContext<EvaluationContextValue | undefined>(undefined);

export function EvaluationProvider({ children }: { children: React.ReactNode }) {
  const [reactionResult, setReactionResult] = useState<ReactionResult | null>(null);
  const [latheResult, setLatheResult] = useState<LatheResult | null>(null);
  const [maneuverResult, setManeuverResult] = useState<ManeuverResult | null>(null);
  const [measuredAudioLatencyMs, setMeasuredAudioLatencyMs] = useState<number>(11.8);

  const resetAllEvaluations = () => {
    setReactionResult(null);
    setLatheResult(null);
    setManeuverResult(null);
  };

  return (
    <EvaluationContext.Provider
      value={{
        reactionResult,
        latheResult,
        maneuverResult,
        measuredAudioLatencyMs,
        setReactionResult,
        setLatheResult,
        setManeuverResult,
        setMeasuredAudioLatencyMs,
        resetAllEvaluations,
      }}>
      {children}
    </EvaluationContext.Provider>
  );
}

export function useEvaluation() {
  const ctx = useContext(EvaluationContext);
  if (!ctx) {
    throw new Error('useEvaluation must be used within an EvaluationProvider');
  }
  return ctx;
}
