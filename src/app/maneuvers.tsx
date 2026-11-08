import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  Polygon,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

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
const STEERING_WHEEL_RADIUS = 48;

// Dimensiones del visor 3D estilo urbano diurno (como la imagen de referencia)
const VIEW3D_W = 720;
const VIEW3D_H = 420;
const HORIZON_Y = 122;
const FOCAL_LEN = 320;

interface ConePoint {
  x: number;
  y: number;
}

interface FloorArrow {
  x: number;
  y: number;
  angleDeg: number;
}

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
  targetAngleDeg: number;
}

interface ScenarioConfig {
  id: string;
  title: string;
  shortLabel: string;
  startX: number;
  startY: number;
  startAngleDeg: number;
  parkingZone: ParkingZone;
  cones: ConePoint[];
  arrows: FloorArrow[];
  obstacles: ObstacleBox[];
}

// Los 3 niveles de la prueba de conducción ambientados en la pista 3D de conos, flechas amarillas y zona P azul
const SCENARIOS: ScenarioConfig[] = [
  {
    id: 'bay',
    title: 'Nivel 1: Circuito de Conos y Parqueo [P] (90°)',
    shortLabel: '1. PARQUEO [P] 90°',
    startX: 145,
    startY: 315,
    startAngleDeg: -12,
    parkingZone: {
      x: 262,
      y: 42,
      w: 62,
      h: 86,
      targetAngleDeg: -90,
    },
    cones: [
      // Corredor izquierdo y derecho de conos naranjas con blanco (como en la imagen)
      { x: 95, y: 345 },
      { x: 145, y: 345 },
      { x: 195, y: 345 },
      { x: 245, y: 345 },
      { x: 295, y: 345 },
      { x: 345, y: 345 },
      { x: 395, y: 345 },
      { x: 105, y: 245 },
      { x: 155, y: 245 },
      { x: 205, y: 245 },
      // Conos que delimitan el cajón de parqueo P
      { x: 235, y: 132 },
      { x: 235, y: 92 },
      { x: 235, y: 52 },
      { x: 350, y: 132 },
      { x: 350, y: 92 },
      { x: 350, y: 52 },
      { x: 410, y: 132 },
      { x: 460, y: 132 },
    ],
    arrows: [
      { x: 185, y: 290, angleDeg: 0 },
      { x: 275, y: 265, angleDeg: -45 },
      { x: 293, y: 175, angleDeg: -90 },
    ],
    obstacles: [
      { x: 165, y: 42, w: 62, h: 80, label: 'CONOS IZQ' },
      { x: 360, y: 42, w: 62, h: 80, label: 'CONOS DER' },
    ],
  },
  {
    id: 'parallel',
    title: 'Nivel 2: Parqueo en Paralelo entre Conos [P]',
    shortLabel: '2. PARALELO [P]',
    startX: 130,
    startY: 225,
    startAngleDeg: 0,
    parkingZone: {
      x: 255,
      y: 46,
      w: 92,
      h: 52,
      targetAngleDeg: 0,
    },
    cones: [
      { x: 140, y: 46 },
      { x: 185, y: 46 },
      { x: 230, y: 46 },
      { x: 230, y: 95 },
      { x: 368, y: 46 },
      { x: 415, y: 46 },
      { x: 460, y: 46 },
      { x: 368, y: 95 },
      // Hilera inferior de conos
      { x: 130, y: 285 },
      { x: 195, y: 285 },
      { x: 260, y: 285 },
      { x: 325, y: 285 },
      { x: 390, y: 285 },
      { x: 455, y: 285 },
    ],
    arrows: [
      { x: 195, y: 195, angleDeg: 0 },
      { x: 295, y: 175, angleDeg: 0 },
      { x: 355, y: 135, angleDeg: -145 },
    ],
    obstacles: [
      { x: 135, y: 44, w: 96, h: 48, label: 'ZONA CONOS 1' },
      { x: 365, y: 44, w: 96, h: 48, label: 'ZONA CONOS 2' },
    ],
  },
  {
    id: 'garage',
    title: 'Nivel 3: Eslalon de Conos y Meta [P]',
    shortLabel: '3. ESLALON CONOS',
    startX: 95,
    startY: 300,
    startAngleDeg: -18,
    parkingZone: {
      x: 468,
      y: 56,
      w: 88,
      h: 56,
      targetAngleDeg: 0,
    },
    cones: [
      { x: 240, y: 180 },
      { x: 240, y: 215 },
      { x: 240, y: 250 },
      { x: 275, y: 180 },
      { x: 275, y: 250 },
      { x: 365, y: 65 },
      { x: 365, y: 100 },
      { x: 365, y: 135 },
      { x: 400, y: 65 },
      { x: 400, y: 135 },
      // Conos guía exteriores
      { x: 145, y: 340 },
      { x: 215, y: 340 },
      { x: 310, y: 310 },
      { x: 420, y: 240 },
      { x: 495, y: 185 },
    ],
    arrows: [
      { x: 165, y: 265, angleDeg: -25 },
      { x: 305, y: 150, angleDeg: 15 },
      { x: 430, y: 120, angleDeg: -25 },
    ],
    obstacles: [
      { x: 238, y: 175, w: 40, h: 82, label: 'BARRERA CONOS 1' },
      { x: 363, y: 60, w: 40, h: 82, label: 'BARRERA CONOS 2' },
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

interface Pt3D {
  x: number;
  y: number;
  z: number;
}

interface ProjectedPt {
  sx: number;
  sy: number;
  depth: number;
  scale: number;
}

function projectPoint3D(
  pt: Pt3D,
  camX: number,
  camY: number,
  camZ: number,
  camYaw: number,
  pitchOffset = 18
): ProjectedPt | null {
  const dx = pt.x - camX;
  const dy = pt.y - camY;
  const cos = Math.cos(camYaw);
  const sin = Math.sin(camYaw);

  const forward = dx * cos + dy * sin;
  const right = -dx * sin + dy * cos;

  if (forward < 8) return null;

  const scale = FOCAL_LEN / forward;
  const sx = VIEW3D_W / 2 + right * scale;
  const sy = HORIZON_Y + pitchOffset + (camZ - pt.z) * scale;

  return { sx, sy, depth: forward, scale };
}

function projectPolygon3D(
  pts: Pt3D[],
  camX: number,
  camY: number,
  camZ: number,
  camYaw: number,
  pitchOffset = 18
): { pointsStr: string; avgDepth: number; centerSx: number; centerSy: number } | null {
  const cos = Math.cos(camYaw);
  const sin = Math.sin(camYaw);
  const nearPlane = 10;

  const camPts = pts.map((p) => {
    const dx = p.x - camX;
    const dy = p.y - camY;
    return {
      fwd: dx * cos + dy * sin,
      right: -dx * sin + dy * cos,
      z: p.z,
    };
  });

  const clipped: { fwd: number; right: number; z: number }[] = [];
  for (let i = 0; i < camPts.length; i++) {
    const curr = camPts[i];
    const prev = camPts[(i + camPts.length - 1) % camPts.length];
    const currIn = curr.fwd >= nearPlane;
    const prevIn = prev.fwd >= nearPlane;

    if (currIn !== prevIn) {
      const t = (nearPlane - prev.fwd) / (curr.fwd - prev.fwd);
      clipped.push({
        fwd: nearPlane,
        right: prev.right + t * (curr.right - prev.right),
        z: prev.z + t * (curr.z - prev.z),
      });
    }
    if (currIn) clipped.push(curr);
  }

  if (clipped.length < 3) return null;

  let sumDepth = 0;
  let sumX = 0;
  let sumY = 0;
  const coords = clipped.map((cp) => {
    const scale = FOCAL_LEN / cp.fwd;
    const sx = VIEW3D_W / 2 + cp.right * scale;
    const sy = HORIZON_Y + pitchOffset + (camZ - cp.z) * scale;
    sumDepth += cp.fwd;
    sumX += sx;
    sumY += sy;
    return `${sx.toFixed(1)},${sy.toFixed(1)}`;
  });

  return {
    pointsStr: coords.join(' '),
    avgDepth: sumDepth / clipped.length,
    centerSx: sumX / clipped.length,
    centerSy: sumY / clipped.length,
  };
}

export default function ManeuversSimulatorScreen() {
  const { preoperationalResult, setManeuverResult } = useEvaluation();
  const { playLeftSignal, playRightSignal, playSuccess, playError } = usePsychAudio();

  const [scenario, setScenario] = useState<ScenarioConfig>(SCENARIOS[0]);
  const [carState, setCarState] = useState({
    x: SCENARIOS[0].startX,
    y: SCENARIOS[0].startY,
    angleRad: (SCENARIOS[0].startAngleDeg * Math.PI) / 180,
    speed: 0,
    steerRad: 0,
  });

  // Historial de huellas de neumáticos sobre el cemento (como en la imagen)
  const [tireTracks, setTireTracks] = useState<{ x: number; y: number; angleRad: number }[]>([]);

  // Mandos del vehículo
  const [gear, setGear] = useState<'D' | 'R'>('D');
  const [handbrakeOn, setHandbrakeOn] = useState<boolean>(false);
  const [seatbeltOn, setSeatbeltOn] = useState<boolean>(true);
  const [turnSignal, setTurnSignal] = useState<'NONE' | 'LEFT' | 'RIGHT' | 'HAZARD'>('NONE');
  const [lightsOn, setLightsOn] = useState<boolean>(true);
  const [blinkTick, setBlinkTick] = useState<boolean>(true);

  const [wheelDragX, setWheelDragX] = useState<number>(0);
  const [gasActive, setGasActive] = useState<boolean>(false);
  const [brakeActive, setBrakeActive] = useState<boolean>(false);

  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [collisions, setCollisions] = useState<number>(0);
  const [alignmentPct, setAlignmentPct] = useState<number>(0);
  const [parkedSuccess, setParkedSuccess] = useState<boolean>(false);
  const [collisionFlash, setCollisionFlash] = useState<boolean>(false);

  const physicsRef = useRef({
    x: SCENARIOS[0].startX,
    y: SCENARIOS[0].startY,
    angleRad: (SCENARIOS[0].startAngleDeg * Math.PI) / 180,
    speed: 0,
    steerRad: 0,
    gas: false,
    brake: false,
    gear: 'D' as 'D' | 'R',
    handbrakeOn: false,
    collisions: 0,
    startTime: 0,
    lastCollisionTime: 0,
    lastTrackTime: 0,
    completed: false,
  });

  useEffect(() => {
    const normalizedSteer = Math.max(-1, Math.min(1, wheelDragX / STEERING_WHEEL_RADIUS));
    physicsRef.current.steerRad = normalizedSteer * MAX_STEER_RAD;
  }, [wheelDragX]);

  useEffect(() => {
    physicsRef.current.gas = gasActive;
    physicsRef.current.brake = brakeActive;
    physicsRef.current.gear = gear;
    physicsRef.current.handbrakeOn = handbrakeOn;
  }, [gasActive, brakeActive, gear, handbrakeOn]);

  useEffect(() => {
    if (turnSignal === 'NONE') return;
    const timer = setInterval(() => setBlinkTick((p) => !p), 380);
    return () => clearInterval(timer);
  }, [turnSignal]);

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
      handbrakeOn: false,
      collisions: 0,
      startTime: performance.now(),
      lastCollisionTime: 0,
      lastTrackTime: 0,
      completed: false,
    };
    setCarState({
      x: targetScenario.startX,
      y: targetScenario.startY,
      angleRad: initAngle,
      speed: 0,
      steerRad: 0,
    });
    setTireTracks([]);
    setGear('D');
    setHandbrakeOn(false);
    setWheelDragX(0);
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

  // Motor físico 60 FPS
  useEffect(() => {
    let rafId: number;
    let lastTime = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const p = physicsRef.current;
      if (p.startTime === 0) p.startTime = now;

      if (!p.completed) {
        const elapsed = Number(((now - p.startTime) / 1000).toFixed(1));
        setElapsedSec(elapsed);

        const maxForwardSpeed = 112;
        const maxReverseSpeed = -76;
        const accelRate = 152;
        const brakeDecelRate = 240;
        const naturalFriction = 68;

        if (p.handbrakeOn) {
          p.speed = Math.abs(p.speed) < 3 ? 0 : p.speed * 0.84;
        } else if (p.gas && !p.brake) {
          if (p.gear === 'D') {
            p.speed = Math.min(maxForwardSpeed, p.speed + accelRate * dt);
          } else {
            p.speed = Math.max(maxReverseSpeed, p.speed - accelRate * dt);
          }
        } else if (p.brake) {
          if (p.speed > 8) {
            p.speed = Math.max(0, p.speed - brakeDecelRate * dt);
          } else {
            p.speed = Math.max(maxReverseSpeed, p.speed - accelRate * 0.85 * dt);
          }
        } else {
          if (Math.abs(p.speed) < 3) {
            p.speed = 0;
          } else if (p.speed > 0) {
            p.speed = Math.max(0, p.speed - naturalFriction * dt);
          } else {
            p.speed = Math.min(0, p.speed + naturalFriction * dt);
          }
        }

        const nextX = p.x + p.speed * Math.cos(p.angleRad) * dt;
        const nextY = p.y + p.speed * Math.sin(p.angleRad) * dt;
        const angularVel = (p.speed / WHEELBASE) * Math.tan(p.steerRad);
        const nextAngle = p.angleRad + angularVel * dt;

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

        const hitsCone = scenario.cones.some((cone) =>
          corners.some((c) => Math.hypot(c.x - cone.x, c.y - cone.y) < 9)
        );

        if (outOfBounds || hitsObstacle || hitsCone) {
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

          // Guardar huellas de neumáticos al moverse
          if (Math.abs(p.speed) > 12 && now - p.lastTrackTime > 160) {
            p.lastTrackTime = now;
            setTireTracks((prev) => [
              ...prev.slice(-18),
              { x: p.x, y: p.y, angleRad: p.angleRad },
            ]);
          }
        }

        const pz = scenario.parkingZone;
        const pzCenterX = pz.x + pz.w / 2;
        const pzCenterY = pz.y + pz.h / 2;
        const distToCenter = Math.hypot(p.x - pzCenterX, p.y - pzCenterY);

        const currentCorners = getCarCorners(p.x, p.y, p.angleRad);
        const cornersInside = currentCorners.filter(
          (c) =>
            c.x >= pz.x - 5 &&
            c.x <= pz.x + pz.w + 5 &&
            c.y >= pz.y - 5 &&
            c.y <= pz.y + pz.h + 5
        ).length;

        const distScore = Math.max(0, 100 - distToCenter * 0.85);
        const cornerScore = cornersInside * 25;
        const computedAlignment = Math.min(100, Math.round(distScore * 0.45 + cornerScore * 0.55));
        setAlignmentPct(computedAlignment);

        if (cornersInside === 4 && Math.abs(p.speed) < 6) {
          p.completed = true;
          p.speed = 0;
          setParkedSuccess(true);
          playSuccess();

          let grade: AptitudeGrade = 'APTO';
          if (elapsed < 30 && p.collisions === 0 && seatbeltOn) {
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
  }, [playError, playSuccess, scenario, seatbeltOn, setManeuverResult]);

  // Gesto del Volante 3D (Esquina Inferior Izquierda)
  const steeringWheelGesture = Gesture.Pan()
    .runOnJS(true)
    .onChange((e) => {
      setWheelDragX((prev) =>
        Math.max(-STEERING_WHEEL_RADIUS, Math.min(STEERING_WHEEL_RADIUS, prev + e.changeX))
      );
    })
    .onFinalize(() => {
      setWheelDragX(0);
    });

  const steerAngleDeg = Math.round((carState.steerRad * 180) / Math.PI);
  const wheelVisualRotateDeg = steerAngleDeg * 2.4;
  const speedKmh = Math.round(Math.abs(carState.speed) * 0.32);

  // Distancia trasera para el espejo retrovisor
  const rearDistMeters = useMemo(() => {
    const rearX = carState.x - (CAR_LENGTH / 2) * Math.cos(carState.angleRad);
    const rearY = carState.y - (CAR_LENGTH / 2) * Math.sin(carState.angleRad);
    let minPx = 220;
    scenario.cones.forEach((c) => {
      const d = Math.hypot(rearX - c.x, rearY - c.y);
      if (d < minPx) minPx = d;
    });
    return Number(Math.max(0.2, minPx / 28).toFixed(1));
  }, [carState.angleRad, carState.x, carState.y, scenario.cones]);

  // Proyección 3D del entorno urbano (explanada gris, conos naranjas/blancos, flechas amarillas, cuadro azul [P] y letrero vertical [P])
  const world3D = useMemo(() => {
    const camDistBack = 112;
    const camZ = 68;
    const camX = carState.x - Math.cos(carState.angleRad) * camDistBack;
    const camY = carState.y - Math.sin(carState.angleRad) * camDistBack;
    const camYaw = carState.angleRad;

    // 1. Piso de concreto claro de la explanada de pruebas
    const concretePlaza = projectPolygon3D(
      [
        { x: 0, y: 0, z: 0 },
        { x: WORLD_W, y: 0, z: 0 },
        { x: WORLD_W, y: WORLD_H, z: 0 },
        { x: 0, y: WORLD_H, z: 0 },
      ],
      camX,
      camY,
      camZ,
      camYaw
    );

    // 2. Líneas blancas de bahías de parqueo en el suelo
    const whiteBayLines: string[] = [];
    for (let bx = 110; bx <= 510; bx += 65) {
      const linePoly = projectPolygon3D(
        [
          { x: bx, y: 30, z: 0.1 },
          { x: bx + 3, y: 30, z: 0.1 },
          { x: bx + 3, y: 125, z: 0.1 },
          { x: bx, y: 125, z: 0.1 },
        ],
        camX,
        camY,
        camZ,
        camYaw
      );
      if (linePoly) whiteBayLines.push(linePoly.pointsStr);
    }

    // 3. Huellas de neumáticos dobles en el cemento (como en la imagen)
    const projectedTracks: string[] = [];
    tireTracks.forEach((tr) => {
      const cos = Math.cos(tr.angleRad);
      const sin = Math.sin(tr.angleRad);
      [-10, 10].forEach((lat) => {
        const tx = tr.x - 18 * cos - lat * sin;
        const ty = tr.y - 18 * sin + lat * cos;
        const poly = projectPolygon3D(
          [
            { x: tx - 4 * cos - 2 * sin, y: ty - 4 * sin + 2 * cos, z: 0.15 },
            { x: tx + 4 * cos - 2 * sin, y: ty + 4 * sin + 2 * cos, z: 0.15 },
            { x: tx + 4 * cos + 2 * sin, y: ty + 4 * sin - 2 * cos, z: 0.15 },
            { x: tx - 4 * cos + 2 * sin, y: ty - 4 * sin - 2 * cos, z: 0.15 },
          ],
          camX,
          camY,
          camZ,
          camYaw
        );
        if (poly) projectedTracks.push(poly.pointsStr);
      });
    });

    // 4. Flechas amarillas pintadas en el pavimento (como en la imagen)
    const yellowArrows: string[] = [];
    scenario.arrows.forEach((ar) => {
      const rad = (ar.angleDeg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const localArrow = [
        { dx: 18, dy: 0 },
        { dx: 4, dy: -11 },
        { dx: 4, dy: -4 },
        { dx: -16, dy: -4 },
        { dx: -16, dy: 4 },
        { dx: 4, dy: 4 },
        { dx: 4, dy: 11 },
      ];
      const worldPts = localArrow.map((p) => ({
        x: ar.x + p.dx * cos - p.dy * sin,
        y: ar.y + p.dx * sin + p.dy * cos,
        z: 0.3,
      }));
      const proj = projectPolygon3D(worldPts, camX, camY, camZ, camYaw);
      if (proj) yellowArrows.push(proj.pointsStr);
    });

    // 5. Cuadro Azul de Parqueo [ P ] pintado en el piso con borde blanco
    const pz = scenario.parkingZone;
    const blueParkingBox = projectPolygon3D(
      [
        { x: pz.x, y: pz.y, z: 0.4 },
        { x: pz.x + pz.w, y: pz.y, z: 0.4 },
        { x: pz.x + pz.w, y: pz.y + pz.h, z: 0.4 },
        { x: pz.x, y: pz.y + pz.h, z: 0.4 },
      ],
      camX,
      camY,
      camZ,
      camYaw
    );

    // 6. Letrero Vertical Azul [ P ] sobre poste metálico al lado de la zona de parqueo (como en la imagen)
    const signBase = projectPoint3D(
      { x: pz.x - 10, y: pz.y + 8, z: 0 },
      camX,
      camY,
      camZ,
      camYaw
    );
    const signTop = projectPoint3D(
      { x: pz.x - 10, y: pz.y + 8, z: 48 },
      camX,
      camY,
      camZ,
      camYaw
    );

    // 7. Conos 3D Naranja con Franjas Blancas ordenados por profundidad
    const projectedCones: {
      sx: number;
      sy: number;
      scale: number;
      depth: number;
    }[] = [];

    scenario.cones.forEach((c) => {
      const pt = projectPoint3D({ x: c.x, y: c.y, z: 0 }, camX, camY, camZ, camYaw);
      if (pt && pt.sx > -40 && pt.sx < VIEW3D_W + 40) {
        projectedCones.push(pt);
      }
    });

    projectedCones.sort((a, b) => b.depth - a.depth);

    return {
      concretePlaza,
      whiteBayLines,
      projectedTracks,
      yellowArrows,
      blueParkingBox,
      signBase,
      signTop,
      projectedCones,
    };
  }, [carState.angleRad, carState.x, carState.y, scenario, tireTracks]);

  const leftBlinkOn = (turnSignal === 'LEFT' || turnSignal === 'HAZARD') && blinkTick;
  const rightBlinkOn = (turnSignal === 'RIGHT' || turnSignal === 'HAZARD') && blinkTick;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <TelemetryHeader
        title="SIMULADOR DE CONDUCCIÓN 3D (PISTA OFICIAL)"
        subtitle="Estacione el Sedán Blanco en la Zona Azul [P] evitando los conos"
        moduleCode="MOD-03"
        showBack
      />

      <View style={styles.mainContainer}>
        {/* BARRA SUPERIOR: NIVEL PREOPERACIONAL + LOS 3 NIVELES DE CONDUCCIÓN + MÉTRICAS */}
        <View style={styles.topHudBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scenarioTabs}>
            <Pressable
              onPress={() => router.push('/preoperational')}
              style={[
                styles.scenarioTab,
                styles.preopTabBadge,
                preoperationalResult && { borderColor: PsychoPalette.mint },
              ]}>
              <Ionicons
                name="construct"
                size={12}
                color={preoperationalResult ? PsychoPalette.mint : PsychoPalette.amberWarning}
              />
              <Text
                style={[
                  styles.scenarioTabText,
                  {
                    color: preoperationalResult ? PsychoPalette.mint : PsychoPalette.amberWarning,
                  },
                ]}>
                0. PREOPERACIONAL
              </Text>
            </Pressable>

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
          </ScrollView>

          <View style={styles.telemetryStrip}>
            <View style={styles.statBadge}>
              <Text style={styles.statBadgeLabel}>TIEMPO</Text>
              <Text style={[styles.statBadgeValue, { color: PsychoPalette.cyan }]}>
                {elapsedSec.toFixed(1)}s
              </Text>
            </View>

            <View style={styles.statBadge}>
              <Text style={styles.statBadgeLabel}>ZONA [P]</Text>
              <Text
                style={[
                  styles.statBadgeValue,
                  { color: alignmentPct >= 85 ? PsychoPalette.mint : PsychoPalette.textPrimary },
                ]}>
                {alignmentPct}%
              </Text>
            </View>

            <View style={styles.statBadge}>
              <Text style={styles.statBadgeLabel}>CONOS</Text>
              <Text
                style={[
                  styles.statBadgeValue,
                  { color: collisions === 0 ? PsychoPalette.mint : PsychoPalette.redSignalBright },
                ]}>
                {collisions}
              </Text>
            </View>

            <Pressable onPress={() => resetScenario(scenario)} style={styles.resetSimBtn}>
              <Ionicons name="refresh" size={13} color={PsychoPalette.bgPrimary} />
              <Text style={styles.resetSimBtnText}>REINICIAR</Text>
            </Pressable>
          </View>
        </View>

        {/* ==================== ESCENARIO 3D ESTILO IMAGEN DE REFERENCIA ==================== */}
        <View
          style={[
            styles.viewportContainer,
            collisionFlash && { borderColor: PsychoPalette.redSignalBright },
            parkedSuccess && { borderColor: PsychoPalette.mint },
          ]}>
          <Svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${VIEW3D_W} ${VIEW3D_H}`}
            preserveAspectRatio="none">
            <Defs>
              {/* Cielo azul diurno brillante igual a la imagen */}
              <LinearGradient id="daySkyGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#0284C7" />
                <Stop offset="0.6" stopColor="#38BDF8" />
                <Stop offset="1" stopColor="#BAE6FD" />
              </LinearGradient>

              {/* Pavimento de cemento gris de la explanada */}
              <LinearGradient id="concreteFloorGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#94A3B8" />
                <Stop offset="0.5" stopColor="#78879B" />
                <Stop offset="1" stopColor="#64748B" />
              </LinearGradient>

              {/* Gradiente perlado de la carrocería del Sedán Blanco */}
              <LinearGradient id="whiteCarBodyGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#FFFFFF" />
                <Stop offset="0.65" stopColor="#F1F5F9" />
                <Stop offset="1" stopColor="#CBD5E1" />
              </LinearGradient>
            </Defs>

            {/* 1. CIELO DIURNO Y RASCACIELOS DE FONDO (COMO EN LA IMAGEN) */}
            <Rect x={0} y={0} width={VIEW3D_W} height={HORIZON_Y} fill="url(#daySkyGrad)" />

            {/* Rascacielos 1 (Izquierda) */}
            <Rect x={12} y={8} width={96} height={HORIZON_Y - 8} fill="#94A3B8" stroke="#475569" strokeWidth={1.5} />
            {[18, 32, 46, 60, 74, 88].map((wy) => (
              <Line key={wy} x1={18} y1={wy} x2={102} y2={wy} stroke="#E2E8F0" strokeWidth={4} strokeDasharray="10 4" />
            ))}

            {/* Rascacielos 2 (Torre Alta Central-Izquierda) */}
            <Rect x={135} y={2} width={118} height={HORIZON_Y - 2} fill="#64748B" stroke="#334155" strokeWidth={1.5} />
            {[14, 26, 38, 50, 62, 74, 86, 98].map((wy) => (
              <Line key={wy} x1={142} y1={wy} x2={246} y2={wy} stroke="#BAE6FD" strokeWidth={3.5} strokeDasharray="12 5" />
            ))}

            {/* Edificio Blanco Central */}
            <Rect x={268} y={26} width={72} height={HORIZON_Y - 26} fill="#E2E8F0" stroke="#94A3B8" strokeWidth={1} />
            {[36, 48, 60, 72, 84, 96].map((wy) => (
              <Line key={wy} x1={274} y1={wy} x2={334} y2={wy} stroke="#64748B" strokeWidth={3} strokeDasharray="6 4" />
            ))}

            {/* Rascacielos 3 y 4 (Derecha con sombra diagonal como en la imagen) */}
            <Rect x={485} y={4} width={110} height={HORIZON_Y - 4} fill="#94A3B8" stroke="#475569" strokeWidth={1.5} />
            <Polygon points={`515,4 595,4 595,${HORIZON_Y} 495,${HORIZON_Y}`} fill="rgba(30, 41, 59, 0.45)" />
            <Rect x={605} y={10} width={105} height={HORIZON_Y - 10} fill="#64748B" stroke="#334155" strokeWidth={1.5} />

            {/* Tienda Roja "Stop Shop / AutoTest" en el horizonte (igual a la imagen) */}
            <Rect x={252} y={78} width={225} height={44} fill="#334155" stroke="#1E293B" strokeWidth={1.5} />
            <Rect x={248} y={74} width={233} height={15} rx={2} fill="#EF4444" stroke="#FFFFFF" strokeWidth={1} />
            <SvgText x={295} y={85} fill="#FFFFFF" fontSize="10" fontWeight="bold">
              Stop Shop • AutoTest
            </SvgText>

            {/* Muro perimetral con pilares beige y rejas */}
            <Rect x={0} y={HORIZON_Y - 14} width={VIEW3D_W} height={16} fill="#C2B280" stroke="#78716C" strokeWidth={1} />

            {/* 2. PISO DE CEMENTO GRIS DE LA EXPLANADA */}
            <Rect
              x={0}
              y={HORIZON_Y}
              width={VIEW3D_W}
              height={VIEW3D_H - HORIZON_Y}
              fill="url(#concreteFloorGrad)"
            />
            {world3D.concretePlaza ? (
              <Polygon points={world3D.concretePlaza.pointsStr} fill="url(#concreteFloorGrad)" />
            ) : null}

            {/* Líneas blancas de estacionamiento */}
            {world3D.whiteBayLines.map((pts, i) => (
              <Polygon key={i} points={pts} fill="rgba(255, 255, 255, 0.65)" />
            ))}

            {/* 3. HUELLAS DE NEUMÁTICOS SOBRE EL PAVIMENTO */}
            {world3D.projectedTracks.map((pts, i) => (
              <Polygon key={i} points={pts} fill="rgba(51, 65, 85, 0.38)" />
            ))}

            {/* 4. FLECHAS AMARILLAS PINTADAS EN EL SUELO (COMO EN LA IMAGEN) */}
            {world3D.yellowArrows.map((pts, i) => (
              <Polygon
                key={i}
                points={pts}
                fill="#FACC15"
                stroke="#CA8A04"
                strokeWidth={1}
              />
            ))}

            {/* 5. CUADRO AZUL DE PARQUEO [ P ] EN EL PISO CON BORDE BLANCO */}
            {world3D.blueParkingBox ? (
              <G>
                <Polygon
                  points={world3D.blueParkingBox.pointsStr}
                  fill={parkedSuccess ? '#10B981' : '#0284C7'}
                  stroke="#FFFFFF"
                  strokeWidth={3.5}
                />
                <SvgText
                  x={world3D.blueParkingBox.centerSx}
                  y={world3D.blueParkingBox.centerSy + 8}
                  fill="#FFFFFF"
                  fontSize="26"
                  fontWeight="bold"
                  textAnchor="middle">
                  P
                </SvgText>
              </G>
            ) : null}

            {/* 6. LETRERO VERTICAL AZUL [ P ] SOBRE POSTE METÁLICO (COMO EN LA IMAGEN) */}
            {world3D.signBase && world3D.signTop ? (
              <G>
                <Line
                  x1={world3D.signBase.sx}
                  y1={world3D.signBase.sy}
                  x2={world3D.signTop.sx}
                  y2={world3D.signTop.sy}
                  stroke="#E2E8F0"
                  strokeWidth={5}
                />
                <Rect
                  x={world3D.signTop.sx - 24}
                  y={world3D.signTop.sy - 46}
                  width={48}
                  height={48}
                  rx={5}
                  fill="#0284C7"
                  stroke="#FFFFFF"
                  strokeWidth={2.5}
                />
                <SvgText
                  x={world3D.signTop.sx}
                  y={world3D.signTop.sy - 12}
                  fill="#FFFFFF"
                  fontSize="32"
                  fontWeight="bold"
                  textAnchor="middle">
                  P
                </SvgText>
              </G>
            ) : null}

            {/* 7. CONOS DE TRÁFICO NARANJAS CON FRANJAS BLANCAS EN 3D */}
            {world3D.projectedCones.map((c, idx) => {
              const s = Math.max(0.38, Math.min(1.65, c.scale * 0.42));
              const cx = c.sx;
              const cy = c.sy;
              return (
                <G key={idx}>
                  {/* Sombra y base roja/naranja del cono */}
                  <Ellipse cx={cx} cy={cy + 2 * s} rx={15 * s} ry={6 * s} fill="rgba(15, 23, 42, 0.35)" />
                  <Ellipse cx={cx} cy={cy} rx={14 * s} ry={5.5 * s} fill="#EA580C" stroke="#9A3412" strokeWidth={1} />
                  {/* Cuerpo cónico naranja */}
                  <Polygon
                    points={`${cx - 11 * s},${cy} ${cx - 3.5 * s},${cy - 34 * s} ${cx + 3.5 * s},${cy - 34 * s} ${cx + 11 * s},${cy}`}
                    fill="#F97316"
                    stroke="#C2410C"
                    strokeWidth={0.8}
                  />
                  {/* Franja blanca reflectiva inferior */}
                  <Polygon
                    points={`${cx - 9 * s},${cy - 7 * s} ${cx - 7 * s},${cy - 14 * s} ${cx + 7 * s},${cy - 14 * s} ${cx + 9 * s},${cy - 7 * s}`}
                    fill="#FFFFFF"
                  />
                  {/* Franja blanca reflectiva superior */}
                  <Polygon
                    points={`${cx - 6 * s},${cy - 20 * s} ${cx - 4.3 * s},${cy - 27 * s} ${cx + 4.3 * s},${cy - 27 * s} ${cx + 6 * s},${cy - 20 * s}`}
                    fill="#FFFFFF"
                  />
                </G>
              );
            })}

            {/* 8. SEDÁN BLANCO 3D EN TERCERA PERSONA (IDÉNTICO AL CARRO "KNIGHTS" DE LA IMAGEN) */}
            <G transform={`translate(${VIEW3D_W * 0.56}, ${VIEW3D_H * 0.67}) rotate(${steerAngleDeg * 0.28})`}>
              {/* Huellas de llantas inmediatas bajo el carro */}
              <Line x1={-66} y1={15} x2={-38} y2={140} stroke="rgba(51, 65, 85, 0.42)" strokeWidth={18} strokeDasharray="4 2" />
              <Line x1={68} y1={15} x2={96} y2={140} stroke="rgba(51, 65, 85, 0.42)" strokeWidth={18} strokeDasharray="4 2" />

              {/* Sombra 3D bajo el Sedán Blanco */}
              <Polygon
                points="-96,-82 78,-88 106,58 -82,66"
                fill="rgba(15, 23, 42, 0.48)"
              />

              {/* Rueda Delantera Izquierda (Gira con el volante) */}
              <G transform={`translate(-84, -52) rotate(${steerAngleDeg * 0.65})`}>
                <Rect x={-8} y={-20} width={16} height={40} rx={5} fill="#0F172A" stroke="#94A3B8" strokeWidth={2} />
                <Ellipse cx={-6} cy={0} rx={4} ry={13} fill="#E2E8F0" />
              </G>

              {/* Rueda Trasera Izquierda */}
              <G transform="translate(-76, 26)">
                <Rect x={-8} y={-20} width={16} height={40} rx={5} fill="#0F172A" stroke="#94A3B8" strokeWidth={2} />
                <Ellipse cx={-6} cy={0} rx={4} ry={13} fill="#E2E8F0" />
              </G>

              {/* Carrocería Principal del Sedán Blanco */}
              <Polygon
                points="-82,-76 66,-82 94,42 84,58 -68,64 -82,46"
                fill="url(#whiteCarBodyGrad)"
                stroke="#94A3B8"
                strokeWidth={2}
              />

              {/* Costado Izquierdo en perspectiva con ventanas laterales y espejo */}
              <Polygon
                points="-82,-70 -56,-84 -42,10 -74,38"
                fill="#E2E8F0"
                stroke="#94A3B8"
                strokeWidth={1.5}
              />
              {/* Ventanas laterales izquierdas polarizadas */}
              <Polygon
                points="-74,-58 -54,-72 -48,-12 -70,4"
                fill="#0F172A"
                stroke="#CBD5E1"
                strokeWidth={2}
              />
              <Line x1={-61} y1={-66} x2={-59} y2={-4} stroke="#E2E8F0" strokeWidth={2.5} />

              {/* Espejo retrovisor lateral izquierdo del sedán */}
              <Ellipse cx={-82} cy={-56} rx={9} ry={5} fill="#FFFFFF" stroke="#64748B" strokeWidth={1.5} />

              {/* Techo Blanco con Sunroof Negro Panorámico */}
              <Polygon
                points="-54,-78 48,-82 64,-8 -42,-4"
                fill="#F8FAFC"
                stroke="#CBD5E1"
                strokeWidth={1.5}
              />
              {/* Quemacocos / Sunroof Negro */}
              <Polygon
                points="-44,-70 36,-73 42,-48 -40,-45"
                fill="#0F172A"
                stroke="#475569"
                strokeWidth={1.5}
              />

              {/* Parabrisas Trasero Polarizado */}
              <Polygon
                points="-40,-38 56,-42 70,4 -32,8"
                fill="#1E293B"
                stroke="#0F172A"
                strokeWidth={3}
              />

              {/* Faros Traseros Rojos LED (Izquierdo y Derecho como en la imagen) */}
              <Polygon
                points="-66,18 -26,22 -24,36 -66,34"
                fill={brakeActive ? '#FF1E42' : '#DC2626'}
                stroke="#7F1D1D"
                strokeWidth={1.5}
              />
              <Polygon
                points="-60,22 -32,25 -32,31 -60,29"
                fill={gear === 'R' ? '#FFFFFF' : leftBlinkOn ? '#FACC15' : '#F97316'}
              />

              <Polygon
                points="46,14 86,10 88,24 48,28"
                fill={brakeActive ? '#FF1E42' : '#DC2626'}
                stroke="#7F1D1D"
                strokeWidth={1.5}
              />
              <Polygon
                points="52,18 80,15 80,21 52,24"
                fill={gear === 'R' ? '#FFFFFF' : rightBlinkOn ? '#FACC15' : '#F97316'}
              />

              {/* Placa Trasera "KNIGHTS" idéntica a la imagen */}
              <Rect x={-16} y={24} width={52} height={16} rx={2} fill="#FFFFFF" stroke="#1E293B" strokeWidth={1.5} />
              <SvgText x={10} y={36} fill="#0F172A" fontSize="9.5" fontWeight="bold" textAnchor="middle">
                KNIGHTS
              </SvgText>

              {/* Parachoques trasero con moldura negra y doble escape */}
              <Line x1={-62} y1={48} x2={82} y2={42} stroke="#1E293B" strokeWidth={3.5} />
              <Rect x={-64} y={54} width={148} height={8} rx={4} fill="#1E293B" />
              <Ellipse cx={-48} cy={58} rx={7} ry={3} fill="#94A3B8" stroke="#0F172A" strokeWidth={1} />
              <Ellipse cx={68} cy={54} rx={7} ry={3} fill="#94A3B8" stroke="#0F172A" strokeWidth={1} />
            </G>
          </Svg>

          {/* ESPEJO RETROVISOR SUPERIOR Y BARRA RÁPIDA DE MANDOS DE CABINA */}
          <View style={styles.topCabinOverlay} pointerEvents="box-none">
            {/* Espejo Retrovisor con sensor de reversa */}
            <View style={styles.rearMirrorPill}>
              <Ionicons name="eye-outline" size={13} color={PsychoPalette.mint} />
              <Text style={styles.rearMirrorText}>
                ESPEJO RETROVISOR: {rearDistMeters}m • {speedKmh} km/h
              </Text>
            </View>

            {/* Botones rápidos de mandos del carro */}
            <View style={styles.quickCarCmds}>
              <Pressable
                onPress={() => {
                  setTurnSignal((p) => (p === 'LEFT' ? 'NONE' : 'LEFT'));
                  playLeftSignal();
                }}
                style={[styles.miniCmdBtn, leftBlinkOn && styles.miniCmdBtnActive]}>
                <Text style={styles.miniCmdText}>◀</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setTurnSignal((p) => (p === 'HAZARD' ? 'NONE' : 'HAZARD'));
                  playError();
                }}
                style={[styles.miniCmdBtn, turnSignal === 'HAZARD' && styles.miniCmdBtnDanger]}>
                <Ionicons name="warning" size={12} color="#FFFFFF" />
              </Pressable>

              <Pressable
                onPress={() => {
                  setTurnSignal((p) => (p === 'RIGHT' ? 'NONE' : 'RIGHT'));
                  playRightSignal();
                }}
                style={[styles.miniCmdBtn, rightBlinkOn && styles.miniCmdBtnActive]}>
                <Text style={styles.miniCmdText}>▶</Text>
              </Pressable>

              <Pressable
                onPress={() => setLightsOn((p) => !p)}
                style={[styles.miniCmdBtn, lightsOn && styles.miniCmdBtnCyan]}>
                <Ionicons name="flashlight" size={12} color="#FFFFFF" />
              </Pressable>

              <Pressable
                onPress={() => setSeatbeltOn((p) => !p)}
                style={[styles.miniCmdBtn, seatbeltOn && styles.miniCmdBtnCyan]}>
                <Ionicons name="shield-checkmark" size={12} color="#FFFFFF" />
              </Pressable>

              <Pressable
                onPress={() => setHandbrakeOn((p) => !p)}
                style={[styles.miniCmdBtn, handbrakeOn && styles.miniCmdBtnDanger]}>
                <Text style={styles.miniCmdText}>(P)</Text>
              </Pressable>
            </View>
          </View>

          {/* ==================== DERECHA: PALANCA DE CAMBIOS 3D METÁLICA (COMO EN LA IMAGEN) ==================== */}
          <View style={styles.shifterRightContainer}>
            <Pressable
              onPress={() => {
                const nextG = gear === 'D' ? 'R' : 'D';
                setGear(nextG);
                playRightSignal();
              }}
              style={styles.shifterPressable}
              accessibilityRole="button"
              accessibilityLabel="Palanca de cambios Avance y Reversa">
              <Svg width={96} height={122} viewBox="0 0 96 122">
                {/* Base circular metálica cromada con ranuras en H */}
                <Ellipse cx={48} cy={92} rx={38} ry={22} fill="#CBD5E1" stroke="#475569" strokeWidth={2.5} />
                <Ellipse cx={48} cy={90} rx={32} ry={17} fill="#94A3B8" stroke="#1E293B" strokeWidth={1.5} />
                {/* Rejilla en H negra */}
                <Path
                  d="M 30 82 L 30 98 M 48 80 L 48 100 M 66 82 L 66 98 M 30 90 L 66 90"
                  stroke="#0F172A"
                  strokeWidth={4.5}
                  strokeLinecap="round"
                />

                {/* Barra cromada de la palanca */}
                <Line
                  x1={48}
                  y1={90}
                  x2={48}
                  y2={gear === 'D' ? 42 : 58}
                  stroke="#E2E8F0"
                  strokeWidth={9}
                  strokeLinecap="round"
                />

                {/* Pomo esférico negro 3D con diagrama R 2 4 / 1 3 5 arriba (igual a la imagen) */}
                <G transform={`translate(0, ${gear === 'D' ? 0 : 14})`}>
                  <Circle cx={48} cy={34} r={28} fill="#1E293B" stroke="#94A3B8" strokeWidth={2.5} />
                  <Circle cx={48} cy={28} r={20} fill="#0F172A" stroke="#CBD5E1" strokeWidth={1.5} />
                  <SvgText x={48} y={21} fill="#FFFFFF" fontSize="7.5" fontWeight="bold" textAnchor="middle">
                    R  2  4
                  </SvgText>
                  <Line x1={35} y1={26} x2={61} y2={26} stroke="#FFFFFF" strokeWidth={1.2} />
                  <SvgText x={48} y={35} fill="#FFFFFF" fontSize="7.5" fontWeight="bold" textAnchor="middle">
                    1  3  5
                  </SvgText>
                </G>
              </Svg>
              <View
                style={[
                  styles.gearStateBadge,
                  gear === 'D' ? styles.gearStateBadgeD : styles.gearStateBadgeR,
                ]}>
                <Text style={styles.gearStateBadgeText}>
                  {gear === 'D' ? 'MARCHA: D (AVANCE)' : 'MARCHA: R (REVERSA)'}
                </Text>
              </View>
            </Pressable>
          </View>

          {/* ==================== CONTROLES INFERIORES IDÉNTICOS A LA IMAGEN: VOLANTE 3D + PEDALES METÁLICOS ==================== */}
          <View style={styles.bottomControlsOverlay} pointerEvents="box-none">
            {/* ESQUINA INFERIOR IZQUIERDA: VOLANTE DEPORTIVO 3D NEGRO DE 3 RADIOS */}
            <View style={styles.steeringWheelZone}>
              <GestureDetector gesture={steeringWheelGesture}>
                <View style={styles.steeringWheelTouchBox}>
                  <Svg
                    width={126}
                    height={126}
                    viewBox="0 0 130 130"
                    style={{ transform: [{ rotate: `${wheelVisualRotateDeg}deg` }] }}>
                    {/* Aro exterior del volante negro con relieve */}
                    <Circle
                      cx={65}
                      cy={65}
                      r={54}
                      fill="none"
                      stroke="#0F172A"
                      strokeWidth={15}
                    />
                    <Circle
                      cx={65}
                      cy={65}
                      r={54}
                      fill="none"
                      stroke="#334155"
                      strokeWidth={4}
                    />
                    {/* 3 Radios deportivos plateados/grises (como el volante de la imagen) */}
                    <Polygon
                      points="16,58 46,52 46,74 18,74"
                      fill="#64748B"
                      stroke="#1E293B"
                      strokeWidth={1.5}
                    />
                    <Polygon
                      points="114,58 84,52 84,74 112,74"
                      fill="#64748B"
                      stroke="#1E293B"
                      strokeWidth={1.5}
                    />
                    <Polygon
                      points="54,82 76,82 70,116 60,116"
                      fill="#64748B"
                      stroke="#1E293B"
                      strokeWidth={1.5}
                    />
                    {/* Centro acolchado del volante y emblema metálico */}
                    <Circle
                      cx={65}
                      cy={65}
                      r={24}
                      fill="#1E293B"
                      stroke="#94A3B8"
                      strokeWidth={2}
                    />
                    <Circle cx={65} cy={65} r={8} fill="#CBD5E1" />
                  </Svg>
                </View>
              </GestureDetector>
              <View style={styles.wheelAnglePill}>
                <Text style={styles.wheelAnglePillText}>
                  GIRO: {steerAngleDeg > 0 ? `+${steerAngleDeg}°` : `${steerAngleDeg}°`}
                </Text>
              </View>
            </View>

            {/* ESQUINA INFERIOR DERECHA: PEDALES METÁLICOS PERFORADOS (FRENO HORIZONTAL + ACELERADOR VERTICAL) */}
            <View style={styles.metallicPedalsRow}>
              {/* PEDAL DE FRENO METÁLICO PERFORADO (IZQUIERDA) */}
              <Pressable
                onPressIn={() => setBrakeActive(true)}
                onPressOut={() => setBrakeActive(false)}
                style={[
                  styles.metallicBrakePressable,
                  brakeActive && { transform: [{ scale: 0.93 }] },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Pedal de Freno">
                <Svg width={94} height={64} viewBox="0 0 94 64">
                  <Rect
                    x={3}
                    y={4}
                    width={88}
                    height={56}
                    rx={10}
                    fill={brakeActive ? '#FCA5A5' : '#E2E8F0'}
                    stroke="#1E293B"
                    strokeWidth={2.5}
                  />
                  {/* Perforaciones circulares antideslizantes */}
                  {[16, 30, 44, 58, 72].map((cx) =>
                    [16, 30].map((cy) => (
                      <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={3.5} fill="#334155" />
                    ))
                  )}
                  <Circle cx={16} cy={44} r={3.5} fill="#334155" />
                  <Circle cx={30} cy={44} r={3.5} fill="#334155" />
                  {/* Recorte inferior derecho igual al pedal de la imagen */}
                  <Polygon
                    points="46,38 82,38 82,54 38,54"
                    fill="#64748B"
                    stroke="#1E293B"
                    strokeWidth={1.5}
                  />
                </Svg>
                <Text style={styles.pedalCaption}>FRENO</Text>
              </Pressable>

              {/* PEDAL DE ACELERADOR METÁLICO VERTICAL PERFORADO (DERECHA) */}
              <Pressable
                onPressIn={() => setGasActive(true)}
                onPressOut={() => setGasActive(false)}
                style={[
                  styles.metallicGasPressable,
                  gasActive && { transform: [{ scale: 0.93 }] },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Pedal de Acelerador">
                <Svg width={62} height={106} viewBox="0 0 62 106">
                  <Rect
                    x={6}
                    y={4}
                    width={50}
                    height={98}
                    rx={10}
                    fill={gasActive ? '#86EFAC' : '#E2E8F0'}
                    stroke="#1E293B"
                    strokeWidth={2.5}
                  />
                  {/* Perforaciones circulares antideslizantes */}
                  {[20, 32, 44].map((cx) =>
                    [18, 32, 46, 60].map((cy) => (
                      <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={3.5} fill="#334155" />
                    ))
                  )}
                  {/* Recorte triangular inferior izquierdo igual al pedal de la imagen */}
                  <Polygon
                    points="12,68 42,94 12,94"
                    fill="#64748B"
                    stroke="#1E293B"
                    strokeWidth={1.5}
                  />
                </Svg>
                <Text style={styles.pedalCaption}>ACELERADOR</Text>
              </Pressable>
            </View>
          </View>

          {/* MODAL DE ÉXITO AL ESTACIONAR DENTRO DE LA ZONA AZUL [P] */}
          {parkedSuccess ? (
            <View style={styles.successOverlay}>
              <View style={styles.successModalCard}>
                <Ionicons name="checkmark-done-circle" size={46} color={PsychoPalette.mint} />
                <Text style={styles.successModalTitle}>¡PRUEBA DE CONDUCCIÓN 3D SUPERADA!</Text>
                <Text style={styles.successModalDesc}>
                  Estacionó el Sedán Blanco dentro de la Zona [P] en {elapsedSec.toFixed(1)}s con{' '}
                  {collisions} {collisions === 1 ? 'cono tocado' : 'conos tocados'}.
                </Text>
                <View style={styles.successModalActions}>
                  <Pressable onPress={() => resetScenario(scenario)} style={styles.modalRepeatBtn}>
                    <Ionicons name="refresh" size={15} color={PsychoPalette.bgPrimary} />
                    <Text style={styles.modalBtnText}>REPETIR NIVEL</Text>
                  </Pressable>
                  <Pressable onPress={() => router.push('/')} style={styles.modalDashboardBtn}>
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    maxWidth: 980,
    width: '100%',
    alignSelf: 'center',
  },
  topHudBar: {
    backgroundColor: PsychoPalette.bgSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    padding: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  scenarioTabs: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  scenarioTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: PsychoPalette.bgPanel,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
  },
  preopTabBadge: {
    borderColor: PsychoPalette.amberWarning,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  scenarioTabActive: {
    backgroundColor: PsychoPalette.cyanDim,
    borderColor: PsychoPalette.cyan,
  },
  scenarioTabText: {
    color: PsychoPalette.textSecondary,
    fontSize: 9.5,
    fontWeight: '800',
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
    paddingVertical: 3,
    alignItems: 'center',
  },
  statBadgeLabel: {
    color: PsychoPalette.textMuted,
    fontSize: 7.5,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
  statBadgeValue: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  resetSimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PsychoPalette.mint,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 7,
  },
  resetSimBtnText: {
    color: PsychoPalette.bgPrimary,
    fontSize: 9.5,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  viewportContainer: {
    flex: 1,
    backgroundColor: '#64748B',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: PsychoPalette.borderSubtle,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 350,
  },
  topCabinOverlay: {
    position: 'absolute',
    top: 8,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  rearMirrorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderWidth: 1.5,
    borderColor: PsychoPalette.mint,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  rearMirrorText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  quickCarCmds: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  miniCmdBtn: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: '#64748B',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
  },
  miniCmdBtnActive: {
    backgroundColor: PsychoPalette.amberWarning,
    borderColor: '#FFFFFF',
  },
  miniCmdBtnCyan: {
    backgroundColor: '#0284C7',
    borderColor: '#FFFFFF',
  },
  miniCmdBtnDanger: {
    backgroundColor: '#DC2626',
    borderColor: '#FFFFFF',
  },
  miniCmdText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  shifterRightContainer: {
    position: 'absolute',
    top: 56,
    right: 12,
    alignItems: 'center',
  },
  shifterPressable: {
    alignItems: 'center',
  },
  gearStateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: -4,
  },
  gearStateBadgeD: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderColor: PsychoPalette.mint,
  },
  gearStateBadgeR: {
    backgroundColor: 'rgba(153, 27, 27, 0.92)',
    borderColor: '#FACC15',
  },
  gearStateBadgeText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  bottomControlsOverlay: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  steeringWheelZone: {
    alignItems: 'center',
    gap: 4,
  },
  steeringWheelTouchBox: {
    width: 128,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelAnglePill: {
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: PsychoPalette.cyan,
  },
  wheelAnglePillText: {
    color: PsychoPalette.cyan,
    fontSize: 9,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  metallicPedalsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  metallicBrakePressable: {
    alignItems: 'center',
    gap: 2,
  },
  metallicGasPressable: {
    alignItems: 'center',
    gap: 2,
  },
  pedalCaption: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '900',
    fontFamily: Fonts.mono,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  successOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5, 10, 20, 0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 40,
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
    fontSize: 16,
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
