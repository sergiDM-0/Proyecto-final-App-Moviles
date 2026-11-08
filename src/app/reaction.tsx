import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TelemetryHeader } from '@/components/telemetry-header';
import { Fonts, PsychoPalette } from '@/constants/theme';
import { AptitudeGrade, useEvaluation } from '@/context/evaluation-context';
import { usePsychAudio } from '@/hooks/use-psych-audio';

type TargetHand = 'LEFT' | 'RIGHT';
type StimulusMode = 'BOTH' | 'AUDIO_ONLY' | 'VISUAL_ONLY';
type TestPhase = 'HEADPHONE_PROMPT' | 'IDLE' | 'WAITING' | 'ACTIVE_SIGNAL' | 'FEEDBACK' | 'FINISHED';

interface TrialRecord {
  round: number;
  expectedHand: TargetHand;
  pressedHand: TargetHand | null;
  reactionMs: number | null;
  status: 'HIT' | 'WRONG_HAND' | 'FALSE_START';
}

const TOTAL_ROUNDS = 8;

export default function ReactionAudioScreen() {
  const { setReactionResult } = useEvaluation();
  const { playLeftSignal, playRightSignal, playSuccess, playError } = usePsychAudio();

  const [hasConfirmedHeadphones, setHasConfirmedHeadphones] = useState<boolean>(false);
  const [stimulusMode, setStimulusMode] = useState<StimulusMode>('BOTH');
  const [phase, setPhase] = useState<TestPhase>('HEADPHONE_PROMPT');
  const [currentRound, setCurrentRound] = useState<number>(0);
  const [activeHand, setActiveHand] = useState<TargetHand | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string>(
    'Colóquese sus audífonos y presione "INICIAR EVALUACIÓN" para comenzar la prueba binaural.'
  );
  const [feedbackType, setFeedbackType] = useState<'NEUTRAL' | 'GOOD' | 'BAD'>('NEUTRAL');
  const [trials, setTrials] = useState<TrialRecord[]>([]);

  const signalTimestampRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextRoundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<TestPhase>('HEADPHONE_PROMPT');
  const activeHandRef = useRef<TargetHand | null>(null);
  const roundRef = useRef<number>(0);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (nextRoundTimerRef.current) {
      clearTimeout(nextRoundTimerRef.current);
      nextRoundTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const confirmHeadphones = () => {
    playSuccess();
    setHasConfirmedHeadphones(true);
    phaseRef.current = 'IDLE';
    setPhase('IDLE');
  };

  const testLeftEar = () => {
    playLeftSignal();
  };

  const testRightEar = () => {
    playRightSignal();
  };

  const finishEvaluation = useCallback(
    (finalTrials: TrialRecord[]) => {
      clearTimers();
      phaseRef.current = 'FINISHED';
      setPhase('FINISHED');
      setActiveHand(null);
      activeHandRef.current = null;

      const hits = finalTrials.filter((t) => t.status === 'HIT' && t.reactionMs !== null);
      const leftHits = hits.filter((t) => t.expectedHand === 'LEFT');
      const rightHits = hits.filter((t) => t.expectedHand === 'RIGHT');

      const avgMs =
        hits.length > 0
          ? Math.round(hits.reduce((acc, t) => acc + (t.reactionMs ?? 0), 0) / hits.length)
          : 999;
      const leftAvgMs =
        leftHits.length > 0
          ? Math.round(leftHits.reduce((acc, t) => acc + (t.reactionMs ?? 0), 0) / leftHits.length)
          : avgMs;
      const rightAvgMs =
        rightHits.length > 0
          ? Math.round(
              rightHits.reduce((acc, t) => acc + (t.reactionMs ?? 0), 0) / rightHits.length
            )
          : avgMs;
      const bestMs =
        hits.length > 0 ? Math.min(...hits.map((t) => t.reactionMs ?? 999)) : 999;

      const falseStarts = finalTrials.filter((t) => t.status === 'FALSE_START').length;
      const wrongHandCount = finalTrials.filter((t) => t.status === 'WRONG_HAND').length;
      const accuracyPct = Math.round((hits.length / TOTAL_ROUNDS) * 100);

      let grade: AptitudeGrade = 'NO APTO';
      if (avgMs < 260 && falseStarts === 0 && wrongHandCount === 0 && hits.length >= 7) {
        grade = 'EXCELENTE';
      } else if (avgMs <= 380 && falseStarts + wrongHandCount <= 2 && hits.length >= 6) {
        grade = 'APTO';
      }

      setReactionResult({
        avgMs,
        leftAvgMs,
        rightAvgMs,
        bestMs,
        accuracyPct,
        falseStarts,
        wrongHandCount,
        grade,
        completedAt: new Date().toLocaleTimeString(),
      });

      if (grade === 'NO APTO') {
        playError();
        setFeedbackType('BAD');
        setFeedbackMessage(
          `Evaluación completada: ${grade} (${avgMs} ms promedio). Se requiere < 380 ms y ≤ 2 errores.`
        );
      } else {
        playSuccess();
        setFeedbackType('GOOD');
        setFeedbackMessage(
          `Evaluación completada: ${grade} • Tiempo medio ${avgMs} ms (Izq: ${leftAvgMs} ms | Der: ${rightAvgMs} ms).`
        );
      }
    },
    [clearTimers, playError, playSuccess, setReactionResult]
  );

  const scheduleNextStimulus = useCallback(
    (nextRoundNum: number, currentTrials: TrialRecord[]) => {
      clearTimers();
      if (nextRoundNum > TOTAL_ROUNDS) {
        finishEvaluation(currentTrials);
        return;
      }

      roundRef.current = nextRoundNum;
      setCurrentRound(nextRoundNum);
      phaseRef.current = 'WAITING';
      setPhase('WAITING');
      activeHandRef.current = null;
      setActiveHand(null);
      setFeedbackType('NEUTRAL');
      setFeedbackMessage('Atención... escuche atentamente en sus audífonos.');

      const delayMs = Math.floor(1100 + Math.random() * 1600);
      timerRef.current = setTimeout(() => {
        const chosenHand: TargetHand = Math.random() < 0.5 ? 'LEFT' : 'RIGHT';
        activeHandRef.current = chosenHand;
        setActiveHand(chosenHand);
        phaseRef.current = 'ACTIVE_SIGNAL';
        setPhase('ACTIVE_SIGNAL');
        signalTimestampRef.current = performance.now();

        if (stimulusMode !== 'VISUAL_ONLY') {
          if (chosenHand === 'LEFT') {
            playLeftSignal();
          } else {
            playRightSignal();
          }
        }

        setFeedbackMessage(
          chosenHand === 'LEFT'
            ? '¡SEÑAL OÍDO IZQUIERDO (440 Hz)! Presione el rectángulo ROJO'
            : '¡SEÑAL OÍDO DERECHO (880 Hz)! Presione el rectángulo VERDE'
        );
      }, delayMs);
    },
    [clearTimers, finishEvaluation, playLeftSignal, playRightSignal, stimulusMode]
  );

  const startTest = useCallback(() => {
    clearTimers();
    setTrials([]);
    scheduleNextStimulus(1, []);
  }, [clearTimers, scheduleNextStimulus]);

  const handlePadPress = useCallback(
    (hand: TargetHand) => {
      if (phaseRef.current === 'HEADPHONE_PROMPT') {
        return;
      }

      if (phaseRef.current === 'IDLE' || phaseRef.current === 'FINISHED') {
        if (hand === 'LEFT') {
          playLeftSignal();
        } else {
          playRightSignal();
        }
        return;
      }

      if (phaseRef.current === 'FEEDBACK') {
        return;
      }

      if (phaseRef.current === 'WAITING') {
        clearTimers();
        playError();
        phaseRef.current = 'FEEDBACK';
        setPhase('FEEDBACK');
        setFeedbackType('BAD');
        setFeedbackMessage(
          `¡SALIDA EN FALSO! Presionó Mano ${hand === 'LEFT' ? 'Izquierda' : 'Derecha'} antes del sonido.`
        );

        const newRecord: TrialRecord = {
          round: roundRef.current,
          expectedHand: hand,
          pressedHand: hand,
          reactionMs: null,
          status: 'FALSE_START',
        };
        const updated = [...trials, newRecord];
        setTrials(updated);

        nextRoundTimerRef.current = setTimeout(() => {
          scheduleNextStimulus(roundRef.current + 1, updated);
        }, 1150);
        return;
      }

      if (phaseRef.current === 'ACTIVE_SIGNAL' && activeHandRef.current) {
        const reactionMs = Math.max(
          85,
          Math.round(performance.now() - signalTimestampRef.current)
        );
        const expected = activeHandRef.current;
        clearTimers();
        phaseRef.current = 'FEEDBACK';
        setPhase('FEEDBACK');
        setActiveHand(null);
        activeHandRef.current = null;

        if (hand === expected) {
          playSuccess();
          setFeedbackType('GOOD');
          const rating =
            reactionMs < 240 ? 'REFLEJO ÓPTIMO' : reactionMs <= 360 ? 'APTO' : 'LENTO';
          setFeedbackMessage(
            `¡CORRECTO (${hand === 'LEFT' ? 'MANO IZQUIERDA' : 'MANO DERECHA'})! Tiempo: ${reactionMs} ms • ${rating}`
          );

          const newRecord: TrialRecord = {
            round: roundRef.current,
            expectedHand: expected,
            pressedHand: hand,
            reactionMs,
            status: 'HIT',
          };
          const updated = [...trials, newRecord];
          setTrials(updated);

          nextRoundTimerRef.current = setTimeout(() => {
            scheduleNextStimulus(roundRef.current + 1, updated);
          }, 950);
        } else {
          playError();
          setFeedbackType('BAD');
          setFeedbackMessage(
            `¡ERROR DE DISCRIMINACIÓN OÍDO/MANO! Se emitió en ${
              expected === 'LEFT' ? 'Oído Izquierdo (Rojo)' : 'Oído Derecho (Verde)'
            }.`
          );

          const newRecord: TrialRecord = {
            round: roundRef.current,
            expectedHand: expected,
            pressedHand: hand,
            reactionMs,
            status: 'WRONG_HAND',
          };
          const updated = [...trials, newRecord];
          setTrials(updated);

          nextRoundTimerRef.current = setTimeout(() => {
            scheduleNextStimulus(roundRef.current + 1, updated);
          }, 1150);
        }
      }
    },
    [clearTimers, playError, playLeftSignal, playRightSignal, playSuccess, scheduleNextStimulus, trials]
  );

  const validHits = trials.filter((t) => t.status === 'HIT' && t.reactionMs !== null);
  const leftHits = validHits.filter((t) => t.expectedHand === 'LEFT');
  const rightHits = validHits.filter((t) => t.expectedHand === 'RIGHT');

  const avgMs =
    validHits.length > 0
      ? Math.round(validHits.reduce((a, b) => a + (b.reactionMs ?? 0), 0) / validHits.length)
      : 0;
  const leftAvgMs =
    leftHits.length > 0
      ? Math.round(leftHits.reduce((a, b) => a + (b.reactionMs ?? 0), 0) / leftHits.length)
      : 0;
  const rightAvgMs =
    rightHits.length > 0
      ? Math.round(rightHits.reduce((a, b) => a + (b.reactionMs ?? 0), 0) / rightHits.length)
      : 0;
  const errorCount = trials.filter((t) => t.status !== 'HIT').length;

  const showLeftVisualFlash =
    phase === 'ACTIVE_SIGNAL' && activeHand === 'LEFT' && stimulusMode !== 'AUDIO_ONLY';
  const showRightVisualFlash =
    phase === 'ACTIVE_SIGNAL' && activeHand === 'RIGHT' && stimulusMode !== 'AUDIO_ONLY';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      {/* CAPA DE LA PRUEBA DEBAJO: SE MUESTRA DIFUMINADA MIENTRAS APARECE LA PANTALLA DE AUDÍFONOS */}
      <View
        style={[
          styles.underlyingTestLayer,
          !hasConfirmedHeadphones && styles.underlyingTestBlurred,
        ]}
        pointerEvents={hasConfirmedHeadphones ? 'auto' : 'none'}>
        <TelemetryHeader
          title="PRUEBA DE REACCIÓN Y AUDIO BINAURAL"
          subtitle="Evaluación de Reflejos con Discriminación por Oído L/R"
          moduleCode="MOD-01"
          showBack
          onTestAudio={playRightSignal}
        />

        <View style={styles.mainContainer}>
          {/* BARRA SUPERIOR DE MÉTRICAS Y MODO DE ESTÍMULO */}
        <View style={styles.topControlCard}>
          <View style={styles.metricsRow}>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>INTENTO</Text>
              <Text style={[styles.metricVal, { color: PsychoPalette.textPrimary }]}>
                {currentRound}/{TOTAL_ROUNDS}
              </Text>
            </View>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>PROMEDIO</Text>
              <Text style={[styles.metricVal, { color: PsychoPalette.mint }]}>
                {avgMs > 0 ? `${avgMs} ms` : '-- ms'}
              </Text>
            </View>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>OÍDO/MANO IZQ</Text>
              <Text style={[styles.metricVal, { color: PsychoPalette.redSignalBright }]}>
                {leftAvgMs > 0 ? `${leftAvgMs} ms` : '-- ms'}
              </Text>
            </View>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>OÍDO/MANO DER</Text>
              <Text style={[styles.metricVal, { color: PsychoPalette.greenSignalBright }]}>
                {rightAvgMs > 0 ? `${rightAvgMs} ms` : '-- ms'}
              </Text>
            </View>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>FALLOS</Text>
              <Text
                style={[
                  styles.metricVal,
                  {
                    color:
                      errorCount > 0 ? PsychoPalette.redSignalBright : PsychoPalette.textSecondary,
                  },
                ]}>
                {errorCount}
              </Text>
            </View>
          </View>

          <View style={styles.controlsSubRow}>
            <View style={styles.modeSelectorGroup}>
              {(
                [
                  { id: 'BOTH', label: 'AUDIO + VISUAL' },
                  { id: 'AUDIO_ONLY', label: 'SOLO AUDIO' },
                  { id: 'VISUAL_ONLY', label: 'SOLO VISUAL' },
                ] as const
              ).map((m) => {
                const active = stimulusMode === m.id;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => setStimulusMode(m.id)}
                    style={[styles.modeChip, active && styles.modeChipActive]}>
                    <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>
                      {m.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.actionBtnGroup}>
              <Pressable
                onPress={() => setHasConfirmedHeadphones(false)}
                style={({ pressed }) => [styles.sampleToneBtn, pressed && { opacity: 0.75 }]}>
                <Ionicons name="headset-outline" size={13} color={PsychoPalette.cyan} />
                <Text style={[styles.sampleToneText, { color: PsychoPalette.cyan }]}>Audífonos</Text>
              </Pressable>

              <Pressable
                onPress={startTest}
                style={({ pressed }) => [styles.startTestBtn, pressed && { opacity: 0.85 }]}>
                <Ionicons
                  name={phase === 'IDLE' || phase === 'FINISHED' ? 'play' : 'refresh'}
                  size={14}
                  color={PsychoPalette.bgPrimary}
                />
                <Text style={styles.startTestBtnText}>
                  {phase === 'IDLE'
                    ? 'INICIAR PRUEBA'
                    : phase === 'FINISHED'
                      ? 'REPETIR PRUEBA'
                      : 'REINICIAR'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* CONSOLA CENTRAL DE ESTÍMULO AUDITIVO Y VISUAL */}
        <View
          style={[
            styles.signalBanner,
            feedbackType === 'GOOD' && styles.signalBannerGood,
            feedbackType === 'BAD' && styles.signalBannerBad,
            phase === 'ACTIVE_SIGNAL' && styles.signalBannerActive,
          ]}>
          <View style={styles.signalIconCluster}>
            <View
              style={[
                styles.earIndicator,
                phase === 'ACTIVE_SIGNAL' &&
                  activeHand === 'LEFT' && {
                    backgroundColor: PsychoPalette.redSignalBright,
                    borderColor: '#FFFFFF',
                  },
              ]}>
              <Ionicons name="headset" size={16} color="#FFFFFF" />
              <Text style={styles.earIndicatorText}>OÍDO IZQ (440Hz)</Text>
            </View>

            <View style={styles.centralSignalStatus}>
              <Text style={styles.signalStateLabel}>
                {phase === 'IDLE'
                  ? 'BANCO DE REACCIÓN EN ESPERA'
                  : phase === 'WAITING'
                    ? 'ESCUCHANDO CANAL BINAURAL...'
                    : phase === 'ACTIVE_SIGNAL'
                      ? `¡RESPONDA AHORA! • ${
                          activeHand === 'LEFT' ? 'OÍDO IZQUIERDO (440 Hz)' : 'OÍDO DERECHO (880 Hz)'
                        }`
                      : phase === 'FINISHED'
                        ? 'INFORME FINAL DE REFLEJOS'
                        : 'REGISTRANDO IMPULSO'}
              </Text>
              <Text style={styles.signalFeedbackText}>{feedbackMessage}</Text>
            </View>

            <View
              style={[
                styles.earIndicator,
                phase === 'ACTIVE_SIGNAL' &&
                  activeHand === 'RIGHT' && {
                    backgroundColor: PsychoPalette.greenSignalBright,
                    borderColor: '#FFFFFF',
                  },
              ]}>
              <Ionicons
                name="headset"
                size={16}
                color="#FFFFFF"
                style={{ transform: [{ scaleX: -1 }] }}
              />
              <Text style={styles.earIndicatorText}>OÍDO DER (880Hz)</Text>
            </View>
          </View>
        </View>

        {/* INTERFAZ DE PANTALLA DIVIDIDA: DOS RECTÁNGULOS GRANDES TÁCTILES */}
        <View style={styles.splitPadsContainer}>
          {/* RECTÁNGULO ROJO: MANO IZQUIERDA */}
          <Pressable
            onPressIn={() => handlePadPress('LEFT')}
            style={({ pressed }) => [
              styles.touchPad,
              styles.redTouchPad,
              showLeftVisualFlash && styles.redTouchPadFlashing,
              pressed && styles.touchPadPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Rectángulo Rojo Mano Izquierda">
            <View style={styles.padTopHeader}>
              <View style={styles.padChannelBadgeRed}>
                <Ionicons name="headset" size={14} color="#FFFFFF" />
                <Text style={styles.padChannelText}>CANAL IZQUIERDO • 440 Hz</Text>
              </View>
              {showLeftVisualFlash ? (
                <View style={styles.activeFlashPill}>
                  <Text style={styles.activeFlashPillText}>¡PRESIONE YA!</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.padCenterContent}>
              <View
                style={[
                  styles.handCircleRed,
                  showLeftVisualFlash && styles.handCircleActiveGlow,
                ]}>
                <Ionicons name="hand-left" size={46} color="#FFFFFF" />
              </View>
              <Text style={styles.padMainTitle}>MANO IZQUIERDA</Text>
              <Text style={styles.padSubLabel}>ZONA DE IMPACTO ROJA (TONO GRAVE)</Text>
            </View>

            <View style={styles.padBottomStats}>
              <Text style={styles.padBottomStatText}>
                Promedio Izq: {leftAvgMs > 0 ? `${leftAvgMs} ms` : 'Sin datos'}
              </Text>
              <Text style={styles.padBottomStatHint}>Toque inmediato</Text>
            </View>
          </Pressable>

          {/* RECTÁNGULO VERDE: MANO DERECHA */}
          <Pressable
            onPressIn={() => handlePadPress('RIGHT')}
            style={({ pressed }) => [
              styles.touchPad,
              styles.greenTouchPad,
              showRightVisualFlash && styles.greenTouchPadFlashing,
              pressed && styles.touchPadPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Rectángulo Verde Mano Derecha">
            <View style={styles.padTopHeader}>
              <View style={styles.padChannelBadgeGreen}>
                <Ionicons name="headset" size={14} color="#042F2E" />
                <Text style={[styles.padChannelText, { color: '#042F2E' }]}>
                  CANAL DERECHO • 880 Hz
                </Text>
              </View>
              {showRightVisualFlash ? (
                <View style={styles.activeFlashPill}>
                  <Text style={styles.activeFlashPillText}>¡PRESIONE YA!</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.padCenterContent}>
              <View
                style={[
                  styles.handCircleGreen,
                  showRightVisualFlash && styles.handCircleActiveGlow,
                ]}>
                <Ionicons name="hand-right" size={46} color="#FFFFFF" />
              </View>
              <Text style={styles.padMainTitle}>MANO DERECHA</Text>
              <Text style={styles.padSubLabel}>ZONA DE IMPACTO VERDE (TONO AGUDO)</Text>
            </View>

            <View style={styles.padBottomStats}>
              <Text style={styles.padBottomStatText}>
                Promedio Der: {rightAvgMs > 0 ? `${rightAvgMs} ms` : 'Sin datos'}
              </Text>
              <Text style={styles.padBottomStatHint}>Toque inmediato</Text>
            </View>
          </Pressable>
        </View>

        {/* HISTORIAL DE PULSACIONES DE LA SERIE */}
        <View style={styles.historyBar}>
          <Text style={styles.historyTitle}>REGISTRO DE PULSACIONES:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.historyScroll}>
            {trials.length === 0 ? (
              <Text style={styles.historyEmpty}>
                Ningún estímulo registrado aún. Colóquese los audífonos y presione &quot;INICIAR PRUEBA&quot;.
              </Text>
            ) : (
              trials.map((t) => (
                <View
                  key={t.round}
                  style={[
                    styles.trialChip,
                    t.status === 'HIT' ? styles.trialChipHit : styles.trialChipFail,
                  ]}>
                  <Text style={styles.trialChipRound}>#{t.round}</Text>
                  <Text style={styles.trialChipHand}>
                    {t.expectedHand === 'LEFT' ? 'IZQ' : 'DER'}
                  </Text>
                  <Text style={styles.trialChipTime}>
                    {t.status === 'HIT'
                      ? `${t.reactionMs}ms`
                      : t.status === 'FALSE_START'
                        ? 'ANTICIPO'
                        : 'ERROR'}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>

          {phase === 'FINISHED' ? (
            <Pressable
              onPress={() => router.push('/lathe')}
              style={styles.nextModuleBtn}>
              <Text style={styles.nextModuleBtnText}>SIGUIENTE: TORNO</Text>
              <Ionicons name="chevron-forward" size={14} color={PsychoPalette.bgPrimary} />
            </Pressable>
          ) : null}
        </View>
      </View>
      </View>

      {/* PANTALLA COMPLETA DE SOLICITUD DE AUDÍFONOS CON FONDO DIFUMINADO DEBAJO */}
      {!hasConfirmedHeadphones ? (
        <View style={styles.fullScreenHeadphoneOverlay}>
          <View style={styles.fullScreenHeadphoneContent}>
            <View style={styles.headphoneTopPill}>
              <Ionicons name="sparkles" size={14} color={PsychoPalette.mint} />
              <Text style={styles.headphoneTopPillText}>
                CALIBRACIÓN ACÚSTICA BINAURAL • REQUISITO PREVIO
              </Text>
            </View>

            <View style={styles.headphoneIconRing}>
              <Ionicons name="headset" size={64} color={PsychoPalette.cyan} />
            </View>

            <Text style={styles.headphoneTitle}>
              POR FAVOR COLÓQUESE UNOS AUDÍFONOS PARA UNA PRUEBA MÁS REALISTA
            </Text>
            <Text style={styles.headphoneDesc}>
              Debajo se encuentra lista la consola de reacción con los rectángulos Rojo (Mano
              Izquierda) y Verde (Mano Derecha). Colóquese sus audífonos estéreo, compruebe ambos
              oídos y presione Aceptar para despejar la pantalla e ingresar a la prueba.
            </Text>

            <View style={styles.headphoneTestRow}>
              <Pressable
                onPress={testLeftEar}
                style={({ pressed }) => [
                  styles.headphoneTestBtn,
                  styles.headphoneTestBtnLeft,
                  pressed && { opacity: 0.85 },
                ]}>
                <Ionicons name="volume-medium" size={22} color="#FFFFFF" />
                <View>
                  <Text style={styles.headphoneTestBtnTitle}>PROBAR OÍDO IZQUIERDO (L)</Text>
                  <Text style={styles.headphoneTestBtnSub}>Tono Grave • 440 Hz</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={testRightEar}
                style={({ pressed }) => [
                  styles.headphoneTestBtn,
                  styles.headphoneTestBtnRight,
                  pressed && { opacity: 0.85 },
                ]}>
                <Ionicons name="volume-high" size={22} color="#FFFFFF" />
                <View>
                  <Text style={styles.headphoneTestBtnTitle}>PROBAR OÍDO DERECHO (R)</Text>
                  <Text style={styles.headphoneTestBtnSub}>Tono Agudo • 880 Hz</Text>
                </View>
              </Pressable>
            </View>

            <Pressable
              onPress={confirmHeadphones}
              style={({ pressed }) => [
                styles.headphoneConfirmBtn,
                pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
              ]}>
              <Ionicons name="checkmark-done-circle" size={24} color={PsychoPalette.bgPrimary} />
              <Text style={styles.headphoneConfirmBtnText}>
                ACEPTAR • AHORA SÍ INGRESAR A LA PRUEBA
              </Text>
              <Ionicons name="arrow-forward" size={20} color={PsychoPalette.bgPrimary} />
            </Pressable>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PsychoPalette.bgPrimary,
    position: 'relative',
  },
  underlyingTestLayer: {
    flex: 1,
  },
  underlyingTestBlurred: {
    opacity: 0.34,
    transform: [{ scale: 0.985 }],
    ...Platform.select({
      web: {
        filter: 'blur(9px)',
      } as any,
      default: {},
    }),
  },
  mainContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
    position: 'relative',
  },
  fullScreenHeadphoneOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5, 10, 20, 0.56)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    paddingHorizontal: 20,
    paddingVertical: 24,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
      } as any,
      default: {},
    }),
  },
  fullScreenHeadphoneContent: {
    width: '100%',
    maxWidth: 680,
    backgroundColor: 'rgba(15, 26, 46, 0.88)',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: PsychoPalette.cyan,
    paddingVertical: 32,
    paddingHorizontal: 26,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  headphoneTopPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PsychoPalette.mintDim,
    borderWidth: 1,
    borderColor: PsychoPalette.mint,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  headphoneTopPillText: {
    color: PsychoPalette.mint,
    fontSize: 10,
    fontWeight: '900',
    fontFamily: Fonts.mono,
    letterSpacing: 0.6,
  },
  headphoneIconRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: PsychoPalette.cyanDim,
    borderWidth: 2.5,
    borderColor: PsychoPalette.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headphoneTitle: {
    color: PsychoPalette.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    fontFamily: Fonts.mono,
    textAlign: 'center',
    letterSpacing: 0.5,
    lineHeight: 28,
  },
  headphoneDesc: {
    color: PsychoPalette.textSecondary,
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 560,
  },
  headphoneTestRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    flexWrap: 'wrap',
  },
  headphoneTestBtn: {
    flex: 1,
    minWidth: 200,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  headphoneTestBtnLeft: {
    backgroundColor: 'rgba(153, 27, 27, 0.85)',
    borderColor: PsychoPalette.redSignalBright,
  },
  headphoneTestBtnRight: {
    backgroundColor: 'rgba(6, 95, 70, 0.85)',
    borderColor: PsychoPalette.mint,
  },
  headphoneTestBtnTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  headphoneTestBtnSub: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
    fontFamily: Fonts.mono,
    marginTop: 2,
  },
  headphoneConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: PsychoPalette.mint,
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderRadius: 14,
    width: '100%',
    marginTop: 4,
  },
  headphoneConfirmBtnText: {
    color: PsychoPalette.bgPrimary,
    fontSize: 14,
    fontWeight: '900',
    fontFamily: Fonts.mono,
    letterSpacing: 0.6,
  },
  topControlCard: {
    backgroundColor: PsychoPalette.bgSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    padding: 10,
    gap: 10,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metricCell: {
    flex: 1,
    minWidth: 62,
    backgroundColor: PsychoPalette.bgPanel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  metricLabel: {
    color: PsychoPalette.textMuted,
    fontSize: 9,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
  metricVal: {
    fontSize: 13,
    fontWeight: '900',
    fontFamily: Fonts.mono,
    marginTop: 2,
  },
  controlsSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  modeSelectorGroup: {
    flexDirection: 'row',
    backgroundColor: PsychoPalette.bgPanel,
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    gap: 4,
  },
  modeChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  modeChipActive: {
    backgroundColor: PsychoPalette.cyanDim,
    borderWidth: 1,
    borderColor: PsychoPalette.cyan,
  },
  modeChipText: {
    color: PsychoPalette.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Fonts.mono,
  },
  modeChipTextActive: {
    color: PsychoPalette.cyan,
    fontWeight: '900',
  },
  actionBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sampleToneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PsychoPalette.bgPanel,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 7,
  },
  sampleToneText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
  startTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: PsychoPalette.mint,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  startTestBtnText: {
    color: PsychoPalette.bgPrimary,
    fontSize: 11,
    fontWeight: '900',
    fontFamily: Fonts.mono,
    letterSpacing: 0.4,
  },
  signalBanner: {
    backgroundColor: PsychoPalette.bgCard,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: PsychoPalette.borderSubtle,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  signalBannerActive: {
    borderColor: PsychoPalette.cyan,
    backgroundColor: '#10243E',
  },
  signalBannerGood: {
    borderColor: PsychoPalette.mint,
    backgroundColor: 'rgba(0, 245, 160, 0.1)',
  },
  signalBannerBad: {
    borderColor: PsychoPalette.redSignalBright,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  signalIconCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  earIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PsychoPalette.bgPanel,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  earIndicatorText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
  centralSignalStatus: {
    flex: 1,
    alignItems: 'center',
  },
  signalStateLabel: {
    color: PsychoPalette.cyan,
    fontSize: 10,
    fontWeight: '900',
    fontFamily: Fonts.mono,
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  signalFeedbackText: {
    color: PsychoPalette.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 2,
  },
  splitPadsContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 230,
  },
  touchPad: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    justifyContent: 'space-between',
    borderWidth: 3,
  },
  redTouchPad: {
    backgroundColor: '#991B1B',
    borderColor: '#EF4444',
  },
  redTouchPadFlashing: {
    backgroundColor: '#EF4444',
    borderColor: '#FFFFFF',
    shadowColor: '#FF3B5C',
    shadowOpacity: 0.9,
    shadowRadius: 20,
    elevation: 12,
  },
  greenTouchPad: {
    backgroundColor: '#065F46',
    borderColor: '#10B981',
  },
  greenTouchPadFlashing: {
    backgroundColor: '#10B981',
    borderColor: '#FFFFFF',
    shadowColor: '#00F5A0',
    shadowOpacity: 0.9,
    shadowRadius: 20,
    elevation: 12,
  },
  touchPadPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
  padTopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  padChannelBadgeRed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  padChannelBadgeGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: PsychoPalette.mint,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  padChannelText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  activeFlashPill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeFlashPillText: {
    color: '#050A14',
    fontSize: 10,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  padCenterContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  handCircleRed: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handCircleGreen: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handCircleActiveGlow: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.08 }],
  },
  padMainTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  padSubLabel: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Fonts.mono,
    textAlign: 'center',
  },
  padBottomStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.22)',
    paddingTop: 8,
  },
  padBottomStatText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
  padBottomStatHint: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 10,
    fontFamily: Fonts.mono,
  },
  historyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PsychoPalette.bgSecondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  historyTitle: {
    color: PsychoPalette.textMuted,
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
  historyScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyEmpty: {
    color: PsychoPalette.textSecondary,
    fontSize: 11,
  },
  trialChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  trialChipHit: {
    backgroundColor: PsychoPalette.mintDim,
    borderColor: PsychoPalette.mint,
  },
  trialChipFail: {
    backgroundColor: PsychoPalette.redSignalDim,
    borderColor: PsychoPalette.redSignalBright,
  },
  trialChipRound: {
    color: PsychoPalette.textSecondary,
    fontSize: 9,
    fontFamily: Fonts.mono,
  },
  trialChipHand: {
    color: PsychoPalette.textPrimary,
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
  trialChipTime: {
    color: PsychoPalette.mint,
    fontSize: 10,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  nextModuleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PsychoPalette.cyan,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
  },
  nextModuleBtnText: {
    color: PsychoPalette.bgPrimary,
    fontSize: 10,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
});
