import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
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
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { Fonts, PsychoPalette } from '@/constants/theme';
import { AptitudeGrade, useEvaluation } from '@/context/evaluation-context';
import { usePsychAudio } from '@/hooks/use-psych-audio';

// Entorno 3D ampliado (gran complejo vial de 1200 x 920 unidades)
const WORLD_W = 1200;
const WORLD_H = 920;
const CAR_LENGTH = 54;
const CAR_WIDTH = 28;
const WHEELBASE = 36;
const MAX_STEER_RAD = (38 * Math.PI) / 180;
const STEERING_WHEEL_RADIUS = 54;

// Visor panorámico horizontal 16:9 optimizado para pantalla de celular en horizontal
const VIEW3D_W = 960;
const VIEW3D_H = 440;
const HORIZON_Y = 136;
const FOCAL_LEN = 390;

export type ManualGear = 'R' | 'N' | '1' | '2' | '3' | '4' | '5';

interface GearSpec {
  gear: ManualGear;
  label: string;
  shortDesc: string;
  maxSpeedPx: number;
  maxKmh: number;
  accelFactor: number;
  slotX: number;
  slotY: number;
}

export const GEAR_SPECS: Record<ManualGear, GearSpec> = {
  R: {
    gear: 'R',
    label: 'REVERSA (R)',
    shortDesc: 'Marcha atrás — Presione ACELERADOR para retroceder',
    maxSpeedPx: -88,
    maxKmh: 24,
    accelFactor: 1.15,
    slotX: 18,
    slotY: 22,
  },
  N: {
    gear: 'N',
    label: 'NEUTRO (N)',
    shortDesc: 'Punto muerto — Motor desacoplado sin tracción',
    maxSpeedPx: 0,
    maxKmh: 0,
    accelFactor: 0,
    slotX: 50,
    slotY: 50,
  },
  '1': {
    gear: '1',
    label: '1ª MARCHA',
    shortDesc: 'Arranque y maniobra de precisión (0-22 km/h)',
    maxSpeedPx: 78,
    maxKmh: 22,
    accelFactor: 1.38,
    slotX: 18,
    slotY: 78,
  },
  '2': {
    gear: '2',
    label: '2ª MARCHA',
    shortDesc: 'Giro en circuito y pista urbana (0-38 km/h)',
    maxSpeedPx: 134,
    maxKmh: 38,
    accelFactor: 1.12,
    slotX: 39,
    slotY: 22,
  },
  '3': {
    gear: '3',
    label: '3ª MARCHA',
    shortDesc: 'Circulación media en avenida (0-56 km/h)',
    maxSpeedPx: 196,
    maxKmh: 56,
    accelFactor: 0.9,
    slotX: 39,
    slotY: 78,
  },
  '4': {
    gear: '4',
    label: '4ª MARCHA',
    shortDesc: 'Crucero rápido en recta (0-78 km/h)',
    maxSpeedPx: 268,
    maxKmh: 78,
    accelFactor: 0.74,
    slotX: 61,
    slotY: 22,
  },
  '5': {
    gear: '5',
    label: '5ª MARCHA',
    shortDesc: 'Velocidad máxima de pista (0-100 km/h)',
    maxSpeedPx: 340,
    maxKmh: 100,
    accelFactor: 0.6,
    slotX: 61,
    slotY: 78,
  },
};

interface ConePoint {
  x: number;
  y: number;
}

interface TreePoint {
  x: number;
  y: number;
  height: number;
  canopyDark: string;
  canopyMid: string;
  canopyLight: string;
}

interface LampPoint {
  x: number;
  y: number;
}

interface FloorArrow {
  x: number;
  y: number;
  angleDeg: number;
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
}

// Árboles 3D volumétricos distribuidos alrededor del gran complejo vial (1200 x 920)
const WORLD_TREES: TreePoint[] = [
  // Bosque perimetral Norte
  { x: 90, y: 28, height: 85, canopyDark: '#14532D', canopyMid: '#15803D', canopyLight: '#4ADE80' },
  { x: 220, y: 24, height: 92, canopyDark: '#064E3B', canopyMid: '#059669', canopyLight: '#34D399' },
  { x: 360, y: 26, height: 78, canopyDark: '#14532D', canopyMid: '#16A34A', canopyLight: '#86EFAC' },
  { x: 510, y: 22, height: 96, canopyDark: '#78350F', canopyMid: '#D97706', canopyLight: '#FBBF24' },
  { x: 660, y: 25, height: 88, canopyDark: '#14532D', canopyMid: '#15803D', canopyLight: '#4ADE80' },
  { x: 810, y: 24, height: 90, canopyDark: '#064E3B', canopyMid: '#059669', canopyLight: '#6EE7B7' },
  { x: 960, y: 28, height: 84, canopyDark: '#7C2D12', canopyMid: '#EA580C', canopyLight: '#FB923C' },
  { x: 1100, y: 30, height: 92, canopyDark: '#14532D', canopyMid: '#16A34A', canopyLight: '#4ADE80' },
  // Avenida Izquierda
  { x: 35, y: 150, height: 82, canopyDark: '#14532D', canopyMid: '#16A34A', canopyLight: '#4ADE80' },
  { x: 32, y: 310, height: 90, canopyDark: '#064E3B', canopyMid: '#059669', canopyLight: '#34D399' },
  { x: 36, y: 470, height: 80, canopyDark: '#78350F', canopyMid: '#CA8A04', canopyLight: '#FACC15' },
  { x: 34, y: 630, height: 88, canopyDark: '#14532D', canopyMid: '#15803D', canopyLight: '#86EFAC' },
  { x: 38, y: 790, height: 84, canopyDark: '#14532D', canopyMid: '#16A34A', canopyLight: '#4ADE80' },
  // Avenida Derecha
  { x: 1160, y: 160, height: 88, canopyDark: '#14532D', canopyMid: '#15803D', canopyLight: '#4ADE80' },
  { x: 1165, y: 320, height: 82, canopyDark: '#064E3B', canopyMid: '#059669', canopyLight: '#34D399' },
  { x: 1162, y: 480, height: 94, canopyDark: '#14532D', canopyMid: '#16A34A', canopyLight: '#86EFAC' },
  { x: 1158, y: 640, height: 86, canopyDark: '#7C2D12', canopyMid: '#EA580C', canopyLight: '#FDBA74' },
  { x: 1160, y: 800, height: 90, canopyDark: '#14532D', canopyMid: '#15803D', canopyLight: '#4ADE80' },
  // Parque Sur
  { x: 180, y: 885, height: 86, canopyDark: '#14532D', canopyMid: '#16A34A', canopyLight: '#4ADE80' },
  { x: 380, y: 888, height: 82, canopyDark: '#064E3B', canopyMid: '#059669', canopyLight: '#34D399' },
  { x: 590, y: 890, height: 92, canopyDark: '#78350F', canopyMid: '#D97706', canopyLight: '#FBBF24' },
  { x: 800, y: 886, height: 86, canopyDark: '#14532D', canopyMid: '#16A34A', canopyLight: '#86EFAC' },
  { x: 1010, y: 884, height: 88, canopyDark: '#14532D', canopyMid: '#15803D', canopyLight: '#4ADE80' },
  // Islas ecológicas internas del circuito
  { x: 920, y: 240, height: 76, canopyDark: '#14532D', canopyMid: '#16A34A', canopyLight: '#4ADE80' },
  { x: 920, y: 560, height: 80, canopyDark: '#064E3B', canopyMid: '#059669', canopyLight: '#6EE7B7' },
];

// Postes de alumbrado vial 3D a lo largo de la pista
const WORLD_LAMPS: LampPoint[] = [
  { x: 140, y: 85 },
  { x: 420, y: 85 },
  { x: 700, y: 85 },
  { x: 980, y: 85 },
  { x: 95, y: 380 },
  { x: 95, y: 680 },
  { x: 1095, y: 380 },
  { x: 1095, y: 680 },
];

