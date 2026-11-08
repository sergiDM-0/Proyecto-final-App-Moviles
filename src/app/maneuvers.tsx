import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { TelemetryHeader } from '@/components/telemetry-header';
import { Fonts, PsychoPalette } from '@/constants/theme';
import { AptitudeGrade, useEvaluation } from '@/context/evaluation-context';
import { usePsychAudio } from '@/hooks/use-psych-audio';

const WORLD_W = 600;
const WORLD_H = 380;
const CAR_LENGTH = 54;
const CAR_WIDTH = 28;
const WHEELBASE = 36;
const MAX_STEER_RAD = (38 * Math.PI) / 180;
const JOYSTICK_RADIUS = 44;

interface ObstacleBox {
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
}

interface ParkingZone {
  x: number;
  y: number;
  w: number;
  h: number;
  targetAngleDeg: number; // 0 (horizontal) or -90/90 (vertical)
}

interface ScenarioConfig {
  id: string;
  title: string;
  shortLabel: string;
  startX: number;
  startY: number;
  startAngleDeg: number;
  parkingZone: ParkingZone;
  obstacles: ObstacleBox[];
}

const SCENARIOS: ScenarioConfig[] = [
  {
    id: 'bay',
    title: 'Parqueo en Batería (90°)',
    shortLabel: '1. BATERÍA 90°',
    startX: 115,
    startY: 295,
    startAngleDeg: 0,
    parkingZone: {
      x: 268,
      y: 34,
      w: 56,
      h: 84,
      targetAngleDeg: -90,
    },
    obstacles: [
      { x: 185, y: 34, w: 68, h: 80, label: 'VEH-A' },
      { x: 338, y: 34, w: 68, h: 80, label: 'VEH-B' },
      { x: 430, y: 34, w: 135, h: 80, label: 'ZONA RESERVADA' },
    ],
  },
  {
    id: 'parallel',
    title: 'Parqueo en Paralelo (Cordón)',
    shortLabel: '2. PARALELO',
    startX: 140,
    startY: 220,
    startAngleDeg: 0,
    parkingZone: {
      x: 255,
      y: 44,
      w: 88,
      h: 48,
      targetAngleDeg: 0,
    },
    obstacles: [
      { x: 145, y: 44, w: 94, h: 46, label: 'VEH-1' },
      { x: 358, y: 44, w: 94, h: 46, label: 'VEH-2' },
    ],
  },
  {
    id: 'garage',
    title: 'Garaje con Obstáculos',
    shortLabel: '3. ESLALON 2D',
    startX: 95,
    startY: 300,
    startAngleDeg: -20,
    parkingZone: {
      x: 472,
      y: 55,
      w: 86,
      h: 52,
      targetAngleDeg: 0,
    },
    obstacles: [
      { x: 240, y: 175, w: 42, h: 90, label: 'MURO 1' },
      { x: 365, y: 60, w: 42, h: 95, label: 'MURO 2' },
    ],
  },
];

function getCarCorners(x: number, y: number, angleRad: number) {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const hl = CAR_LENGTH / 2;
  const hw = CAR_WIDTH / 2;
  const local = [
    { dx: hl, dy: -hw },
    { dx: hl, dy: hw },
    { dx: -hl, dy: hw },
    { dx: -hl, dy: -hw },
  ];
  return local.map((p) => ({
    x: x + p.dx * cos - p.dy * sin,
    y: y + p.dx * sin + p.dy * cos,
  }));
}

