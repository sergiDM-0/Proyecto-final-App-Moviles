// Geometría y datos del mundo 3D del simulador de maniobras.
// Módulo puro (sin React ni React Native) para poder medir su rendimiento con `npm run bench`.

// Entorno 3D ampliado (gran complejo vial de 1200 x 920 unidades)
export const WORLD_W = 1200;
export const WORLD_H = 920;
export const CAR_LENGTH = 54;
export const CAR_WIDTH = 28;
export const WHEELBASE = 36;
export const MAX_STEER_RAD = (38 * Math.PI) / 180;
export const STEERING_WHEEL_RADIUS = 54;

// Visor panorámico horizontal 16:9 optimizado para pantalla de celular en horizontal
export const VIEW3D_W = 960;
export const VIEW3D_H = 440;
export const HORIZON_Y = 134;
export const FOCAL_LEN = 395;

// Recorte por distancia: lo que queda más lejos queda oculto por la bruma, no se dibuja (menos nodos SVG por cuadro)
export const DRAW_DISTANCE = 900;
export const TILE_DISTANCE = 780;

export type ManualGear = 'R' | 'N' | '1' | '2' | '3' | '4' | '5';

export interface GearSpec {
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
    shortDesc: 'Marcha atrás ágil — Presione ACELERADOR para retroceder con respuesta rápida',
    maxSpeedPx: -68,
    maxKmh: 28,
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
    shortDesc: 'Arranque rápido y maniobra ágil (0-30 km/h)',
    maxSpeedPx: 72,
    maxKmh: 32,
    accelFactor: 1.25,
    slotX: 18,
    slotY: 78,
  },
  '2': {
    gear: '2',
    label: '2ª MARCHA',
    shortDesc: 'Giro dinámico en pista urbana (0-50 km/h)',
    maxSpeedPx: 115,
    maxKmh: 50,
    accelFactor: 1.1,
    slotX: 39,
    slotY: 22,
  },
  '3': {
    gear: '3',
    label: '3ª MARCHA',
    shortDesc: 'Circulación rápida y fluida (0-72 km/h)',
    maxSpeedPx: 164,
    maxKmh: 72,
    accelFactor: 0.96,
    slotX: 39,
    slotY: 78,
  },
  '4': {
    gear: '4',
    label: '4ª MARCHA',
    shortDesc: 'Crucero veloz en avenida (0-95 km/h)',
    maxSpeedPx: 216,
    maxKmh: 95,
    accelFactor: 0.85,
    slotX: 61,
    slotY: 22,
  },
  '5': {
    gear: '5',
    label: '5ª MARCHA',
    shortDesc: 'Velocidad máxima de pista (0-120 km/h)',
    maxSpeedPx: 272,
    maxKmh: 120,
    accelFactor: 0.76,
    slotX: 61,
    slotY: 78,
  },
};

export interface ConePoint {
  x: number;
  y: number;
}

export interface TreePoint {
  x: number;
  y: number;
  height: number;
  canopyDark: string;
  canopyMid: string;
  canopyLight: string;
}

export interface LampPoint {
  x: number;
  y: number;
}

export interface FloorArrow {
  x: number;
  y: number;
  angleDeg: number;
}

export interface ParkedCar3D {
  x: number;
  y: number;
  w: number;
  d: number;
  bodyColor: string;
  sideColor: string;
  roofColor: string;
}

export interface Building3D {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  frontColor: string;
  sideColor: string;
  topColor: string;
  label?: string;
}

export interface ParkingZone {
  x: number;
  y: number;
  w: number;
  h: number;
  targetAngleDeg: number;
}

export interface ScenarioConfig {
  id: string;
  title: string;
  shortLabel: string;
  startX: number;
  startY: number;
  startAngleDeg: number;
  parkingZone: ParkingZone;
  cones: ConePoint[];
  arrows: FloorArrow[];
  parkedCars: ParkedCar3D[];
}

