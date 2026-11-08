import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
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

// Círculo del joystick más pequeño y compacto según lo solicitado
const JOYSTICK_RADIUS = 28;

// Dimensiones del viewport 3D SVG
const VIEW3D_W = 720;
const VIEW3D_H = 360;
const HORIZON_Y = 118;
const FOCAL_LEN = 310;

interface ObstacleBox {
  x: number;
  y: number;
  w: number;
  h: number;
  height3D?: number;
  kind?: 'car' | 'wall' | 'zone';
  color?: string;
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
  obstacles: ObstacleBox[];
}

// Conserva los diseños de los 3 niveles originales realizados ahora en entorno 3D de carretera
const SCENARIOS: ScenarioConfig[] = [
  {
    id: 'bay',
    title: 'Nivel 1: Parqueo en Batería 3D (90°)',
    shortLabel: '1. BATERÍA 90° (3D)',
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
      { x: 185, y: 34, w: 68, h: 80, height3D: 22, kind: 'car', color: '#DC2626', label: 'VEH-A' },
      { x: 338, y: 34, w: 68, h: 80, height3D: 22, kind: 'car', color: '#D97706', label: 'VEH-B' },
      {
        x: 430,
        y: 34,
        w: 135,
        h: 80,
        height3D: 16,
        kind: 'zone',
        color: '#334155',
        label: 'ZONA RESERVADA',
      },
    ],
  },
  {
    id: 'parallel',
    title: 'Nivel 2: Parqueo en Paralelo 3D (Cordón)',
    shortLabel: '2. PARALELO (3D)',
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
      { x: 145, y: 44, w: 94, h: 46, height3D: 22, kind: 'car', color: '#0284C7', label: 'VEH-1' },
      { x: 358, y: 44, w: 94, h: 46, height3D: 22, kind: 'car', color: '#7C3AED', label: 'VEH-2' },
    ],
  },
  {
    id: 'garage',
    title: 'Nivel 3: Eslalon y Garaje con Obstáculos 3D',
    shortLabel: '3. ESLALON 3D',
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
      { x: 240, y: 175, w: 42, h: 90, height3D: 28, kind: 'wall', color: '#B45309', label: 'MURO 1' },
      { x: 365, y: 60, w: 42, h: 95, height3D: 28, kind: 'wall', color: '#B45309', label: 'MURO 2' },
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
  z: number; // height above ground
}

interface ProjectedPt {
  sx: number;
  sy: number;
  depth: number;
}

/**
 * Transforma un punto del mundo (x, y, z) a coordenadas de pantalla en perspectiva 3D
 * respecto a una cámara posicionada en (camX, camY, camZ) mirando en dirección camYaw
 */
function projectPoint3D(
  pt: Pt3D,
  camX: number,
  camY: number,
  camZ: number,
  camYaw: number,
  pitchOffset: number = 0
): ProjectedPt | null {
  const dx = pt.x - camX;
  const dy = pt.y - camY;
  const cos = Math.cos(camYaw);
  const sin = Math.sin(camYaw);

  // forward = a lo largo del eje de visión, right = lateral derecha
  const forward = dx * cos + dy * sin;
  const right = -dx * sin + dy * cos;

  const clampedForward = Math.max(8, forward);
  if (forward < 6) {
    return null;
  }

  const scale = FOCAL_LEN / clampedForward;
  const sx = VIEW3D_W / 2 + right * scale;
  const sy = HORIZON_Y + pitchOffset + (camZ - pt.z) * scale;

  return { sx, sy, depth: clampedForward };
}

/**
 * Proyecta un polígono 3D recortando los vértices detrás de la cámara para evitar distorsiones
 */
function projectPolygon3D(
  pts: Pt3D[],
  camX: number,
  camY: number,
  camZ: number,
  camYaw: number,
  pitchOffset: number = 0
): { pointsStr: string; avgDepth: number; centerSx: number; centerSy: number } | null {
  const cos = Math.cos(camYaw);
  const sin = Math.sin(camYaw);
  const nearPlane = 10;

  // Transformar a espacio de cámara (forward, right, z)
  const camPts = pts.map((p) => {
    const dx = p.x - camX;
    const dy = p.y - camY;
    return {
      fwd: dx * cos + dy * sin,
      right: -dx * sin + dy * cos,
      z: p.z,
    };
  });

  // Recorte (clipping) contra el plano cercano nearPlane
  const clipped: { fwd: number; right: number; z: number }[] = [];
  for (let i = 0; i < camPts.length; i++) {
    const curr = camPts[i];
    const prev = camPts[(i + camPts.length - 1) % camPts.length];
    const currInside = curr.fwd >= nearPlane;
    const prevInside = prev.fwd >= nearPlane;

    if (currInside !== prevInside) {
      const t = (nearPlane - prev.fwd) / (curr.fwd - prev.fwd);
      clipped.push({
        fwd: nearPlane,
        right: prev.right + t * (curr.right - prev.right),
        z: prev.z + t * (curr.z - prev.z),
      });
    }
    if (currInside) {
      clipped.push(curr);
    }
  }

  if (clipped.length < 3) return null;

  let sumDepth = 0;
  let sumX = 0;
  let sumY = 0;
  const screenCoords = clipped.map((cp) => {
    const scale = FOCAL_LEN / cp.fwd;
    const sx = VIEW3D_W / 2 + cp.right * scale;
    const sy = HORIZON_Y + pitchOffset + (camZ - cp.z) * scale;
    sumDepth += cp.fwd;
    sumX += sx;
    sumY += sy;
    return `${sx.toFixed(1)},${sy.toFixed(1)}`;
  });

  return {
    pointsStr: screenCoords.join(' '),
    avgDepth: sumDepth / clipped.length,
    centerSx: sumX / clipped.length,
    centerSy: sumY / clipped.length,
  };
}

