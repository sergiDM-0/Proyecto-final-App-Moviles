import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { TelemetryHeader } from '@/components/telemetry-header';
import { Fonts, PsychoPalette } from '@/constants/theme';
import { AptitudeGrade, useEvaluation } from '@/context/evaluation-context';
import { usePsychAudio } from '@/hooks/use-psych-audio';

type SpeedPreset = {
  id: 'NORMAL' | 'FAST' | 'EXPERT';
  label: string;
  multiplier: number;
  pxPerSec: number;
};

const SPEED_PRESETS: SpeedPreset[] = [
  { id: 'NORMAL', label: '1.0x ESTÁNDAR', multiplier: 1.0, pxPerSec: 95 },
  { id: 'FAST', label: '1.4x RÁPIDO', multiplier: 1.4, pxPerSec: 135 },
  { id: 'EXPERT', label: '1.8x EXPERTO', multiplier: 1.8, pxPerSec: 175 },
];

const EXAM_DURATION_SEC = 25;
const LANE_HALF_WIDTH = 30;

/**
 * Calcula el centro X del carril izquierdo para una coordenada Y y desplazamiento scrollOffset
 */
function getLeftLaneCenterX(y: number, scrollOffset: number, halfWidth: number): number {
  const centerBase = halfWidth * 0.5;
  const maxAmp = Math.max(18, Math.min(halfWidth * 0.28, halfWidth * 0.5 - LANE_HALF_WIDTH - 14));
  const phase = (y - scrollOffset) * 0.017;
  const wave = Math.sin(phase) * 0.68 + Math.cos(phase * 1.65 + 1.1) * 0.32;
  return centerBase + wave * maxAmp;
}

/**
 * Calcula el centro X del carril derecho (asimétrico respecto al izquierdo para exigir disociación bimanual)
 */
function getRightLaneCenterX(
  y: number,
  scrollOffset: number,
  halfWidth: number,
  totalWidth: number
): number {
  const centerBase = halfWidth + halfWidth * 0.5;
  const maxAmp = Math.max(18, Math.min(halfWidth * 0.28, halfWidth * 0.5 - LANE_HALF_WIDTH - 14));
  const phase = (y - scrollOffset) * 0.019;
  const wave = Math.cos(phase * 1.15 + 0.6) * 0.64 - Math.sin(phase * 1.8 - 0.5) * 0.36;
  return Math.min(totalWidth - LANE_HALF_WIDTH - 10, centerBase + wave * maxAmp);
}

function buildWavePath(
  height: number,
  scrollOffset: number,
  getX: (y: number, scroll: number) => number,
  xShift = 0
): string {
  const step = 14;
  let d = '';
  for (let y = 0; y <= height + step; y += step) {
    const clampedY = Math.min(height, y);
    const x = getX(clampedY, scrollOffset) + xShift;
    if (y === 0) {
      d += `M ${x.toFixed(1)} ${clampedY.toFixed(1)}`;
    } else {
      d += ` L ${x.toFixed(1)} ${clampedY.toFixed(1)}`;
    }
  }
  return d;
}