export default function ManeuversSimulatorScreen() {
  const { setManeuverResult } = useEvaluation();
  const { playSuccess, playError } = usePsychAudio();

  const [scenario, setScenario] = useState<ScenarioConfig>(SCENARIOS[0]);
  const [carState, setCarState] = useState({
    x: SCENARIOS[0].startX,
    y: SCENARIOS[0].startY,
    angleRad: (SCENARIOS[0].startAngleDeg * Math.PI) / 180,
    speed: 0,
    steerRad: 0,
  });

  const [gear, setGear] = useState<'D' | 'R'>('D');
  const [joystickKnob, setJoystickKnob] = useState({ x: 0, y: 0 });
  const [gasActive, setGasActive] = useState(false);
  const [brakeActive, setBrakeActive] = useState(false);

  const [elapsedSec, setElapsedSec] = useState(0);
  const [collisions, setCollisions] = useState(0);
  const [alignmentPct, setAlignmentPct] = useState(0);
  const [parkedSuccess, setParkedSuccess] = useState(false);
  const [collisionFlash, setCollisionFlash] = useState(false);

  // Refs for physics engine at 60 FPS
  const physicsRef = useRef({
    x: SCENARIOS[0].startX,
    y: SCENARIOS[0].startY,
    angleRad: (SCENARIOS[0].startAngleDeg * Math.PI) / 180,
    speed: 0,
    steerRad: 0,
    gas: false,
    brake: false,
    gear: 'D' as 'D' | 'R',
    collisions: 0,
    startTime: performance.now(),
    lastCollisionTime: 0,
    completed: false,
  });

  const joystickStartRef = useRef({ x: 0, y: 0 });

  const resetScenario = useCallback((targetScenario: ScenarioConfig) => {
    const initAngle = (targetScenario.startAngleDeg * Math.PI) / 180;
    physicsRef.current = {
      x: targetScenario.startX,
      y: targetScenario.startY,
      angleRad: initAngle,
      speed: 0,
      steerRad: 0,
      gas: false,
      brake: false,
      gear: 'D',
      collisions: 0,
      startTime: performance.now(),
      lastCollisionTime: 0,
      completed: false,
    };
    setCarState({
      x: targetScenario.startX,
      y: targetScenario.startY,
      angleRad: initAngle,
      speed: 0,
      steerRad: 0,
    });
    setGear('D');
    setJoystickKnob({ x: 0, y: 0 });
    setGasActive(false);
    setBrakeActive(false);
    setElapsedSec(0);
    setCollisions(0);
    setAlignmentPct(0);
    setParkedSuccess(false);
    setCollisionFlash(false);
  }, []);

  const handleSelectScenario = useCallback(
    (sc: ScenarioConfig) => {
      setScenario(sc);
      resetScenario(sc);
    },
    [resetScenario]
  );

  // Update refs when pedals/gear change
  useEffect(() => {
    physicsRef.current.gas = gasActive;
    physicsRef.current.brake = brakeActive;
    physicsRef.current.gear = gear;
  }, [gasActive, brakeActive, gear]);

  // 60 FPS Top-Down Vehicle Kinematics & Collision/Parking Detection Loop
  useEffect(() => {
    let rafId: number;
    let lastTime = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const p = physicsRef.current;
      if (!p.completed) {
        // Elapsed timer
        const elapsed = Number(((now - p.startTime) / 1000).toFixed(1));
        setElapsedSec(elapsed);

        // Acceleration & Braking Pedals logic
        const maxForwardSpeed = 115;
        const maxReverseSpeed = -78;
        const accelRate = 155;
        const brakeDecelRate = 240;
        const naturalFriction = 68;

        if (p.gas && !p.brake) {
          if (p.gear === 'D') {
            p.speed = Math.min(maxForwardSpeed, p.speed + accelRate * dt);
          } else {
            p.speed = Math.max(maxReverseSpeed, p.speed - accelRate * dt);
          }
        } else if (p.brake) {
          // If moving forward, brake stops quickly; if stopped or already reversing, pedal acts as reverse/brake
          if (p.speed > 8) {
            p.speed = Math.max(0, p.speed - brakeDecelRate * dt);
          } else {
            p.speed = Math.max(maxReverseSpeed, p.speed - accelRate * 0.85 * dt);
          }
        } else {
          // Natural rolling friction
          if (Math.abs(p.speed) < 3) {
            p.speed = 0;
          } else if (p.speed > 0) {
            p.speed = Math.max(0, p.speed - naturalFriction * dt);
          } else {
            p.speed = Math.min(0, p.speed + naturalFriction * dt);
          }
        }

        // Bicycle kinematic model update
        const nextX = p.x + p.speed * Math.cos(p.angleRad) * dt;
        const nextY = p.y + p.speed * Math.sin(p.angleRad) * dt;
        const angularVel = (p.speed / WHEELBASE) * Math.tan(p.steerRad);
        const nextAngle = p.angleRad + angularVel * dt;

        // Check boundary & obstacle collisions using the 4 corners of the vehicle
        const corners = getCarCorners(nextX, nextY, nextAngle);
        const outOfBounds = corners.some(
          (c) => c.x < 18 || c.x > WORLD_W - 18 || c.y < 18 || c.y > WORLD_H - 18
        );

        const hitsObstacle = scenario.obstacles.some((obs) =>
          corners.some(
            (c) =>
              c.x >= obs.x &&
              c.x <= obs.x + obs.w &&
              c.y >= obs.y &&
              c.y <= obs.y + obs.h
          )
        );

        if (outOfBounds || hitsObstacle) {
          // Bounce back and register collision
          p.speed = -p.speed * 0.35;
          if (now - p.lastCollisionTime > 750) {
            p.lastCollisionTime = now;
            p.collisions += 1;
            setCollisions(p.collisions);
            setCollisionFlash(true);
            playError();
            setTimeout(() => setCollisionFlash(false), 380);
          }
        } else {
          p.x = nextX;
          p.y = nextY;
          p.angleRad = nextAngle;
        }

        // Evaluate alignment with demarcated parking zone
        const pz = scenario.parkingZone;
        const pzCenterX = pz.x + pz.w / 2;
        const pzCenterY = pz.y + pz.h / 2;
        const distToCenter = Math.hypot(p.x - pzCenterX, p.y - pzCenterY);

        const currentCorners = getCarCorners(p.x, p.y, p.angleRad);
        const cornersInside = currentCorners.filter(
          (c) =>
            c.x >= pz.x - 4 &&
            c.x <= pz.x + pz.w + 4 &&
            c.y >= pz.y - 4 &&
            c.y <= pz.y + pz.h + 4
        ).length;

        const distScore = Math.max(0, 100 - distToCenter * 0.85);
        const cornerScore = cornersInside * 25;
        const computedAlignment = Math.min(100, Math.round(distScore * 0.45 + cornerScore * 0.55));
        setAlignmentPct(computedAlignment);

        // If all 4 corners are inside the parking zone and vehicle is nearly stopped
        if (cornersInside === 4 && Math.abs(p.speed) < 6) {
          p.completed = true;
          p.speed = 0;
          setParkedSuccess(true);
          playSuccess();

          let grade: AptitudeGrade = 'APTO';
          if (elapsed < 28 && p.collisions === 0) {
            grade = 'EXCELENTE';
          } else if (p.collisions > 2 || elapsed > 65) {
            grade = 'NO APTO';
          }

          setManeuverResult({
            elapsedSeconds: elapsed,
            collisions: p.collisions,
            alignmentPct: 100,
            scenarioTitle: scenario.title,
            grade,
            completedAt: new Date().toLocaleTimeString(),
          });
        }

        setCarState({
          x: p.x,
          y: p.y,
          angleRad: p.angleRad,
          speed: p.speed,
          steerRad: p.steerRad,
        });
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [playError, playSuccess, scenario, setManeuverResult]);

  // Joystick Pan Gesture (Bottom-Left Corner) for precise wheel steering
  const joystickGesture = Gesture.Pan()
    .runOnJS(true)
    .onBegin(() => {
      joystickStartRef.current = { ...joystickKnob };
    })
    .onUpdate((e) => {
      const rawX = joystickStartRef.current.x + e.translationX;
      const rawY = joystickStartRef.current.y + e.translationY;
      const dist = Math.hypot(rawX, rawY);
      const scale = dist > JOYSTICK_RADIUS ? JOYSTICK_RADIUS / dist : 1;
      const clampedX = rawX * scale;
      const clampedY = rawY * scale;

      setJoystickKnob({ x: clampedX, y: clampedY });
      const normalizedSteer = clampedX / JOYSTICK_RADIUS; // -1 to +1
      physicsRef.current.steerRad = normalizedSteer * MAX_STEER_RAD;
    })
    .onFinalize(() => {
      // Smoothly return steering wheel to center on release
      setJoystickKnob({ x: 0, y: 0 });
      physicsRef.current.steerRad = 0;
    });

  const carAngleDeg = (carState.angleRad * 180) / Math.PI;
  const steerAngleDeg = Math.round((carState.steerRad * 180) / Math.PI);
  const speedKmh = Math.round(Math.abs(carState.speed) * 0.25);

  const pz = scenario.parkingZone;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <TelemetryHeader
        title="SIMULADOR DE MANIOBRAS 2D (TOP-DOWN)"
        subtitle="Estacione el vehículo azul dentro de la zona de parqueo demarcada"
        moduleCode="MOD-03"
        showBack
      />

      <View style={styles.mainContainer}>
        {/* BARRA SUPERIOR DE ESCENARIOS Y TELEMETRÍA DEL VEHÍCULO */}
        <View style={styles.topHudBar}>
          <View style={styles.scenarioTabs}>
            {SCENARIOS.map((sc) => {
              const active = scenario.id === sc.id;
              return (
                <Pressable
                  key={sc.id}
                  onPress={() => handleSelectScenario(sc)}
                  style={[styles.scenarioTab, active && styles.scenarioTabActive]}>
                  <Text style={[styles.scenarioTabText, active && styles.scenarioTabTextActive]}>
                    {sc.shortLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.telemetryStrip}>
            <View style={styles.statBadge}>
              <Text style={styles.statBadgeLabel}>TIEMPO</Text>
              <Text style={[styles.statBadgeValue, { color: PsychoPalette.cyan }]}>
                {elapsedSec.toFixed(1)}s
              </Text>
            </View>

            <View style={styles.statBadge}>
              <Text style={styles.statBadgeLabel}>ENCAJE PARQUEO</Text>
              <Text
                style={[
                  styles.statBadgeValue,
                  { color: alignmentPct >= 85 ? PsychoPalette.mint : PsychoPalette.textPrimary },
                ]}>
                {alignmentPct}%
              </Text>
            </View>

            <View style={styles.statBadge}>
              <Text style={styles.statBadgeLabel}>COLISIONES</Text>
              <Text
                style={[
                  styles.statBadgeValue,
                  {
                    color:
                      collisions === 0 ? PsychoPalette.mint : PsychoPalette.redSignalBright,
                  },
                ]}>
                {collisions}
              </Text>
            </View>

            <Pressable onPress={() => resetScenario(scenario)} style={styles.resetSimBtn}>
              <Ionicons name="refresh" size={14} color={PsychoPalette.bgPrimary} />
              <Text style={styles.resetSimBtnText}>REINICIAR</Text>
            </Pressable>
          </View>
        </View>

        {/* VISTA DE PÁJARO (TOP-DOWN) DEL CIRCUITO Y VEHÍCULO AZUL */}
        <View
          style={[
            styles.viewportContainer,
            collisionFlash && { borderColor: PsychoPalette.redSignalBright },
            parkedSuccess && { borderColor: PsychoPalette.mint },
          ]}>
          <Svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
            preserveAspectRatio="xMidYMid meet">
            <Defs>
              <LinearGradient id="asphaltGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#09111E" />
                <Stop offset="1" stopColor="#0F1B2E" />
              </LinearGradient>
            </Defs>

            {/* Superficie asfaltada del circuito */}
            <Rect x={0} y={0} width={WORLD_W} height={WORLD_H} fill="url(#asphaltGrad)" />

            {/* Bordes perimetrales de seguridad del circuito */}
            <Rect
              x={14}
              y={14}
              width={WORLD_W - 28}
              height={WORLD_H - 28}
              fill="none"
              stroke={PsychoPalette.borderSubtle}
              strokeWidth={3}
              rx={10}
            />

            {/* Marcas viales de carriles de circulación */}
            <Line
              x1={30}
              y1={210}
              x2={WORLD_W - 30}
              y2={210}
              stroke="rgba(148, 163, 184, 0.25)"
              strokeWidth={2}
              strokeDasharray="14 12"
            />
            <Line
              x1={30}
              y1={340}
              x2={WORLD_W - 30}
              y2={340}
              stroke="rgba(0, 217, 245, 0.2)"
              strokeWidth={2}
            />

            {/* ZONA DE PARQUEO CLARAMENTE DEMARCADA CON SUS BORDES Y DELIMITACIONES */}
            <G>
              <Rect
                x={pz.x}
                y={pz.y}
                width={pz.w}
                height={pz.h}
                fill={
                  parkedSuccess
                    ? 'rgba(0, 245, 160, 0.28)'
                    : alignmentPct >= 75
                      ? 'rgba(0, 245, 160, 0.16)'
                      : 'rgba(0, 217, 245, 0.10)'
                }
                stroke={parkedSuccess || alignmentPct >= 75 ? PsychoPalette.mint : PsychoPalette.cyan}
                strokeWidth={3}
                strokeDasharray="8 5"
                rx={5}
              />
              {/* Esquinas reforzadas de delimitación de parqueo */}
              <Path
                d={`M ${pz.x} ${pz.y + 14} L ${pz.x} ${pz.y} L ${pz.x + 14} ${pz.y}`}
                stroke={PsychoPalette.mint}
                strokeWidth={4}
                fill="none"
              />
              <Path
                d={`M ${pz.x + pz.w - 14} ${pz.y} L ${pz.x + pz.w} ${pz.y} L ${pz.x + pz.w} ${pz.y + 14}`}
                stroke={PsychoPalette.mint}
                strokeWidth={4}
                fill="none"
              />
              <Path
                d={`M ${pz.x} ${pz.y + pz.h - 14} L ${pz.x} ${pz.y + pz.h} L ${pz.x + 14} ${pz.y + pz.h}`}
                stroke={PsychoPalette.mint}
                strokeWidth={4}
                fill="none"
              />
              <Path
                d={`M ${pz.x + pz.w - 14} ${pz.y + pz.h} L ${pz.x + pz.w} ${pz.y + pz.h} L ${pz.x + pz.w} ${pz.y + pz.h - 14}`}
                stroke={PsychoPalette.mint}
                strokeWidth={4}
                fill="none"
              />
              <SvgText
                x={pz.x + pz.w / 2}
                y={pz.y + pz.h / 2 + 5}
                fill={PsychoPalette.mint}
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle">
                P
              </SvgText>
            </G>

            {/* Obstáculos y vehículos estacionados adyacentes */}
            {scenario.obstacles.map((obs, idx) => (
              <G key={idx}>
                <Rect
                  x={obs.x}
                  y={obs.y}
                  width={obs.w}
                  height={obs.h}
                  fill="#17253B"
                  stroke="#475569"
                  strokeWidth={2}
                  rx={6}
                />
                <Line
                  x1={obs.x + 6}
                  y1={obs.y + 6}
                  x2={obs.x + obs.w - 6}
                  y2={obs.y + obs.h - 6}
                  stroke="rgba(239, 68, 68, 0.35)"
                  strokeWidth={1.5}
                />
                {obs.label ? (
                  <SvgText
                    x={obs.x + obs.w / 2}
                    y={obs.y + obs.h / 2 + 4}
                    fill="#94A3B8"
                    fontSize="10"
                    fontWeight="bold"
                    textAnchor="middle">
                    {obs.label}
                  </SvgText>
                ) : null}
              </G>
            ))}

            {/* VEHÍCULO AZUL (VISTA SUPERIOR TOP-DOWN CON RUEDAS DIRECCIONALES) */}
            <G
              transform={`translate(${carState.x}, ${carState.y}) rotate(${carAngleDeg})`}>
              {/* Línea guía de proyección delantera */}
              <Line
                x1={CAR_LENGTH / 2}
                y1={0}
                x2={CAR_LENGTH / 2 + 42}
                y2={Math.tan(carState.steerRad) * 42}
                stroke="rgba(0, 217, 245, 0.45)"
                strokeWidth={2}
                strokeDasharray="4 4"
              />

              {/* Ruedas traseras */}
              <Rect
                x={-CAR_LENGTH / 2 + 5}
                y={-CAR_WIDTH / 2 - 3}
                width={12}
                height={4}
                rx={1.5}
                fill="#0F172A"
                stroke="#94A3B8"
                strokeWidth={0.8}
              />
              <Rect
                x={-CAR_LENGTH / 2 + 5}
                y={CAR_WIDTH / 2 - 1}
                width={12}
                height={4}
                rx={1.5}
                fill="#0F172A"
                stroke="#94A3B8"
                strokeWidth={0.8}
              />

              {/* Ruedas delanteras que rotan según el ángulo del Joystick */}
              <G
                transform={`translate(${CAR_LENGTH / 2 - 11}, ${-CAR_WIDTH / 2 - 1}) rotate(${steerAngleDeg})`}>
                <Rect
                  x={-6}
                  y={-2}
                  width={12}
                  height={4}
                  rx={1.5}
                  fill="#0F172A"
                  stroke={PsychoPalette.cyan}
                  strokeWidth={1}
                />
              </G>
              <G
                transform={`translate(${CAR_LENGTH / 2 - 11}, ${CAR_WIDTH / 2 + 1}) rotate(${steerAngleDeg})`}>
                <Rect
                  x={-6}
                  y={-2}
                  width={12}
                  height={4}
                  rx={1.5}
                  fill="#0F172A"
                  stroke={PsychoPalette.cyan}
                  strokeWidth={1}
                />
              </G>

              {/* Carrocería Principal del Vehículo Azul */}
              <Rect
                x={-CAR_LENGTH / 2}
                y={-CAR_WIDTH / 2}
                width={CAR_LENGTH}
                height={CAR_WIDTH}
                rx={7}
                fill={PsychoPalette.vehicleBlue}
                stroke={PsychoPalette.vehicleBlueLight}
                strokeWidth={2}
              />

              {/* Cabina / Parabrisas y Luneta Trasera */}
              <Rect
                x={-10}
                y={-CAR_WIDTH / 2 + 4}
                width={22}
                height={CAR_WIDTH - 8}
                rx={4}
                fill="#1E3A8A"
                stroke="#93C5FD"
                strokeWidth={1}
              />
              <Rect
                x={6}
                y={-CAR_WIDTH / 2 + 5}
                width={7}
                height={CAR_WIDTH - 10}
                rx={2}
                fill="#BAE6FD"
                opacity={0.85}
              />

              {/* Faros Delanteros */}
              <Circle cx={CAR_LENGTH / 2 - 2} cy={-CAR_WIDTH / 2 + 5} r={2.5} fill="#E0F2FE" />
              <Circle cx={CAR_LENGTH / 2 - 2} cy={CAR_WIDTH / 2 - 5} r={2.5} fill="#E0F2FE" />

              {/* Luces Traseras de Freno / Reversa */}
              <Rect
                x={-CAR_LENGTH / 2}
                y={-CAR_WIDTH / 2 + 3}
                width={3}
                height={6}
                fill={
                  brakeActive
                    ? '#FF3B5C'
                    : carState.speed < -2
                      ? '#FFFFFF'
                      : '#991B1B'
                }
              />
              <Rect
                x={-CAR_LENGTH / 2}
                y={CAR_WIDTH / 2 - 9}
                width={3}
                height={6}
                fill={
                  brakeActive
                    ? '#FF3B5C'
                    : carState.speed < -2
                      ? '#FFFFFF'
                      : '#991B1B'
                }
              />
            </G>
          </Svg>

          {/* Indicador flotante superior de velocidad y dirección */}
          <View style={styles.cockpitFloatingOverlay} pointerEvents="none">
            <View style={styles.cockpitPill}>
              <Text style={styles.cockpitPillText}>
                VEL: {speedKmh} km/h • GIRO RUEDAS: {steerAngleDeg > 0 ? `+${steerAngleDeg}°` : `${steerAngleDeg}°`}
              </Text>
            </View>
            {collisionFlash ? (
              <View style={[styles.cockpitPill, styles.cockpitPillAlert]}>
                <Text style={styles.cockpitPillAlertText}>¡IMPACTO CONTRA OBSTÁCULO!</Text>
              </View>
            ) : null}
          </View>

          {/* CONTROLES TÁCTILES: JOYSTICK (ESQUINA INFERIOR IZQUIERDA) Y PEDALES (ESQUINA INFERIOR DERECHA) */}
          <View style={styles.bottomControlsOverlay} pointerEvents="box-none">
            {/* ESQUINA INFERIOR IZQUIERDA: JOYSTICK DE DIRECCIÓN */}
            <View style={styles.joystickPanel}>
              <Text style={styles.controlLabel}>DIRECCIÓN (JOYSTICK)</Text>
              <GestureDetector gesture={joystickGesture}>
                <View style={styles.joystickBase}>
                  <View style={styles.joystickCrosshairH} />
                  <View style={styles.joystickCrosshairV} />
                  <View
                    style={[
                      styles.joystickKnob,
                      {
                        transform: [
                          { translateX: joystickKnob.x },
                          { translateY: joystickKnob.y },
                        ],
                      },
                    ]}>
                    <Ionicons name="navigate-circle-outline" size={24} color={PsychoPalette.bgPrimary} />
                  </View>
                </View>
              </GestureDetector>
              <Text style={styles.joystickAngleReadout}>
                {steerAngleDeg === 0
                  ? 'RECTO 0°'
                  : steerAngleDeg < 0
                    ? `IZQ ${steerAngleDeg}°`
                    : `DER +${steerAngleDeg}°`}
              </Text>
            </View>

            {/* ESQUINA INFERIOR DERECHA: PEDALES DE CONTROL (FRENO/REVERSA Y ACELERADOR) */}
            <View style={styles.pedalsCluster}>
              {/* Selector de Transmisión D / R */}
              <View style={styles.gearSelectorColumn}>
                <Text style={styles.controlLabel}>MARCHA</Text>
                <Pressable
                  onPress={() => setGear('D')}
                  style={[styles.gearBtn, gear === 'D' && styles.gearBtnActiveD]}>
                  <Text style={[styles.gearBtnText, gear === 'D' && styles.gearBtnTextActive]}>
                    D • AVANCE
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setGear('R')}
                  style={[styles.gearBtn, gear === 'R' && styles.gearBtnActiveR]}>
                  <Text style={[styles.gearBtnText, gear === 'R' && styles.gearBtnTextActive]}>
                    R • REVERSA
                  </Text>
                </Pressable>
              </View>

              {/* PEDAL DE FRENO / REVERSA */}
              <Pressable
                onPressIn={() => setBrakeActive(true)}
                onPressOut={() => setBrakeActive(false)}
                style={[styles.pedalBox, styles.brakePedal, brakeActive && styles.brakePedalActive]}
                accessibilityRole="button"
                accessibilityLabel="Pedal de Freno y Reversa">
                <Ionicons name="hand-left-outline" size={20} color="#FFFFFF" />
                <Text style={styles.pedalTitle}>FRENO</Text>
                <Text style={styles.pedalSub}>REV</Text>
                <View style={styles.pedalGripLines}>
                  <View style={styles.pedalGripLine} />
                  <View style={styles.pedalGripLine} />
                  <View style={styles.pedalGripLine} />
                </View>
              </Pressable>

              {/* PEDAL DE ACELERADOR */}
              <Pressable
                onPressIn={() => setGasActive(true)}
                onPressOut={() => setGasActive(false)}
                style={[styles.pedalBox, styles.gasPedal, gasActive && styles.gasPedalActive]}
                accessibilityRole="button"
                accessibilityLabel="Pedal de Acelerador">
                <Ionicons name="speedometer-outline" size={20} color={PsychoPalette.bgPrimary} />
                <Text style={[styles.pedalTitle, { color: PsychoPalette.bgPrimary }]}>ACEL</Text>
                <Text style={[styles.pedalSub, { color: PsychoPalette.bgPrimary }]}>
                  {gear === 'D' ? 'AVANCE' : 'RETROC'}
                </Text>
                <View style={styles.pedalGripLines}>
                  <View style={[styles.pedalGripLine, { backgroundColor: PsychoPalette.bgPrimary }]} />
                  <View style={[styles.pedalGripLine, { backgroundColor: PsychoPalette.bgPrimary }]} />
                  <View style={[styles.pedalGripLine, { backgroundColor: PsychoPalette.bgPrimary }]} />
                </View>
              </Pressable>
            </View>
          </View>

          {/* MODAL DE ÉXITO AL ESTACIONAR CORRECTAMENTE */}
          {parkedSuccess ? (
            <View style={styles.successOverlay}>
              <View style={styles.successModalCard}>
                <Ionicons name="checkmark-done-circle" size={44} color={PsychoPalette.mint} />
                <Text style={styles.successModalTitle}>¡MANIOBRA DE PARQUEO COMPLETADA!</Text>
                <Text style={styles.successModalDesc}>
                  {scenario.title} ejecutado en {elapsedSec.toFixed(1)}s con {collisions}{' '}
                  {collisions === 1 ? 'colisión' : 'colisiones'}.
                </Text>
                <View style={styles.successModalActions}>
                  <Pressable
                    onPress={() => resetScenario(scenario)}
                    style={styles.modalRepeatBtn}>
                    <Ionicons name="refresh" size={15} color={PsychoPalette.bgPrimary} />
                    <Text style={styles.modalBtnText}>REPETIR MANIOBRA</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => router.push('/')}
                    style={styles.modalDashboardBtn}>
                    <Text style={styles.modalBtnText}>VER BAREMOS EN TABLERO</Text>
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
    paddingVertical: 8,
    gap: 8,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  topHudBar: {
    backgroundColor: PsychoPalette.bgSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  scenarioTabs: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  scenarioTab: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: PsychoPalette.bgPanel,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
  },
  scenarioTabActive: {
    backgroundColor: PsychoPalette.cyanDim,
    borderColor: PsychoPalette.cyan,
  },
  scenarioTabText: {
    color: PsychoPalette.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Fonts.mono,
  },
  scenarioTabTextActive: {
    color: PsychoPalette.cyan,
    fontWeight: '900',
  },
  telemetryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  statBadge: {
    backgroundColor: PsychoPalette.bgPanel,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  statBadgeLabel: {
    color: PsychoPalette.textMuted,
    fontSize: 8,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
  statBadgeValue: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  resetSimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PsychoPalette.mint,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 7,
  },
  resetSimBtnText: {
    color: PsychoPalette.bgPrimary,
    fontSize: 10,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  viewportContainer: {
    flex: 1,
    backgroundColor: '#09111E',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: PsychoPalette.borderSubtle,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 300,
  },
  cockpitFloatingOverlay: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cockpitPill: {
    backgroundColor: 'rgba(8, 15, 29, 0.86)',
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  cockpitPillText: {
    color: PsychoPalette.cyan,
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
  cockpitPillAlert: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderColor: '#FFFFFF',
  },
  cockpitPillAlertText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  bottomControlsOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  joystickPanel: {
    backgroundColor: 'rgba(8, 15, 29, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 245, 0.45)',
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
    gap: 5,
  },
  controlLabel: {
    color: PsychoPalette.textSecondary,
    fontSize: 9,
    fontWeight: '800',
    fontFamily: Fonts.mono,
    letterSpacing: 0.5,
  },
  joystickBase: {
    width: JOYSTICK_RADIUS * 2 + 22,
    height: JOYSTICK_RADIUS * 2 + 22,
    borderRadius: JOYSTICK_RADIUS + 11,
    backgroundColor: '#0F1A2E',
    borderWidth: 2,
    borderColor: PsychoPalette.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  joystickCrosshairH: {
    position: 'absolute',
    width: '80%',
    height: 1,
    backgroundColor: 'rgba(0, 217, 245, 0.25)',
  },
  joystickCrosshairV: {
    position: 'absolute',
    width: 1,
    height: '80%',
    backgroundColor: 'rgba(0, 217, 245, 0.25)',
  },
  joystickKnob: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PsychoPalette.cyan,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PsychoPalette.cyan,
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 6,
  },
  joystickAngleReadout: {
    color: PsychoPalette.mint,
    fontSize: 10,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  pedalsCluster: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: 'rgba(8, 15, 29, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 160, 0.45)',
    borderRadius: 16,
    padding: 10,
  },
  gearSelectorColumn: {
    gap: 5,
    alignItems: 'center',
    marginRight: 2,
  },
  gearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 7,
    backgroundColor: PsychoPalette.bgCard,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    minWidth: 74,
    alignItems: 'center',
  },
  gearBtnActiveD: {
    backgroundColor: PsychoPalette.mintDim,
    borderColor: PsychoPalette.mint,
  },
  gearBtnActiveR: {
    backgroundColor: PsychoPalette.amberDim,
    borderColor: PsychoPalette.amberWarning,
  },
  gearBtnText: {
    color: PsychoPalette.textSecondary,
    fontSize: 9,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
  gearBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  pedalBox: {
    width: 64,
    height: 108,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
  },
  brakePedal: {
    backgroundColor: '#991B1B',
    borderColor: '#EF4444',
  },
  brakePedalActive: {
    backgroundColor: '#EF4444',
    borderColor: '#FFFFFF',
    transform: [{ scale: 0.94 }],
  },
  gasPedal: {
    backgroundColor: PsychoPalette.mint,
    borderColor: '#FFFFFF',
  },
  gasPedalActive: {
    backgroundColor: PsychoPalette.cyan,
    transform: [{ scale: 0.94 }],
  },
  pedalTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  pedalSub: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 9,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
  pedalGripLines: {
    width: '75%',
    gap: 4,
  },
  pedalGripLine: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  successOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5, 10, 20, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  successModalCard: {
    backgroundColor: PsychoPalette.bgCard,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: PsychoPalette.mint,
    padding: 20,
    alignItems: 'center',
    maxWidth: 420,
    width: '100%',
    gap: 10,
  },
  successModalTitle: {
    color: PsychoPalette.mint,
    fontSize: 17,
    fontWeight: '900',
    fontFamily: Fonts.mono,
    textAlign: 'center',
  },
  successModalDesc: {
    color: PsychoPalette.textPrimary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  successModalActions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 6,
  },
  modalRepeatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PsychoPalette.mint,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalDashboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PsychoPalette.cyan,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalBtnText: {
    color: PsychoPalette.bgPrimary,
    fontSize: 11,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
});