export default function ManeuversSimulatorScreen() {
  const { preoperationalResult, setManeuverResult } = useEvaluation();
  const { playLeftSignal, playRightSignal, playSuccess, playError } = usePsychAudio();

  const [scenario, setScenario] = useState<ScenarioConfig>(SCENARIOS[0]);
  const [cameraMode, setCameraMode] = useState<'CHASE_3D' | 'COCKPIT_3D'>('CHASE_3D');

  const [carState, setCarState] = useState({
    x: SCENARIOS[0].startX,
    y: SCENARIOS[0].startY,
    angleRad: (SCENARIOS[0].startAngleDeg * Math.PI) / 180,
    speed: 0,
    steerRad: 0,
  });

  // Mandos y controles de un carro normal en la cabina
  const [engineOn, setEngineOn] = useState<boolean>(true);
  const [seatbeltOn, setSeatbeltOn] = useState<boolean>(true);
  const [handbrakeOn, setHandbrakeOn] = useState<boolean>(false);
  const [headlightMode, setHeadlightMode] = useState<'OFF' | 'LOW' | 'HIGH'>('LOW');
  const [turnSignal, setTurnSignal] = useState<'NONE' | 'LEFT' | 'RIGHT' | 'HAZARD'>('NONE');
  const [wipersOn, setWipersOn] = useState<boolean>(false);
  const [blinkTick, setBlinkTick] = useState<boolean>(true);
  const [wiperAngle, setWiperAngle] = useState<number>(0);
  const [cabinAlert, setCabinAlert] = useState<string | null>(null);

  const [gear, setGear] = useState<'D' | 'R'>('D');
  const [joystickKnob, setJoystickKnob] = useState({ x: 0, y: 0 });
  const [gasActive, setGasActive] = useState(false);
  const [brakeActive, setBrakeActive] = useState(false);

  const [elapsedSec, setElapsedSec] = useState(0);
  const [collisions, setCollisions] = useState(0);
  const [alignmentPct, setAlignmentPct] = useState(0);
  const [parkedSuccess, setParkedSuccess] = useState(false);
  const [collisionFlash, setCollisionFlash] = useState(false);

  const physicsRef = useRef({
    x: SCENARIOS[0].startX,
    y: SCENARIOS[0].startY,
    angleRad: (SCENARIOS[0].startAngleDeg * Math.PI) / 180,
    speed: 0,
    steerRad: 0,
    gas: false,
    brake: false,
    gear: 'D' as 'D' | 'R',
    engineOn: true,
    handbrakeOn: false,
    collisions: 0,
    startTime: 0,
    lastCollisionTime: 0,
    completed: false,
  });

  useEffect(() => {
    const normalizedSteer = joystickKnob.x / JOYSTICK_RADIUS;
    physicsRef.current.steerRad = normalizedSteer * MAX_STEER_RAD;
  }, [joystickKnob]);

  useEffect(() => {
    physicsRef.current.gas = gasActive;
    physicsRef.current.brake = brakeActive;
    physicsRef.current.gear = gear;
    physicsRef.current.engineOn = engineOn;
    physicsRef.current.handbrakeOn = handbrakeOn;
  }, [gasActive, brakeActive, gear, engineOn, handbrakeOn]);

  // Animación de direccionales y limpiaparabrisas
  useEffect(() => {
    if (turnSignal === 'NONE' && !wipersOn) return;
    const interval = setInterval(() => {
      if (turnSignal !== 'NONE') {
        setBlinkTick((prev) => !prev);
      }
      if (wipersOn) {
        setWiperAngle((prev) => (prev === 0 ? 48 : 0));
      }
    }, 380);
    return () => clearInterval(interval);
  }, [turnSignal, wipersOn]);

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
      engineOn: true,
      handbrakeOn: false,
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
    setHandbrakeOn(false);
    setEngineOn(true);
    setJoystickKnob({ x: 0, y: 0 });
    setGasActive(false);
    setBrakeActive(false);
    setElapsedSec(0);
    setCollisions(0);
    setAlignmentPct(0);
    setParkedSuccess(false);
    setCollisionFlash(false);
    setCabinAlert(null);
  }, []);

  const handleSelectScenario = useCallback(
    (sc: ScenarioConfig) => {
      setScenario(sc);
      resetScenario(sc);
    },
    [resetScenario]
  );

  // Motor físico de conducción a 60 FPS
  useEffect(() => {
    let rafId: number;
    let lastTime = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const p = physicsRef.current;
      if (p.startTime === 0) {
        p.startTime = now;
      }
      if (!p.completed) {
        const elapsed = Number(((now - p.startTime) / 1000).toFixed(1));
        setElapsedSec(elapsed);

        const maxForwardSpeed = 115;
        const maxReverseSpeed = -78;
        const accelRate = 155;
        const brakeDecelRate = 240;
        const naturalFriction = 68;

        if (!p.engineOn) {
          p.speed = Math.abs(p.speed) < 3 ? 0 : p.speed * 0.92;
          if (p.gas) {
            setCabinAlert('¡ENCIENDA EL MOTOR (START) EN LA CABINA PARA CONDUCIR!');
          }
        } else if (p.handbrakeOn) {
          p.speed = Math.abs(p.speed) < 3 ? 0 : p.speed * 0.85;
          if (p.gas) {
            setCabinAlert('¡LIBERE EL FRENO DE MANO ((P)) PARA AVANZAR!');
          }
        } else {
          if (p.gas && !p.brake) {
            setCabinAlert(null);
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

        if (outOfBounds || hitsObstacle) {
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

  // Gesto del Joystick Compacto (Esquina Inferior Izquierda)
  const joystickGesture = Gesture.Pan()
    .runOnJS(true)
    .onChange((e) => {
      setJoystickKnob((prev) => {
        const rawX = prev.x + e.changeX;
        const rawY = prev.y + e.changeY;
        const dist = Math.hypot(rawX, rawY);
        const scale = dist > JOYSTICK_RADIUS ? JOYSTICK_RADIUS / dist : 1;
        return {
          x: rawX * scale,
          y: rawY * scale,
        };
      });
    })
    .onFinalize(() => {
      setJoystickKnob({ x: 0, y: 0 });
    });

  const carAngleDeg = (carState.angleRad * 180) / Math.PI;
  const steerAngleDeg = Math.round((carState.steerRad * 180) / Math.PI);
  const speedKmh = Math.round(Math.abs(carState.speed) * 0.32);
  const rpm = engineOn ? Math.round(850 + Math.abs(carState.speed) * 32) : 0;

  // Cálculo de la distancia trasera a obstáculos para los espejos retrovisores
  const rearProximityMeters = useMemo(() => {
    const rearX = carState.x - (CAR_LENGTH / 2) * Math.cos(carState.angleRad);
    const rearY = carState.y - (CAR_LENGTH / 2) * Math.sin(carState.angleRad);
    let minPx = 220;
    scenario.obstacles.forEach((obs) => {
      const cx = Math.max(obs.x, Math.min(rearX, obs.x + obs.w));
      const cy = Math.max(obs.y, Math.min(rearY, obs.y + obs.h));
      const d = Math.hypot(rearX - cx, rearY - cy);
      if (d < minPx) minPx = d;
    });
    return Number(Math.max(0.2, minPx / 28).toFixed(1));
  }, [carState.angleRad, carState.x, carState.y, scenario.obstacles]);

  // Construcción de la escena 3D en perspectiva
  const scene3D = useMemo(() => {
    const isChase = cameraMode === 'CHASE_3D';
    const camDistBack = isChase ? 108 : -6;
    const camZ = isChase ? 62 : 34;
    const camX = carState.x - Math.cos(carState.angleRad) * camDistBack;
    const camY = carState.y - Math.sin(carState.angleRad) * camDistBack;
    const camYaw = carState.angleRad;

    // 1. Polígono de la superficie de carretera asfaltada 3D
    const roadSlab = projectPolygon3D(
      [
        { x: 10, y: 10, z: 0 },
        { x: WORLD_W - 10, y: 10, z: 0 },
        { x: WORLD_W - 10, y: WORLD_H - 10, z: 0 },
        { x: 10, y: WORLD_H - 10, z: 0 },
      ],
      camX,
      camY,
      camZ,
      camYaw
    );

    // 2. Líneas de carril de carretera en 3D
    const laneStripes: string[] = [];
    for (let lx = 35; lx < WORLD_W - 45; lx += 55) {
      const stripe = projectPolygon3D(
        [
          { x: lx, y: 206, z: 0.2 },
          { x: lx + 30, y: 206, z: 0.2 },
          { x: lx + 30, y: 212, z: 0.2 },
          { x: lx, y: 212, z: 0.2 },
        ],
        camX,
        camY,
        camZ,
        camYaw
      );
      if (stripe) laneStripes.push(stripe.pointsStr);
    }

    // Bordillo sur de la carretera
    const southCurb = projectPolygon3D(
      [
        { x: 18, y: 342, z: 0.3 },
        { x: WORLD_W - 18, y: 342, z: 0.3 },
        { x: WORLD_W - 18, y: 348, z: 0.3 },
        { x: 18, y: 348, z: 0.3 },
      ],
      camX,
      camY,
      camZ,
      camYaw
    );

    // Bordillo norte (zona de bahías/andén)
    const northCurb = projectPolygon3D(
      [
        { x: 18, y: 24, z: 0.3 },
        { x: WORLD_W - 18, y: 24, z: 0.3 },
        { x: WORLD_W - 18, y: 32, z: 0.3 },
        { x: 18, y: 32, z: 0.3 },
      ],
      camX,
      camY,
      camZ,
      camYaw
    );

    // 3. Zona de Parqueo 3D Demarcada (P)
    const pz = scenario.parkingZone;
    const parkingFloor = projectPolygon3D(
      [
        { x: pz.x, y: pz.y, z: 0.5 },
        { x: pz.x + pz.w, y: pz.y, z: 0.5 },
        { x: pz.x + pz.w, y: pz.y + pz.h, z: 0.5 },
        { x: pz.x, y: pz.y + pz.h, z: 0.5 },
      ],
      camX,
      camY,
      camZ,
      camYaw
    );

    // Pilares luminosos 3D en las 4 esquinas de la zona de parqueo para guía espacial
    const pzCorners = [
      { x: pz.x, y: pz.y },
      { x: pz.x + pz.w, y: pz.y },
      { x: pz.x + pz.w, y: pz.y + pz.h },
      { x: pz.x, y: pz.y + pz.h },
    ];
    const beaconPosts: { x1: number; y1: number; x2: number; y2: number }[] = [];
    pzCorners.forEach((c) => {
      const bot = projectPoint3D({ x: c.x, y: c.y, z: 0 }, camX, camY, camZ, camYaw);
      const top = projectPoint3D({ x: c.x, y: c.y, z: 24 }, camX, camY, camZ, camYaw);
      if (bot && top) {
        beaconPosts.push({ x1: bot.sx, y1: bot.sy, x2: top.sx, y2: top.sy });
      }
    });

    // 4. Haz de luces delanteras sobre la carretera 3D
    let headlightCone: string | null = null;
    if (headlightMode !== 'OFF') {
      const reach = headlightMode === 'HIGH' ? 165 : 95;
      const spread = headlightMode === 'HIGH' ? 52 : 32;
      const cosA = Math.cos(carState.angleRad);
      const sinA = Math.sin(carState.angleRad);
      const frontX = carState.x + (CAR_LENGTH / 2) * cosA;
      const frontY = carState.y + (CAR_LENGTH / 2) * sinA;

      const beamPoly = projectPolygon3D(
        [
          { x: frontX - 10 * sinA, y: frontY + 10 * cosA, z: 0.6 },
          { x: frontX + 10 * sinA, y: frontY - 10 * cosA, z: 0.6 },
          {
            x: frontX + reach * cosA + spread * sinA,
            y: frontY + reach * sinA - spread * cosA,
            z: 0.6,
          },
          {
            x: frontX + reach * cosA - spread * sinA,
            y: frontY + reach * sinA + spread * cosA,
            z: 0.6,
          },
        ],
        camX,
        camY,
        camZ,
        camYaw
      );
      if (beamPoly) headlightCone = beamPoly.pointsStr;
    }

    // 5. Bloques 3D volumétricos (Obstáculos, carros estacionados y nuestro vehículo azul en vista exterior)
    interface RenderFace {
      pointsStr: string;
      fill: string;
      stroke: string;
      avgDepth: number;
      label?: string;
      cx?: number;
      cy?: number;
    }
    const faces3D: RenderFace[] = [];

    const addBox3D = (
      bx: number,
      by: number,
      bw: number,
      bh: number,
      bz0: number,
      bz1: number,
      baseColor: string,
      topColor: string,
      strokeColor: string,
      label?: string
    ) => {
      const b0 = { x: bx, y: by, z: bz0 };
      const b1 = { x: bx + bw, y: by, z: bz0 };
      const b2 = { x: bx + bw, y: by + bh, z: bz0 };
      const b3 = { x: bx, y: by + bh, z: bz0 };

      const t0 = { x: bx, y: by, z: bz1 };
      const t1 = { x: bx + bw, y: by, z: bz1 };
      const t2 = { x: bx + bw, y: by + bh, z: bz1 };
      const t3 = { x: bx, y: by + bh, z: bz1 };

      const rawSides = [
        [b0, b1, t1, t0],
        [b1, b2, t2, t1],
        [b2, b3, t3, t2],
        [b3, b0, t0, t3],
      ];

      rawSides.forEach((quad) => {
        const proj = projectPolygon3D(quad, camX, camY, camZ, camYaw);
        if (proj) {
          faces3D.push({
            pointsStr: proj.pointsStr,
            fill: baseColor,
            stroke: strokeColor,
            avgDepth: proj.avgDepth,
          });
        }
      });

      const topProj = projectPolygon3D([t0, t1, t2, t3], camX, camY, camZ, camYaw);
      if (topProj) {
        faces3D.push({
          pointsStr: topProj.pointsStr,
          fill: topColor,
          stroke: strokeColor,
          avgDepth: topProj.avgDepth - 0.5,
          label,
          cx: topProj.centerSx,
          cy: topProj.centerSy,
        });
      }
    };

    // Agregar los obstáculos de cada nivel en 3D
    scenario.obstacles.forEach((obs) => {
      const h3d = obs.height3D ?? 22;
      const baseCol = obs.color ?? '#1E293B';
      addBox3D(
        obs.x,
        obs.y,
        obs.w,
        obs.h,
        0,
        h3d * 0.58,
        baseCol,
        baseCol,
        '#94A3B8',
        obs.kind !== 'car' ? obs.label : undefined
      );
      if (obs.kind === 'car') {
        // Cabina superior del vehículo estacionado en 3D
        addBox3D(
          obs.x + obs.w * 0.16,
          obs.y + obs.h * 0.16,
          obs.w * 0.68,
          obs.h * 0.68,
          h3d * 0.58,
          h3d,
          '#0F172A',
          '#38BDF8',
          '#E2E8F0',
          obs.label
        );
      }
    });

    // Si estamos en cámara exterior 3D, renderizar el vehículo azul del jugador en 3D con chasis y cabina
    if (isChase) {
      const corners = getCarCorners(carState.x, carState.y, carState.angleRad);
      const bPts = corners.map((c) => ({ x: c.x, y: c.y, z: 0 }));
      const mPts = corners.map((c) => ({ x: c.x, y: c.y, z: 12 }));

      for (let i = 0; i < 4; i++) {
        const next = (i + 1) % 4;
        const sideProj = projectPolygon3D(
          [bPts[i], bPts[next], mPts[next], mPts[i]],
          camX,
          camY,
          camZ,
          camYaw
        );
        if (sideProj) {
          faces3D.push({
            pointsStr: sideProj.pointsStr,
            fill: i === 2 && brakeActive ? '#EF4444' : '#1D4ED8',
            stroke: '#93C5FD',
            avgDepth: sideProj.avgDepth,
          });
        }
      }

      const bodyTop = projectPolygon3D(mPts, camX, camY, camZ, camYaw);
      if (bodyTop) {
        faces3D.push({
          pointsStr: bodyTop.pointsStr,
          fill: '#2563EB',
          stroke: '#BAE6FD',
          avgDepth: bodyTop.avgDepth - 0.3,
        });
      }

      // Techo/Cabina 3D del carro del conductor
      const cos = Math.cos(carState.angleRad);
      const sin = Math.sin(carState.angleRad);
      const roofLocal = [
        { dx: 12, dy: -10 },
        { dx: 12, dy: 10 },
        { dx: -14, dy: 10 },
        { dx: -14, dy: -10 },
      ];
      const roofBot = roofLocal.map((p) => ({
        x: carState.x + p.dx * cos - p.dy * sin,
        y: carState.y + p.dx * sin + p.dy * cos,
        z: 12,
      }));
      const roofTop = roofLocal.map((p) => ({
        x: carState.x + p.dx * 0.8 * cos - p.dy * 0.85 * sin,
        y: carState.y + p.dx * 0.8 * sin + p.dy * 0.85 * cos,
        z: 22,
      }));

      for (let i = 0; i < 4; i++) {
        const next = (i + 1) % 4;
        const winProj = projectPolygon3D(
          [roofBot[i], roofBot[next], roofTop[next], roofTop[i]],
          camX,
          camY,
          camZ,
          camYaw
        );
        if (winProj) {
          faces3D.push({
            pointsStr: winProj.pointsStr,
            fill: 'rgba(125, 211, 252, 0.72)',
            stroke: '#E0F2FE',
            avgDepth: winProj.avgDepth - 0.5,
          });
        }
      }

      const roofCap = projectPolygon3D(roofTop, camX, camY, camZ, camYaw);
      if (roofCap) {
        faces3D.push({
          pointsStr: roofCap.pointsStr,
          fill: '#1E40AF',
          stroke: '#93C5FD',
          avgDepth: roofCap.avgDepth - 0.8,
          label: 'TU CARRO 3D',
          cx: roofCap.centerSx,
          cy: roofCap.centerSy,
        });
      }
    }

    // Ordenar caras 3D de más lejana a más cercana (Painter's Algorithm)
    faces3D.sort((a, b) => b.avgDepth - a.avgDepth);

    return {
      roadSlab,
      laneStripes,
      southCurb,
      northCurb,
      parkingFloor,
      beaconPosts,
      headlightCone,
      faces3D,
    };
  }, [brakeActive, cameraMode, carState.angleRad, carState.x, carState.y, headlightMode, scenario]);

  const pz = scenario.parkingZone;
  const leftBlinkOn = (turnSignal === 'LEFT' || turnSignal === 'HAZARD') && blinkTick;
  const rightBlinkOn = (turnSignal === 'RIGHT' || turnSignal === 'HAZARD') && blinkTick;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <TelemetryHeader
        title="SIMULADOR DE CONDUCCIÓN 3D Y CABINA"
        subtitle="3 Niveles en Carretera 3D + Espejos Retrovisores + Mandos Reales + Preoperacional"
        moduleCode="MOD-03"
        showBack
      />

      <View style={styles.mainContainer}>
        {/* BARRA SUPERIOR: ACCESO AL NIVEL PREOPERACIONAL + LOS 3 NIVELES 3D + TELEMETRÍA */}
        <View style={styles.topHudBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scenarioTabs}>
            {/* Botón directo al nuevo Nivel Preoperacional */}
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
                0. PREOPERACIONAL {preoperationalResult ? `(${preoperationalResult.scorePct}%)` : ''}
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
            <Pressable
              onPress={() =>
                setCameraMode((prev) => (prev === 'CHASE_3D' ? 'COCKPIT_3D' : 'CHASE_3D'))
              }
              style={styles.cameraToggleBtn}>
              <Ionicons name="videocam-outline" size={13} color={PsychoPalette.cyan} />
              <Text style={styles.cameraToggleText}>
                {cameraMode === 'CHASE_3D' ? 'VISTA: 3D + CABINA' : 'VISTA: PARABRISAS 1ªP'}
              </Text>
            </Pressable>

            <View style={styles.statBadge}>
              <Text style={styles.statBadgeLabel}>PARQUEO</Text>
              <Text
                style={[
                  styles.statBadgeValue,
                  { color: alignmentPct >= 85 ? PsychoPalette.mint : PsychoPalette.textPrimary },
                ]}>
                {alignmentPct}%
              </Text>
            </View>

            <View style={styles.statBadge}>
              <Text style={styles.statBadgeLabel}>CHOQUES</Text>
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

        {/* VENTANA PRINCIPAL: ENTORNO DE CARRETERA 3D + ESPEJOS RETROVISORES + CABINA DE VEHÍCULO */}
        <View
          style={[
            styles.viewportContainer,
            collisionFlash && { borderColor: PsychoPalette.redSignalBright },
            parkedSuccess && { borderColor: PsychoPalette.mint },
          ]}>
          {/* RENDERIZADOR 3D DE CARRETERA Y NIVELES */}
          <Svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${VIEW3D_W} ${VIEW3D_H}`}
            preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="sky3DGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop
                  offset="0"
                  stopColor={headlightMode === 'HIGH' ? '#040B1A' : '#020617'}
                />
                <Stop offset="0.65" stopColor="#0B1930" />
                <Stop offset="1" stopColor="#172A4A" />
              </LinearGradient>
              <LinearGradient id="ground3DGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#091322" />
                <Stop offset="1" stopColor="#050A14" />
              </LinearGradient>
              <LinearGradient id="asphalt3DGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#111C2D" />
                <Stop offset="1" stopColor="#1E293B" />
              </LinearGradient>
            </Defs>

            {/* Cielo 3D y Horizonte Vial */}
            <Rect x={0} y={0} width={VIEW3D_W} height={HORIZON_Y} fill="url(#sky3DGrad)" />

            {/* Silueta de ciudad/montañas en el horizonte de la carretera */}
            <Polygon
              points={`0,${HORIZON_Y} 65,${HORIZON_Y - 22} 130,${HORIZON_Y - 12} 210,${HORIZON_Y - 34} 285,${HORIZON_Y - 16} 390,${HORIZON_Y - 38} 490,${HORIZON_Y - 18} 610,${HORIZON_Y - 30} ${VIEW3D_W},${HORIZON_Y - 14} ${VIEW3D_W},${HORIZON_Y}`}
              fill="#0A1526"
              stroke="rgba(0, 217, 245, 0.2)"
              strokeWidth={1}
            />

            {/* Terreno base bajo el horizonte */}
            <Rect
              x={0}
              y={HORIZON_Y}
              width={VIEW3D_W}
              height={VIEW3D_H - HORIZON_Y}
              fill="url(#ground3DGrad)"
            />

            {/* Superficie 3D de la carretera */}
            {scene3D.roadSlab ? (
              <Polygon
                points={scene3D.roadSlab.pointsStr}
                fill="url(#asphalt3DGrad)"
                stroke="#334155"
                strokeWidth={2}
              />
            ) : null}

            {/* Bordillos viales norte y sur en perspectiva 3D */}
            {scene3D.northCurb ? (
              <Polygon points={scene3D.northCurb.pointsStr} fill="#F59E0B" opacity={0.75} />
            ) : null}
            {scene3D.southCurb ? (
              <Polygon points={scene3D.southCurb.pointsStr} fill="#00D9F5" opacity={0.55} />
            ) : null}

            {/* Marcas viales de carril en perspectiva 3D */}
            {scene3D.laneStripes.map((pts, idx) => (
              <Polygon key={idx} points={pts} fill="rgba(241, 245, 249, 0.65)" />
            ))}

            {/* Haz de luz de farolas delanteras sobre la carretera 3D */}
            {scene3D.headlightCone ? (
              <Polygon
                points={scene3D.headlightCone}
                fill={
                  headlightMode === 'HIGH'
                    ? 'rgba(186, 230, 253, 0.34)'
                    : 'rgba(186, 230, 253, 0.18)'
                }
              />
            ) : null}

            {/* Zona de Parqueo 3D Demarcada en el asfalto */}
            {scene3D.parkingFloor ? (
              <G>
                <Polygon
                  points={scene3D.parkingFloor.pointsStr}
                  fill={
                    parkedSuccess
                      ? 'rgba(0, 245, 160, 0.42)'
                      : alignmentPct >= 75
                        ? 'rgba(0, 245, 160, 0.26)'
                        : 'rgba(0, 217, 245, 0.18)'
                  }
                  stroke={PsychoPalette.mint}
                  strokeWidth={3}
                  strokeDasharray="10 5"
                />
                <SvgText
                  x={scene3D.parkingFloor.centerSx}
                  y={scene3D.parkingFloor.centerSy + 4}
                  fill={PsychoPalette.mint}
                  fontSize="16"
                  fontWeight="bold"
                  textAnchor="middle">
                  ZONA P (3D)
                </SvgText>
              </G>
            ) : null}

            {/* Postes/balizas luminosas 3D en las 4 esquinas del parqueo */}
            {scene3D.beaconPosts.map((bp, i) => (
              <G key={i}>
                <Line
                  x1={bp.x1}
                  y1={bp.y1}
                  x2={bp.x2}
                  y2={bp.y2}
                  stroke={PsychoPalette.mint}
                  strokeWidth={2.5}
                />
                <Circle cx={bp.x2} cy={bp.y2} r={3.5} fill="#FFFFFF" stroke={PsychoPalette.mint} strokeWidth={1.5} />
              </G>
            ))}

            {/* Volúmenes 3D de carros estacionados, muros y nuestro vehículo */}
            {scene3D.faces3D.map((f, idx) => (
              <G key={idx}>
                <Polygon
                  points={f.pointsStr}
                  fill={f.fill}
                  stroke={f.stroke}
                  strokeWidth={1.2}
                />
                {f.label && f.cx && f.cy ? (
                  <SvgText
                    x={f.cx}
                    y={f.cy + 3}
                    fill="#FFFFFF"
                    fontSize="10"
                    fontWeight="bold"
                    textAnchor="middle">
                    {f.label}
                  </SvgText>
                ) : null}
              </G>
            ))}

            {/* MARCO SUPERIOR Y PILARES A DE LA CABINA DEL VEHÍCULO */}
            <Path
              d={`M 0 0 L ${VIEW3D_W} 0 L ${VIEW3D_W} 28 L ${VIEW3D_W - 42} ${VIEW3D_H} L ${VIEW3D_W} ${VIEW3D_H} L ${VIEW3D_W} 0`}
              fill="#070D19"
            />
            <Polygon points={`0,0 52,0 16,${VIEW3D_H} 0,${VIEW3D_H}`} fill="#0B1324" stroke="#1E3150" strokeWidth={1.5} />
            <Polygon
              points={`${VIEW3D_W},0 ${VIEW3D_W - 52},0 ${VIEW3D_W - 16},${VIEW3D_H} ${VIEW3D_W},${VIEW3D_H}`}
              fill="#0B1324"
              stroke="#1E3150"
              strokeWidth={1.5}
            />

            {/* PLUMILLAS LIMPIAPARABRISAS EN LA CABINA */}
            {wipersOn ? (
              <G>
                <Line
                  x1={210}
                  y1={VIEW3D_H - 92}
                  x2={175 + wiperAngle * 1.4}
                  y2={VIEW3D_H - 210}
                  stroke="#94A3B8"
                  strokeWidth={3.5}
                  strokeLinecap="round"
                />
                <Line
                  x1={470}
                  y1={VIEW3D_H - 92}
                  x2={435 + wiperAngle * 1.4}
                  y2={VIEW3D_H - 210}
                  stroke="#94A3B8"
                  strokeWidth={3.5}
                  strokeLinecap="round"
                />
              </G>
            ) : null}
          </Svg>

          {/* ==================== LOS 3 ESPEJOS RETROVISORES DE LA CABINA ==================== */}
          <View style={styles.mirrorsTopOverlay} pointerEvents="none">
            {/* 1. ESPEJO RETROVISOR LATERAL IZQUIERDO */}
            <View style={styles.sideMirrorBox}>
              <View style={styles.mirrorHeaderRow}>
                <Ionicons name="eye-outline" size={10} color={PsychoPalette.cyan} />
                <Text style={styles.mirrorLabelText}>ESPEJO IZQ (L)</Text>
              </View>
              <View style={styles.mirrorGlass}>
                <Svg width="100%" height="100%" viewBox="0 0 90 42">
                  <Rect x={0} y={0} width={90} height={16} fill="#061020" />
                  <Rect x={0} y={16} width={90} height={26} fill="#162235" />
                  <Line x1={45} y1={16} x2={10} y2={42} stroke={PsychoPalette.cyan} strokeWidth={1.5} strokeDasharray="3 3" />
                  <Polygon points="68,18 90,22 90,42 62,42" fill="#1D4ED8" stroke="#93C5FD" strokeWidth={1} />
                  {leftBlinkOn ? <Circle cx={65} cy={26} r={4} fill="#F59E0B" /> : null}
                </Svg>
              </View>
            </View>

            {/* 2. ESPEJO RETROVISOR CENTRAL PANORÁMICO (CON SENSOR DE REVERSA) */}
            <View
              style={[
                styles.centerMirrorBox,
                gear === 'R' && { borderColor: PsychoPalette.amberWarning },
              ]}>
              <View style={styles.mirrorHeaderRow}>
                <Ionicons name="car-outline" size={11} color={PsychoPalette.mint} />
                <Text style={styles.mirrorLabelText}>
                  ESPEJO RETROVISOR CENTRAL • DISTANCIA TRASERA: {rearProximityMeters} m
                </Text>
              </View>
              <View style={styles.centerMirrorGlass}>
                <Svg width="100%" height="100%" viewBox="0 0 180 38">
                  <Rect x={0} y={0} width={180} height={14} fill="#050D1A" />
                  <Rect x={0} y={14} width={180} height={24} fill="#131F33" />
                  <Line x1={90} y1={14} x2={35} y2={38} stroke="rgba(0,245,160,0.6)" strokeWidth={1.5} />
                  <Line x1={90} y1={14} x2={145} y2={38} stroke="rgba(0,245,160,0.6)" strokeWidth={1.5} />
                  {/* Guías de cámara/espejo de reversa */}
                  <Line x1={55} y1={24} x2={125} y2={24} stroke="#F59E0B" strokeWidth={1} strokeDasharray="4 3" />
                  <Line x1={42} y1={33} x2={138} y2={33} stroke="#EF4444" strokeWidth={1} />
                </Svg>
              </View>
            </View>

            {/* 3. ESPEJO RETROVISOR LATERAL DERECHO + MINI RADAR */}
            <View style={styles.rightMirrorAndRadarRow}>
              <View style={styles.sideMirrorBox}>
                <View style={styles.mirrorHeaderRow}>
                  <Text style={styles.mirrorLabelText}>ESPEJO DER (R)</Text>
                  <Ionicons name="eye-outline" size={10} color={PsychoPalette.cyan} />
                </View>
                <View style={styles.mirrorGlass}>
                  <Svg width="100%" height="100%" viewBox="0 0 90 42">
                    <Rect x={0} y={0} width={90} height={16} fill="#061020" />
                    <Rect x={0} y={16} width={90} height={26} fill="#162235" />
                    <Line x1={45} y1={16} x2={80} y2={42} stroke={PsychoPalette.mint} strokeWidth={1.5} strokeDasharray="3 3" />
                    <Polygon points="0,22 22,18 28,42 0,42" fill="#1D4ED8" stroke="#93C5FD" strokeWidth={1} />
                    {rightBlinkOn ? <Circle cx={25} cy={26} r={4} fill="#F59E0B" /> : null}
                  </Svg>
                </View>
              </View>

              {/* MINI-RADAR TÁCTICO PARA PRECISIÓN DE PARQUEO */}
              <View style={styles.miniRadarBox}>
                <Svg width={78} height={50} viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}>
                  <Rect x={0} y={0} width={WORLD_W} height={WORLD_H} fill="#050A14" />
                  <Rect
                    x={pz.x}
                    y={pz.y}
                    width={pz.w}
                    height={pz.h}
                    fill="rgba(0,245,160,0.3)"
                    stroke={PsychoPalette.mint}
                    strokeWidth={12}
                  />
                  {scenario.obstacles.map((o, idx) => (
                    <Rect key={idx} x={o.x} y={o.y} width={o.w} height={o.h} fill="#EF4444" />
                  ))}
                  <G transform={`translate(${carState.x}, ${carState.y}) rotate(${carAngleDeg})`}>
                    <Rect
                      x={-CAR_LENGTH / 2}
                      y={-CAR_WIDTH / 2}
                      width={CAR_LENGTH}
                      height={CAR_WIDTH}
                      fill={PsychoPalette.cyan}
                    />
                  </G>
                </Svg>
              </View>
            </View>
          </View>

          {/* ALERTA DE CABINA (EJ: FRENO DE MANO PUESTO O MOTOR APAGADO) */}
          {cabinAlert || collisionFlash ? (
            <View style={styles.cabinCenterAlertBox} pointerEvents="none">
              <Ionicons name="warning" size={15} color="#FFFFFF" />
              <Text style={styles.cabinCenterAlertText}>
                {collisionFlash ? '¡IMPACTO DETECTADO EN LA VÍA 3D!' : cabinAlert}
              </Text>
            </View>
          ) : null}

          {/* ==================== PARTE INFERIOR: CABINA DEL VEHÍCULO CON MANDOS DE CARRO NORMAL ==================== */}
          <View style={styles.cabinDashboardWrapper}>
            {/* FILA DE COMANDOS DE UN CARRO NORMAL (MOTOR, CINTURÓN, FRENO MANO, DIRECCIONALES, LUCES, LIMPIABRISAS, PITO) */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carCommandsBar}>
              {/* 1. ENCENDIDO MOTOR START/STOP */}
              <Pressable
                onPress={() => {
                  setEngineOn((prev) => !prev);
                  playRightSignal();
                }}
                style={[styles.cmdBtn, engineOn ? styles.cmdBtnMint : styles.cmdBtnRed]}>
                <Ionicons
                  name="power"
                  size={13}
                  color={engineOn ? PsychoPalette.mint : PsychoPalette.redSignalBright}
                />
                <Text style={styles.cmdBtnText}>{engineOn ? 'MOTOR: ON' : 'START/STOP'}</Text>
              </Pressable>

              {/* 2. CINTURÓN DE SEGURIDAD */}
              <Pressable
                onPress={() => {
                  setSeatbeltOn((prev) => !prev);
                  playLeftSignal();
                }}
                style={[styles.cmdBtn, seatbeltOn ? styles.cmdBtnMint : styles.cmdBtnAmber]}>
                <Ionicons
                  name="shield-checkmark"
                  size={13}
                  color={seatbeltOn ? PsychoPalette.mint : PsychoPalette.amberWarning}
                />
                <Text style={styles.cmdBtnText}>
                  {seatbeltOn ? 'CINTURÓN OK' : 'ABROCHAR CINT.'}
                </Text>
              </Pressable>

              {/* 3. FRENO DE MANO ((P)) */}
              <Pressable
                onPress={() => {
                  setHandbrakeOn((prev) => !prev);
                  playLeftSignal();
                }}
                style={[styles.cmdBtn, handbrakeOn ? styles.cmdBtnRed : styles.cmdBtnCyan]}>
                <Ionicons
                  name="alert-circle"
                  size={13}
                  color={handbrakeOn ? PsychoPalette.redSignalBright : PsychoPalette.cyan}
                />
                <Text style={styles.cmdBtnText}>
                  {handbrakeOn ? '((P)) FRENO MANO ON' : '((P)) LIBRE'}
                </Text>
              </Pressable>

              {/* 4. DIRECCIONAL IZQUIERDA */}
              <Pressable
                onPress={() => {
                  setTurnSignal((prev) => (prev === 'LEFT' ? 'NONE' : 'LEFT'));
                  playLeftSignal();
                }}
                style={[styles.cmdBtn, leftBlinkOn && styles.cmdBtnAmber]}>
                <Ionicons
                  name="arrow-back-circle"
                  size={14}
                  color={leftBlinkOn ? PsychoPalette.amberWarning : PsychoPalette.textSecondary}
                />
                <Text style={styles.cmdBtnText}>DIR IZQ</Text>
              </Pressable>

              {/* 5. LUCES DE PARQUEO / EMERGENCIA */}
              <Pressable
                onPress={() => {
                  setTurnSignal((prev) => (prev === 'HAZARD' ? 'NONE' : 'HAZARD'));
                  playError();
                }}
                style={[styles.cmdBtn, turnSignal === 'HAZARD' && styles.cmdBtnRed]}>
                <Ionicons
                  name="warning"
                  size={13}
                  color={
                    turnSignal === 'HAZARD' ? PsychoPalette.redSignalBright : PsychoPalette.amberWarning
                  }
                />
                <Text style={styles.cmdBtnText}>ESTACIONARIAS</Text>
              </Pressable>

              {/* 6. DIRECCIONAL DERECHA */}
              <Pressable
                onPress={() => {
                  setTurnSignal((prev) => (prev === 'RIGHT' ? 'NONE' : 'RIGHT'));
                  playRightSignal();
                }}
                style={[styles.cmdBtn, rightBlinkOn && styles.cmdBtnAmber]}>
                <Text style={styles.cmdBtnText}>DIR DER</Text>
                <Ionicons
                  name="arrow-forward-circle"
                  size={14}
                  color={rightBlinkOn ? PsychoPalette.amberWarning : PsychoPalette.textSecondary}
                />
              </Pressable>

              {/* 7. LUCES DELANTERAS (OFF / BAJAS / ALTAS) */}
              <Pressable
                onPress={() => {
                  setHeadlightMode((prev) =>
                    prev === 'OFF' ? 'LOW' : prev === 'LOW' ? 'HIGH' : 'OFF'
                  );
                  playRightSignal();
                }}
                style={[styles.cmdBtn, headlightMode !== 'OFF' && styles.cmdBtnCyan]}>
                <Ionicons
                  name="flashlight"
                  size={13}
                  color={headlightMode !== 'OFF' ? PsychoPalette.cyan : PsychoPalette.textSecondary}
                />
                <Text style={styles.cmdBtnText}>
                  LUCES: {headlightMode === 'OFF' ? 'OFF' : headlightMode === 'LOW' ? 'BAJAS' : 'ALTAS'}
                </Text>
              </Pressable>

              {/* 8. LIMPIAPARABRISAS */}
              <Pressable
                onPress={() => setWipersOn((prev) => !prev)}
                style={[styles.cmdBtn, wipersOn && styles.cmdBtnCyan]}>
                <Ionicons
                  name="rainy-outline"
                  size={13}
                  color={wipersOn ? PsychoPalette.cyan : PsychoPalette.textSecondary}
                />
                <Text style={styles.cmdBtnText}>{wipersOn ? 'PLUMILLAS ON' : 'PLUMILLAS'}</Text>
              </Pressable>

              {/* 9. CLAXON / PITO */}
              <Pressable
                onPress={() => {
                  playLeftSignal();
                  setTimeout(() => playRightSignal(), 90);
                }}
                style={styles.cmdBtn}>
                <Ionicons name="megaphone-outline" size={13} color={PsychoPalette.amberWarning} />
                <Text style={styles.cmdBtnText}>PITO</Text>
              </Pressable>
            </ScrollView>

            {/* FILA INFERIOR DE CABINA: JOYSTICK COMPACTO + VOLANTE Y TABLERO CENTRAL + CAJA Y PEDALES */}
            <View style={styles.cabinMainControlsRow}>
              {/* ESQUINA INFERIOR IZQUIERDA: JOYSTICK DE DIRECCIÓN CON CÍRCULO MÁS PEQUEÑO */}
              <View style={styles.joystickPanel}>
                <Text style={styles.controlLabel}>JOYSTICK COMPACTO</Text>
                <GestureDetector gesture={joystickGesture}>
                  <View style={styles.joystickBase}>
                    <View style={styles.joystickCrosshairH} />
                    <View style={styles.joystickCrosshairV} />
                    <View
                      style={[
                        styles.joystickKnobSmall,
                        {
                          transform: [
                            { translateX: joystickKnob.x },
                            { translateY: joystickKnob.y },
                          ],
                        },
                      ]}>
                      <View style={styles.joystickCenterDot} />
                    </View>
                  </View>
                </GestureDetector>
                <Text style={styles.joystickAngleReadout}>
                  {steerAngleDeg === 0
                    ? '0° RECTO'
                    : steerAngleDeg < 0
                      ? `IZQ ${steerAngleDeg}°`
                      : `DER +${steerAngleDeg}°`}
                </Text>
              </View>

              {/* CENTRO DE LA CABINA: VOLANTE REALISTA QUE GIRA + CLUSTER DIGITAL DE INSTRUMENTOS */}
              <View style={styles.steeringAndClusterCenter}>
                <View style={styles.instrumentCluster}>
                  <View style={styles.clusterSideItem}>
                    <Text style={styles.clusterLabel}>RPM</Text>
                    <Text style={[styles.clusterValue, { color: PsychoPalette.cyan }]}>{rpm}</Text>
                  </View>

                  {/* Volante gráfico de la cabina que rota con la dirección */}
                  <View style={styles.steeringWheelWrap}>
                    <Svg
                      width={68}
                      height={68}
                      viewBox="0 0 80 80"
                      style={{ transform: [{ rotate: `${steerAngleDeg * 2.2}deg` }] }}>
                      <Circle
                        cx={40}
                        cy={40}
                        r={33}
                        fill="none"
                        stroke="#1E293B"
                        strokeWidth={9}
                      />
                      <Circle
                        cx={40}
                        cy={40}
                        r={33}
                        fill="none"
                        stroke={PsychoPalette.cyan}
                        strokeWidth={2}
                      />
                      {/* Marcador superior de centrado del volante */}
                      <Rect x={37} y={3} width={6} height={9} rx={2} fill={PsychoPalette.mint} />
                      {/* Radios del volante */}
                      <Line x1={10} y1={40} x2={70} y2={40} stroke="#334155" strokeWidth={6} />
                      <Line x1={40} y1={40} x2={40} y2={72} stroke="#334155" strokeWidth={6} />
                      <Circle cx={40} cy={40} r={11} fill="#0F172A" stroke={PsychoPalette.mint} strokeWidth={2} />
                    </Svg>
                  </View>

                  <View style={styles.clusterSideItem}>
                    <Text style={styles.clusterLabel}>VELOCIDAD</Text>
                    <Text style={[styles.clusterValue, { color: PsychoPalette.mint }]}>
                      {speedKmh} <Text style={{ fontSize: 9 }}>km/h</Text>
                    </Text>
                  </View>
                </View>

                <View style={styles.clusterIndicatorsStrip}>
                  <Text
                    style={[
                      styles.clusterIconTag,
                      { color: leftBlinkOn ? PsychoPalette.mint : PsychoPalette.textMuted },
                    ]}>
                    ◀
                  </Text>
                  <Text style={styles.clusterGearBadge}>
                    MARCHA: {handbrakeOn ? 'P' : gear} • {elapsedSec.toFixed(1)}s
                  </Text>
                  <Text
                    style={[
                      styles.clusterIconTag,
                      { color: rightBlinkOn ? PsychoPalette.mint : PsychoPalette.textMuted },
                    ]}>
                    ▶
                  </Text>
                </View>
              </View>

              {/* ESQUINA INFERIOR DERECHA: TRANSMISIÓN D/R Y PEDALES DE FRENO Y ACELERADOR */}
              <View style={styles.pedalsCluster}>
                <View style={styles.gearSelectorColumn}>
                  <Text style={styles.controlLabel}>CAJA</Text>
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

                {/* PEDAL DE FRENO */}
                <Pressable
                  onPressIn={() => setBrakeActive(true)}
                  onPressOut={() => setBrakeActive(false)}
                  style={[styles.pedalBox, styles.brakePedal, brakeActive && styles.brakePedalActive]}
                  accessibilityRole="button"
                  accessibilityLabel="Pedal de Freno y Reversa">
                  <Ionicons name="hand-left-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.pedalTitle}>FRENO</Text>
                  <Text style={styles.pedalSub}>REV</Text>
                </Pressable>

                {/* PEDAL DE ACELERADOR */}
                <Pressable
                  onPressIn={() => setGasActive(true)}
                  onPressOut={() => setGasActive(false)}
                  style={[styles.pedalBox, styles.gasPedal, gasActive && styles.gasPedalActive]}
                  accessibilityRole="button"
                  accessibilityLabel="Pedal de Acelerador">
                  <Ionicons name="speedometer-outline" size={16} color={PsychoPalette.bgPrimary} />
                  <Text style={[styles.pedalTitle, { color: PsychoPalette.bgPrimary }]}>ACEL</Text>
                  <Text style={[styles.pedalSub, { color: PsychoPalette.bgPrimary }]}>
                    {gear === 'D' ? 'AVANCE' : 'RETROC'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* MODAL DE ÉXITO AL ESTACIONAR EN 3D */}
          {parkedSuccess ? (
            <View style={styles.successOverlay}>
              <View style={styles.successModalCard}>
                <Ionicons name="checkmark-done-circle" size={44} color={PsychoPalette.mint} />
                <Text style={styles.successModalTitle}>¡NIVEL 3D COMPLETADO CON ÉXITO!</Text>
                <Text style={styles.successModalDesc}>
                  {scenario.title} superado en {elapsedSec.toFixed(1)}s con {collisions}{' '}
                  {collisions === 1 ? 'colisión' : 'colisiones'}.
                </Text>
                <View style={styles.successModalActions}>
                  <Pressable onPress={() => resetScenario(scenario)} style={styles.modalRepeatBtn}>
                    <Ionicons name="refresh" size={15} color={PsychoPalette.bgPrimary} />
                    <Text style={styles.modalBtnText}>REPETIR NIVEL 3D</Text>
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
  cameraToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PsychoPalette.bgPanel,
    borderWidth: 1,
    borderColor: PsychoPalette.cyan,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
  },
  cameraToggleText: {
    color: PsychoPalette.cyan,
    fontSize: 9,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  statBadge: {
    backgroundColor: PsychoPalette.bgPanel,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    paddingHorizontal: 7,
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
    backgroundColor: '#050A14',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: PsychoPalette.borderSubtle,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 330,
    justifyContent: 'space-between',
  },
  mirrorsTopOverlay: {
    position: 'absolute',
    top: 6,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 6,
  },
  sideMirrorBox: {
    width: 98,
    backgroundColor: 'rgba(7, 13, 25, 0.92)',
    borderWidth: 1.5,
    borderColor: PsychoPalette.cyan,
    borderRadius: 10,
    padding: 4,
    gap: 2,
  },
  centerMirrorBox: {
    flex: 1,
    maxWidth: 260,
    backgroundColor: 'rgba(7, 13, 25, 0.94)',
    borderWidth: 1.5,
    borderColor: PsychoPalette.mint,
    borderRadius: 10,
    padding: 4,
    gap: 2,
  },
  rightMirrorAndRadarRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  mirrorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  mirrorLabelText: {
    color: PsychoPalette.textPrimary,
    fontSize: 8,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  mirrorGlass: {
    height: 38,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
  },
  centerMirrorGlass: {
    height: 36,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
  },
  miniRadarBox: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: PsychoPalette.mint,
    backgroundColor: '#050A14',
  },
  cabinCenterAlertBox: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.92)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 64,
  },
  cabinCenterAlertText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  cabinDashboardWrapper: {
    marginTop: 'auto',
    backgroundColor: 'rgba(7, 13, 25, 0.94)',
    borderTopWidth: 2,
    borderTopColor: '#1E3150',
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 8,
    gap: 6,
  },
  carCommandsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 2,
  },
  cmdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PsychoPalette.bgPanel,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
  },
  cmdBtnMint: {
    borderColor: PsychoPalette.mint,
    backgroundColor: PsychoPalette.mintDim,
  },
  cmdBtnCyan: {
    borderColor: PsychoPalette.cyan,
    backgroundColor: PsychoPalette.cyanDim,
  },
  cmdBtnAmber: {
    borderColor: PsychoPalette.amberWarning,
    backgroundColor: PsychoPalette.amberDim,
  },
  cmdBtnRed: {
    borderColor: PsychoPalette.redSignalBright,
    backgroundColor: PsychoPalette.redSignalDim,
  },
  cmdBtnText: {
    color: PsychoPalette.textPrimary,
    fontSize: 8.5,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  cabinMainControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  joystickPanel: {
    backgroundColor: PsychoPalette.bgPanel,
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 245, 0.45)',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 9,
    alignItems: 'center',
    gap: 3,
  },
  controlLabel: {
    color: PsychoPalette.textSecondary,
    fontSize: 8,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
  joystickBase: {
    width: JOYSTICK_RADIUS * 2 + 12,
    height: JOYSTICK_RADIUS * 2 + 12,
    borderRadius: JOYSTICK_RADIUS + 6,
    backgroundColor: '#0F1A2E',
    borderWidth: 1.5,
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
  joystickKnobSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: PsychoPalette.cyan,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joystickCenterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PsychoPalette.bgPrimary,
  },
  joystickAngleReadout: {
    color: PsychoPalette.mint,
    fontSize: 9,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  steeringAndClusterCenter: {
    flex: 1,
    backgroundColor: '#050A14',
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  instrumentCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    gap: 6,
  },
  clusterSideItem: {
    alignItems: 'center',
    minWidth: 55,
  },
  clusterLabel: {
    color: PsychoPalette.textMuted,
    fontSize: 8,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
  clusterValue: {
    fontSize: 15,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  steeringWheelWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  clusterIndicatorsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  clusterIconTag: {
    fontSize: 12,
    fontWeight: '900',
  },
  clusterGearBadge: {
    color: PsychoPalette.textSecondary,
    fontSize: 9,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  pedalsCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PsychoPalette.bgPanel,
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 160, 0.45)',
    borderRadius: 12,
    padding: 6,
  },
  gearSelectorColumn: {
    gap: 4,
    alignItems: 'center',
  },
  gearBtn: {
    paddingHorizontal: 7,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: PsychoPalette.bgCard,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    minWidth: 66,
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
    fontSize: 8.5,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
  gearBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  pedalBox: {
    width: 52,
    height: 76,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 4,
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
    fontSize: 10,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  pedalSub: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 8,
    fontWeight: '800',
    fontFamily: Fonts.mono,
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