// Edificios, separadores viales e infraestructura 3D real proyectada en el mundo
export const WORLD_BUILDINGS_3D: Building3D[] = [
  // Edificio Central AutoTest al norte de las bahías
  {
    x: 430,
    y: 12,
    z: 0,
    w: 310,
    d: 55,
    h: 95,
    frontColor: '#1E293B',
    sideColor: '#0F172A',
    topColor: '#334155',
    label: 'CENTRO OFICIAL • AUTOTEST 3D',
  },
  // Franja roja superior del edificio central
  {
    x: 424,
    y: 10,
    z: 78,
    w: 322,
    d: 60,
    h: 22,
    frontColor: '#DC2626',
    sideColor: '#991B1B',
    topColor: '#EF4444',
  },
  // Torre de Control Vial (Izquierda Norte)
  {
    x: 150,
    y: 10,
    z: 0,
    w: 150,
    d: 58,
    h: 145,
    frontColor: '#64748B',
    sideColor: '#475569',
    topColor: '#94A3B8',
  },
  // Edificio Corporativo (Derecha Norte)
  {
    x: 840,
    y: 10,
    z: 0,
    w: 185,
    d: 58,
    h: 135,
    frontColor: '#475569',
    sideColor: '#334155',
    topColor: '#64748B',
  },
  // Pórtico Vial 3D sobre la pista principal (Columna Izquierda, Columna Derecha y Travesaño Superior)
  {
    x: 205,
    y: 445,
    z: 0,
    w: 14,
    d: 14,
    h: 108,
    frontColor: '#94A3B8',
    sideColor: '#64748B',
    topColor: '#CBD5E1',
  },
  {
    x: 785,
    y: 445,
    z: 0,
    w: 14,
    d: 14,
    h: 108,
    frontColor: '#94A3B8',
    sideColor: '#64748B',
    topColor: '#CBD5E1',
  },
  {
    x: 200,
    y: 442,
    z: 92,
    w: 604,
    d: 20,
    h: 24,
    frontColor: '#0284C7',
    sideColor: '#0369A1',
    topColor: '#38BDF8',
    label: 'ZONA DE MANIOBRAS Y PARQUEO [P]',
  },
  // Islas separadoras viales 3D con relieve en la pista
  {
    x: 880,
    y: 230,
    z: 0,
    w: 85,
    d: 360,
    h: 7,
    frontColor: '#15803D',
    sideColor: '#CBD5E1',
    topColor: '#16A34A',
  },
];

// Árboles 3D volumétricos distribuidos alrededor del gran complejo vial (1200 x 920)
export const WORLD_TREES: TreePoint[] = [
  { x: 85, y: 32, height: 88, canopyDark: '#14532D', canopyMid: '#15803D', canopyLight: '#4ADE80' },
  { x: 355, y: 28, height: 82, canopyDark: '#14532D', canopyMid: '#16A34A', canopyLight: '#86EFAC' },
  { x: 785, y: 28, height: 92, canopyDark: '#064E3B', canopyMid: '#059669', canopyLight: '#6EE7B7' },
  { x: 1085, y: 32, height: 94, canopyDark: '#14532D', canopyMid: '#16A34A', canopyLight: '#4ADE80' },
  // Avenida Izquierda
  { x: 35, y: 150, height: 84, canopyDark: '#14532D', canopyMid: '#16A34A', canopyLight: '#4ADE80' },
  { x: 32, y: 310, height: 90, canopyDark: '#064E3B', canopyMid: '#059669', canopyLight: '#34D399' },
  { x: 36, y: 470, height: 82, canopyDark: '#78350F', canopyMid: '#CA8A04', canopyLight: '#FACC15' },
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
  // Islas ecológicas internas
  { x: 922, y: 295, height: 78, canopyDark: '#14532D', canopyMid: '#16A34A', canopyLight: '#4ADE80' },
  { x: 922, y: 515, height: 82, canopyDark: '#064E3B', canopyMid: '#059669', canopyLight: '#6EE7B7' },
];

// Postes de alumbrado vial 3D a lo largo de la pista
export const WORLD_LAMPS: LampPoint[] = [
  { x: 140, y: 88 },
  { x: 410, y: 88 },
  { x: 740, y: 88 },
  { x: 1020, y: 88 },
  { x: 95, y: 360 },
  { x: 95, y: 660 },
  { x: 1095, y: 360 },
  { x: 1095, y: 660 },
];

