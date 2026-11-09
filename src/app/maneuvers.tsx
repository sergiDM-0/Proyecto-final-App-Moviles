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

import {
  buildWorld3D,
  GEAR_SPECS,
  getCarCorners,
  HORIZON_Y,
  MAX_STEER_RAD,
  SCENARIOS,
  STEERING_WHEEL_RADIUS,
  VIEW3D_H,
  VIEW3D_W,
  WHEELBASE,
  WORLD_H,
  WORLD_W,
} from '@/lib/maneuvers-world';
import type { ManualGear, ScenarioConfig } from '@/lib/maneuvers-world';

export default function ManeuversSimulatorScreen() {
  const { width: winW, height: winH } = useWindowDimensions();
  const isPortraitScreen = winH > winW;

  const { preoperationalResult, setManeuverResult } = useEvaluation();
  const { playLeftSignal, playRightSignal, playSuccess, playError } = usePsychAudio();

  const [scenario, setScenario] = useState<ScenarioConfig>(SCENARIOS[0]);
  const [completedLevelIds, setCompletedLevelIds] = useState<string[]>([]);
  const [lastGrade, setLastGrade] = useState<AptitudeGrade>('EXCELENTE');

  const [carState, setCarState] = useState({
    x: SCENARIOS[0].startX,
    y: SCENARIOS[0].startY,
    angleRad: (SCENARIOS[0].startAngleDeg * Math.PI) / 180,
    speed: 0,
    steerRad: 0,
    rpm: 850,
    camPitch: 0,
    camRollDeg: 0,
    camBobY: 0,
    camYawOff: 0,
    animPhase: 0,
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
    '1ª Marcha suave activa • Aceleración progresiva sin tirones y suspensión 3D activa'
  );

  const physicsRef = useRef({
    x: SCENARIOS[0].startX,
    y: SCENARIOS[0].startY,
    angleRad: (SCENARIOS[0].startAngleDeg * Math.PI) / 180,
    speed: 0,
    steerRad: 0,
    targetSteerRad: 0,
    throttleSmooth: 0,
    camPitch: 0,
    camRollDeg: 0,
    camBobY: 0,
    camYawOff: 0,
    animPhase: 0,
    rpm: 850,
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
    lastHudTime: 0,
    lastRenderTime: 0,
    completed: false,
  });

  const currentLevelIdx = useMemo(
    () => SCENARIOS.findIndex((s) => s.id === scenario.id),
    [scenario.id]
  );
  const nextScenario =
    currentLevelIdx >= 0 && currentLevelIdx < SCENARIOS.length - 1
      ? SCENARIOS[currentLevelIdx + 1]
      : null;

  useEffect(() => {
    const normalizedSteer = Math.max(-1, Math.min(1, wheelDragX / STEERING_WHEEL_RADIUS));
    physicsRef.current.targetSteerRad = normalizedSteer * MAX_STEER_RAD;
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

  // Soporte de teclado en Web (W=Acelerador, S=Freno, C/Shift=Embrague, A/D=Volante, 1-5/R/N=Caja)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') {
        setWheelDragX((prev) => Math.max(-STEERING_WHEEL_RADIUS, prev - 10));
        return;
      }
      if (k === 'arrowright' || k === 'd') {
        setWheelDragX((prev) => Math.min(STEERING_WHEEL_RADIUS, prev + 10));
        return;
      }
      if (e.repeat) return;
      if (k === 'arrowup' || k === 'w') {
        physicsRef.current.gas = true;
        setGasActive(true);
      } else if (k === 'arrowdown' || k === 's') {
        physicsRef.current.brake = true;
        setBrakeActive(true);
      } else if (k === 'c' || k === 'shift') {
        physicsRef.current.clutch = true;
        setClutchActive(true);
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
        physicsRef.current.gas = false;
        setGasActive(false);
      } else if (k === 'arrowdown' || k === 's') {
        physicsRef.current.brake = false;
        setBrakeActive(false);
      } else if (k === 'c' || k === 'shift') {
        physicsRef.current.clutch = false;
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
      targetSteerRad: 0,
      throttleSmooth: 0,
      camPitch: 0,
      camRollDeg: 0,
      camBobY: 0,
      camYawOff: 0,
      animPhase: 0,
      rpm: 850,
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
      lastHudTime: 0,
      lastRenderTime: 0,
      completed: false,
    };
    setCarState({
      x: targetScenario.startX,
      y: targetScenario.startY,
      angleRad: initAngle,
      speed: 0,
      steerRad: 0,
      rpm: 850,
      camPitch: 0,
      camRollDeg: 0,
      camBobY: 0,
      camYawOff: 0,
      animPhase: 0,
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
    setStatusBanner(`${targetScenario.shortLabel} activo • Acelerador progresivo sin tirones`);
  }, []);

  const handleSelectScenario = useCallback(
    (sc: ScenarioConfig) => {
      setScenario(sc);
      resetScenario(sc);
    },
    [resetScenario]
  );

  const handleContinueNextLevel = useCallback(() => {
    if (nextScenario) {
      setScenario(nextScenario);
      resetScenario(nextScenario);
    } else {
      router.push('/');
    }
  }, [nextScenario, resetScenario]);

  // Motor físico 60 FPS con amortiguación exponencial de acelerador/dirección y suspensión 3D de cámara
  useEffect(() => {
    let rafId: number;
    let lastTime = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.04, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const p = physicsRef.current;
      if (p.startTime === 0) p.startTime = now;
      p.animPhase += dt;

      if (!p.completed) {
        const prevSpeed = p.speed;
        const spec = GEAR_SPECS[p.gear];
        const isAccelerating = p.gas || p.throttleLock;

        // Respuesta ágil del pedal del acelerador y de la dirección
        const targetThrottle = isAccelerating && !p.brake && !p.handbrakeOn && p.engineOn ? 1 : 0;
        const throttleLerp = 1 - Math.exp(-(targetThrottle > p.throttleSmooth ? 6.5 : 7.5) * dt);
        p.throttleSmooth += (targetThrottle - p.throttleSmooth) * throttleLerp;

        const steerLerp = 1 - Math.exp(-11.5 * dt);
        p.steerRad += (p.targetSteerRad - p.steerRad) * steerLerp;

        // Empuje inmediato y potente desde el primer toque del acelerador
        const smoothThrottleCurve = p.throttleSmooth * (0.62 + 0.38 * p.throttleSmooth);
        const baseAccel = 96 * spec.accelFactor * Math.max(0.28, smoothThrottleCurve);
        const brakeDecel = 155;
        const rollingFriction = 18;

        if (!p.engineOn) {
          p.rpm += (0 - p.rpm) * Math.min(1, dt * 5);
          p.speed = Math.abs(p.speed) < 0.35 ? 0 : p.speed * Math.pow(0.32, dt);
        } else if (p.handbrakeOn) {
          p.speed = Math.abs(p.speed) < 0.35 ? 0 : p.speed * Math.pow(0.12, dt);
          p.rpm += (850 - p.rpm) * Math.min(1, dt * 6);
        } else if (p.brake) {
          // PEDAL DE FRENO INDEPENDIENTE: Frenado progresivo y realista
          if (Math.abs(p.speed) < 0.45) {
            p.speed = 0;
          } else if (p.speed > 0) {
            p.speed = Math.max(0, p.speed - brakeDecel * dt);
          } else {
            p.speed = Math.min(0, p.speed + brakeDecel * dt);
          }
          p.rpm += (850 - p.rpm) * Math.min(1, dt * 6);
        } else if (p.clutch || p.gear === 'N') {
          // PEDAL DE EMBRAGUE O NEUTRO: Desacopla transmisión suavemente
          const targetFreeRpm = isAccelerating ? 3800 : 860;
          p.rpm += (targetFreeRpm - p.rpm) * Math.min(1, dt * 5);
          if (Math.abs(p.speed) < 0.3) {
            p.speed = 0;
          } else if (p.speed > 0) {
            p.speed = Math.max(0, p.speed - rollingFriction * 0.55 * dt);
          } else {
            p.speed = Math.min(0, p.speed + rollingFriction * 0.55 * dt);
          }
        } else if (isAccelerating || p.throttleSmooth > 0.04) {
          // PEDAL DE ACELERADOR INDEPENDIENTE: Empuje gradual y fluido sin tirones
          if (p.gear === 'R') {
            p.speed = Math.max(spec.maxSpeedPx, p.speed - baseAccel * dt);
          } else {
            if (p.speed <= spec.maxSpeedPx) {
              p.speed = Math.min(spec.maxSpeedPx, p.speed + baseAccel * dt);
            } else {
              p.speed = Math.max(spec.maxSpeedPx, p.speed - rollingFriction * 1.1 * dt);
            }
          }
        } else {
          // Inercia suave al soltar el acelerador (freno de motor progresivo)
          if (Math.abs(p.speed) < 0.3) {
            p.speed = 0;
          } else if (p.speed > 0) {
            p.speed = Math.max(0, p.speed - rollingFriction * dt);
          } else {
            p.speed = Math.min(0, p.speed + rollingFriction * dt);
          }
        }

        if (p.engineOn && !p.clutch && p.gear !== 'N') {
          const maxForGear = Math.max(24, Math.abs(spec.maxSpeedPx));
          const ratio = Math.min(1.06, Math.abs(p.speed) / maxForGear);
          const targetRpm = 850 + ratio * 3400 + p.throttleSmooth * 360;
          p.rpm += (targetRpm - p.rpm) * Math.min(1, dt * 6.5);
        }

        const nextX = p.x + p.speed * Math.cos(p.angleRad) * dt;
        const nextY = p.y + p.speed * Math.sin(p.angleRad) * dt;
        const angularVel = (p.speed / WHEELBASE) * Math.tan(p.steerRad) * 1.08;
        const nextAngle = p.angleRad + angularVel * dt;

        p.x = Math.max(96, Math.min(WORLD_W - 96, nextX));
        p.y = Math.max(96, Math.min(WORLD_H - 96, nextY));
        p.angleRad = nextAngle;

        // FÍSICAS DE SUSPENSIÓN Y REACCIÓN DE LA CÁMARA 3D (Cabeceo, balanceo lateral y vibración viva)
        const longitudinalAccel = (p.speed - prevSpeed) / dt;
        const targetPitch = Math.max(
          -5.5,
          Math.min(6.5, -longitudinalAccel * 0.045 + (p.brake && Math.abs(p.speed) > 2 ? 3.8 : 0) - p.throttleSmooth * 2.1)
        );
        p.camPitch += (targetPitch - p.camPitch) * Math.min(1, dt * 4.2);

        const centrifugalRoll = -angularVel * Math.abs(p.speed) * 0.022 - p.steerRad * (p.speed * 0.045);
        const targetRoll = Math.max(-4.2, Math.min(4.2, centrifugalRoll));
        p.camRollDeg += (targetRoll - p.camRollDeg) * Math.min(1, dt * 4.5);

        // Inercia de la cabeza/cámara: al girar el volante la vista se retrasa y luego alcanza al carro
        const targetYawOff = Math.max(-0.06, Math.min(0.06, -angularVel * 0.07));
        p.camYawOff += (targetYawOff - p.camYawOff) * Math.min(1, dt * 3.8);

        const speedRatio = Math.min(1, Math.abs(p.speed) / 65);
        const roadWave = Math.sin(p.animPhase * (6 + speedRatio * 9)) * (0.08 + speedRatio * 0.5);
        const roadJitter = Math.sin(p.animPhase * 31.7) * Math.cos(p.animPhase * 17.3) * speedRatio * 0.22;
        const engineIdlingWave = p.engineOn ? Math.cos(p.animPhase * 19) * 0.1 : 0;
        p.camBobY = roadWave + roadJitter + engineIdlingWave;

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
          p.camPitch = 5.2; // Impulso físico de impacto en la suspensión
          setCollisions(p.collisions);
          setHitConeIndices((prev) =>
            prev.includes(touchedConeIdx) ? prev : [...prev, touchedConeIdx]
          );
          setCollisionFlash(true);
          setStatusBanner('¡Atención! Cono impactado — Corrija suavemente con volante y pedales');
          playError();
          setTimeout(() => setCollisionFlash(false), 420);
        }

        // Huellas de neumáticos en el pavimento
        if (Math.abs(p.speed) > 9 && now - p.lastTrackTime > 165) {
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
            c.x >= pz.x - 14 &&
            c.x <= pz.x + pz.w + 14 &&
            c.y >= pz.y - 14 &&
            c.y <= pz.y + pz.h + 14
        ).length;

        const centerInside =
          p.x >= pz.x - 8 &&
          p.x <= pz.x + pz.w + 8 &&
          p.y >= pz.y - 8 &&
          p.y <= pz.y + pz.h + 8;

        const distScore = Math.max(0, 100 - distToCenter * 0.42);
        const cornerScore = cornersInside * 25;
        const computedAlignment = Math.min(100, Math.round(distScore * 0.4 + cornerScore * 0.6));

        const elapsed = Number(((now - p.startTime) / 1000).toFixed(1));
        if (now - p.lastHudTime > 95) {
          p.lastHudTime = now;
          setElapsedSec(elapsed);
          setAlignmentPct(computedAlignment);
        }

        if (centerInside && Math.abs(p.speed) >= 8) {
          setStatusBanner('¡Está dentro de la Zona [P]! Presione FRENO para completar el nivel');
        }

        if ((cornersInside >= 3 || (centerInside && distToCenter < 54)) && Math.abs(p.speed) < 8) {
          p.completed = true;
          p.speed = 0;
          setThrottleLock(false);
          setElapsedSec(elapsed);
          setAlignmentPct(100);
          setParkedSuccess(true);
          setCompletedLevelIds((prev) => (prev.includes(scenario.id) ? prev : [...prev, scenario.id]));
          playSuccess();

          let grade: AptitudeGrade = 'APTO';
          if (elapsed < 55 && p.collisions === 0 && seatbeltOn) {
            grade = 'EXCELENTE';
          } else if (p.collisions > 3 || elapsed > 120) {
            grade = 'NO APTO';
          }
          setLastGrade(grade);

          setManeuverResult({
            elapsedSeconds: elapsed,
            collisions: p.collisions,
            alignmentPct: 100,
            scenarioTitle: scenario.title,
            grade,
            completedAt: new Date().toLocaleTimeString(),
          });
        }

        // Rendimiento: en movimiento se redibuja a cada cuadro; detenido, a 20 FPS (las animaciones
        // de reposo —vibración del motor, viento— se siguen viendo igual de fluidas).
        const isMoving =
          Math.abs(p.speed) > 0.4 ||
          Math.abs(p.targetSteerRad - p.steerRad) > 0.002 ||
          Math.abs(p.camPitch) > 0.4 ||
          Math.abs(p.camRollDeg) > 0.2;
        if (!isMoving && now - p.lastRenderTime < 48) {
          rafId = requestAnimationFrame(step);
          return;
        }
        p.lastRenderTime = now;

        setCarState({
          x: p.x,
          y: p.y,
          angleRad: p.angleRad,
          speed: p.speed,
          steerRad: p.steerRad,
          rpm: Math.round(p.rpm),
          camPitch: p.camPitch,
          camRollDeg: p.camRollDeg,
          camBobY: p.camBobY,
          camYawOff: p.camYawOff,
          animPhase: p.animPhase,
        });
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [playError, playSuccess, scenario, seatbeltOn, setManeuverResult]);

  // Gesto exclusivo de la Caja de Dirección (Volante)
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
  const speedKmh = Math.round(Math.abs(carState.speed) * 0.44);

  // Renderizado 3D con físicas de cámara, iluminación volumétrica, faros proyectados y entorno vivo
  const world3D = useMemo(
    () =>
      buildWorld3D(
        {
          x: carState.x,
          y: carState.y,
          angleRad: carState.angleRad,
          camBobY: carState.camBobY,
          camPitch: carState.camPitch,
          camYawOff: carState.camYawOff,
        },
        scenario,
        tireTracks,
        hitConeIndices
      ),
    [
      carState.angleRad,
      carState.camBobY,
      carState.camPitch,
      carState.camYawOff,
      carState.x,
      carState.y,
      hitConeIndices,
      scenario,
      tireTracks,
    ]
  );

  const leftBlinkOn = (turnSignal === 'LEFT' || turnSignal === 'HAZARD') && blinkTick;
  const rightBlinkOn = (turnSignal === 'RIGHT' || turnSignal === 'HAZARD') && blinkTick;
  const currentGearSpec = GEAR_SPECS[gear];
  // Desplazamiento continuo trigonométrico (sin saltos de módulo) para el sol, nubes y montañas
  const skyPanSmooth = Math.sin(carState.angleRad) * 160;
  const sunScreenX = 680 - Math.sin(carState.angleRad + 0.6) * 210;
  const sunScreenY = Math.max(18, Math.min(78, 34 + carState.camPitch * 0.8));
  const windSwayPx = Math.sin(carState.animPhase * 1.6) * 2.4 + Math.sin(carState.animPhase * 3.7) * 0.8;
  const CLOUD_PERIOD = 1300;
  const cloudBase = (((carState.animPhase * 5 - skyPanSmooth * 0.55) % CLOUD_PERIOD) + CLOUD_PERIOD) % CLOUD_PERIOD;
  const beaconPulse = 0.65 + 0.35 * Math.sin(carState.animPhase * 4.2);

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
                const done = completedLevelIds.includes(sc.id);
                return (
                  <Pressable
                    key={sc.id}
                    onPress={() => handleSelectScenario(sc)}
                    style={[
                      styles.scenarioTab,
                      active && styles.scenarioTabActive,
                      done && !active && { borderColor: PsychoPalette.mint },
                    ]}>
                    {done ? (
                      <Ionicons name="checkmark-circle" size={11} color={PsychoPalette.mint} />
                    ) : null}
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

        {/* ==================== VISOR 3D HORIZONTAL DE ALTA DEFINICIÓN ==================== */}
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
              <LinearGradient id="realisticSkyGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#0284C7" />
                <Stop offset="0.45" stopColor="#0EA5E9" />
                <Stop offset="0.82" stopColor="#7DD3FC" />
                <Stop offset="1" stopColor="#E0F2FE" />
              </LinearGradient>

              <RadialGradient id="sunGlowGrad" cx="0.78" cy="0.22" r="0.26">
                <Stop offset="0" stopColor="#FEF08A" stopOpacity="0.95" />
                <Stop offset="0.35" stopColor="#FDE047" stopOpacity="0.45" />
                <Stop offset="1" stopColor="#38BDF8" stopOpacity="0" />
              </RadialGradient>

              <LinearGradient id="realisticGrassGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#15803D" />
                <Stop offset="0.35" stopColor="#166534" />
                <Stop offset="1" stopColor="#052E16" />
              </LinearGradient>

              <LinearGradient id="asphaltRoadGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#475569" />
                <Stop offset="0.32" stopColor="#334155" />
                <Stop offset="0.72" stopColor="#1E293B" />
                <Stop offset="1" stopColor="#0F172A" />
              </LinearGradient>

              <LinearGradient id="hoodMetallicGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FFFFFF" />
                <Stop offset="0.5" stopColor="#E2E8F0" />
                <Stop offset="1" stopColor="#94A3B8" />
              </LinearGradient>

              <RadialGradient id="sunHaloGrad" cx="0.5" cy="0.5" r="0.5">
                <Stop offset="0" stopColor="#FFFBEB" stopOpacity="1" />
                <Stop offset="0.18" stopColor="#FEF08A" stopOpacity="0.85" />
                <Stop offset="0.55" stopColor="#FDE047" stopOpacity="0.22" />
                <Stop offset="1" stopColor="#FDE047" stopOpacity="0" />
              </RadialGradient>

              <LinearGradient id="hazeGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#E0F2FE" stopOpacity="0.75" />
                <Stop offset="0.35" stopColor="#BAE6FD" stopOpacity="0.3" />
                <Stop offset="1" stopColor="#BAE6FD" stopOpacity="0" />
              </LinearGradient>

              <RadialGradient id="vignetteGrad" cx="0.5" cy="0.5" r="0.75">
                <Stop offset="0.55" stopColor="#000000" stopOpacity="0" />
                <Stop offset="1" stopColor="#020617" stopOpacity="0.62" />
              </RadialGradient>

              <LinearGradient id="beamGrad" x1="0" y1="1" x2="0" y2="0">
                <Stop offset="0" stopColor="#FEF9C3" stopOpacity="0.5" />
                <Stop offset="1" stopColor="#FEF9C3" stopOpacity="0.04" />
              </LinearGradient>

              <LinearGradient id="cockpitDashGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#1E293B" />
                <Stop offset="0.35" stopColor="#0F172A" />
                <Stop offset="1" stopColor="#020617" />
              </LinearGradient>
            </Defs>

            {/* CÁMARA 3D: balanceo lateral (roll) real aplicado a todo el entorno exterior */}
            <G
              transform={`translate(${VIEW3D_W / 2}, 230) rotate(${(carState.camRollDeg * 0.7).toFixed(2)}) scale(1.07) translate(${-VIEW3D_W / 2}, -230)`}>
            {/* 1. CIELO REALISTA, SOL Y CORDILLERA CON PARALAJE */}
            <Rect x={-80} y={-40} width={VIEW3D_W + 160} height={HORIZON_Y + 40} fill="url(#realisticSkyGrad)" />
            <Circle cx={sunScreenX} cy={sunScreenY} r={105} fill="url(#sunHaloGrad)" />
            <Circle cx={sunScreenX} cy={sunScreenY} r={17} fill="#FFFBEB" />

            <G transform={`translate(${-skyPanSmooth * 0.22}, 0)`}>
              <Path
                d={`M -320 ${HORIZON_Y} L -220 ${HORIZON_Y - 36} L -80 ${HORIZON_Y - 58} L 95 ${HORIZON_Y - 48} L 210 ${HORIZON_Y - 22} L 345 ${HORIZON_Y - 58} L 490 ${HORIZON_Y - 18} L 640 ${HORIZON_Y - 52} L 790 ${HORIZON_Y - 26} L ${VIEW3D_W} ${HORIZON_Y - 44} L ${VIEW3D_W + 160} ${HORIZON_Y - 60} L ${VIEW3D_W + 320} ${HORIZON_Y - 30} L ${VIEW3D_W + 320} ${HORIZON_Y} Z`}
                fill="#0369A1"
                opacity={0.34}
              />
            </G>
            <G transform={`translate(${-skyPanSmooth * 0.4}, 0)`}>
              <Path
                d={`M -340 ${HORIZON_Y} Q -160 ${HORIZON_Y - 40} 0 ${HORIZON_Y - 22} Q 180 ${HORIZON_Y - 44} 360 ${HORIZON_Y - 14} T 720 ${HORIZON_Y - 32} T ${VIEW3D_W + 340} ${HORIZON_Y - 18} L ${VIEW3D_W + 340} ${HORIZON_Y} Z`}
                fill="#15803D"
                opacity={0.85}
              />
            </G>

            {/* Nubes con deriva lenta del viento y paralaje al girar */}
            {[0, -1].map((k) => (
              <G
                key={`cloud-${k}`}
                transform={`translate(${cloudBase + k * CLOUD_PERIOD}, 0)`}>
                <Ellipse cx={180} cy={28} rx={64} ry={13} fill="rgba(255,255,255,0.82)" />
                <Ellipse cx={215} cy={24} rx={45} ry={15} fill="rgba(255,255,255,0.9)" />
                <Ellipse cx={540} cy={32} rx={72} ry={13} fill="rgba(255,255,255,0.78)" />
                <Ellipse cx={575} cy={27} rx={44} ry={12} fill="rgba(255,255,255,0.88)" />
                <Ellipse cx={880} cy={22} rx={58} ry={11} fill="rgba(255,255,255,0.7)" />
                <Ellipse cx={1010} cy={46} rx={50} ry={10} fill="rgba(255,255,255,0.6)" />
              </G>
            ))}

            {/* 2. PISO REALISTA MULTICAPA: PRADERA + BASE ASFÁLTICA + LOSAS EN PERSPECTIVA 3D */}
            <Rect
              x={-80}
              y={HORIZON_Y}
              width={VIEW3D_W + 160}
              height={VIEW3D_H - HORIZON_Y + 40}
              fill="url(#realisticGrassGrad)"
            />

            {world3D.asphaltBase ? (
              <Polygon
                points={world3D.asphaltBase.pointsStr}
                fill="url(#asphaltRoadGrad)"
                stroke="#CBD5E1"
                strokeWidth={2}
              />
            ) : null}

            {/* Losas de pavimento y concreto con juntas de dilatación en 3D */}
            {world3D.groundTiles.map((t, idx) => (
              <Polygon
                key={`tile-${idx}`}
                points={t.pointsStr}
                fill={t.shade}
                stroke="rgba(15, 23, 42, 0.42)"
                strokeWidth={0.9}
              />
            ))}

            {/* Bordillos perimetrales 3D extruidos (rojos y blancos con volumen vertical) */}
            {world3D.curbBoxes.map((cb, idx) => (
              <Polygon
                key={`curb-${idx}`}
                points={cb.pointsStr}
                fill={cb.fill}
                stroke={cb.stroke}
                strokeWidth={0.6}
              />
            ))}

            {/* Doble línea central amarilla */}
            {world3D.yellowDividerLines.map((pts, i) => (
              <Polygon key={`ydiv-${i}`} points={pts} fill="#FACC15" />
            ))}

            {/* Marcas viales blancas (carriles, bahías y paso cebra) */}
            {world3D.whiteLaneDashes.map((pts, i) => (
              <Polygon key={`lane-${i}`} points={pts} fill="rgba(248, 250, 252, 0.86)" />
            ))}

            {/* Haces de luz proyectados por los faros sobre el pavimento */}
            {lightsOn
              ? world3D.headlightBeams.map((pts, i) => (
                  <Polygon key={`beam-${i}`} points={pts} fill="rgba(254, 249, 195, 0.2)" />
                ))
              : null}

            {/* Bruma atmosférica de distancia sobre el piso (profundidad y realismo) */}
            <Rect
              x={-80}
              y={world3D.horizonDynamicY - 6}
              width={VIEW3D_W + 160}
              height={70}
              fill="url(#hazeGrad)"
            />

            {/* 3. HUELLAS REALISTAS DE NEUMÁTICOS */}
            {world3D.projectedTracks.map((pts, i) => (
              <Polygon key={`trk-${i}`} points={pts} fill="rgba(2, 6, 23, 0.48)" />
            ))}

            {/* 4. FLECHAS DIRECCIONALES AMARILLAS EN EL PISO */}
            {world3D.yellowArrows.map((pts, i) => (
              <Polygon
                key={`arr-${i}`}
                points={pts}
                fill="#FACC15"
                stroke="#CA8A04"
                strokeWidth={1.3}
              />
            ))}

            {/* 5. ZONA AZUL OFICIAL DE PARQUEO [ P ] CON TOPE DE LLANTAS 3D */}
            {world3D.blueParkingBox ? (
              <G>
                <Polygon
                  points={world3D.blueParkingBox.pointsStr}
                  fill={parkedSuccess ? 'rgba(16, 185, 129, 0.9)' : 'rgba(2, 132, 199, 0.86)'}
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

            {world3D.wheelStop3D
              ? world3D.wheelStop3D.faces.map((f, i) => (
                  <Polygon
                    key={`wstop-${i}`}
                    points={f.pointsStr}
                    fill={f.fill}
                    stroke={f.stroke}
                    strokeWidth={0.8}
                  />
                ))
              : null}

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

            {/* 7. ELEMENTOS 3D VOLUMÉTRICOS: EDIFICIOS 3D, CARROS ESTACIONADOS 3D, ÁRBOLES, FAROLAS Y CONOS */}
            {world3D.renderItems.map((item, idx) => {
              if (item.type === 'BOX3D' && item.faces) {
                return (
                  <G key={`box3d-${idx}`}>
                    {item.faces.map((f, fIdx) => (
                      <G key={`face-${fIdx}`}>
                        <Polygon
                          points={f.pointsStr}
                          fill={f.fill}
                          stroke={f.stroke}
                          strokeWidth={1}
                        />
                        {f.label && f.labelX !== undefined && f.labelY !== undefined ? (
                          <SvgText
                            x={f.labelX}
                            y={f.labelY + 3}
                            fill="#FFFFFF"
                            fontSize="9.5"
                            fontWeight="bold"
                            textAnchor="middle">
                            {f.label}
                          </SvgText>
                        ) : null}
                      </G>
                    ))}
                  </G>
                );
              }

              if (item.type === 'TREE' && item.tree && item.sx !== undefined && item.sy !== undefined && item.scale !== undefined) {
                const s = Math.max(0.24, Math.min(2.4, item.scale * 0.62));
                const tx = item.sx;
                const ty = item.sy;
                return (
                  <G key={`tree-${idx}`}>
                    <Ellipse cx={tx + 4 * s} cy={ty + 2 * s} rx={24 * s} ry={8 * s} fill="rgba(2, 6, 23, 0.42)" />
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
                    <G transform={`translate(${(windSwayPx * s * 0.7).toFixed(2)}, 0)`}>
                      <Circle cx={tx} cy={ty - 40 * s} r={22 * s} fill={item.tree.canopyDark} />
                      <Circle cx={tx - 13 * s} cy={ty - 34 * s} r={15 * s} fill={item.tree.canopyMid} />
                      <Circle cx={tx + 12 * s} cy={ty - 34 * s} r={15 * s} fill={item.tree.canopyDark} />
                      <Circle cx={tx - 3 * s} cy={ty - 46 * s} r={16 * s} fill={item.tree.canopyMid} />
                      <Circle cx={tx - 6 * s} cy={ty - 50 * s} r={11 * s} fill={item.tree.canopyLight} />
                      <Circle cx={tx + 8 * s} cy={ty - 52 * s} r={7 * s} fill={item.tree.canopyLight} opacity={0.55} />
                    </G>
                  </G>
                );
              }

              if (item.type === 'LAMP' && item.sx !== undefined && item.sy !== undefined && item.scale !== undefined) {
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
                    <Circle
                      cx={lx + 19 * s}
                      cy={ly - 71 * s}
                      r={16 * s}
                      fill="rgba(254, 240, 138, 0.28)"
                      opacity={beaconPulse}
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

              if (item.sx === undefined || item.sy === undefined || item.scale === undefined) {
                return null;
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
                  <Polygon
                    points={`${cx - 15 * s},${cy} ${cx},${cy - 5 * s} ${cx + 15 * s},${cy} ${cx},${cy + 5 * s}`}
                    fill="#C2410C"
                    stroke="#7C2D12"
                    strokeWidth={0.8}
                  />
                  <Polygon
                    points={`${cx - 11 * s},${cy} ${cx - 3.2 * s},${cy - 35 * s} ${cx},${cy - 35 * s} ${cx},${cy}`}
                    fill="#FB923C"
                  />
                  <Polygon
                    points={`${cx},${cy} ${cx},${cy - 35 * s} ${cx + 3.2 * s},${cy - 35 * s} ${cx + 11 * s},${cy}`}
                    fill="#EA580C"
                  />
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

            </G>

            {/* Viñeta cinematográfica: se intensifica con la velocidad */}
            <Rect
              x={0}
              y={0}
              width={VIEW3D_W}
              height={VIEW3D_H}
              fill="url(#vignetteGrad)"
              opacity={0.55 + Math.min(0.45, Math.abs(carState.speed) / 220)}
            />

            {/* ==================== CABINA EN 1ª PERSONA SIN RETROVISORES ==================== */}
            {/* CAPÓ DELANTERO ESCULPIDO EN 3D CON GUARDABARROS Y REFLEJO SOLAR */}
            <G transform={`translate(${steerAngleDeg * -0.45}, ${gasActive ? -2.5 : brakeActive ? 3.5 : 0})`}>
              <Polygon
                points={`145,328 265,262 695,262 815,328`}
                fill="url(#hoodMetallicGrad)"
                stroke="#94A3B8"
                strokeWidth={2}
              />
              {/* Relieve lateral izquierdo y derecho del capó */}
              <Polygon points="145,328 265,262 315,266 235,328" fill="#E2E8F0" />
              <Polygon points="815,328 695,262 645,266 725,328" fill="#CBD5E1" />
              <Line x1={245} y1={324} x2={318} y2={266} stroke="#94A3B8" strokeWidth={2} />
              <Line x1={715} y1={324} x2={642} y2={266} stroke="#94A3B8" strokeWidth={2} />
              <Ellipse cx={480} cy={274} rx={15} ry={4.5} fill="#38BDF8" stroke="#0F172A" strokeWidth={1.2} />
            </G>

            {/* LIMPIAPARABRISAS ANIMADOS */}
            <G transform={`rotate(${-wiperAngle}, 250, 326)`}>
              <Line x1={250} y1={326} x2={115} y2={296} stroke="#0F172A" strokeWidth={4.5} strokeLinecap="round" />
            </G>
            <G transform={`rotate(${-wiperAngle}, 610, 326)`}>
              <Line x1={610} y1={326} x2={465} y2={296} stroke="#0F172A" strokeWidth={4.5} strokeLinecap="round" />
            </G>

            {/* PARALES DELANTEROS (PILARES A) ESTILIZADOS */}
            <Polygon points="0,0 54,0 22,335 0,335" fill="#0F172A" stroke="#334155" strokeWidth={2} />
            <Polygon
              points={`${VIEW3D_W},0 ${VIEW3D_W - 54},0 ${VIEW3D_W - 22},335 ${VIEW3D_W},335`}
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

          {/* ==================== LETRERO DE NIVEL COMPLETADO Y CONTINUAR AL SIGUIENTE NIVEL ==================== */}
          {parkedSuccess ? (
            <View style={styles.successOverlay}>
              <View style={styles.successModalCard}>
                <View style={styles.levelBadgeHeader}>
                  <Ionicons name="trophy" size={18} color="#020617" />
                  <Text style={styles.levelBadgeHeaderText}>
                    NIVEL {currentLevelIdx + 1} DE {SCENARIOS.length} COMPLETADO • {lastGrade}
                  </Text>
                </View>

                <Text style={styles.successModalTitle}>
                  ¡{scenario.shortLabel} SUPERADO CON ÉXITO!
                </Text>

                {/* Indicador visual de progreso entre los 3 niveles */}
                <View style={styles.levelStepperRow}>
                  {SCENARIOS.map((sc, idx) => {
                    const isDone = completedLevelIds.includes(sc.id) || sc.id === scenario.id;
                    const isNext = nextScenario?.id === sc.id;
                    return (
                      <View
                        key={sc.id}
                        style={[
                          styles.levelStepChip,
                          isDone && styles.levelStepChipDone,
                          isNext && styles.levelStepChipNext,
                        ]}>
                        <Ionicons
                          name={isDone ? 'checkmark-circle' : isNext ? 'play-circle' : 'ellipse-outline'}
                          size={12}
                          color={isDone ? '#020617' : isNext ? PsychoPalette.cyan : '#94A3B8'}
                        />
                        <Text
                          style={[
                            styles.levelStepChipText,
                            isDone && { color: '#020617', fontWeight: '900' },
                            isNext && { color: PsychoPalette.cyan },
                          ]}>
                          NIVEL {idx + 1}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <Text style={styles.successModalDesc}>
                  Estacionó dentro de la Zona Oficial [P] en {elapsedSec.toFixed(1)}s con{' '}
                  {collisions} {collisions === 1 ? 'cono tocado' : 'conos tocados'}.
                </Text>

                {/* Botón Principal: CONTINUAR AL SIGUIENTE NIVEL */}
                {nextScenario ? (
                  <Pressable onPress={handleContinueNextLevel} style={styles.nextLevelPrimarySign}>
                    <View style={styles.nextLevelSignLeft}>
                      <Text style={styles.nextLevelSmallTag}>SIGUIENTE PRUEBA DISPONIBLE</Text>
                      <Text style={styles.nextLevelMainText}>
                        CONTINUAR AL SIGUIENTE NIVEL ({nextScenario.shortLabel})
                      </Text>
                    </View>
                    <Ionicons name="arrow-forward-circle" size={28} color="#020617" />
                  </Pressable>
                ) : (
                  <Pressable onPress={() => router.push('/')} style={styles.nextLevelPrimarySign}>
                    <View style={styles.nextLevelSignLeft}>
                      <Text style={styles.nextLevelSmallTag}>¡3 DE 3 NIVELES COMPLETADOS!</Text>
                      <Text style={styles.nextLevelMainText}>
                        FINALIZAR PRUEBA Y VER RESULTADOS EN TABLERO
                      </Text>
                    </View>
                    <Ionicons name="checkmark-done-circle" size={28} color="#020617" />
                  </Pressable>
                )}

                <View style={styles.successModalActions}>
                  <Pressable onPress={() => resetScenario(scenario)} style={styles.modalRepeatBtn}>
                    <Ionicons name="refresh" size={13} color={PsychoPalette.textPrimary} />
                    <Text style={styles.modalSecondaryBtnText}>REPETIR NIVEL {currentLevelIdx + 1}</Text>
                  </Pressable>
                  {nextScenario ? (
                    <Pressable onPress={() => router.push('/')} style={styles.modalDashboardBtn}>
                      <Text style={styles.modalSecondaryBtnText}>IR AL MENÚ PRINCIPAL</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => handleSelectScenario(SCENARIOS[0])}
                      style={styles.modalDashboardBtn}>
                      <Text style={styles.modalSecondaryBtnText}>VOLVER AL NIVEL 1</Text>
                    </Pressable>
                  )}
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
    backgroundColor: 'rgba(2, 6, 23, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
  },
  successModalCard: {
    backgroundColor: PsychoPalette.bgSecondary,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: PsychoPalette.mint,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 8,
    maxWidth: 480,
    width: '100%',
  },
  levelBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PsychoPalette.mint,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  levelBadgeHeaderText: {
    color: '#020617',
    fontSize: 9.5,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  successModalTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    fontFamily: Fonts.mono,
    textAlign: 'center',
  },
  levelStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 2,
  },
  levelStepChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  levelStepChipDone: {
    backgroundColor: PsychoPalette.mint,
    borderColor: '#FFFFFF',
  },
  levelStepChipNext: {
    borderColor: PsychoPalette.cyan,
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
  },
  levelStepChipText: {
    color: '#94A3B8',
    fontSize: 8.5,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
  successModalDesc: {
    color: PsychoPalette.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  nextLevelPrimarySign: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: PsychoPalette.mint,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 2,
  },
  nextLevelSignLeft: {
    flex: 1,
    gap: 2,
  },
  nextLevelSmallTag: {
    color: '#064E3B',
    fontSize: 8,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  nextLevelMainText: {
    color: '#020617',
    fontSize: 11.5,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  successModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  modalRepeatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: PsychoPalette.bgPanel,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modalDashboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: PsychoPalette.bgPanel,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modalSecondaryBtnText: {
    color: PsychoPalette.textPrimary,
    fontSize: 9.5,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
});