// Los 3 niveles de conducción dentro del nuevo entorno amplio (1200 x 920)
const SCENARIOS: ScenarioConfig[] = [
  {
    id: 'bay',
    title: 'Nivel 1: Circuito Vial y Parqueo en Bahía [P] (90°)',
    shortLabel: '1. PARQUEO [P] 90°',
    startX: 240,
    startY: 730,
    startAngleDeg: -42,
    parkingZone: {
      x: 520,
      y: 120,
      w: 110,
      h: 140,
      targetAngleDeg: -90,
    },
    cones: [
      // Carril de salida amplio
      { x: 150, y: 810 },
      { x: 260, y: 810 },
      { x: 370, y: 810 },
      { x: 480, y: 810 },
      { x: 590, y: 810 },
      { x: 700, y: 810 },
      // Guía izquierda de aproximación
      { x: 180, y: 560 },
      { x: 270, y: 460 },
      { x: 360, y: 370 },
      // Conos que delimitan la Bahía Oficial [P]
      { x: 485, y: 275 },
      { x: 485, y: 200 },
      { x: 485, y: 125 },
      { x: 665, y: 275 },
      { x: 665, y: 200 },
      { x: 665, y: 125 },
      // Guía derecha
      { x: 760, y: 340 },
      { x: 840, y: 440 },
    ],
    arrows: [
      { x: 320, y: 640, angleDeg: -42 },
      { x: 445, y: 500, angleDeg: -65 },
      { x: 555, y: 360, angleDeg: -90 },
    ],
  },
  {
    id: 'parallel',
    title: 'Nivel 2: Avenida y Parqueo en Paralelo [P]',
    shortLabel: '2. PARALELO [P]',
    startX: 210,
    startY: 560,
    startAngleDeg: -18,
    parkingZone: {
      x: 510,
      y: 130,
      w: 160,
      h: 92,
      targetAngleDeg: 0,
    },
    cones: [
      { x: 310, y: 130 },
      { x: 395, y: 130 },
      { x: 480, y: 130 },
      { x: 480, y: 225 },
      { x: 700, y: 130 },
      { x: 785, y: 130 },
      { x: 870, y: 130 },
      { x: 700, y: 225 },
      // Borde inferior del carril
      { x: 220, y: 720 },
      { x: 360, y: 720 },
      { x: 500, y: 720 },
      { x: 640, y: 720 },
      { x: 780, y: 720 },
      { x: 920, y: 720 },
    ],
    arrows: [
      { x: 340, y: 490, angleDeg: -18 },
      { x: 520, y: 410, angleDeg: -22 },
      { x: 640, y: 310, angleDeg: -155 },
    ],
  },
  {
    id: 'garage',
    title: 'Nivel 3: Gran Eslalon de Conos y Meta [P]',
    shortLabel: '3. ESLALON CONOS',
    startX: 190,
    startY: 740,
    startAngleDeg: -28,
    parkingZone: {
      x: 840,
      y: 145,
      w: 150,
      h: 100,
      targetAngleDeg: 0,
    },
    cones: [
      // Puertas de eslalon en la gran explanada
      { x: 410, y: 540 },
      { x: 410, y: 615 },
      { x: 590, y: 360 },
      { x: 590, y: 435 },
      { x: 750, y: 410 },
      { x: 750, y: 485 },
      // Borde exterior de referencia
      { x: 260, y: 820 },
      { x: 450, y: 800 },
      { x: 650, y: 740 },
      { x: 840, y: 640 },
      { x: 980, y: 480 },
      { x: 810, y: 145 },
      { x: 1015, y: 145 },
    ],
    arrows: [
      { x: 310, y: 650, angleDeg: -30 },
      { x: 500, y: 480, angleDeg: -15 },
      { x: 700, y: 320, angleDeg: -25 },
      { x: 830, y: 265, angleDeg: -45 },
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
  pitchOffset = 10
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
  pitchOffset = 10
): { pointsStr: string; avgDepth: number; centerSx: number; centerSy: number } | null {
  const cos = Math.cos(camYaw);
  const sin = Math.sin(camYaw);
  const nearPlane = 9;

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

// Pre-generación de losas de pavimento y carriles para un piso 3D realista con sensación real de velocidad
const ASPHALT_TILES: { x: number; y: number; w: number; h: number; shade: string }[] = [];
const tileStepX = 160;
const tileStepY = 140;
for (let gx = 80; gx < WORLD_W - 80; gx += tileStepX) {
  for (let gy = 80; gy < WORLD_H - 80; gy += tileStepY) {
    const isAlt = ((gx / tileStepX + gy / tileStepY) | 0) % 2 === 0;
    ASPHALT_TILES.push({
      x: gx,
      y: gy,
      w: Math.min(tileStepX, WORLD_W - 80 - gx),
      h: Math.min(tileStepY, WORLD_H - 80 - gy),
      shade: isAlt ? '#334155' : '#2D3A4E',
    });
  }
}

// Bordillos perimetrales 3D Rojos y Blancos
const CURB_SEGMENTS: { x1: number; y1: number; x2: number; y2: number; color: string }[] = [];
const curbStep = 80;
for (let cx = 80; cx < WORLD_W - 80; cx += curbStep) {
  const isRed = ((cx / curbStep) | 0) % 2 === 0;
  CURB_SEGMENTS.push({
    x1: cx,
    y1: 80,
    x2: Math.min(cx + curbStep, WORLD_W - 80),
    y2: 90,
    color: isRed ? '#DC2626' : '#F8FAFC',
  });
  CURB_SEGMENTS.push({
    x1: cx,
    y1: WORLD_H - 90,
    x2: Math.min(cx + curbStep, WORLD_W - 80),
    y2: WORLD_H - 80,
    color: isRed ? '#F8FAFC' : '#DC2626',
  });
}
for (let cy = 80; cy < WORLD_H - 80; cy += curbStep) {
  const isRed = ((cy / curbStep) | 0) % 2 === 0;
  CURB_SEGMENTS.push({
    x1: 80,
    y1: cy,
    x2: 90,
    y2: Math.min(cy + curbStep, WORLD_H - 80),
    color: isRed ? '#DC2626' : '#F8FAFC',
  });
  CURB_SEGMENTS.push({
    x1: WORLD_W - 90,
    y1: cy,
    x2: WORLD_W - 80,
    y2: Math.min(cy + curbStep, WORLD_H - 80),
    color: isRed ? '#F8FAFC' : '#DC2626',
  });
}

export default function ManeuversSimulatorScreen() {
  const { width: winW, height: winH } = useWindowDimensions();
  const isPortraitScreen = winH > winW;

  const { preoperationalResult, setManeuverResult } = useEvaluation();
  const { playLeftSignal, playRightSignal, playSuccess, playError } = usePsychAudio();

  const [scenario, setScenario] = useState<ScenarioConfig>(SCENARIOS[0]);
  const [carState, setCarState] = useState({
    x: SCENARIOS[0].startX,
    y: SCENARIOS[0].startY,
    angleRad: (SCENARIOS[0].startAngleDeg * Math.PI) / 180,
    speed: 0,
    steerRad: 0,
    rpm: 900,
  });

  const [tireTracks, setTireTracks] = useState<{ x: number; y: number; angleRad: number }[]>([]);
  const [hitConeIndices, setHitConeIndices] = useState<number[]>([]);

  // Mandos de cabina en primera persona
  const [gear, setGear] = useState<ManualGear>('1');
  const [engineOn, setEngineOn] = useState<boolean>(true);
  const [handbrakeOn, setHandbrakeOn] = useState<boolean>(false);
  const [seatbeltOn, setSeatbeltOn] = useState<boolean>(true);
  const [turnSignal, setTurnSignal] = useState<'NONE' | 'LEFT' | 'RIGHT' | 'HAZARD'>('NONE');
  const [lightsOn, setLightsOn] = useState<boolean>(true);
  const [wipersOn, setWipersOn] = useState<boolean>(false);
  const [wiperAngle, setWiperAngle] = useState<number>(0);
  const [blinkTick, setBlinkTick] = useState<boolean>(true);

  // Dirección (Volante) + 3 Pedales Independientes (Embrague, Freno, Acelerador)
  const [wheelDragX, setWheelDragX] = useState<number>(0);
  const [clutchActive, setClutchActive] = useState<boolean>(false);
  const [brakeActive, setBrakeActive] = useState<boolean>(false);
  const [gasActive, setGasActive] = useState<boolean>(false);
  const [throttleLock, setThrottleLock] = useState<boolean>(false);

  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [collisions, setCollisions] = useState<number>(0);
  const [alignmentPct, setAlignmentPct] = useState<number>(0);
  const [parkedSuccess, setParkedSuccess] = useState<boolean>(false);
  const [collisionFlash, setCollisionFlash] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string>(
    '1ª Marcha lista • Use los pedales independientes: EMBRAGUE, FRENO y ACELERADOR'
  );

  const physicsRef = useRef({
    x: SCENARIOS[0].startX,
    y: SCENARIOS[0].startY,
    angleRad: (SCENARIOS[0].startAngleDeg * Math.PI) / 180,
    speed: 0,
    steerRad: 0,
    rpm: 900,
    clutch: false,
    brake: false,
    gas: false,
    throttleLock: false,
    gear: '1' as ManualGear,
    engineOn: true,
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
    physicsRef.current.clutch = clutchActive;
    physicsRef.current.brake = brakeActive;
    physicsRef.current.gas = gasActive;
    physicsRef.current.throttleLock = throttleLock;
    physicsRef.current.gear = gear;
    physicsRef.current.engineOn = engineOn;
    physicsRef.current.handbrakeOn = handbrakeOn;
  }, [clutchActive, brakeActive, gasActive, throttleLock, gear, engineOn, handbrakeOn]);

  // Soporte de teclado en Web (W=Acelerador, S=Freno, Espacio/C=Embrague, A/D=Volante, 1-5/R/N=Caja)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowup' || k === 'w') {
        setGasActive(true);
      } else if (k === 'arrowdown' || k === 's') {
        setBrakeActive(true);
      } else if (k === 'c' || k === 'shift') {
        setClutchActive(true);
      } else if (k === 'arrowleft' || k === 'a') {
        setWheelDragX((prev) => Math.max(-STEERING_WHEEL_RADIUS, prev - 14));
      } else if (k === 'arrowright' || k === 'd') {
        setWheelDragX((prev) => Math.min(STEERING_WHEEL_RADIUS, prev + 14));
      } else if (['1', '2', '3', '4', '5'].includes(k)) {
        setGear(k as ManualGear);
      } else if (k === 'r') {
        setGear('R');
      } else if (k === 'n') {
        setGear('N');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowup' || k === 'w') {
        setGasActive(false);
      } else if (k === 'arrowdown' || k === 's') {
        setBrakeActive(false);
      } else if (k === 'c' || k === 'shift') {
        setClutchActive(false);
      } else if (k === 'arrowleft' || k === 'a' || k === 'arrowright' || k === 'd') {
        setWheelDragX(0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (turnSignal === 'NONE') return;
    const timer = setInterval(() => setBlinkTick((p) => !p), 380);
    return () => clearInterval(timer);
  }, [turnSignal]);

  useEffect(() => {
    if (!wipersOn) return;
    let dir = 1;
    const timer = setInterval(() => {
      setWiperAngle((prev) => {
        if (prev >= 52) dir = -1;
        if (prev <= 4) dir = 1;
        return prev + dir * 8;
      });
    }, 70);
    return () => clearInterval(timer);
  }, [wipersOn]);

  const selectGear = useCallback(
    (nextGear: ManualGear) => {
      setGear(nextGear);
      const spec = GEAR_SPECS[nextGear];
      setStatusBanner(`${spec.label}: ${spec.shortDesc}`);
      if (nextGear === 'R') {
        playError();
      } else {
        playRightSignal();
      }
    },
    [playError, playRightSignal]
  );

  const resetScenario = useCallback((targetScenario: ScenarioConfig) => {
    const initAngle = (targetScenario.startAngleDeg * Math.PI) / 180;
    physicsRef.current = {
      x: targetScenario.startX,
      y: targetScenario.startY,
      angleRad: initAngle,
      speed: 0,
      steerRad: 0,
      rpm: 900,
      clutch: false,
      brake: false,
      gas: false,
      throttleLock: false,
      gear: '1',
      engineOn: true,
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
      rpm: 900,
    });
    setTireTracks([]);
    setHitConeIndices([]);
    setGear('1');
    setEngineOn(true);
    setHandbrakeOn(false);
    setWheelDragX(0);
    setClutchActive(false);
    setBrakeActive(false);
    setGasActive(false);
    setThrottleLock(false);
    setElapsedSec(0);
    setCollisions(0);
    setAlignmentPct(0);
    setParkedSuccess(false);
    setCollisionFlash(false);
    setStatusBanner('1ª Marcha lista • Presione ACELERADOR para avanzar o FRENO para detenerse');
  }, []);

  const handleSelectScenario = useCallback(
    (sc: ScenarioConfig) => {
      setScenario(sc);
      resetScenario(sc);
    },
    [resetScenario]
  );

  // Motor físico 60 FPS con pedales independientes (Embrague, Freno, Acelerador) y Caja en H
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

        const spec = GEAR_SPECS[p.gear];
        const baseAccel = 165 * spec.accelFactor;
        const brakeDecel = 310;
        const rollingFriction = 48;
        const isAccelerating = p.gas || p.throttleLock;

        if (!p.engineOn) {
          p.rpm = 0;
          p.speed = Math.abs(p.speed) < 3 ? 0 : p.speed * 0.92;
        } else if (p.handbrakeOn) {
          p.speed = Math.abs(p.speed) < 3 ? 0 : p.speed * 0.8;
          p.rpm = 900;
        } else if (p.brake) {
          // PEDAL DE FRENO INDEPENDIENTE: Exclusivamente frena y detiene el vehículo a 0 km/h
          if (Math.abs(p.speed) < 5) {
            p.speed = 0;
          } else if (p.speed > 0) {
            p.speed = Math.max(0, p.speed - brakeDecel * dt);
          } else {
            p.speed = Math.min(0, p.speed + brakeDecel * dt);
          }
          p.rpm = 900;
        } else if (p.clutch || p.gear === 'N') {
          // PEDAL DE EMBRAGUE O NEUTRO: Desacopla la transmisión; si pisa acelerador sube RPM en vacío
          p.rpm = isAccelerating ? 5100 : 950;
          if (Math.abs(p.speed) < 3) {
            p.speed = 0;
          } else if (p.speed > 0) {
            p.speed = Math.max(0, p.speed - rollingFriction * 0.7 * dt);
          } else {
            p.speed = Math.min(0, p.speed + rollingFriction * 0.7 * dt);
          }
        } else if (isAccelerating) {
          // PEDAL DE ACELERADOR INDEPENDIENTE: Impulsa en la marcha seleccionada (1ª-5ª adelante, R atrás)
          if (p.gear === 'R') {
            p.speed = Math.max(spec.maxSpeedPx, p.speed - baseAccel * dt);
          } else {
            if (p.speed <= spec.maxSpeedPx) {
              p.speed = Math.min(spec.maxSpeedPx, p.speed + baseAccel * dt);
            } else {
              p.speed = Math.max(spec.maxSpeedPx, p.speed - rollingFriction * 1.6 * dt);
            }
          }
        } else {
          // Fricción natural al soltar pedales
          if (Math.abs(p.speed) < 3) {
            p.speed = 0;
          } else if (p.speed > 0) {
            p.speed = Math.max(0, p.speed - rollingFriction * dt);
          } else {
            p.speed = Math.min(0, p.speed + rollingFriction * dt);
          }
        }

        if (p.engineOn && !p.clutch && p.gear !== 'N') {
          const maxForGear = Math.max(50, Math.abs(spec.maxSpeedPx));
          const ratio = Math.min(1.15, Math.abs(p.speed) / maxForGear);
          p.rpm = Math.round(900 + ratio * 5400);
        }

        const nextX = p.x + p.speed * Math.cos(p.angleRad) * dt;
        const nextY = p.y + p.speed * Math.sin(p.angleRad) * dt;
        const angularVel = (p.speed / WHEELBASE) * Math.tan(p.steerRad) * 1.15;
        const nextAngle = p.angleRad + angularVel * dt;

        // Límites del complejo vial con deslizamiento suave junto a los bordillos
        p.x = Math.max(96, Math.min(WORLD_W - 96, nextX));
        p.y = Math.max(96, Math.min(WORLD_H - 96, nextY));
        p.angleRad = nextAngle;

        // Colisión con conos
        const corners = getCarCorners(p.x, p.y, p.angleRad);
        let touchedConeIdx = -1;
        scenario.cones.forEach((cone, idx) => {
          const hit =
            Math.hypot(p.x - cone.x, p.y - cone.y) < 18 ||
            corners.some((c) => Math.hypot(c.x - cone.x, c.y - cone.y) < 10);
          if (hit) touchedConeIdx = idx;
        });

        if (touchedConeIdx !== -1 && now - p.lastCollisionTime > 1100) {
          p.lastCollisionTime = now;
          p.collisions += 1;
          setCollisions(p.collisions);
          setHitConeIndices((prev) =>
            prev.includes(touchedConeIdx) ? prev : [...prev, touchedConeIdx]
          );
          setCollisionFlash(true);
          setStatusBanner('¡Atención! Cono impactado — Corrija con el volante y los pedales');
          playError();
          setTimeout(() => setCollisionFlash(false), 420);
        }

        // Huellas de neumáticos en el pavimento
        if (Math.abs(p.speed) > 12 && now - p.lastTrackTime > 150) {
          p.lastTrackTime = now;
          setTireTracks((prev) => [
            ...prev.slice(-28),
            { x: p.x, y: p.y, angleRad: p.angleRad },
          ]);
        }

        // Evaluación de estacionamiento en Zona [P]
        const pz = scenario.parkingZone;
        const pzCenterX = pz.x + pz.w / 2;
        const pzCenterY = pz.y + pz.h / 2;
        const distToCenter = Math.hypot(p.x - pzCenterX, p.y - pzCenterY);

        const cornersInside = corners.filter(
          (c) =>
            c.x >= pz.x - 10 &&
            c.x <= pz.x + pz.w + 10 &&
            c.y >= pz.y - 10 &&
            c.y <= pz.y + pz.h + 10
        ).length;

        const distScore = Math.max(0, 100 - distToCenter * 0.45);
        const cornerScore = cornersInside * 25;
        const computedAlignment = Math.min(100, Math.round(distScore * 0.45 + cornerScore * 0.55));
        setAlignmentPct(computedAlignment);

        if (cornersInside === 4 && Math.abs(p.speed) < 8) {
          p.completed = true;
          p.speed = 0;
          setParkedSuccess(true);
          playSuccess();

          let grade: AptitudeGrade = 'APTO';
          if (elapsed < 45 && p.collisions === 0 && seatbeltOn) {
            grade = 'EXCELENTE';
          } else if (p.collisions > 3 || elapsed > 95) {
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
          rpm: p.rpm,
        });
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [playError, playSuccess, scenario, seatbeltOn, setManeuverResult]);

  // Gesto exclusivo de la Caja de Dirección (Volante): adapta coordenadas si la pantalla está rotada 90° en móvil
  const steeringWheelGesture = Gesture.Pan()
    .runOnJS(true)
    .onChange((e) => {
      const deltaSteer = isPortraitScreen ? e.changeY : e.changeX;
      setWheelDragX((prev) =>
        Math.max(-STEERING_WHEEL_RADIUS, Math.min(STEERING_WHEEL_RADIUS, prev + deltaSteer))
      );
    })
    .onFinalize(() => {
      setWheelDragX(0);
    });

  // Gesto de la Caja de Cambios Manual en H (R, N, 1, 2, 3, 4, 5)
  const shifterPanGesture = Gesture.Pan()
    .runOnJS(true)
    .onUpdate((e) => {
      const localX = Math.max(0, Math.min(100, e.x));
      const localY = Math.max(0, Math.min(100, e.y));

      if (localY > 36 && localY < 64) {
        if (gear !== 'N') selectGear('N');
        return;
      }

      const isTopRow = localY <= 36;
      if (localX < 34) {
        const g: ManualGear = isTopRow ? 'R' : '1';
        if (gear !== g) selectGear(g);
      } else if (localX < 68) {
        const g: ManualGear = isTopRow ? '2' : '3';
        if (gear !== g) selectGear(g);
      } else {
        const g: ManualGear = isTopRow ? '4' : '5';
        if (gear !== g) selectGear(g);
      }
    });

  const steerAngleDeg = Math.round((carState.steerRad * 180) / Math.PI);
  const wheelVisualRotateDeg = steerAngleDeg * 2.6;
  const speedKmh = Math.round(Math.abs(carState.speed) * 0.32);

  // Renderizado 3D en Primera Persona con entorno amplio y piso realista
  const world3D = useMemo(() => {
    const camDistBack = 4;
    const camZ = 38;
    const pitchOffset = 10;

    const camX = carState.x - Math.cos(carState.angleRad) * camDistBack;
    const camY = carState.y - Math.sin(carState.angleRad) * camDistBack;
    const camYaw = carState.angleRad;

    // 1. Base de asfalto general del complejo vial
    const asphaltBase = projectPolygon3D(
      [
        { x: 80, y: 80, z: 0 },
        { x: WORLD_W - 80, y: 80, z: 0 },
        { x: WORLD_W - 80, y: WORLD_H - 80, z: 0 },
        { x: 80, y: WORLD_H - 80, z: 0 },
      ],
      camX,
      camY,
      camZ,
      camYaw,
      pitchOffset
    );

    // 2. Losas texturizadas de asfalto y concreto (dan sensación real de velocidad y perspectiva en el piso)
    const groundTiles: { pointsStr: string; shade: string }[] = [];
    ASPHALT_TILES.forEach((tile) => {
      const centerDist = Math.hypot(tile.x + tile.w / 2 - camX, tile.y + tile.h / 2 - camY);
      if (centerDist > 920) return;
      const poly = projectPolygon3D(
        [
          { x: tile.x + 2, y: tile.y + 2, z: 0.05 },
          { x: tile.x + tile.w - 2, y: tile.y + 2, z: 0.05 },
          { x: tile.x + tile.w - 2, y: tile.y + tile.h - 2, z: 0.05 },
          { x: tile.x + 2, y: tile.y + tile.h - 2, z: 0.05 },
        ],
        camX,
        camY,
        camZ,
        camYaw,
        pitchOffset
      );
      if (poly) {
        groundTiles.push({ pointsStr: poly.pointsStr, shade: tile.shade });
      }
    });

    // 3. Bordillos perimetrales 3D Rojos y Blancos
    const curbPolys: { pointsStr: string; color: string }[] = [];
    CURB_SEGMENTS.forEach((seg) => {
      const poly = projectPolygon3D(
        [
          { x: seg.x1, y: seg.y1, z: 0.2 },
          { x: seg.x2, y: seg.y1, z: 0.2 },
          { x: seg.x2, y: seg.y2, z: 0.2 },
          { x: seg.x1, y: seg.y2, z: 0.2 },
        ],
        camX,
        camY,
        camZ,
        camYaw,
        pitchOffset
      );
      if (poly) curbPolys.push({ pointsStr: poly.pointsStr, color: seg.color });
    });

    // 4. Marcas viales realistas: Líneas de carril segmentadas, doble línea amarilla y paso cebra
    const whiteLaneDashes: string[] = [];
    for (let lx = 180; lx <= WORLD_W - 180; lx += 90) {
      [360, 620].forEach((ly) => {
        const dash = projectPolygon3D(
          [
            { x: lx, y: ly, z: 0.15 },
            { x: lx + 46, y: ly, z: 0.15 },
            { x: lx + 46, y: ly + 5, z: 0.15 },
            { x: lx, y: ly + 5, z: 0.15 },
          ],
          camX,
          camY,
          camZ,
          camYaw,
          pitchOffset
        );
        if (dash) whiteLaneDashes.push(dash.pointsStr);
      });
    }

    // Líneas de bahías de estacionamiento superiores
    for (let bx = 180; bx <= WORLD_W - 180; bx += 110) {
      const bayLine = projectPolygon3D(
        [
          { x: bx, y: 105, z: 0.15 },
          { x: bx + 5, y: 105, z: 0.15 },
          { x: bx + 5, y: 265, z: 0.15 },
          { x: bx, y: 265, z: 0.15 },
        ],
        camX,
        camY,
        camZ,
        camYaw,
        pitchOffset
      );
      if (bayLine) whiteLaneDashes.push(bayLine.pointsStr);
    }

    // Paso peatonal tipo cebra en 3D
    for (let zy = 660; zy <= 790; zy += 24) {
      const zebra = projectPolygon3D(
        [
          { x: 140, y: zy, z: 0.18 },
          { x: 195, y: zy, z: 0.18 },
          { x: 195, y: zy + 12, z: 0.18 },
          { x: 140, y: zy + 12, z: 0.18 },
        ],
        camX,
        camY,
        camZ,
        camYaw,
        pitchOffset
      );
      if (zebra) whiteLaneDashes.push(zebra.pointsStr);
    }

    // 5. Huellas dobles de neumáticos sobre el asfalto
    const projectedTracks: string[] = [];
    tireTracks.forEach((tr) => {
      const cos = Math.cos(tr.angleRad);
      const sin = Math.sin(tr.angleRad);
      [-11, 11].forEach((lat) => {
        const tx = tr.x - 16 * cos - lat * sin;
        const ty = tr.y - 16 * sin + lat * cos;
        const poly = projectPolygon3D(
          [
            { x: tx - 5 * cos - 2.2 * sin, y: ty - 5 * sin + 2.2 * cos, z: 0.2 },
            { x: tx + 5 * cos - 2.2 * sin, y: ty + 5 * sin + 2.2 * cos, z: 0.2 },
            { x: tx + 5 * cos + 2.2 * sin, y: ty + 5 * sin - 2.2 * cos, z: 0.2 },
            { x: tx - 5 * cos + 2.2 * sin, y: ty - 5 * sin - 2.2 * cos, z: 0.2 },
          ],
          camX,
          camY,
          camZ,
          camYaw,
          pitchOffset
        );
        if (poly) projectedTracks.push(poly.pointsStr);
      });
    });

    // 6. Flechas direccionales amarillas en el pavimento
    const yellowArrows: string[] = [];
    scenario.arrows.forEach((ar) => {
      const rad = (ar.angleDeg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const localArrow = [
        { dx: 28, dy: 0 },
        { dx: 6, dy: -16 },
        { dx: 6, dy: -6 },
        { dx: -24, dy: -6 },
        { dx: -24, dy: 6 },
        { dx: 6, dy: 6 },
        { dx: 6, dy: 16 },
      ];
      const worldPts = localArrow.map((p) => ({
        x: ar.x + p.dx * cos - p.dy * sin,
        y: ar.y + p.dx * sin + p.dy * cos,
        z: 0.28,
      }));
      const proj = projectPolygon3D(worldPts, camX, camY, camZ, camYaw, pitchOffset);
      if (proj) yellowArrows.push(proj.pointsStr);
    });

    // 7. Cajón Azul Oficial de Parqueo [ P ] y Poste Vertical [ P ]
    const pz = scenario.parkingZone;
    const blueParkingBox = projectPolygon3D(
      [
        { x: pz.x, y: pz.y, z: 0.35 },
        { x: pz.x + pz.w, y: pz.y, z: 0.35 },
        { x: pz.x + pz.w, y: pz.y + pz.h, z: 0.35 },
        { x: pz.x, y: pz.y + pz.h, z: 0.35 },
      ],
      camX,
      camY,
      camZ,
      camYaw,
      pitchOffset
    );

    const signBase = projectPoint3D(
      { x: pz.x - 14, y: pz.y + 10, z: 0 },
      camX,
      camY,
      camZ,
      camYaw,
      pitchOffset
    );
    const signTop = projectPoint3D(
      { x: pz.x - 14, y: pz.y + 10, z: 62 },
      camX,
      camY,
      camZ,
      camYaw,
      pitchOffset
    );

    // 8. Objetos 3D Verticales ordenados por profundidad (Árboles Volumétricos, Farolas Viales y Conos 3D)
    const renderItems: {
      type: 'TREE' | 'LAMP' | 'CONE';
      depth: number;
      sx: number;
      sy: number;
      scale: number;
      tree?: TreePoint;
      coneHit?: boolean;
    }[] = [];

    WORLD_TREES.forEach((tr) => {
      const pt = projectPoint3D(
        { x: tr.x, y: tr.y, z: 0 },
        camX,
        camY,
        camZ,
        camYaw,
        pitchOffset
      );
      if (pt && pt.sx > -110 && pt.sx < VIEW3D_W + 110) {
        renderItems.push({
          type: 'TREE',
          depth: pt.depth,
          sx: pt.sx,
          sy: pt.sy,
          scale: pt.scale,
          tree: tr,
        });
      }
    });

    WORLD_LAMPS.forEach((lp) => {
      const pt = projectPoint3D(
        { x: lp.x, y: lp.y, z: 0 },
        camX,
        camY,
        camZ,
        camYaw,
        pitchOffset
      );
      if (pt && pt.sx > -80 && pt.sx < VIEW3D_W + 80) {
        renderItems.push({
          type: 'LAMP',
          depth: pt.depth,
          sx: pt.sx,
          sy: pt.sy,
          scale: pt.scale,
        });
      }
    });

    scenario.cones.forEach((c, idx) => {
      const pt = projectPoint3D(
        { x: c.x, y: c.y, z: 0 },
        camX,
        camY,
        camZ,
        camYaw,
        pitchOffset
      );
      if (pt && pt.sx > -60 && pt.sx < VIEW3D_W + 60) {
        renderItems.push({
          type: 'CONE',
          depth: pt.depth,
          sx: pt.sx,
          sy: pt.sy,
          scale: pt.scale,
          coneHit: hitConeIndices.includes(idx),
        });
      }
    });

    renderItems.sort((a, b) => b.depth - a.depth);

    return {
      asphaltBase,
      groundTiles,
      curbPolys,
      whiteLaneDashes,
      projectedTracks,
      yellowArrows,
      blueParkingBox,
      signBase,
      signTop,
      renderItems,
    };
  }, [carState.angleRad, carState.x, carState.y, hitConeIndices, scenario, tireTracks]);

  const leftBlinkOn = (turnSignal === 'LEFT' || turnSignal === 'HAZARD') && blinkTick;
  const rightBlinkOn = (turnSignal === 'RIGHT' || turnSignal === 'HAZARD') && blinkTick;
  const currentGearSpec = GEAR_SPECS[gear];
  const horizonPanOffset = Math.round(((carState.angleRad * 180) / Math.PI) * 2.4) % 240;

  // Contenedor adaptable: si el celular está en vertical (winH > winW), rota automáticamente 90° a formato horizontal completo
  const landscapeContainerStyle = isPortraitScreen
    ? {
        width: winH,
        height: winW,
        transform: [{ rotate: '90deg' as const }],
      }
    : {
        width: winW,
        height: winH,
      };

  return (
    <View style={styles.outerRoot}>
      <SafeAreaView style={[styles.landscapeWrapper, landscapeContainerStyle]} edges={['left', 'right']}>
        {/* BARRA SUPERIOR HORIZONTAL COMPACTA PARA CELULAR */}
        <View style={styles.compactTopBar}>
          <View style={styles.leftNavGroup}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={14} color={PsychoPalette.textPrimary} />
              <Text style={styles.backBtnText}>SALIR</Text>
            </Pressable>

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
                  size={11}
                  color={preoperationalResult ? PsychoPalette.mint : PsychoPalette.amberWarning}
                />
                <Text
                  style={[
                    styles.scenarioTabText,
                    {
                      color: preoperationalResult ? PsychoPalette.mint : PsychoPalette.amberWarning,
                    },
                  ]}>
                  0. PREOP
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
          </View>

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
              <Ionicons name="refresh" size={12} color={PsychoPalette.bgPrimary} />
              <Text style={styles.resetSimBtnText}>REINICIAR</Text>
            </Pressable>
          </View>
        </View>

        {/* ==================== VISOR 3D HORIZONTAL EN PRIMERA PERSONA (SIN RETROVISORES, ENTORNO AMPLIADO Y PISO REALISTA) ==================== */}
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
              {/* Gradiente de cielo realista con atmósfera */}
              <LinearGradient id="realisticSkyGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#0369A1" />
                <Stop offset="0.48" stopColor="#0EA5E9" />
                <Stop offset="0.82" stopColor="#7DD3FC" />
                <Stop offset="1" stopColor="#E0F2FE" />
              </LinearGradient>

              {/* Resplandor solar en el cielo */}
              <RadialGradient id="sunGlowGrad" cx="0.78" cy="0.22" r="0.25">
                <Stop offset="0" stopColor="#FEF08A" stopOpacity="0.95" />
                <Stop offset="0.35" stopColor="#FDE047" stopOpacity="0.45" />
                <Stop offset="1" stopColor="#38BDF8" stopOpacity="0" />
              </RadialGradient>

              {/* Terreno ecológico exterior con profundidad */}
              <LinearGradient id="realisticGrassGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#15803D" />
                <Stop offset="0.35" stopColor="#166534" />
                <Stop offset="1" stopColor="#052E16" />
              </LinearGradient>

              {/* Base de asfalto multicapa realista */}
              <LinearGradient id="asphaltRoadGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#475569" />
                <Stop offset="0.35" stopColor="#334155" />
                <Stop offset="0.75" stopColor="#1E293B" />
                <Stop offset="1" stopColor="#0F172A" />
              </LinearGradient>

              {/* Capó delantero esculpido en 3D */}
              <LinearGradient id="hoodMetallicGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#F8FAFC" />
                <Stop offset="0.5" stopColor="#E2E8F0" />
                <Stop offset="1" stopColor="#94A3B8" />
              </LinearGradient>

              {/* Salpicadero de fibra/cuero oscuro en 1ª persona */}
              <LinearGradient id="cockpitDashGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#1E293B" />
                <Stop offset="0.35" stopColor="#0F172A" />
                <Stop offset="1" stopColor="#020617" />
              </LinearGradient>
            </Defs>

            {/* 1. CIELO REALISTA, SOL, CORDILLERA Y HORIZONTE URBANO */}
            <Rect x={0} y={0} width={VIEW3D_W} height={HORIZON_Y} fill="url(#realisticSkyGrad)" />
            <Rect x={0} y={0} width={VIEW3D_W} height={HORIZON_Y} fill="url(#sunGlowGrad)" />
            <Circle cx={748} cy={32} r={18} fill="#FEF9C3" />

            {/* Cordillera lejana con perspectiva atmosférica */}
            <Path
              d={`M 0 ${HORIZON_Y} L 95 ${HORIZON_Y - 48} L 210 ${HORIZON_Y - 22} L 345 ${HORIZON_Y - 58} L 490 ${HORIZON_Y - 18} L 640 ${HORIZON_Y - 52} L 790 ${HORIZON_Y - 26} L ${VIEW3D_W} ${HORIZON_Y - 44} L ${VIEW3D_W} ${HORIZON_Y} Z`}
              fill="#0284C7"
              opacity={0.35}
            />
            <Path
              d={`M 0 ${HORIZON_Y} Q 180 ${HORIZON_Y - 38} 360 ${HORIZON_Y - 14} T 720 ${HORIZON_Y - 34} T ${VIEW3D_W} ${HORIZON_Y - 18} L ${VIEW3D_W} ${HORIZON_Y} Z`}
              fill="#15803D"
              opacity={0.82}
            />

            {/* Skyline 3D con edificios sombreados y complejo AutoTest */}
            <G transform={`translate(${-horizonPanOffset * 0.65}, 0)`}>
              {/* Nubes volumétricas */}
              <Ellipse cx={180} cy={30} rx={64} ry={14} fill="rgba(255,255,255,0.82)" />
              <Ellipse cx={215} cy={25} rx={45} ry={16} fill="rgba(255,255,255,0.9)" />
              <Ellipse cx={540} cy={34} rx={72} ry={14} fill="rgba(255,255,255,0.78)" />

              {/* Edificio 3D 1 con cara iluminada y cara en sombra */}
              <Rect x={70} y={22} width={68} height={HORIZON_Y - 22} fill="#CBD5E1" stroke="#475569" strokeWidth={1} />
              <Rect x={138} y={22} width={24} height={HORIZON_Y - 22} fill="#64748B" stroke="#475569" strokeWidth={1} />
              {[34, 48, 62, 76, 90, 104, 118].map((wy) => (
                <Line key={wy} x1={76} y1={wy} x2={130} y2={wy} stroke="#38BDF8" strokeWidth={3.5} strokeDasharray="8 4" />
              ))}

              {/* Torre Corporativa 3D 2 */}
              <Rect x={210} y={10} width={86} height={HORIZON_Y - 10} fill="#94A3B8" stroke="#334155" strokeWidth={1} />
              <Rect x={296} y={10} width={28} height={HORIZON_Y - 10} fill="#475569" stroke="#334155" strokeWidth={1} />
              {[22, 36, 50, 64, 78, 92, 106, 120].map((wy) => (
                <Line key={wy} x1={218} y1={wy} x2={288} y2={wy} stroke="#E0F2FE" strokeWidth={3} strokeDasharray="10 4" />
              ))}

              {/* Sede Central Centro de Evaluación Vial AutoTest */}
              <Rect x={390} y={84} width={230} height={52} fill="#1E293B" stroke="#0F172A" strokeWidth={1.5} />
              <Rect x={384} y={76} width={242} height={16} rx={3} fill="#EF4444" stroke="#FFFFFF" strokeWidth={1.2} />
              <SvgText x={505} y={88} fill="#FFFFFF" fontSize="10.5" fontWeight="bold" textAnchor="middle">
                CENTRO VIAL • AUTOTEST 3D
              </SvgText>

              {/* Torres Derecha */}
              <Rect x={680} y={18} width={92} height={HORIZON_Y - 18} fill="#CBD5E1" stroke="#475569" strokeWidth={1} />
              <Rect x={772} y={18} width={28} height={HORIZON_Y - 18} fill="#64748B" stroke="#475569" strokeWidth={1} />
              <Rect x={835} y={28} width={88} height={HORIZON_Y - 28} fill="#94A3B8" stroke="#334155" strokeWidth={1} />
            </G>

            {/* 2. PISO REALISTA MULTICAPA: PRADERA + BASE ASFÁLTICA + LOSAS EN PERSPECTIVA 3D */}
            <Rect
              x={0}
              y={HORIZON_Y}
              width={VIEW3D_W}
              height={VIEW3D_H - HORIZON_Y}
              fill="url(#realisticGrassGrad)"
            />

            {world3D.asphaltBase ? (
              <Polygon
                points={world3D.asphaltBase.pointsStr}
                fill="url(#asphaltRoadGrad)"
                stroke="#94A3B8"
                strokeWidth={2}
              />
            ) : null}

            {/* Losas de pavimento y concreto con juntas de dilatación en 3D */}
            {world3D.groundTiles.map((t, idx) => (
              <Polygon
                key={`tile-${idx}`}
                points={t.pointsStr}
                fill={t.shade}
                stroke="rgba(15, 23, 42, 0.35)"
                strokeWidth={0.8}
              />
            ))}

            {/* Bordillos perimetrales 3D Rojos y Blancos */}
            {world3D.curbPolys.map((cb, idx) => (
              <Polygon
                key={`curb-${idx}`}
                points={cb.pointsStr}
                fill={cb.color}
                stroke="#0F172A"
                strokeWidth={0.6}
              />
            ))}

            {/* Marcas viales blancas (carriles, bahías y paso cebra) */}
            {world3D.whiteLaneDashes.map((pts, i) => (
              <Polygon key={`lane-${i}`} points={pts} fill="rgba(248, 250, 252, 0.82)" />
            ))}

            {/* 3. HUELLAS REALISTAS DE NEUMÁTICOS */}
            {world3D.projectedTracks.map((pts, i) => (
              <Polygon key={`trk-${i}`} points={pts} fill="rgba(2, 6, 23, 0.45)" />
            ))}

            {/* 4. FLECHAS DIRECCIONALES AMARILLAS EN EL PISO */}
            {world3D.yellowArrows.map((pts, i) => (
              <Polygon
                key={`arr-${i}`}
                points={pts}
                fill="#FACC15"
                stroke="#CA8A04"
                strokeWidth={1.2}
              />
            ))}

            {/* 5. ZONA AZUL OFICIAL DE PARQUEO [ P ] */}
            {world3D.blueParkingBox ? (
              <G>
                <Polygon
                  points={world3D.blueParkingBox.pointsStr}
                  fill={parkedSuccess ? 'rgba(16, 185, 129, 0.88)' : 'rgba(2, 132, 199, 0.85)'}
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

            {/* 6. POSTE Y SEÑAL VERTICAL [ P ] */}
            {world3D.signBase && world3D.signTop ? (
              <G>
                <Line
                  x1={world3D.signBase.sx}
                  y1={world3D.signBase.sy}
                  x2={world3D.signTop.sx}
                  y2={world3D.signTop.sy}
                  stroke="#CBD5E1"
                  strokeWidth={5}
                />
                <Rect
                  x={world3D.signTop.sx - 24}
                  y={world3D.signTop.sy - 46}
                  width={48}
                  height={48}
                  rx={6}
                  fill="#0284C7"
                  stroke="#FFFFFF"
                  strokeWidth={2.5}
                />
                <SvgText
                  x={world3D.signTop.sx}
                  y={world3D.signTop.sy - 12}
                  fill="#FFFFFF"
                  fontSize="30"
                  fontWeight="bold"
                  textAnchor="middle">
                  P
                </SvgText>
              </G>
            ) : null}

            {/* 7. ELEMENTOS 3D VOLUMÉTRICOS: ÁRBOLES REALISTAS, FAROLAS VIALES Y CONOS SOMBREADOS */}
            {world3D.renderItems.map((item, idx) => {
              if (item.type === 'TREE' && item.tree) {
                const s = Math.max(0.24, Math.min(2.4, item.scale * 0.62));
                const tx = item.sx;
                const ty = item.sy;
                return (
                  <G key={`tree-${idx}`}>
                    {/* Sombra proyectada sobre el terreno */}
                    <Ellipse cx={tx + 4 * s} cy={ty + 2 * s} rx={24 * s} ry={8 * s} fill="rgba(2, 6, 23, 0.42)" />
                    {/* Tronco con corteza sombreada */}
                    <Rect
                      x={tx - 5 * s}
                      y={ty - 36 * s}
                      width={10 * s}
                      height={37 * s}
                      rx={2.5 * s}
                      fill="#5C2D0C"
                    />
                    <Rect
                      x={tx - 5 * s}
                      y={ty - 36 * s}
                      width={4 * s}
                      height={37 * s}
                      fill="#92400E"
                    />
                    {/* Follaje volumétrico en 4 capas (sombra base, tono medio e iluminación solar) */}
                    <Circle cx={tx} cy={ty - 40 * s} r={22 * s} fill={item.tree.canopyDark} />
                    <Circle cx={tx - 13 * s} cy={ty - 34 * s} r={15 * s} fill={item.tree.canopyMid} />
                    <Circle cx={tx + 12 * s} cy={ty - 34 * s} r={15 * s} fill={item.tree.canopyDark} />
                    <Circle cx={tx - 3 * s} cy={ty - 46 * s} r={16 * s} fill={item.tree.canopyMid} />
                    <Circle cx={tx - 6 * s} cy={ty - 50 * s} r={11 * s} fill={item.tree.canopyLight} />
                  </G>
                );
              }

              if (item.type === 'LAMP') {
                const s = Math.max(0.25, Math.min(2.1, item.scale * 0.65));
                const lx = item.sx;
                const ly = item.sy;
                return (
                  <G key={`lamp-${idx}`}>
                    <Ellipse cx={lx} cy={ly + 1 * s} rx={8 * s} ry={3 * s} fill="rgba(2, 6, 23, 0.4)" />
                    <Line
                      x1={lx}
                      y1={ly}
                      x2={lx}
                      y2={ly - 68 * s}
                      stroke="#94A3B8"
                      strokeWidth={3.5 * s}
                    />
                    <Line
                      x1={lx}
                      y1={ly - 68 * s}
                      x2={lx + 18 * s}
                      y2={ly - 72 * s}
                      stroke="#CBD5E1"
                      strokeWidth={2.5 * s}
                    />
                    <Ellipse
                      cx={lx + 19 * s}
                      cy={ly - 71 * s}
                      rx={5 * s}
                      ry={2.5 * s}
                      fill="#FEF08A"
                    />
                  </G>
                );
              }

              // Cono 3D con sombreado lateral y bandas reflectivas
              const s = Math.max(0.32, Math.min(1.9, item.scale * 0.48));
              const cx = item.sx;
              const cy = item.sy;
              return (
                <G
                  key={`cone-${idx}`}
                  transform={item.coneHit ? `rotate(32, ${cx}, ${cy})` : undefined}>
                  <Ellipse cx={cx + 3 * s} cy={cy + 2 * s} rx={16 * s} ry={6 * s} fill="rgba(2, 6, 23, 0.45)" />
                  {/* Base cuadrada 3D del cono */}
                  <Polygon
                    points={`${cx - 15 * s},${cy} ${cx},${cy - 5 * s} ${cx + 15 * s},${cy} ${cx},${cy + 5 * s}`}
                    fill="#C2410C"
                    stroke="#7C2D12"
                    strokeWidth={0.8}
                  />
                  {/* Cuerpo cónico mitad iluminada / mitad sombra */}
                  <Polygon
                    points={`${cx - 11 * s},${cy} ${cx - 3.2 * s},${cy - 35 * s} ${cx},${cy - 35 * s} ${cx},${cy}`}
                    fill="#FB923C"
                  />
                  <Polygon
                    points={`${cx},${cy} ${cx},${cy - 35 * s} ${cx + 3.2 * s},${cy - 35 * s} ${cx + 11 * s},${cy}`}
                    fill="#EA580C"
                  />
                  {/* Bandas reflectivas blancas */}
                  <Polygon
                    points={`${cx - 8.8 * s},${cy - 8 * s} ${cx - 6.8 * s},${cy - 15 * s} ${cx + 6.8 * s},${cy - 15 * s} ${cx + 8.8 * s},${cy - 8 * s}`}
                    fill="#F8FAFC"
                  />
                  <Polygon
                    points={`${cx - 5.8 * s},${cy - 21 * s} ${cx - 4.1 * s},${cy - 28 * s} ${cx + 4.1 * s},${cy - 28 * s} ${cx + 5.8 * s},${cy - 21 * s}`}
                    fill="#F8FAFC"
                  />
                </G>
              );
            })}

            {/* ==================== CABINA EN 1ª PERSONA SIN RETROVISORES (VISTA AMPLIA Y DESPEJADA) ==================== */}
            {/* CAPÓ DELANTERO ESCULPIDO EN 3D */}
            <G transform={`translate(${steerAngleDeg * -0.45}, ${gasActive ? -2.5 : brakeActive ? 3.5 : 0})`}>
              <Polygon
                points={`165,328 275,266 685,266 795,328`}
                fill="url(#hoodMetallicGrad)"
                stroke="#94A3B8"
                strokeWidth={2}
              />
              {/* Nervaduras aerodinámicas del capó */}
              <Line x1={255} y1={324} x2={325} y2={270} stroke="#CBD5E1" strokeWidth={2.5} />
              <Line x1={705} y1={324} x2={635} y2={270} stroke="#CBD5E1" strokeWidth={2.5} />
              <Ellipse cx={480} cy={278} rx={14} ry={4.5} fill="#38BDF8" stroke="#0F172A" strokeWidth={1} />
            </G>

            {/* LIMPIAPARABRISAS ANIMADOS */}
            <G transform={`rotate(${-wiperAngle}, 250, 326)`}>
              <Line x1={250} y1={326} x2={115} y2={296} stroke="#0F172A" strokeWidth={4.5} strokeLinecap="round" />
            </G>
            <G transform={`rotate(${-wiperAngle}, 610, 326)`}>
              <Line x1={610} y1={326} x2={465} y2={296} stroke="#0F172A" strokeWidth={4.5} strokeLinecap="round" />
            </G>

            {/* PARALES DELANTEROS (PILARES A) ESTILIZADOS EN LOS BORDES DEL PARABRISAS */}
            <Polygon points="0,0 58,0 24,335 0,335" fill="#0F172A" stroke="#334155" strokeWidth={2} />
            <Polygon
              points={`${VIEW3D_W},0 ${VIEW3D_W - 58},0 ${VIEW3D_W - 24},335 ${VIEW3D_W},335`}
              fill="#0F172A"
              stroke="#334155"
              strokeWidth={2}
            />

            {/* SALPICADERO Y TABLERO DE INSTRUMENTOS EN PRIMERA PERSONA */}
            <Path
              d={`M 0 324 Q 240 302 480 308 Q 720 302 ${VIEW3D_W} 324 L ${VIEW3D_W} ${VIEW3D_H} L 0 ${VIEW3D_H} Z`}
              fill="url(#cockpitDashGrad)"
              stroke="#334155"
              strokeWidth={2}
            />

            {/* Cúpula de instrumentos detrás de la caja de dirección */}
            <Path
              d="M 36 324 Q 190 272 344 324 L 344 420 L 36 420 Z"
              fill="#020617"
              stroke="#475569"
              strokeWidth={2.5}
            />

            {/* Tacómetro (RPM x1000) */}
            <Circle cx={118} cy={364} r={34} fill="#0F172A" stroke="#38BDF8" strokeWidth={2} />
            <SvgText x={118} y={352} fill="#94A3B8" fontSize="7.5" fontWeight="bold" textAnchor="middle">
              RPM x1000
            </SvgText>
            <SvgText
              x={118}
              y={370}
              fill={carState.rpm > 5200 ? '#EF4444' : '#38BDF8'}
              fontSize="14"
              fontWeight="bold"
              textAnchor="middle">
              {(carState.rpm / 1000).toFixed(1)}
            </SvgText>
            <SvgText x={118} y={382} fill="#64748B" fontSize="7" fontWeight="bold" textAnchor="middle">
              {clutchActive ? 'EMBRAGUE' : engineOn ? 'MOTOR ON' : 'OFF'}
            </SvgText>

            {/* Indicador Digital de Marcha Actual (R, N, 1, 2, 3, 4, 5) */}
            <Rect
              x={168}
              y={334}
              width={42}
              height={52}
              rx={7}
              fill="#0F172A"
              stroke={gear === 'R' ? '#F59E0B' : gear === 'N' ? '#94A3B8' : '#10B981'}
              strokeWidth={2}
            />
            <SvgText x={189} y={346} fill="#94A3B8" fontSize="7" fontWeight="bold" textAnchor="middle">
              CAMBIO
            </SvgText>
            <SvgText
              x={189}
              y={374}
              fill={gear === 'R' ? '#F59E0B' : gear === 'N' ? '#E2E8F0' : '#10B981'}
              fontSize="24"
              fontWeight="bold"
              textAnchor="middle">
              {gear}
            </SvgText>

            {/* Testigos de direccionales */}
            <SvgText x={162} y={326} fill={leftBlinkOn ? '#22C55E' : '#1E293B'} fontSize="14" fontWeight="bold">
              ◀
            </SvgText>
            <SvgText x={204} y={326} fill={rightBlinkOn ? '#22C55E' : '#1E293B'} fontSize="14" fontWeight="bold">
              ▶
            </SvgText>

            {/* Velocímetro (km/h) */}
            <Circle cx={260} cy={364} r={34} fill="#0F172A" stroke="#10B981" strokeWidth={2} />
            <SvgText x={260} y={352} fill="#94A3B8" fontSize="7.5" fontWeight="bold" textAnchor="middle">
              VELOCIDAD
            </SvgText>
            <SvgText x={260} y={371} fill="#10B981" fontSize="16" fontWeight="bold" textAnchor="middle">
              {speedKmh}
            </SvgText>
            <SvgText x={260} y={383} fill="#64748B" fontSize="7.5" fontWeight="bold" textAnchor="middle">
              km/h
            </SvgText>
          </Svg>

          {/* BARRA FLOTANTE SUPERIOR DE ESTADO Y MANDOS DE CABINA */}
          <View style={styles.windshieldTopHud} pointerEvents="box-none">
            <View style={styles.statusBannerPill}>
              <Ionicons name="speedometer-outline" size={13} color={PsychoPalette.mint} />
              <Text style={styles.statusBannerText} numberOfLines={1}>
                {statusBanner}
              </Text>
            </View>

            <View style={styles.carInteriorButtons}>
              <Pressable
                onPress={() => {
                  setEngineOn((p) => !p);
                  playRightSignal();
                }}
                style={[styles.cabinSwitchBtn, engineOn ? styles.cabinSwitchBtnMint : styles.cabinSwitchBtnRed]}>
                <Ionicons name="power" size={11} color="#FFFFFF" />
                <Text style={styles.cabinSwitchText}>{engineOn ? 'MOTOR' : 'OFF'}</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setTurnSignal((p) => (p === 'LEFT' ? 'NONE' : 'LEFT'));
                  playLeftSignal();
                }}
                style={[styles.cabinSwitchBtn, leftBlinkOn && styles.cabinSwitchBtnAmber]}>
                <Text style={styles.cabinSwitchText}>◀ IZQ</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setTurnSignal((p) => (p === 'HAZARD' ? 'NONE' : 'HAZARD'));
                  playError();
                }}
                style={[styles.cabinSwitchBtn, turnSignal === 'HAZARD' && styles.cabinSwitchBtnRed]}>
                <Ionicons name="warning" size={11} color="#FFFFFF" />
              </Pressable>

              <Pressable
                onPress={() => {
                  setTurnSignal((p) => (p === 'RIGHT' ? 'NONE' : 'RIGHT'));
                  playRightSignal();
                }}
                style={[styles.cabinSwitchBtn, rightBlinkOn && styles.cabinSwitchBtnAmber]}>
                <Text style={styles.cabinSwitchText}>DER ▶</Text>
              </Pressable>

              <Pressable
                onPress={() => setLightsOn((p) => !p)}
                style={[styles.cabinSwitchBtn, lightsOn && styles.cabinSwitchBtnCyan]}>
                <Ionicons name="flashlight" size={11} color="#FFFFFF" />
              </Pressable>

              <Pressable
                onPress={() => {
                  setWipersOn((p) => {
                    const next = !p;
                    if (!next) setWiperAngle(0);
                    return next;
                  });
                }}
                style={[styles.cabinSwitchBtn, wipersOn && styles.cabinSwitchBtnCyan]}>
                <Ionicons name="water" size={11} color="#FFFFFF" />
              </Pressable>

              <Pressable
                onPress={() => setSeatbeltOn((p) => !p)}
                style={[styles.cabinSwitchBtn, seatbeltOn && styles.cabinSwitchBtnMint]}>
                <Ionicons name="shield-checkmark" size={11} color="#FFFFFF" />
              </Pressable>

              <Pressable
                onPress={() => setHandbrakeOn((p) => !p)}
                style={[styles.cabinSwitchBtn, handbrakeOn && styles.cabinSwitchBtnRed]}>
                <Text style={styles.cabinSwitchText}>(P) MANO</Text>
              </Pressable>
            </View>
          </View>

          {/* ==================== MANDOS INFERIORES EN HORIZONTAL: VOLANTE + CAJA EN H + 3 PEDALES INDEPENDIENTES ==================== */}
          <View style={styles.bottomCockpitControls} pointerEvents="box-none">
            {/* 1. CAJA DE DIRECCIÓN (VOLANTE 3D) */}
            <View style={styles.steeringColumnBox}>
              <GestureDetector gesture={steeringWheelGesture}>
                <View style={styles.steeringWheelTouchBox}>
                  <View pointerEvents="none">
                    <Svg
                      width={136}
                      height={136}
                      viewBox="0 0 134 134"
                      style={{ transform: [{ rotate: `${wheelVisualRotateDeg}deg` }] }}>
                      <Circle
                        cx={67}
                        cy={67}
                        r={56}
                        fill="none"
                        stroke="#0F172A"
                        strokeWidth={15}
                      />
                      <Circle
                        cx={67}
                        cy={67}
                        r={56}
                        fill="none"
                        stroke="#334155"
                        strokeWidth={3.5}
                      />
                      <Rect x={63} y={5} width={8} height={11} rx={2} fill="#EF4444" />
                      <Polygon
                        points="16,60 47,54 47,76 18,76"
                        fill="#64748B"
                        stroke="#1E293B"
                        strokeWidth={1.5}
                      />
                      <Polygon
                        points="118,60 87,54 87,76 116,76"
                        fill="#64748B"
                        stroke="#1E293B"
                        strokeWidth={1.5}
                      />
                      <Polygon
                        points="56,84 78,84 72,120 62,120"
                        fill="#64748B"
                        stroke="#1E293B"
                        strokeWidth={1.5}
                      />
                      <Circle
                        cx={67}
                        cy={67}
                        r={24}
                        fill="#1E293B"
                        stroke="#94A3B8"
                        strokeWidth={2}
                      />
                      <Circle cx={67} cy={67} r={8} fill="#38BDF8" />
                    </Svg>
                  </View>
                </View>
              </GestureDetector>
              <View style={styles.wheelInfoPill}>
                <Text style={styles.wheelInfoText}>
                  DIRECCIÓN: {steerAngleDeg > 0 ? `+${steerAngleDeg}°` : `${steerAngleDeg}°`}
                </Text>
              </View>
            </View>

            {/* 2. CAJA DE CAMBIOS EN H (R, N, 1, 2, 3, 4, 5) */}
            <View style={styles.realShifterConsole}>
              <Text style={styles.shifterHeaderTitle}>
                CAJA DE CAMBIOS ({currentGearSpec.label})
              </Text>

              <View style={styles.shifterBodyRow}>
                <GestureDetector gesture={shifterPanGesture}>
                  <View style={styles.hGateTouchBox}>
                    <View pointerEvents="none">
                      <Svg width={98} height={88} viewBox="0 0 100 100">
                        <Rect
                          x={4}
                          y={4}
                          width={92}
                          height={92}
                          rx={18}
                          fill="#1E293B"
                          stroke="#64748B"
                          strokeWidth={2.5}
                        />
                        <Path
                          d="M 18 22 L 18 78 M 39 22 L 39 78 M 61 22 L 61 78 M 18 50 L 61 50"
                          stroke="#020617"
                          strokeWidth={8}
                          strokeLinecap="round"
                        />
                        <Path
                          d="M 18 22 L 18 78 M 39 22 L 39 78 M 61 22 L 61 78 M 18 50 L 61 50"
                          stroke="#475569"
                          strokeWidth={2.5}
                          strokeLinecap="round"
                        />
                        <SvgText x={18} y={14} fill="#F59E0B" fontSize="9" fontWeight="bold" textAnchor="middle">
                          R
                        </SvgText>
                        <SvgText x={18} y={92} fill="#E2E8F0" fontSize="9" fontWeight="bold" textAnchor="middle">
                          1
                        </SvgText>
                        <SvgText x={39} y={14} fill="#E2E8F0" fontSize="9" fontWeight="bold" textAnchor="middle">
                          2
                        </SvgText>
                        <SvgText x={39} y={92} fill="#E2E8F0" fontSize="9" fontWeight="bold" textAnchor="middle">
                          3
                        </SvgText>
                        <SvgText x={61} y={14} fill="#E2E8F0" fontSize="9" fontWeight="bold" textAnchor="middle">
                          4
                        </SvgText>
                        <SvgText x={61} y={92} fill="#E2E8F0" fontSize="9" fontWeight="bold" textAnchor="middle">
                          5
                        </SvgText>
                        <SvgText x={82} y={53} fill="#38BDF8" fontSize="9" fontWeight="bold" textAnchor="middle">
                          N
                        </SvgText>
                        <Line
                          x1={42}
                          y1={50}
                          x2={currentGearSpec.slotX}
                          y2={currentGearSpec.slotY}
                          stroke="#CBD5E1"
                          strokeWidth={6}
                          strokeLinecap="round"
                        />
                        <G transform={`translate(${currentGearSpec.slotX}, ${currentGearSpec.slotY})`}>
                          <Circle
                            cx={0}
                            cy={0}
                            r={14}
                            fill="#0F172A"
                            stroke={gear === 'R' ? '#F59E0B' : gear === 'N' ? '#38BDF8' : '#10B981'}
                            strokeWidth={2.5}
                          />
                          <SvgText
                            x={0}
                            y={4}
                            fill="#FFFFFF"
                            fontSize="10"
                            fontWeight="bold"
                            textAnchor="middle">
                            {gear}
                          </SvgText>
                        </G>
                      </Svg>
                    </View>
                  </View>
                </GestureDetector>

                <View style={styles.gearButtonsGrid}>
                  <View style={styles.gearButtonsRow}>
                    {(['R', '2', '4', 'N'] as ManualGear[]).map((g) => {
                      const active = gear === g;
                      return (
                        <Pressable
                          key={g}
                          onPress={() => selectGear(g)}
                          style={[
                            styles.gearSlotBtn,
                            active && (g === 'R' ? styles.gearSlotBtnReverse : styles.gearSlotBtnActive),
                          ]}>
                          <Text style={[styles.gearSlotBtnText, active && styles.gearSlotBtnTextActive]}>
                            {g}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={styles.gearButtonsRow}>
                    {(['1', '3', '5'] as ManualGear[]).map((g) => {
                      const active = gear === g;
                      return (
                        <Pressable
                          key={g}
                          onPress={() => selectGear(g)}
                          style={[styles.gearSlotBtn, active && styles.gearSlotBtnActive]}>
                          <Text style={[styles.gearSlotBtnText, active && styles.gearSlotBtnTextActive]}>
                            {g}ª
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
            </View>

            {/* 3. LOS 3 PEDALES INDEPENDIENTES PARA CADA FUNCIÓN: EMBRAGUE + FRENO + ACELERADOR */}
            <View style={styles.independentPedalsBox}>
              <View style={styles.pedalsHeaderRow}>
                <Text style={styles.pedalsHeaderLabel}>PEDALES INDEPENDIENTES</Text>
                <Pressable
                  onPress={() => {
                    if (gear === 'N') setGear('1');
                    setHandbrakeOn(false);
                    setThrottleLock((prev) => !prev);
                  }}
                  style={[styles.lockGasMiniBtn, throttleLock && styles.lockGasMiniBtnActive]}>
                  <Ionicons
                    name={throttleLock ? 'lock-closed' : 'lock-open-outline'}
                    size={10}
                    color={throttleLock ? '#020617' : PsychoPalette.mint}
                  />
                  <Text style={[styles.lockGasMiniText, throttleLock && { color: '#020617' }]}>
                    {throttleLock ? 'ACEL. FIJO ON' : 'FIJAR ACEL.'}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.threePedalsRow}>
                {/* PEDAL 1: EMBRAGUE INDEPENDIENTE (IZQUIERDA) */}
                <Pressable
                  onTouchStart={() => setClutchActive(true)}
                  onTouchEnd={() => setClutchActive(false)}
                  onTouchCancel={() => setClutchActive(false)}
                  onPressIn={() => setClutchActive(true)}
                  onPressOut={() => setClutchActive(false)}
                  style={[
                    styles.singlePedalCard,
                    styles.clutchPedalBorder,
                    clutchActive && styles.pedalPressedScale,
                  ]}>
                  <View style={styles.pedalBarTrack}>
                    <View
                      style={[
                        styles.pedalBarFill,
                        {
                          height: clutchActive ? '100%' : '12%',
                          backgroundColor: '#38BDF8',
                        },
                      ]}
                    />
                  </View>
                  <View pointerEvents="none">
                    <Svg width={44} height={68} viewBox="0 0 54 84">
                      <Rect
                        x={4}
                        y={4}
                        width={46}
                        height={76}
                        rx={8}
                        fill={clutchActive ? '#7DD3FC' : '#CBD5E1'}
                        stroke="#0F172A"
                        strokeWidth={2.5}
                      />
                      {[16, 27, 38].map((cx) =>
                        [18, 34, 50, 64].map((cy) => (
                          <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={3} fill="#1E293B" />
                        ))
                      )}
                    </Svg>
                  </View>
                  <Text style={[styles.pedalNameTag, { color: '#38BDF8' }]}>EMBRAGUE</Text>
                </Pressable>

                {/* PEDAL 2: FRENO INDEPENDIENTE (CENTRO - SOLO DETIENE EL CARRO) */}
                <Pressable
                  onTouchStart={() => {
                    setBrakeActive(true);
                    setThrottleLock(false);
                  }}
                  onTouchEnd={() => setBrakeActive(false)}
                  onTouchCancel={() => setBrakeActive(false)}
                  onPressIn={() => {
                    setBrakeActive(true);
                    setThrottleLock(false);
                  }}
                  onPressOut={() => setBrakeActive(false)}
                  style={[
                    styles.singlePedalCard,
                    styles.brakePedalBorder,
                    brakeActive && styles.pedalPressedScale,
                  ]}>
                  <View style={styles.pedalBarTrack}>
                    <View
                      style={[
                        styles.pedalBarFill,
                        {
                          height: brakeActive ? '100%' : '12%',
                          backgroundColor: '#EF4444',
                        },
                      ]}
                    />
                  </View>
                  <View pointerEvents="none">
                    <Svg width={56} height={68} viewBox="0 0 68 84">
                      <Rect
                        x={4}
                        y={8}
                        width={60}
                        height={68}
                        rx={9}
                        fill={brakeActive ? '#FCA5A5' : '#E2E8F0'}
                        stroke="#0F172A"
                        strokeWidth={2.5}
                      />
                      {[16, 28, 40, 52].map((cx) =>
                        [22, 38, 54].map((cy) => (
                          <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={3.2} fill="#1E293B" />
                        ))
                      )}
                    </Svg>
                  </View>
                  <Text style={[styles.pedalNameTag, { color: '#F87171' }]}>FRENO</Text>
                </Pressable>

                {/* PEDAL 3: ACELERADOR INDEPENDIENTE (DERECHA - IMPULSA EN LA MARCHA ACTUAL) */}
                <Pressable
                  onTouchStart={() => {
                    if (gear === 'N') setGear('1');
                    setHandbrakeOn(false);
                    setGasActive(true);
                  }}
                  onTouchEnd={() => setGasActive(false)}
                  onTouchCancel={() => setGasActive(false)}
                  onPressIn={() => {
                    if (gear === 'N') setGear('1');
                    setHandbrakeOn(false);
                    setGasActive(true);
                  }}
                  onPressOut={() => setGasActive(false)}
                  style={[
                    styles.singlePedalCard,
                    styles.gasPedalBorder,
                    (gasActive || throttleLock) && styles.pedalPressedScale,
                  ]}>
                  <View style={styles.pedalBarTrack}>
                    <View
                      style={[
                        styles.pedalBarFill,
                        {
                          height: gasActive || throttleLock ? '100%' : '12%',
                          backgroundColor: '#10B981',
                        },
                      ]}
                    />
                  </View>
                  <View pointerEvents="none">
                    <Svg width={48} height={74} viewBox="0 0 58 92">
                      <Rect
                        x={5}
                        y={4}
                        width={48}
                        height={84}
                        rx={9}
                        fill={gasActive || throttleLock ? '#86EFAC' : '#E2E8F0'}
                        stroke="#0F172A"
                        strokeWidth={2.5}
                      />
                      {[18, 29, 40].map((cx) =>
                        [18, 34, 50, 66].map((cy) => (
                          <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={3.2} fill="#1E293B" />
                        ))
                      )}
                    </Svg>
                  </View>
                  <Text style={[styles.pedalNameTag, { color: '#34D399' }]}>ACELERADOR</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* MODAL DE ÉXITO AL ESTACIONAR DENTRO DE LA ZONA AZUL [P] */}
          {parkedSuccess ? (
            <View style={styles.successOverlay}>
              <View style={styles.successModalCard}>
                <Ionicons name="checkmark-done-circle" size={44} color={PsychoPalette.mint} />
                <Text style={styles.successModalTitle}>¡PRUEBA DE CONDUCCIÓN 3D SUPERADA!</Text>
                <Text style={styles.successModalDesc}>
                  Estacionó correctamente dentro de la Zona [P] en {elapsedSec.toFixed(1)}s con{' '}
                  {collisions} {collisions === 1 ? 'cono tocado' : 'conos tocados'}.
                </Text>
                <View style={styles.successModalActions}>
                  <Pressable onPress={() => resetScenario(scenario)} style={styles.modalRepeatBtn}>
                    <Ionicons name="refresh" size={14} color={PsychoPalette.bgPrimary} />
                    <Text style={styles.modalBtnText}>REPETIR NIVEL</Text>
                  </Pressable>
                  <Pressable onPress={() => router.push('/')} style={styles.modalDashboardBtn}>
                    <Text style={styles.modalBtnText}>VER BAREMOS EN TABLERO</Text>
                    <Ionicons name="arrow-forward" size={14} color={PsychoPalette.bgPrimary} />
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerRoot: {
    flex: 1,
    backgroundColor: PsychoPalette.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  landscapeWrapper: {
    backgroundColor: PsychoPalette.bgPrimary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  compactTopBar: {
    backgroundColor: PsychoPalette.bgSecondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  leftNavGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: PsychoPalette.bgPanel,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
  },
  backBtnText: {
    color: PsychoPalette.textPrimary,
    fontSize: 8.5,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  scenarioTabs: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  scenarioTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
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
    fontSize: 8.5,
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
    gap: 5,
  },
  statBadge: {
    backgroundColor: PsychoPalette.bgPanel,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignItems: 'center',
  },
  statBadgeLabel: {
    color: PsychoPalette.textMuted,
    fontSize: 6.5,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
  statBadgeValue: {
    fontSize: 10,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  resetSimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: PsychoPalette.mint,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  resetSimBtnText: {
    color: PsychoPalette.bgPrimary,
    fontSize: 8.5,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  viewportContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: PsychoPalette.borderSubtle,
    overflow: 'hidden',
    position: 'relative',
  },
  windshieldTopHud: {
    position: 'absolute',
    top: 8,
    left: 54,
    right: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  statusBannerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(2, 6, 23, 0.84)',
    borderWidth: 1,
    borderColor: PsychoPalette.mint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBannerText: {
    color: '#F8FAFC',
    fontSize: 8.5,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
  carInteriorButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cabinSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(2, 6, 23, 0.86)',
    borderWidth: 1,
    borderColor: '#475569',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cabinSwitchBtnAmber: {
    backgroundColor: '#F59E0B',
    borderColor: '#FEF08A',
  },
  cabinSwitchBtnRed: {
    backgroundColor: '#EF4444',
    borderColor: '#FCA5A5',
  },
  cabinSwitchBtnCyan: {
    backgroundColor: '#0284C7',
    borderColor: '#7DD3FC',
  },
  cabinSwitchBtnMint: {
    backgroundColor: '#059669',
    borderColor: '#6EE7B7',
  },
  cabinSwitchText: {
    color: '#FFFFFF',
    fontSize: 7.5,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  bottomCockpitControls: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  steeringColumnBox: {
    alignItems: 'center',
    gap: 2,
  },
  steeringWheelTouchBox: {
    width: 136,
    height: 136,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelInfoPill: {
    backgroundColor: 'rgba(2, 6, 23, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: PsychoPalette.cyan,
  },
  wheelInfoText: {
    color: PsychoPalette.cyan,
    fontSize: 7.5,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  realShifterConsole: {
    backgroundColor: 'rgba(2, 6, 23, 0.92)',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#475569',
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: 'center',
    gap: 3,
  },
  shifterHeaderTitle: {
    color: '#E2E8F0',
    fontSize: 7.5,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  shifterBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hGateTouchBox: {
    width: 98,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearButtonsGrid: {
    gap: 4,
  },
  gearButtonsRow: {
    flexDirection: 'row',
    gap: 3,
  },
  gearSlotBtn: {
    minWidth: 26,
    paddingVertical: 5,
    paddingHorizontal: 5,
    borderRadius: 5,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
    alignItems: 'center',
  },
  gearSlotBtnActive: {
    backgroundColor: PsychoPalette.mint,
    borderColor: '#FFFFFF',
  },
  gearSlotBtnReverse: {
    backgroundColor: '#F59E0B',
    borderColor: '#FFFFFF',
  },
  gearSlotBtnText: {
    color: '#CBD5E1',
    fontSize: 8.5,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  gearSlotBtnTextActive: {
    color: '#020617',
  },
  independentPedalsBox: {
    backgroundColor: 'rgba(2, 6, 23, 0.92)',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  pedalsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  pedalsHeaderLabel: {
    color: '#94A3B8',
    fontSize: 7,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  lockGasMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: PsychoPalette.mint,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  lockGasMiniBtnActive: {
    backgroundColor: PsychoPalette.mint,
  },
  lockGasMiniText: {
    color: PsychoPalette.mint,
    fontSize: 6.5,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  threePedalsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  singlePedalCard: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1.5,
    paddingHorizontal: 5,
    paddingVertical: 4,
    alignItems: 'center',
    gap: 2,
    position: 'relative',
  },
  clutchPedalBorder: {
    borderColor: 'rgba(56, 189, 248, 0.5)',
  },
  brakePedalBorder: {
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  gasPedalBorder: {
    borderColor: 'rgba(16, 185, 129, 0.5)',
  },
  pedalPressedScale: {
    transform: [{ scale: 0.93 }],
    backgroundColor: '#1E293B',
  },
  pedalBarTrack: {
    width: '100%',
    height: 4,
    backgroundColor: '#020617',
    borderRadius: 2,
    overflow: 'hidden',
  },
  pedalBarFill: {
    width: '100%',
    borderRadius: 2,
  },
  pedalNameTag: {
    fontSize: 7,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  successOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5, 9, 20, 0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  successModalCard: {
    backgroundColor: PsychoPalette.bgSecondary,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: PsychoPalette.mint,
    padding: 18,
    alignItems: 'center',
    gap: 8,
    maxWidth: 420,
    width: '100%',
  },
  successModalTitle: {
    color: PsychoPalette.mint,
    fontSize: 15,
    fontWeight: '900',
    fontFamily: Fonts.mono,
    textAlign: 'center',
  },
  successModalDesc: {
    color: PsychoPalette.textSecondary,
    fontSize: 11.5,
    textAlign: 'center',
    lineHeight: 17,
  },
  successModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  modalRepeatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: PsychoPalette.cyan,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modalDashboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: PsychoPalette.mint,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modalBtnText: {
    color: PsychoPalette.bgPrimary,
    fontSize: 10.5,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
});