// Los 3 niveles de conducción con vehículos 3D estacionados de referencia
export const SCENARIOS: ScenarioConfig[] = [
  {
    id: 'bay',
    title: 'Nivel 1: Circuito Vial y Parqueo en Bahía [P] (90°)',
    shortLabel: '1. PARQUEO [P] 90°',
    startX: 250,
    startY: 730,
    startAngleDeg: -45,
    parkingZone: {
      x: 520,
      y: 120,
      w: 112,
      h: 142,
      targetAngleDeg: -90,
    },
    parkedCars: [
      // Vehículos 3D estacionados en las bahías vecinas izquierda y derecha
      {
        x: 385,
        y: 128,
        w: 56,
        d: 108,
        bodyColor: '#DC2626',
        sideColor: '#991B1B',
        roofColor: '#F87171',
      },
      {
        x: 705,
        y: 128,
        w: 56,
        d: 108,
        bodyColor: '#2563EB',
        sideColor: '#1E40AF',
        roofColor: '#60A5FA',
      },
    ],
    cones: [
      { x: 150, y: 810 },
      { x: 260, y: 810 },
      { x: 370, y: 810 },
      { x: 480, y: 810 },
      { x: 590, y: 810 },
      { x: 700, y: 810 },
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
      { x: 760, y: 340 },
      { x: 840, y: 440 },
    ],
    arrows: [
      { x: 325, y: 640, angleDeg: -42 },
      { x: 455, y: 500, angleDeg: -65 },
      { x: 575, y: 350, angleDeg: -90 },
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
      w: 164,
      h: 96,
      targetAngleDeg: 0,
    },
    parkedCars: [
      // Vehículos 3D estacionados adelante y atrás del cajón de parqueo paralelo
      {
        x: 345,
        y: 144,
        w: 112,
        d: 56,
        bodyColor: '#F59E0B',
        sideColor: '#B45309',
        roofColor: '#FBBF24',
      },
      {
        x: 725,
        y: 144,
        w: 112,
        d: 56,
        bodyColor: '#0EA5E9',
        sideColor: '#0369A1',
        roofColor: '#38BDF8',
      },
    ],
    cones: [
      { x: 310, y: 130 },
      { x: 480, y: 130 },
      { x: 480, y: 225 },
      { x: 700, y: 130 },
      { x: 700, y: 225 },
      { x: 870, y: 130 },
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
      x: 830,
      y: 135,
      w: 156,
      h: 108,
      targetAngleDeg: 0,
    },
    parkedCars: [
      {
        x: 645,
        y: 145,
        w: 110,
        d: 56,
        bodyColor: '#10B981',
        sideColor: '#047857',
        roofColor: '#34D399',
      },
    ],
    cones: [
      { x: 410, y: 540 },
      { x: 410, y: 615 },
      { x: 590, y: 360 },
      { x: 590, y: 435 },
      { x: 750, y: 410 },
      { x: 750, y: 485 },
      { x: 260, y: 820 },
      { x: 450, y: 800 },
      { x: 650, y: 740 },
      { x: 840, y: 640 },
      { x: 980, y: 480 },
      { x: 810, y: 135 },
      { x: 1010, y: 135 },
    ],
    arrows: [
      { x: 310, y: 650, angleDeg: -30 },
      { x: 500, y: 480, angleDeg: -15 },
      { x: 700, y: 320, angleDeg: -25 },
      { x: 830, y: 265, angleDeg: -45 },
    ],
  },
];