export default function LatheBimanualScreen() {
  const { setLatheResult } = useEvaluation();
  const { playSuccess, playError } = usePsychAudio();

  const [canvasSize, setCanvasSize] = useState({ width: 360, height: 380 });
  const [speedPreset, setSpeedPreset] = useState<SpeedPreset>(SPEED_PRESETS[0]);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [examFinished, setExamFinished] = useState<boolean>(false);
  const [remainingSec, setRemainingSec] = useState<number>(EXAM_DURATION_SEC);

  const [scrollOffset, setScrollOffset] = useState<number>(0);
  const [leftCircle, setLeftCircle] = useState<{ x: number; y: number }>({ x: 90, y: 280 });
  const [rightCircle, setRightCircle] = useState<{ x: number; y: number }>({ x: 270, y: 280 });

  const [leftInTrack, setLeftInTrack] = useState<boolean>(true);
  const [rightInTrack, setRightInTrack] = useState<boolean>(true);

  const [precisionPct, setPrecisionPct] = useState<number>(100);
  const [leftPrecisionPct, setLeftPrecisionPct] = useState<number>(100);
  const [rightPrecisionPct, setRightPrecisionPct] = useState<number>(100);
  const [offTrackSeconds, setOffTrackSeconds] = useState<number>(0);
  const [finalGrade, setFinalGrade] = useState<AptitudeGrade | null>(null);

  // Refs for 60fps loop and gesture state
  const scrollRef = useRef<number>(0);
  const leftPosRef = useRef<{ x: number; y: number }>({ x: 90, y: 280 });
  const rightPosRef = useRef<{ x: number; y: number }>({ x: 270, y: 280 });
  const leftDragStartRef = useRef<{ x: number; y: number }>({ x: 90, y: 280 });
  const rightDragStartRef = useRef<{ x: number; y: number }>({ x: 270, y: 280 });

  const statsRef = useRef({
    totalFrames: 0,
    leftGoodFrames: 0,
    rightGoodFrames: 0,
    bothGoodFrames: 0,
    offTrackMs: 0,
    elapsedMs: 0,
    lastBuzzTime: 0,
  });

  const handleCanvasLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setCanvasSize({ width, height });
      const half = width / 2;
      const targetY = height * 0.74;
      const initLeftX = getLeftLaneCenterX(targetY, scrollRef.current, half);
      const initRightX = getRightLaneCenterX(targetY, scrollRef.current, half, width);
      leftPosRef.current = { x: initLeftX, y: targetY };
      rightPosRef.current = { x: initRightX, y: targetY };
      setLeftCircle({ x: initLeftX, y: targetY });
      setRightCircle({ x: initRightX, y: targetY });
    }
  }, []);

  const resetAndStartExam = useCallback(() => {
    const half = canvasSize.width / 2;
    const targetY = canvasSize.height * 0.74;
    scrollRef.current = 0;
    const initLeftX = getLeftLaneCenterX(targetY, 0, half);
    const initRightX = getRightLaneCenterX(targetY, 0, half, canvasSize.width);

    leftPosRef.current = { x: initLeftX, y: targetY };
    rightPosRef.current = { x: initRightX, y: targetY };
    setLeftCircle({ x: initLeftX, y: targetY });
    setRightCircle({ x: initRightX, y: targetY });

    statsRef.current = {
      totalFrames: 0,
      leftGoodFrames: 0,
      rightGoodFrames: 0,
      bothGoodFrames: 0,
      offTrackMs: 0,
      elapsedMs: 0,
      lastBuzzTime: 0,
    };

    setPrecisionPct(100);
    setLeftPrecisionPct(100);
    setRightPrecisionPct(100);
    setOffTrackSeconds(0);
    setRemainingSec(EXAM_DURATION_SEC);
    setExamFinished(false);
    setFinalGrade(null);
    setIsRunning(true);
  }, [canvasSize.height, canvasSize.width]);

  // Main 60 FPS simulation loop
  useEffect(() => {
    if (!isRunning || examFinished) return;

    let rafId: number;
    let lastTime = performance.now();

    const step = (now: number) => {
      const dtMs = Math.min(50, Math.max(1, now - lastTime));
      lastTime = now;

      const halfWidth = canvasSize.width / 2;
      scrollRef.current += (speedPreset.pxPerSec * dtMs) / 1000;
      setScrollOffset(scrollRef.current);

      // Evaluate left & right circle distance from their respective undulating lane center
      const expectedLeftX = getLeftLaneCenterX(
        leftPosRef.current.y,
        scrollRef.current,
        halfWidth
      );
      const expectedRightX = getRightLaneCenterX(
        rightPosRef.current.y,
        scrollRef.current,
        halfWidth,
        canvasSize.width
      );

      const leftDist = Math.abs(leftPosRef.current.x - expectedLeftX);
      const rightDist = Math.abs(rightPosRef.current.x - expectedRightX);

      const isLeftOk = leftDist <= LANE_HALF_WIDTH;
      const isRightOk = rightDist <= LANE_HALF_WIDTH;

      setLeftInTrack(isLeftOk);
      setRightInTrack(isRightOk);

      const st = statsRef.current;
      st.totalFrames += 1;
      if (isLeftOk) st.leftGoodFrames += 1;
      if (isRightOk) st.rightGoodFrames += 1;
      if (isLeftOk && isRightOk) {
        st.bothGoodFrames += 1;
      } else {
        st.offTrackMs += dtMs;
        if (now - st.lastBuzzTime > 950) {
          st.lastBuzzTime = now;
          playError();
        }
      }

      st.elapsedMs += dtMs;
      const leftPct = Math.round((st.leftGoodFrames / st.totalFrames) * 100);
      const rightPct = Math.round((st.rightGoodFrames / st.totalFrames) * 100);
      const globalPct = Math.round(((leftPct + rightPct) / 2));

      setLeftPrecisionPct(leftPct);
      setRightPrecisionPct(rightPct);
      setPrecisionPct(globalPct);
      setOffTrackSeconds(Number((st.offTrackMs / 1000).toFixed(1)));

      const secLeft = Math.max(0, Math.ceil((EXAM_DURATION_SEC * 1000 - st.elapsedMs) / 1000));
      setRemainingSec(secLeft);

      if (st.elapsedMs >= EXAM_DURATION_SEC * 1000) {
        setIsRunning(false);
        setExamFinished(true);

        let grade: AptitudeGrade = 'NO APTO';
        if (globalPct >= 90) {
          grade = 'EXCELENTE';
          playSuccess();
        } else if (globalPct >= 75) {
          grade = 'APTO';
          playSuccess();
        } else {
          playError();
        }

        setFinalGrade(grade);
        setLatheResult({
          precisionPct: globalPct,
          leftPrecisionPct: leftPct,
          rightPrecisionPct: rightPct,
          offTrackSeconds: Number((st.offTrackMs / 1000).toFixed(1)),
          speedLevel: speedPreset.label,
          grade,
          completedAt: new Date().toLocaleTimeString(),
        });
        return;
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [
    canvasSize.width,
    examFinished,
    isRunning,
    playError,
    playSuccess,
    setLatheResult,
    speedPreset.label,
    speedPreset.pxPerSec,
  ]);

  // Gestures for Left and Right draggable circles using react-native-gesture-handler
  const halfCanvasWidth = canvasSize.width / 2;

  const leftPanGesture = Gesture.Pan()
    .runOnJS(true)
    .onBegin(() => {
      leftDragStartRef.current = { ...leftPosRef.current };
    })
    .onUpdate((e) => {
      const nextX = Math.max(
        22,
        Math.min(halfCanvasWidth - 22, leftDragStartRef.current.x + e.translationX)
      );
      const nextY = Math.max(
        60,
        Math.min(canvasSize.height - 45, leftDragStartRef.current.y + e.translationY)
      );
      leftPosRef.current = { x: nextX, y: nextY };
      setLeftCircle({ x: nextX, y: nextY });
    });

  const rightPanGesture = Gesture.Pan()
    .runOnJS(true)
    .onBegin(() => {
      rightDragStartRef.current = { ...rightPosRef.current };
    })
    .onUpdate((e) => {
      const nextX = Math.max(
        halfCanvasWidth + 22,
        Math.min(canvasSize.width - 22, rightDragStartRef.current.x + e.translationX)
      );
      const nextY = Math.max(
        60,
        Math.min(canvasSize.height - 45, rightDragStartRef.current.y + e.translationY)
      );
      rightPosRef.current = { x: nextX, y: nextY };
      setRightCircle({ x: nextX, y: nextY });
    });

  // Build SVG wave paths for Left and Right lanes
  const leftCenterPath = buildWavePath(canvasSize.height, scrollOffset, (y, s) =>
    getLeftLaneCenterX(y, s, halfCanvasWidth)
  );
  const leftBorderLPath = buildWavePath(
    canvasSize.height,
    scrollOffset,
    (y, s) => getLeftLaneCenterX(y, s, halfCanvasWidth),
    -LANE_HALF_WIDTH
  );
  const leftBorderRPath = buildWavePath(
    canvasSize.height,
    scrollOffset,
    (y, s) => getLeftLaneCenterX(y, s, halfCanvasWidth),
    LANE_HALF_WIDTH
  );

  const rightCenterPath = buildWavePath(canvasSize.height, scrollOffset, (y, s) =>
    getRightLaneCenterX(y, s, halfCanvasWidth, canvasSize.width)
  );
  const rightBorderLPath = buildWavePath(
    canvasSize.height,
    scrollOffset,
    (y, s) => getRightLaneCenterX(y, s, halfCanvasWidth, canvasSize.width),
    -LANE_HALF_WIDTH
  );
  const rightBorderRPath = buildWavePath(
    canvasSize.height,
    scrollOffset,
    (y, s) => getRightLaneCenterX(y, s, halfCanvasWidth, canvasSize.width),
    LANE_HALF_WIDTH
  );

  // Target guide points at each circle's Y coordinate
  const targetLeftX = getLeftLaneCenterX(leftCircle.y, scrollOffset, halfCanvasWidth);
  const targetRightX = getRightLaneCenterX(
    rightCircle.y,
    scrollOffset,
    halfCanvasWidth,
    canvasSize.width
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <TelemetryHeader
        title="PRUEBA DEL TORNO (COORDINACIÓN BIMANUAL)"
        subtitle="Arrastre ambos anillos simultáneamente sin salir de los carriles ondulados"
        moduleCode="MOD-02"
        showBack
      />

      <View style={styles.mainContainer}>
        {/* PANEL SUPERIOR DE INDICADORES DE PRECISIÓN Y VELOCIDAD */}
        <View style={styles.hudPanel}>
          <View style={styles.hudMetricsRow}>
            <View style={styles.hudMetricBox}>
              <Text style={styles.hudMetricLabel}>PRECISIÓN GLOBAL</Text>
              <Text
                style={[
                  styles.hudMetricValue,
                  {
                    color:
                      precisionPct >= 85
                        ? PsychoPalette.mint
                        : precisionPct >= 75
                          ? PsychoPalette.cyan
                          : PsychoPalette.redSignalBright,
                  },
                ]}>
                {precisionPct}%
              </Text>
            </View>

            <View style={styles.hudMetricBox}>
              <Text style={styles.hudMetricLabel}>CARRIL IZQ (L)</Text>
              <Text
                style={[
                  styles.hudMetricValue,
                  { color: leftInTrack ? PsychoPalette.cyan : PsychoPalette.redSignalBright },
                ]}>
                {leftPrecisionPct}%
              </Text>
            </View>

            <View style={styles.hudMetricBox}>
              <Text style={styles.hudMetricLabel}>CARRIL DER (R)</Text>
              <Text
                style={[
                  styles.hudMetricValue,
                  { color: rightInTrack ? PsychoPalette.mint : PsychoPalette.redSignalBright },
                ]}>
                {rightPrecisionPct}%
              </Text>
            </View>

            <View style={styles.hudMetricBox}>
              <Text style={styles.hudMetricLabel}>VELOCIDAD</Text>
              <Text style={[styles.hudMetricValue, { color: PsychoPalette.textPrimary }]}>
                {speedPreset.pxPerSec} px/s
              </Text>
            </View>

            <View style={styles.hudMetricBox}>
              <Text style={styles.hudMetricLabel}>FUERA PISTA</Text>
              <Text
                style={[
                  styles.hudMetricValue,
                  {
                    color:
                      offTrackSeconds > 3.5
                        ? PsychoPalette.redSignalBright
                        : PsychoPalette.amberWarning,
                  },
                ]}>
                {offTrackSeconds}s
              </Text>
            </View>

            <View style={styles.hudMetricBox}>
              <Text style={styles.hudMetricLabel}>TIEMPO</Text>
              <Text style={[styles.hudMetricValue, { color: PsychoPalette.cyan }]}>
                {remainingSec}s
              </Text>
            </View>
          </View>

          <View style={styles.hudControlsRow}>
            <View style={styles.speedButtonsRow}>
              {SPEED_PRESETS.map((sp) => {
                const active = speedPreset.id === sp.id;
                return (
                  <Pressable
                    key={sp.id}
                    onPress={() => setSpeedPreset(sp)}
                    style={[styles.speedChip, active && styles.speedChipActive]}>
                    <Text style={[styles.speedChipText, active && styles.speedChipTextActive]}>
                      {sp.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.examBtnsRow}>
              <Pressable
                onPress={() => setIsRunning((prev) => !prev)}
                disabled={examFinished}
                style={[styles.pauseBtn, examFinished && { opacity: 0.5 }]}>
                <Ionicons
                  name={isRunning ? 'pause' : 'play'}
                  size={13}
                  color={PsychoPalette.cyan}
                />
                <Text style={styles.pauseBtnText}>{isRunning ? 'PAUSAR' : 'REANUDAR'}</Text>
              </Pressable>

              <Pressable onPress={resetAndStartExam} style={styles.restartBtn}>
                <Ionicons name="refresh" size={14} color={PsychoPalette.bgPrimary} />
                <Text style={styles.restartBtnText}>NUEVO EXAMEN</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* PISTA DE DOBLE CARRIL ONDULADO CON CONTROL MULTITÁCTIL SIMULTÁNEO */}
        <View style={styles.trackArena} onLayout={handleCanvasLayout}>
          <Svg width={canvasSize.width} height={canvasSize.height} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="leftTrackGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={PsychoPalette.cyan} stopOpacity="0.18" />
                <Stop offset="1" stopColor={PsychoPalette.cyan} stopOpacity="0.32" />
              </LinearGradient>
              <LinearGradient id="rightTrackGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={PsychoPalette.mint} stopOpacity="0.18" />
                <Stop offset="1" stopColor={PsychoPalette.mint} stopOpacity="0.32" />
              </LinearGradient>
            </Defs>

            {/* Rejilla técnica de referencia */}
            {[0.2, 0.4, 0.6, 0.8].map((ratio) => (
              <Line
                key={ratio}
                x1={0}
                y1={canvasSize.height * ratio}
                x2={canvasSize.width}
                y2={canvasSize.height * ratio}
                stroke="rgba(30, 49, 80, 0.45)"
                strokeWidth={1}
                strokeDasharray="6 6"
              />
            ))}

            {/* Divisor central entre mano izquierda y mano derecha */}
            <Line
              x1={halfCanvasWidth}
              y1={0}
              x2={halfCanvasWidth}
              y2={canvasSize.height}
              stroke={PsychoPalette.borderSubtle}
              strokeWidth={2}
              strokeDasharray="8 6"
            />

            {/* CARRIL ONDULADO IZQUIERDO (MANO IZQUIERDA - CIAN) */}
            <Path
              d={leftCenterPath}
              stroke={
                leftInTrack ? 'rgba(0, 217, 245, 0.22)' : 'rgba(239, 68, 68, 0.28)'
              }
              strokeWidth={LANE_HALF_WIDTH * 2}
              fill="none"
              strokeLinecap="round"
            />
            <Path
              d={leftBorderLPath}
              stroke={leftInTrack ? PsychoPalette.cyan : PsychoPalette.redSignalBright}
              strokeWidth={2.5}
              fill="none"
            />
            <Path
              d={leftBorderRPath}
              stroke={leftInTrack ? PsychoPalette.cyan : PsychoPalette.redSignalBright}
              strokeWidth={2.5}
              fill="none"
            />
            <Path
              d={leftCenterPath}
              stroke="rgba(255, 255, 255, 0.35)"
              strokeWidth={1.5}
              strokeDasharray="8 8"
              fill="none"
            />

            {/* CARRIL ONDULADO DERECHO (MANO DERECHA - VERDE MENTA) */}
            <Path
              d={rightCenterPath}
              stroke={
                rightInTrack ? 'rgba(0, 245, 160, 0.22)' : 'rgba(239, 68, 68, 0.28)'
              }
              strokeWidth={LANE_HALF_WIDTH * 2}
              fill="none"
              strokeLinecap="round"
            />
            <Path
              d={rightBorderLPath}
              stroke={rightInTrack ? PsychoPalette.mint : PsychoPalette.redSignalBright}
              strokeWidth={2.5}
              fill="none"
            />
            <Path
              d={rightBorderRPath}
              stroke={rightInTrack ? PsychoPalette.mint : PsychoPalette.redSignalBright}
              strokeWidth={2.5}
              fill="none"
            />
            <Path
              d={rightCenterPath}
              stroke="rgba(255, 255, 255, 0.35)"
              strokeWidth={1.5}
              strokeDasharray="8 8"
              fill="none"
            />

            {/* Puntos ideales de referencia sobre el centro de cada carril */}
            <Circle
              cx={targetLeftX}
              cy={leftCircle.y}
              r={6}
              fill={PsychoPalette.cyan}
              opacity={0.75}
            />
            <Circle
              cx={targetRightX}
              cy={rightCircle.y}
              r={6}
              fill={PsychoPalette.mint}
              opacity={0.75}
            />

            {/* CÍRCULO ARRASTRABLE IZQUIERDO (CONTROLADO POR EL USUARIO) */}
            <Circle
              cx={leftCircle.x}
              cy={leftCircle.y}
              r={26}
              fill={
                leftInTrack ? 'rgba(0, 217, 245, 0.28)' : 'rgba(239, 68, 68, 0.42)'
              }
              stroke={leftInTrack ? PsychoPalette.cyan : PsychoPalette.redSignalBright}
              strokeWidth={3.5}
            />
            <Circle
              cx={leftCircle.x}
              cy={leftCircle.y}
              r={9}
              fill={leftInTrack ? '#FFFFFF' : PsychoPalette.redSignalBright}
            />

            {/* CÍRCULO ARRASTRABLE DERECHO (CONTROLADO POR EL USUARIO) */}
            <Circle
              cx={rightCircle.x}
              cy={rightCircle.y}
              r={26}
              fill={
                rightInTrack ? 'rgba(0, 245, 160, 0.28)' : 'rgba(239, 68, 68, 0.42)'
              }
              stroke={rightInTrack ? PsychoPalette.mint : PsychoPalette.redSignalBright}
              strokeWidth={3.5}
            />
            <Circle
              cx={rightCircle.x}
              cy={rightCircle.y}
              r={9}
              fill={rightInTrack ? '#FFFFFF' : PsychoPalette.redSignalBright}
            />

            {/* Indicador visual de barra de progreso inferior */}
            <Rect
              x={0}
              y={canvasSize.height - 5}
              width={canvasSize.width * (1 - remainingSec / EXAM_DURATION_SEC)}
              height={5}
              fill={PsychoPalette.mint}
            />
          </Svg>

          {/* Etiquetas de estado en cada carril */}
          <View style={styles.laneHeadersOverlay} pointerEvents="none">
            <View
              style={[
                styles.laneStatusBadge,
                leftInTrack ? styles.laneStatusCyan : styles.laneStatusAlert,
              ]}>
              <Ionicons
                name={leftInTrack ? 'checkmark-circle' : 'warning'}
                size={14}
                color={leftInTrack ? PsychoPalette.cyan : PsychoPalette.redSignalBright}
              />
              <Text
                style={[
                  styles.laneStatusText,
                  { color: leftInTrack ? PsychoPalette.cyan : PsychoPalette.redSignalBright },
                ]}>
                MANO IZQ: {leftInTrack ? 'EN CARRIL' : '¡FUERA DE CARRIL!'}
              </Text>
            </View>

            <View
              style={[
                styles.laneStatusBadge,
                rightInTrack ? styles.laneStatusMint : styles.laneStatusAlert,
              ]}>
              <Ionicons
                name={rightInTrack ? 'checkmark-circle' : 'warning'}
                size={14}
                color={rightInTrack ? PsychoPalette.mint : PsychoPalette.redSignalBright}
              />
              <Text
                style={[
                  styles.laneStatusText,
                  { color: rightInTrack ? PsychoPalette.mint : PsychoPalette.redSignalBright },
                ]}>
                MANO DER: {rightInTrack ? 'EN CARRIL' : '¡FUERA DE CARRIL!'}
              </Text>
            </View>
          </View>

          {/* ZONAS DE GESTOS INDEPENDIENTES (IZQUIERDA Y DERECHA) PARA MULTITOUCH SIMULTÁNEO */}
          <View style={styles.gestureSplitLayer}>
            <GestureDetector gesture={leftPanGesture}>
              <View style={styles.gestureHalfZone} />
            </GestureDetector>
            <GestureDetector gesture={rightPanGesture}>
              <View style={styles.gestureHalfZone} />
            </GestureDetector>
          </View>

          {/* MODAL DE RESULTADO AL TERMINAR EL EXAMEN DE 25s */}
          {examFinished && finalGrade ? (
            <View style={styles.resultOverlay}>
              <View style={styles.resultCard}>
                <Text style={styles.resultHeaderTag}>DICTAMEN COORDINACIÓN BIMANUAL</Text>
                <Text
                  style={[
                    styles.resultGradeTitle,
                    {
                      color:
                        finalGrade === 'EXCELENTE'
                          ? PsychoPalette.mint
                          : finalGrade === 'APTO'
                            ? PsychoPalette.cyan
                            : PsychoPalette.redSignalBright,
                    },
                  ]}>
                  {finalGrade} ({precisionPct}%)
                </Text>
                <Text style={styles.resultBreakdown}>
                  Carril Izquierdo: {leftPrecisionPct}% • Carril Derecho: {rightPrecisionPct}% •
                  Tiempo fuera de pista: {offTrackSeconds}s
                </Text>

                <View style={styles.resultActions}>
                  <Pressable onPress={resetAndStartExam} style={styles.resultRetryBtn}>
                    <Ionicons name="refresh" size={15} color={PsychoPalette.bgPrimary} />
                    <Text style={styles.resultRetryText}>REPETIR TORNO</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => router.push('/maneuvers')}
                    style={styles.resultNextBtn}>
                    <Text style={styles.resultNextText}>IR A MANIOBRAS 2D</Text>
                    <Ionicons name="arrow-forward" size={15} color={PsychoPalette.bgPrimary} />
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PsychoPalette.bgPrimary,
  },
  mainContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  hudPanel: {
    backgroundColor: PsychoPalette.bgSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    padding: 10,
    gap: 8,
  },
  hudMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  hudMetricBox: {
    flex: 1,
    minWidth: 68,
    backgroundColor: PsychoPalette.bgPanel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    paddingVertical: 6,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  hudMetricLabel: {
    color: PsychoPalette.textMuted,
    fontSize: 8,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
  hudMetricValue: {
    fontSize: 13,
    fontWeight: '900',
    fontFamily: Fonts.mono,
    marginTop: 2,
  },
  hudControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  speedButtonsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  speedChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: PsychoPalette.bgPanel,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
  },
  speedChipActive: {
    backgroundColor: PsychoPalette.cyanDim,
    borderColor: PsychoPalette.cyan,
  },
  speedChipText: {
    color: PsychoPalette.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Fonts.mono,
  },
  speedChipTextActive: {
    color: PsychoPalette.cyan,
    fontWeight: '900',
  },
  examBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pauseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PsychoPalette.bgPanel,
    borderWidth: 1,
    borderColor: PsychoPalette.cyan,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
  },
  pauseBtnText: {
    color: PsychoPalette.cyan,
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
  restartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PsychoPalette.mint,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
  },
  restartBtnText: {
    color: PsychoPalette.bgPrimary,
    fontSize: 10,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  trackArena: {
    flex: 1,
    backgroundColor: '#070E1B',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: PsychoPalette.borderSubtle,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 280,
  },
  laneHeadersOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  laneStatusBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  laneStatusCyan: {
    backgroundColor: 'rgba(8, 15, 29, 0.85)',
    borderColor: PsychoPalette.cyan,
  },
  laneStatusMint: {
    backgroundColor: 'rgba(8, 15, 29, 0.85)',
    borderColor: PsychoPalette.mint,
  },
  laneStatusAlert: {
    backgroundColor: 'rgba(153, 27, 27, 0.85)',
    borderColor: PsychoPalette.redSignalBright,
  },
  laneStatusText: {
    fontSize: 10,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  gestureSplitLayer: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
  },
  gestureHalfZone: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  resultOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5, 10, 20, 0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  resultCard: {
    backgroundColor: PsychoPalette.bgCard,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: PsychoPalette.mint,
    padding: 20,
    alignItems: 'center',
    maxWidth: 420,
    width: '100%',
    gap: 10,
  },
  resultHeaderTag: {
    color: PsychoPalette.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Fonts.mono,
    letterSpacing: 1,
  },
  resultGradeTitle: {
    fontSize: 24,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  resultBreakdown: {
    color: PsychoPalette.textPrimary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  resultActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  resultRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PsychoPalette.mint,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  resultRetryText: {
    color: PsychoPalette.bgPrimary,
    fontSize: 11,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  resultNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PsychoPalette.cyan,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  resultNextText: {
    color: PsychoPalette.bgPrimary,
    fontSize: 11,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
});
