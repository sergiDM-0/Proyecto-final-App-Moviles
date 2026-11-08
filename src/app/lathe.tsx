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

const EXAM_DURATION_SEC = 25;

function getProportionalLaneHalfWidth(canvasWidth: number): number {
  return Math.max(22, Math.min(32, Math.round(canvasWidth * 0.042)));
}

function getLeftLaneCenterX(
  y: number,
  scrollOffset: number,
  halfWidth: number,
  laneHalfW: number
): number {
  const centerBase = halfWidth * 0.5;
  const maxAmp = Math.max(18, Math.min(halfWidth * 0.28, halfWidth * 0.5 - laneHalfW - 14));
  const phase = (y - scrollOffset) * 0.017;
  const wave = Math.sin(phase) * 0.68 + Math.cos(phase * 1.65 + 1.1) * 0.32;
  return centerBase + wave * maxAmp;
}

function getRightLaneCenterX(
  y: number,
  scrollOffset: number,
  halfWidth: number,
  totalWidth: number,
  laneHalfW: number
): number {
  const centerBase = halfWidth + halfWidth * 0.5;
  const maxAmp = Math.max(18, Math.min(halfWidth * 0.28, halfWidth * 0.5 - laneHalfW - 14));
  const phase = (y - scrollOffset) * 0.019;
  const wave = Math.cos(phase * 1.15 + 0.6) * 0.64 - Math.sin(phase * 1.8 - 0.5) * 0.36;
  return Math.min(totalWidth - laneHalfW - 10, centerBase + wave * maxAmp);
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
  const [isAdaptiveMode, setIsAdaptiveMode] = useState<boolean>(true);
  const [currentPxPerSec, setCurrentPxPerSec] = useState<number>(95);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0);
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

  const scrollRef = useRef<number>(0);
  const speedRef = useRef<number>(95);
  const leftPosRef = useRef<{ x: number; y: number }>({ x: 90, y: 280 });
  const rightPosRef = useRef<{ x: number; y: number }>({ x: 270, y: 280 });

  const statsRef = useRef({
    totalFrames: 0,
    leftGoodFrames: 0,
    rightGoodFrames: 0,
    bothGoodFrames: 0,
    offTrackMs: 0,
    elapsedMs: 0,
    lastBuzzTime: 0,
    consecutiveGoodFrames: 0,
    consecutiveBadFrames: 0,
  });

  useEffect(() => {
    leftPosRef.current = leftCircle;
  }, [leftCircle]);

  useEffect(() => {
    rightPosRef.current = rightCircle;
  }, [rightCircle]);

  const handleCanvasLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setCanvasSize({ width, height });
      const half = width / 2;
      const laneHalfW = getProportionalLaneHalfWidth(width);
      const targetY = height * 0.74;
      const initLeftX = getLeftLaneCenterX(targetY, scrollRef.current, half, laneHalfW);
      const initRightX = getRightLaneCenterX(targetY, scrollRef.current, half, width, laneHalfW);
      leftPosRef.current = { x: initLeftX, y: targetY };
      rightPosRef.current = { x: initRightX, y: targetY };
      setLeftCircle({ x: initLeftX, y: targetY });
      setRightCircle({ x: initRightX, y: targetY });
    }
  }, []);

  const resetAndStartExam = useCallback(() => {
    const half = canvasSize.width / 2;
    const laneHalfW = getProportionalLaneHalfWidth(canvasSize.width);
    const targetY = canvasSize.height * 0.74;
    scrollRef.current = 0;
    speedRef.current = 95;
    setCurrentPxPerSec(95);
    setSpeedMultiplier(1.0);

    const initLeftX = getLeftLaneCenterX(targetY, 0, half, laneHalfW);
    const initRightX = getRightLaneCenterX(targetY, 0, half, canvasSize.width, laneHalfW);

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
      consecutiveGoodFrames: 0,
      consecutiveBadFrames: 0,
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

  // Bucle a 60 FPS con velocidad adaptativa según el desempeño del usuario
  useEffect(() => {
    if (!isRunning || examFinished) return;

    let rafId: number;
    let lastTime = performance.now();

    const step = (now: number) => {
      const dtMs = Math.min(50, Math.max(1, now - lastTime));
      lastTime = now;

      const halfWidth = canvasSize.width / 2;
      const laneHalfW = getProportionalLaneHalfWidth(canvasSize.width);
      scrollRef.current += (speedRef.current * dtMs) / 1000;
      setScrollOffset(scrollRef.current);

      const expectedLeftX = getLeftLaneCenterX(
        leftPosRef.current.y,
        scrollRef.current,
        halfWidth,
        laneHalfW
      );
      const expectedRightX = getRightLaneCenterX(
        rightPosRef.current.y,
        scrollRef.current,
        halfWidth,
        canvasSize.width,
        laneHalfW
      );

      const leftDist = Math.abs(leftPosRef.current.x - expectedLeftX);
      const rightDist = Math.abs(rightPosRef.current.x - expectedRightX);

      const isLeftOk = leftDist <= laneHalfW;
      const isRightOk = rightDist <= laneHalfW;

      setLeftInTrack(isLeftOk);
      setRightInTrack(isRightOk);

      const st = statsRef.current;
      st.totalFrames += 1;
      if (isLeftOk) st.leftGoodFrames += 1;
      if (isRightOk) st.rightGoodFrames += 1;

      // LÓGICA DE VELOCIDAD ADAPTATIVA SEGÚN DESEMPEÑO
      if (isLeftOk && isRightOk) {
        st.bothGoodFrames += 1;
        st.consecutiveGoodFrames += 1;
        st.consecutiveBadFrames = 0;

        // Si el usuario mantiene ambos anillos perfectamente en pista por más de 45 frames (~0.75s)
        // se incrementa la velocidad progresivamente hasta 210 px/s (2.2x)
        if (isAdaptiveMode && st.consecutiveGoodFrames > 45) {
          const newSpeed = Math.min(210, speedRef.current + 0.35);
          speedRef.current = newSpeed;
          setCurrentPxPerSec(Math.round(newSpeed));
          setSpeedMultiplier(Number((newSpeed / 95).toFixed(2)));
        }
      } else {
        st.offTrackMs += dtMs;
        st.consecutiveBadFrames += 1;
        st.consecutiveGoodFrames = 0;

        // Si el usuario se sale o pierde precisión, la velocidad disminuye suavemente para permitir recuperar el control
        if (isAdaptiveMode) {
          const newSpeed = Math.max(70, speedRef.current - 0.7);
          speedRef.current = newSpeed;
          setCurrentPxPerSec(Math.round(newSpeed));
          setSpeedMultiplier(Number((newSpeed / 95).toFixed(2)));
        }

        if (now - st.lastBuzzTime > 900) {
          st.lastBuzzTime = now;
          playError();
        }
      }

      st.elapsedMs += dtMs;
      const leftPct = Math.round((st.leftGoodFrames / st.totalFrames) * 100);
      const rightPct = Math.round((st.rightGoodFrames / st.totalFrames) * 100);
      const globalPct = Math.round((leftPct + rightPct) / 2);

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
          speedLevel: `Dinámica (${Math.round(speedRef.current)} px/s • ${Number((speedRef.current / 95).toFixed(1))}x)`,
          grade,
          completedAt: new Date().toLocaleTimeString(),
        });
        return;
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [canvasSize.width, examFinished, isAdaptiveMode, isRunning, playError, playSuccess, setLatheResult]);

  const halfCanvasWidth = canvasSize.width / 2;
  const laneHalfWidth = getProportionalLaneHalfWidth(canvasSize.width);
  // Joysticks proporcionales al ancho de la carretera (más pequeños: ~44% del semiancho del carril)
  const joystickOuterRadius = Math.max(11, Math.round(laneHalfWidth * 0.44));
  const joystickInnerRadius = Math.max(4, Math.round(joystickOuterRadius * 0.36));

  const leftPanGesture = Gesture.Pan()
    .runOnJS(true)
    .onChange((e) => {
      setLeftCircle((prev) => ({
        x: Math.max(18, Math.min(halfCanvasWidth - 18, prev.x + e.changeX)),
        y: Math.max(50, Math.min(canvasSize.height - 40, prev.y + e.changeY)),
      }));
    });

  const rightPanGesture = Gesture.Pan()
    .runOnJS(true)
    .onChange((e) => {
      setRightCircle((prev) => ({
        x: Math.max(halfCanvasWidth + 18, Math.min(canvasSize.width - 18, prev.x + e.changeX)),
        y: Math.max(50, Math.min(canvasSize.height - 40, prev.y + e.changeY)),
      }));
    });

  const leftCenterPath = buildWavePath(canvasSize.height, scrollOffset, (y, s) =>
    getLeftLaneCenterX(y, s, halfCanvasWidth, laneHalfWidth)
  );
  const leftBorderLPath = buildWavePath(
    canvasSize.height,
    scrollOffset,
    (y, s) => getLeftLaneCenterX(y, s, halfCanvasWidth, laneHalfWidth),
    -laneHalfWidth
  );
  const leftBorderRPath = buildWavePath(
    canvasSize.height,
    scrollOffset,
    (y, s) => getLeftLaneCenterX(y, s, halfCanvasWidth, laneHalfWidth),
    laneHalfWidth
  );

  const rightCenterPath = buildWavePath(canvasSize.height, scrollOffset, (y, s) =>
    getRightLaneCenterX(y, s, halfCanvasWidth, canvasSize.width, laneHalfWidth)
  );
  const rightBorderLPath = buildWavePath(
    canvasSize.height,
    scrollOffset,
    (y, s) => getRightLaneCenterX(y, s, halfCanvasWidth, canvasSize.width, laneHalfWidth),
    -laneHalfWidth
  );
  const rightBorderRPath = buildWavePath(
    canvasSize.height,
    scrollOffset,
    (y, s) => getRightLaneCenterX(y, s, halfCanvasWidth, canvasSize.width, laneHalfWidth),
    laneHalfWidth
  );

  const targetLeftX = getLeftLaneCenterX(
    leftCircle.y,
    scrollOffset,
    halfCanvasWidth,
    laneHalfWidth
  );
  const targetRightX = getRightLaneCenterX(
    rightCircle.y,
    scrollOffset,
    halfCanvasWidth,
    canvasSize.width,
    laneHalfWidth
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <TelemetryHeader
        title="PRUEBA DEL TORNO (VELOCIDAD ADAPTATIVA)"
        subtitle="La velocidad se adapta en tiempo real a su precisión bimanual"
        moduleCode="MOD-02"
        showBack
      />

      <View style={styles.mainContainer}>
        {/* PANEL HUD SUPERIOR */}
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
              <Text style={styles.hudMetricLabel}>VELOCIDAD ADAPTATIVA</Text>
              <Text
                style={[
                  styles.hudMetricValue,
                  {
                    color:
                      speedMultiplier >= 1.5
                        ? PsychoPalette.amberWarning
                        : speedMultiplier >= 1.0
                          ? PsychoPalette.mint
                          : PsychoPalette.cyan,
                  },
                ]}>
                {currentPxPerSec} px/s ({speedMultiplier}x)
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
            <Pressable
              onPress={() => setIsAdaptiveMode((prev) => !prev)}
              style={styles.adaptiveTag}>
              <Ionicons
                name="trending-up-outline"
                size={14}
                color={PsychoPalette.mint}
              />
              <Text style={styles.adaptiveTagText}>
                {isAdaptiveMode
                  ? 'MODO DINÁMICO ACTIVO: Si conduce bien acelera, si falla desacelera'
                  : 'MODO FIJO (TOQUE PARA ACTIVAR DINÁMICO)'}
              </Text>
            </Pressable>

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

        {/* PISTA DE DOBLE CARRIL ONDULADO */}
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

            <Line
              x1={halfCanvasWidth}
              y1={0}
              x2={halfCanvasWidth}
              y2={canvasSize.height}
              stroke={PsychoPalette.borderSubtle}
              strokeWidth={2}
              strokeDasharray="8 6"
            />

            {/* CARRIL IZQUIERDO */}
            <Path
              d={leftCenterPath}
              stroke={leftInTrack ? 'rgba(0, 217, 245, 0.22)' : 'rgba(239, 68, 68, 0.28)'}
              strokeWidth={laneHalfWidth * 2}
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

            {/* CARRIL DERECHO */}
            <Path
              d={rightCenterPath}
              stroke={rightInTrack ? 'rgba(0, 245, 160, 0.22)' : 'rgba(239, 68, 68, 0.28)'}
              strokeWidth={laneHalfWidth * 2}
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

            <Circle cx={targetLeftX} cy={leftCircle.y} r={3.5} fill={PsychoPalette.cyan} opacity={0.75} />
            <Circle cx={targetRightX} cy={rightCircle.y} r={3.5} fill={PsychoPalette.mint} opacity={0.75} />

            {/* JOYSTICK IZQUIERDO PROPORCIONAL A LA CARRETERA */}
            <Circle
              cx={leftCircle.x}
              cy={leftCircle.y}
              r={joystickOuterRadius}
              fill={leftInTrack ? 'rgba(0, 217, 245, 0.32)' : 'rgba(239, 68, 68, 0.45)'}
              stroke={leftInTrack ? PsychoPalette.cyan : PsychoPalette.redSignalBright}
              strokeWidth={2.2}
            />
            <Circle
              cx={leftCircle.x}
              cy={leftCircle.y}
              r={joystickInnerRadius}
              fill={leftInTrack ? '#FFFFFF' : PsychoPalette.redSignalBright}
            />

            {/* JOYSTICK DERECHO PROPORCIONAL A LA CARRETERA */}
            <Circle
              cx={rightCircle.x}
              cy={rightCircle.y}
              r={joystickOuterRadius}
              fill={rightInTrack ? 'rgba(0, 245, 160, 0.32)' : 'rgba(239, 68, 68, 0.45)'}
              stroke={rightInTrack ? PsychoPalette.mint : PsychoPalette.redSignalBright}
              strokeWidth={2.2}
            />
            <Circle
              cx={rightCircle.x}
              cy={rightCircle.y}
              r={joystickInnerRadius}
              fill={rightInTrack ? '#FFFFFF' : PsychoPalette.redSignalBright}
            />

            <Rect
              x={0}
              y={canvasSize.height - 5}
              width={canvasSize.width * (1 - remainingSec / EXAM_DURATION_SEC)}
              height={5}
              fill={PsychoPalette.mint}
            />
          </Svg>

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
                IZQ: {leftInTrack ? 'EN CARRIL' : '¡FUERA!'}
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
                DER: {rightInTrack ? 'EN CARRIL' : '¡FUERA!'}
              </Text>
            </View>
          </View>

          <View style={styles.gestureSplitLayer}>
            <GestureDetector gesture={leftPanGesture}>
              <View style={styles.gestureHalfZone} />
            </GestureDetector>
            <GestureDetector gesture={rightPanGesture}>
              <View style={styles.gestureHalfZone} />
            </GestureDetector>
          </View>

          {examFinished && finalGrade && (
            <View style={styles.resultOverlay}>
              <View style={styles.resultCard}>
                <Text style={styles.resultHeaderTag}>DICTAMEN TORNO ADAPTATIVO</Text>
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
                  Velocidad final alcanzada: {currentPxPerSec} px/s ({speedMultiplier}x) • Tiempo fuera: {offTrackSeconds}s
                </Text>

                <View style={styles.resultActions}>
                  <Pressable onPress={resetAndStartExam} style={styles.resultRetryBtn}>
                    <Ionicons name="refresh" size={15} color={PsychoPalette.bgPrimary} />
                    <Text style={styles.resultRetryText}>REPETIR TORNO</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => router.push('/maneuvers')}
                    style={styles.resultNextBtn}>
                    <Text style={styles.resultNextText}>IR A SIMULADOR 3D</Text>
                    <Ionicons name="arrow-forward" size={15} color={PsychoPalette.bgPrimary} />
                  </Pressable>
                </View>
              </View>
            </View>
          )}
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
    fontSize: 12,
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
  adaptiveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PsychoPalette.bgPanel,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 160, 0.35)',
    flex: 1,
    minWidth: 180,
  },
  adaptiveTagText: {
    color: PsychoPalette.mint,
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Fonts.mono,
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
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
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