export function getCarCorners(x: number, y: number, angleRad: number) {
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

export interface Pt3D {
  x: number;
  y: number;
  z: number;
}

export interface ProjectedPt {
  sx: number;
  sy: number;
  depth: number;
  scale: number;
}

export function projectPoint3D(
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

export function projectPolygon3D(
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

export interface ProjectedFace3D {
  pointsStr: string;
  fill: string;
  stroke: string;
  label?: string;
  labelX?: number;
  labelY?: number;
}

// Motor de extrusión de volúmenes 3D (proyecta caras visibles con sombreado direccional exacto)
export function projectBox3D(
  box: {
    x: number;
    y: number;
    z: number;
    w: number;
    d: number;
    h: number;
    frontColor: string;
    sideColor: string;
    topColor: string;
    strokeColor?: string;
    label?: string;
  },
  camX: number,
  camY: number,
  camZ: number,
  camYaw: number,
  pitchOffset = 10
): { faces: ProjectedFace3D[]; depth: number } | null {
  const { x, y, z, w, d, h, frontColor, sideColor, topColor, strokeColor = '#0F172A', label } = box;
  const centerX = x + w / 2;
  const centerY = y + d / 2;
  const dist = Math.hypot(centerX - camX, centerY - camY);
  if (dist > DRAW_DISTANCE) return null;

  const b0 = { x, y, z };
  const b1 = { x: x + w, y, z };
  const b2 = { x: x + w, y: y + d, z };
  const b3 = { x, y: y + d, z };
  const t0 = { x, y, z: z + h };
  const t1 = { x: x + w, y, z: z + h };
  const t2 = { x: x + w, y: y + d, z: z + h };
  const t3 = { x, y: y + d, z: z + h };

  const faces: ProjectedFace3D[] = [];

  // Caras laterales X (Oeste / Este)
  if (camX < x) {
    const f = projectPolygon3D([b0, b3, t3, t0], camX, camY, camZ, camYaw, pitchOffset);
    if (f) faces.push({ pointsStr: f.pointsStr, fill: sideColor, stroke: strokeColor });
  } else if (camX > x + w) {
    const f = projectPolygon3D([b1, b2, t2, t1], camX, camY, camZ, camYaw, pitchOffset);
    if (f) faces.push({ pointsStr: f.pointsStr, fill: sideColor, stroke: strokeColor });
  }

  // Caras frontales/traseras Y (Norte / Sur)
  if (camY < y) {
    const f = projectPolygon3D([b0, b1, t1, t0], camX, camY, camZ, camYaw, pitchOffset);
    if (f) {
      faces.push({
        pointsStr: f.pointsStr,
        fill: frontColor,
        stroke: strokeColor,
        label,
        labelX: f.centerSx,
        labelY: f.centerSy,
      });
    }
  } else if (camY > y + d) {
    const f = projectPolygon3D([b3, b2, t2, t3], camX, camY, camZ, camYaw, pitchOffset);
    if (f) {
      faces.push({
        pointsStr: f.pointsStr,
        fill: frontColor,
        stroke: strokeColor,
        label,
        labelX: f.centerSx,
        labelY: f.centerSy,
      });
    }
  }

  // Cara superior / Techo (Z + H)
  if (camZ > z + h) {
    const f = projectPolygon3D([t0, t1, t2, t3], camX, camY, camZ, camYaw, pitchOffset);
    if (f) faces.push({ pointsStr: f.pointsStr, fill: topColor, stroke: strokeColor });
  }

  if (faces.length === 0) return null;
  return { faces, depth: dist };
}

// Pre-generación de losas de pavimento con variación tonal y brillo especular
export const ASPHALT_TILES: { x: number; y: number; w: number; h: number; shade: string }[] = [];
export const tileStepX = 140;
export const tileStepY = 120;
for (let gx = 80; gx < WORLD_W - 80; gx += tileStepX) {
  for (let gy = 80; gy < WORLD_H - 80; gy += tileStepY) {
    const idx = (((gx / tileStepX) | 0) + ((gy / tileStepY) | 0)) % 3;
    const shade = idx === 0 ? '#283548' : idx === 1 ? '#1E293B' : '#233044';
    ASPHALT_TILES.push({
      x: gx,
      y: gy,
      w: Math.min(tileStepX, WORLD_W - 80 - gx),
      h: Math.min(tileStepY, WORLD_H - 80 - gy),
      shade,
    });
  }
}

// Bordillos perimetrales 3D con volumen real (altura z = 4.5)
export const CURB_BOXES_3D: {
  x: number;
  y: number;
  w: number;
  d: number;
  topColor: string;
  sideColor: string;
}[] = [];
export const curbStep = 80;
for (let cx = 80; cx < WORLD_W - 80; cx += curbStep) {
  const isRed = ((cx / curbStep) | 0) % 2 === 0;
  CURB_BOXES_3D.push({
    x: cx,
    y: 72,
    w: Math.min(curbStep, WORLD_W - 80 - cx),
    d: 10,
    topColor: isRed ? '#EF4444' : '#F8FAFC',
    sideColor: isRed ? '#B91C1C' : '#CBD5E1',
  });
  CURB_BOXES_3D.push({
    x: cx,
    y: WORLD_H - 82,
    w: Math.min(curbStep, WORLD_W - 80 - cx),
    d: 10,
    topColor: isRed ? '#F8FAFC' : '#EF4444',
    sideColor: isRed ? '#CBD5E1' : '#B91C1C',
  });
}
for (let cy = 80; cy < WORLD_H - 80; cy += curbStep) {
  const isRed = ((cy / curbStep) | 0) % 2 === 0;
  CURB_BOXES_3D.push({
    x: 72,
    y: cy,
    w: 10,
    d: Math.min(curbStep, WORLD_H - 80 - cy),
    topColor: isRed ? '#EF4444' : '#F8FAFC',
    sideColor: isRed ? '#B91C1C' : '#CBD5E1',
  });
  CURB_BOXES_3D.push({
    x: WORLD_W - 82,
    y: cy,
    w: 10,
    d: Math.min(curbStep, WORLD_H - 80 - cy),
    topColor: isRed ? '#F8FAFC' : '#EF4444',
    sideColor: isRed ? '#CBD5E1' : '#B91C1C',
  });
}


export interface CameraSnapshot {
  x: number;
  y: number;
  angleRad: number;
  camBobY: number;
  camPitch: number;
  camYawOff: number;
}

export interface RenderItem {
  type: 'BOX3D' | 'TREE' | 'LAMP' | 'CONE';
  depth: number;
  sx?: number;
  sy?: number;
  scale?: number;
  tree?: TreePoint;
  coneHit?: boolean;
  faces?: ProjectedFace3D[];
}

// Renderizado 3D con físicas de cámara, iluminación volumétrica, faros proyectados y entorno vivo
export function buildWorld3D(
  carState: CameraSnapshot,
  scenario: ScenarioConfig,
  tireTracks: { x: number; y: number; angleRad: number }[],
  hitConeIndices: number[]
) {
  const camDistBack = 4;
  const camZ = 38 + carState.camBobY * 0.65;
  const pitchOffset = 10 + carState.camPitch + carState.camBobY;

  const camX = carState.x - Math.cos(carState.angleRad) * camDistBack;
  const camY = carState.y - Math.sin(carState.angleRad) * camDistBack;
  const camYaw = carState.angleRad + carState.camYawOff;

  // 1. Base de asfalto general del complejo vial
  const asphaltBase = projectPolygon3D(
    [
      { x: 75, y: 75, z: 0 },
      { x: WORLD_W - 75, y: 75, z: 0 },
      { x: WORLD_W - 75, y: WORLD_H - 75, z: 0 },
      { x: 75, y: WORLD_H - 75, z: 0 },
    ],
    camX,
    camY,
    camZ,
    camYaw,
    pitchOffset
  );

  // 2. Losas texturizadas de asfalto y concreto
  const groundTiles: { pointsStr: string; shade: string }[] = [];
  ASPHALT_TILES.forEach((tile) => {
    const centerDist = Math.hypot(tile.x + tile.w / 2 - camX, tile.y + tile.h / 2 - camY);
    if (centerDist > TILE_DISTANCE) return;
    const poly = projectPolygon3D(
      [
        { x: tile.x + 1.5, y: tile.y + 1.5, z: 0.05 },
        { x: tile.x + tile.w - 1.5, y: tile.y + 1.5, z: 0.05 },
        { x: tile.x + tile.w - 1.5, y: tile.y + tile.h - 1.5, z: 0.05 },
        { x: tile.x + 1.5, y: tile.y + tile.h - 1.5, z: 0.05 },
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

  // 2b. Haces de luz 3D proyectados sobre el pavimento por los faros del vehículo
  const headlightBeams: string[] = [];
  const cosCar = Math.cos(carState.angleRad);
  const sinCar = Math.sin(carState.angleRad);
  [-13, 13].forEach((latOffset) => {
    const beamStartX = carState.x + 22 * cosCar - latOffset * sinCar;
    const beamStartY = carState.y + 22 * sinCar + latOffset * cosCar;
    const beamPoly = projectPolygon3D(
      [
        { x: beamStartX - 4 * sinCar, y: beamStartY + 4 * cosCar, z: 0.22 },
        { x: beamStartX + 4 * sinCar, y: beamStartY - 4 * cosCar, z: 0.22 },
        {
          x: beamStartX + 165 * cosCar + (latOffset * 1.8 + 36) * sinCar,
          y: beamStartY + 165 * sinCar - (latOffset * 1.8 + 36) * cosCar,
          z: 0.22,
        },
        {
          x: beamStartX + 165 * cosCar + (latOffset * 1.8 - 36) * sinCar,
          y: beamStartY + 165 * sinCar - (latOffset * 1.8 - 36) * cosCar,
          z: 0.22,
        },
      ],
      camX,
      camY,
      camZ,
      camYaw,
      pitchOffset
    );
    if (beamPoly) headlightBeams.push(beamPoly.pointsStr);
  });

  // 3. Bordillos perimetrales 3D con relieve real (z = 0..4.5)
  const curbBoxes: ProjectedFace3D[] = [];
  CURB_BOXES_3D.forEach((cb) => {
    const boxProj = projectBox3D(
      {
        x: cb.x,
        y: cb.y,
        z: 0,
        w: cb.w,
        d: cb.d,
        h: 4.5,
        frontColor: cb.sideColor,
        sideColor: cb.sideColor,
        topColor: cb.topColor,
        strokeColor: '#0F172A',
      },
      camX,
      camY,
      camZ,
      camYaw,
      pitchOffset
    );
    if (boxProj) {
      curbBoxes.push(...boxProj.faces);
    }
  });

  // 4. Marcas viales realistas: Líneas de carril segmentadas, doble línea central amarilla y paso cebra
  const whiteLaneDashes: string[] = [];
  const yellowDividerLines: string[] = [];

  for (let lx = 160; lx <= WORLD_W - 180; lx += 85) {
    [350, 610].forEach((ly) => {
      const dash = projectPolygon3D(
        [
          { x: lx, y: ly, z: 0.16 },
          { x: lx + 44, y: ly, z: 0.16 },
          { x: lx + 44, y: ly + 5, z: 0.16 },
          { x: lx, y: ly + 5, z: 0.16 },
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

  // Doble línea central amarilla vial
  [476, 484].forEach((yy) => {
    const yLine = projectPolygon3D(
      [
        { x: 160, y: yy, z: 0.16 },
        { x: 840, y: yy, z: 0.16 },
        { x: 840, y: yy + 3.5, z: 0.16 },
        { x: 160, y: yy + 3.5, z: 0.16 },
      ],
      camX,
      camY,
      camZ,
      camYaw,
      pitchOffset
    );
    if (yLine) yellowDividerLines.push(yLine.pointsStr);
  });

  // Líneas divisorias de bahías de parqueo superiores
  for (let bx = 160; bx <= WORLD_W - 180; bx += 112) {
    const bayLine = projectPolygon3D(
      [
        { x: bx, y: 102, z: 0.16 },
        { x: bx + 5, y: 102, z: 0.16 },
        { x: bx + 5, y: 268, z: 0.16 },
        { x: bx, y: 268, z: 0.16 },
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
  for (let zy = 650; zy <= 790; zy += 22) {
    const zebra = projectPolygon3D(
      [
        { x: 135, y: zy, z: 0.18 },
        { x: 192, y: zy, z: 0.18 },
        { x: 192, y: zy + 11, z: 0.18 },
        { x: 135, y: zy + 11, z: 0.18 },
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
      { dx: 30, dy: 0 },
      { dx: 6, dy: -17 },
      { dx: 6, dy: -6.5 },
      { dx: -26, dy: -6.5 },
      { dx: -26, dy: 6.5 },
      { dx: 6, dy: 6.5 },
      { dx: 6, dy: 17 },
    ];
    const worldPts = localArrow.map((p) => ({
      x: ar.x + p.dx * cos - p.dy * sin,
      y: ar.y + p.dx * sin + p.dy * cos,
      z: 0.28,
    }));
    const proj = projectPolygon3D(worldPts, camX, camY, camZ, camYaw, pitchOffset);
    if (proj) yellowArrows.push(proj.pointsStr);
  });

  // 7. Cajón Azul Oficial de Parqueo [ P ], tope de llantas 3D y Poste Vertical [ P ]
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

  // Tope amarillo 3D de llantas al fondo del cajón [P]
  const wheelStop3D = projectBox3D(
    {
      x: pz.x + 14,
      y: pz.y + 8,
      z: 0,
      w: pz.w - 28,
      d: 8,
      h: 5.5,
      frontColor: '#CA8A04',
      sideColor: '#854D0E',
      topColor: '#FACC15',
      strokeColor: '#0F172A',
    },
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
    { x: pz.x - 14, y: pz.y + 10, z: 66 },
    camX,
    camY,
    camZ,
    camYaw,
    pitchOffset
  );

  // 8. Objetos 3D Volumétricos ordenados por profundidad (Edificios 3D, Vehículos 3D, Árboles, Farolas y Conos)
  const renderItems: RenderItem[] = [];
  // Edificios, Pórtico Vial e Islas 3D
  WORLD_BUILDINGS_3D.forEach((b) => {
    const proj = projectBox3D(b, camX, camY, camZ, camYaw, pitchOffset);
    if (proj) {
      renderItems.push({
        type: 'BOX3D',
        depth: proj.depth,
        faces: proj.faces,
      });
    }
  });

  // Vehículos 3D estacionados en las bahías vecinas (Carrocería inferior + Cabina superior)
  scenario.parkedCars.forEach((pc) => {
    const lowerBody = projectBox3D(
      {
        x: pc.x,
        y: pc.y,
        z: 0,
        w: pc.w,
        d: pc.d,
        h: 15,
        frontColor: pc.bodyColor,
        sideColor: pc.sideColor,
        topColor: pc.roofColor,
        strokeColor: '#0F172A',
      },
      camX,
      camY,
      camZ,
      camYaw,
      pitchOffset
    );
    const upperCabin = projectBox3D(
      {
        x: pc.x + pc.w * 0.14,
        y: pc.y + pc.d * 0.18,
        z: 15,
        w: pc.w * 0.72,
        d: pc.d * 0.62,
        h: 13,
        frontColor: '#1E293B',
        sideColor: '#0F172A',
        topColor: pc.roofColor,
        strokeColor: '#CBD5E1',
      },
      camX,
      camY,
      camZ,
      camYaw,
      pitchOffset
    );
    if (lowerBody) {
      renderItems.push({
        type: 'BOX3D',
        depth: lowerBody.depth,
        faces: [...lowerBody.faces, ...(upperCabin ? upperCabin.faces : [])],
      });
    }
  });

  WORLD_TREES.forEach((tr) => {
    const pt = projectPoint3D(
      { x: tr.x, y: tr.y, z: 0 },
      camX,
      camY,
      camZ,
      camYaw,
      pitchOffset
    );
    if (pt && pt.depth < DRAW_DISTANCE && pt.sx > -110 && pt.sx < VIEW3D_W + 110) {
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
    if (pt && pt.depth < DRAW_DISTANCE && pt.sx > -80 && pt.sx < VIEW3D_W + 80) {
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
    headlightBeams,
    curbBoxes,
    whiteLaneDashes,
    yellowDividerLines,
    projectedTracks,
    yellowArrows,
    blueParkingBox,
    wheelStop3D,
    signBase,
    signTop,
    renderItems,
    horizonDynamicY: Math.round(HORIZON_Y + pitchOffset),
  };
}
