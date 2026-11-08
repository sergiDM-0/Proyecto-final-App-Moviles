import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

type StationId = 'ENGINE' | 'TIRES' | 'LIGHTS' | 'MIRRORS' | 'CABIN' | 'KIT';

interface LearningStation {
  id: StationId;
  stepNum: number;
  shortTitle: string;
  systemTitle: string;
  carZoneCoords: { cx: number; cy: number };
  problemTitle: string;
  problemExplanation: string;
  problemConsequence: string;
  problemMetric: string;
  solutionTitle: string;
  solutionExplanation: string;
  solutionMetric: string;
  actionButtonLabel: string;
  voiceSummary: string;
  voiceSolvedConfirmation: string;
}

const STATIONS: LearningStation[] = [
  {
    id: 'ENGINE',
    stepNum: 1,
    shortTitle: '1. MOTOR Y FLUIDOS',
    systemTitle: 'Compartimiento del Motor: Refrigerante y Aceite',
    carZoneCoords: { cx: 88, cy: 55 },
    problemTitle: 'PROBLEMA: Nivel de Refrigerante Bajo (Debajo de MIN) y Aceite sin medir',
    problemExplanation:
      'El vaso de expansión tiene líquido por debajo del mínimo (riesgo de burbujas de aire en el radiador) y el motor podría sobrecalentarse en pocos minutos.',
    problemConsequence: 'Riesgo crítico de recalentamiento y daño de empaque de culata.',
    problemMetric: 'NIVEL: 30% (BAJO MIN) • TEMP: 108°C ALERTA',
    solutionTitle: 'SOLUCIÓN: Rellenado 50/50 hasta marca FULL y Aceite en rango Óptimo',
    solutionExplanation:
      'Con el motor en frío se completa el refrigerante entre las marcas MIN y MAX/FULL y se comprueba con la bayoneta que el aceite SAE 5W-30 esté en la zona reticulada.',
    solutionMetric: 'NIVEL: 100% FULL • TEMP: 88°C ESTABLE',
    actionButtonLabel: 'APLICAR SOLUCIÓN: RELLENAR REFRIGERANTE Y MEDIR ACEITE',
    voiceSummary:
      'Punto 1: Motor y fluidos. Qué pasa: el refrigerante está por debajo del mínimo y el motor puede recalentarse. Cómo se soluciona: con el motor en frío, rellene el refrigerante hasta la marca máxima y mida el nivel de aceite con la bayoneta.',
    voiceSolvedConfirmation:
      'Solución aplicada en motor: refrigerante en nivel máximo y aceite verificado a temperatura estable.',
  },
  {
    id: 'TIRES',
    stepNum: 2,
    shortTitle: '2. LLANTAS (PSI)',
    systemTitle: 'Neumáticos: Presión de Aire (PSI) y Labrado',
    carZoneCoords: { cx: 115, cy: 18 },
    problemTitle: 'PROBLEMA: Llanta Delantera Baja (21 PSI) con Deformación Lateral',
    problemExplanation:
      'La llanta presenta flancos aplastados por baja presión (21 PSI frente a los 32 PSI recomendados). Esto hala la dirección hacia un lado y aumenta la distancia de frenado.',
    problemConsequence: 'Mayor consumo, sobrecalentamiento del caucho y riesgo de estallido.',
    problemMetric: 'MANÓMETRO: 21 PSI (DESINFLADA) • FLANCO DEFORMADO',
    solutionTitle: 'SOLUCIÓN: Calibración Exacta a 32 PSI y Labrado > 2.0 mm',
    solutionExplanation:
      'Al inflar a 32 PSI en frío, la banda de rodadura apoya de forma plana y uniforme sobre el asfalto, garantizando agarre óptimo en curvas y frenado.',
    solutionMetric: 'MANÓMETRO: 32 PSI ÓPTIMO • HUELLA 100% UNIFORME',
    actionButtonLabel: 'APLICAR SOLUCIÓN: CALIBRAR AIRE DE LLANTA A 32 PSI',
    voiceSummary:
      'Punto 2: Llantas. Qué pasa: la llanta tiene baja presión con 21 P S I, deformando el caucho y alargando el frenado. Cómo se soluciona: calibre el aire a 32 P S I en frío para lograr un apoyo firme y uniforme.',
    voiceSolvedConfirmation:
      'Solución aplicada en llantas: presión calibrada a 32 P S I y labrado verificado.',
  },
  {
    id: 'LIGHTS',
    stepNum: 3,
    shortTitle: '3. LUCES Y FAROLAS',
    systemTitle: 'Sistema Óptico: Farolas Delanteras, Direccionales y Freno',
    carZoneCoords: { cx: 52, cy: 55 },
    problemTitle: 'PROBLEMA: Farola Derecha Apagada/Desalineada y Direccional sin Verificar',
    problemExplanation:
      'Un proyector delantero no ilumina la calzada y el haz izquierdo apunta demasiado bajo, reduciendo un 60% el campo visual nocturno y confundiendo a otros conductores.',
    problemConsequence: 'Infracción vial grave y pérdida de visibilidad en carretera.',
    problemMetric: 'FAROLA DER: FALLA • VISIBILIDAD VIAL: 40%',
    solutionTitle: 'SOLUCIÓN: Proyectores Simétricos Activos y Circuito L/R Sincronizado',
    solutionExplanation:
      'Ambos faros proyectan un haz simétrico regulado en altura, con direccionales ámbar intermitentes y luces de freno rojas de encendido instantáneo.',
    solutionMetric: '2 FAROLAS LED ACTIVAS • VISIBILIDAD: 100%',
    actionButtonLabel: 'APLICAR SOLUCIÓN: RESTABLECER Y ALINEAR LUCES DEL CARRO',
    voiceSummary:
      'Punto 3: Luces y farolas. Qué pasa: la farola derecha está apagada y reduce el 60 por ciento de la visibilidad. Cómo se soluciona: restablezca y alinee ambos faros delanteros y verifique direccionales y freno.',
    voiceSolvedConfirmation:
      'Solución aplicada en luces: doble haz delantero alineado y direccionales operativas al 100 por ciento.',
  },
  {
    id: 'MIRRORS',
    stepNum: 4,
    shortTitle: '4. ESPEJOS 360°',
    systemTitle: 'Visibilidad: Espejos Retrovisores Izquierdo, Central y Derecho',
    carZoneCoords: { cx: 168, cy: 20 },
    problemTitle: 'PROBLEMA: Espejos Desajustados con Gran Punto Ciego Lateral',
    problemExplanation:
      'Los espejos laterales están cerrados apuntando hacia la carrocería del propio carro y el espejo central apunta al techo, ocultando vehículos en los carriles vecinos.',
    problemConsequence: 'Colisión lateral al cambiar de carril o al estacionar en reversa.',
    problemMetric: 'ÁNGULO VISUAL: CERRADO • PUNTO CIEGO CRÍTICO',
    solutionTitle: 'SOLUCIÓN: Graduación Panorámica de los 3 Espejos sin Puntos Ciegos',
    solutionExplanation:
      'Se abren los espejos laterales (viendo solo un 10% del costado del carro y 90% del carril adyacente) y se centra el retrovisor interior hacia la luneta trasera completa.',
    solutionMetric: '3 ESPEJOS ALINEADOS • COBERTURA TRASERA 100%',
    actionButtonLabel: 'APLICAR SOLUCIÓN: GRADUAR LOS 3 ESPEJOS RETROVISORES',
    voiceSummary:
      'Punto 4: Espejos retrovisores. Qué pasa: los espejos laterales están cerrados y crean un punto ciego peligroso. Cómo se soluciona: gradúe los 3 espejos para cubrir los carriles vecinos y toda la ventana trasera.',
    voiceSolvedConfirmation:
      'Solución aplicada en espejos: visión panorámica graduada sin puntos ciegos.',
  },
  {
    id: 'CABIN',
    stepNum: 5,
    shortTitle: '5. CABINA Y MANDOS',
    systemTitle: 'Cabina del Conductor: Cinturón, Freno de Mano y Tablero',
    carZoneCoords: { cx: 195, cy: 55 },
    problemTitle: 'PROBLEMA: Cinturón Desabrochado y Freno de Mano sin Tensión',
    problemExplanation:
      'El conductor no ha asegurado el cinturón de 3 puntos y la palanca del freno de estacionamiento tiene recorrido excesivo sin bloquear las ruedas traseras en pendiente.',
    problemConsequence: 'El vehículo puede rodarse solo y no hay retención ante impacto.',
    problemMetric: 'CINTURÓN: SUELTO • FRENO MANO: DESTENSADO',
    solutionTitle: 'SOLUCIÓN: Cinturón Anclado (Click) y Freno de Mano Calibrado (5-7 clics)',
    solutionExplanation:
      'El cinturón queda ajustado sobre clavícula y cadera, la silla a distancia ergonómica de los pedales y el freno de mano bloquea firmemente el eje trasero.',
    solutionMetric: 'CINTURÓN ANCLADO OK • FRENO MANO FIRME',
    actionButtonLabel: 'APLICAR SOLUCIÓN: ABROCHAR CINTURÓN Y CALIBRAR FRENO',
    voiceSummary:
      'Punto 5: Cabina y mandos. Qué pasa: el cinturón está desabrochado y el freno de mano no tiene tensión. Cómo se soluciona: abroche el cinturón de 3 puntos hasta escuchar el clic y calibre el freno de mano.',
    voiceSolvedConfirmation:
      'Solución aplicada en cabina: cinturón de 3 puntos asegurado y freno de mano calibrado.',
  },
  {
    id: 'KIT',
    stepNum: 6,
    shortTitle: '6. KIT DE CARRETERA',
    systemTitle: 'Baúl: Extintor Vigente, Triángulos Reflectivos y Herramientas',
    carZoneCoords: { cx: 292, cy: 55 },
    problemTitle: 'PROBLEMA: Extintor Despresurizado (Zona Roja) y Sin Triángulos Armados',
    problemExplanation:
      'El manómetro del extintor marca aguja en rojo (descargado), las herramientas están sueltas y no se cuenta con los 2 conos/triángulos reflectivos reglamentarios.',
    problemConsequence: 'Imposibilidad de atender un conato de incendio o señalizar varada.',
    problemMetric: 'EXTINTOR: 0 PSI (DESCARGADO) • KIT INCOMPLETO',
    solutionTitle: 'SOLUCIÓN: Extintor en Zona Verde + 2 Triángulos + Botiquín y Gato',
    solutionExplanation:
      'Extintor ABC recargado con aguja en verde, 2 señales reflectivas listas para ubicar a 30m y 50m, tacos de bloqueo, cruceta, gato hidráulico y botiquín.',
    solutionMetric: 'EXTINTOR EN VERDE (VIGENTE) • KIT PESV 100%',
    actionButtonLabel: 'APLICAR SOLUCIÓN: EQUIPAR EXTINTOR RECARGADO Y KIT VIAL',
    voiceSummary:
      'Punto 6: Kit de carretera. Qué pasa: el extintor está descargado en zona roja y faltan los triángulos reflectivos. Cómo se soluciona: equipe el extintor recargado en verde junto con 2 triángulos, botiquín y herramienta.',
    voiceSolvedConfirmation:
      'Solución aplicada en kit de carretera: extintor vigente en verde y equipo de emergencia completo.',
  },
];

export default function PreoperationalScreen() {
  const { setPreoperationalResult } = useEvaluation();
  const { playLeftSignal, playRightSignal, playSuccess } = usePsychAudio();

  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [solvedMap, setSolvedMap] = useState<Record<StationId, boolean>>({
    ENGINE: false,
    TIRES: false,
    LIGHTS: false,
    MIRRORS: false,
    CABIN: false,
    KIT: false,
  });

  // Permite alternar la vista gráfica encima del componente para comparar el Problema vs la Solución
  const [viewMode, setViewMode] = useState<'PROBLEM' | 'SOLUTION'>('PROBLEM');
  const [certifiedGrade, setCertifiedGrade] = useState<AptitudeGrade | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  const currentStation = STATIONS[activeIndex];
  const isCurrentSolved = solvedMap[currentStation.id];
  const showingSolution = viewMode === 'SOLUTION';

  const speakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const utterancesRef = useRef<SpeechSynthesisUtterance[]>([]);
  const speakTokenRef = useRef(0);
  const nativeVoiceRef = useRef<string | undefined>(undefined);
  const nativeLangRef = useRef<string | undefined>(undefined);

  // Elige la voz nativa (iOS/Android) de mayor calidad en español, la más "humana" disponible
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Speech.getAvailableVoicesAsync()
      .then((voices) => {
        // En iOS la lista incluye voces "compact" que NO están descargadas y hacen fallar speak().
        // Solo se usa una voz si es Enhanced/Premium (descargada); si no, se usa solo el idioma.
        const es = voices.filter(
          (v) => v.language?.toLowerCase().startsWith('es') && !/compact/i.test(v.identifier)
        );
        const best =
          es.find((v) => v.quality === 'Enhanced' && /es-(CO|MX|419|US)/i.test(v.language)) ??
          es.find((v) => v.quality === 'Enhanced');
        nativeVoiceRef.current = best?.identifier;
        nativeLangRef.current = best?.language ?? 'es-MX';
      })
      .catch(() => {});
  }, []);

  const stopVoiceNarration = useCallback(() => {
    speakTokenRef.current += 1;
    if (speakTimerRef.current) {
      clearTimeout(speakTimerRef.current);
      speakTimerRef.current = null;
    }
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
    try {
      Speech.stop();
    } catch {
      // Ignore if Speech API not ready
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
    setIsSpeaking(false);
  }, []);

  const speakNarration = useCallback(
    (text: string) => {
      stopVoiceNarration();
      const token = speakTokenRef.current;
      setIsSpeaking(true);

      const isWeb =
        Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window;

      // Voz web más natural: prioriza voces neuronales/online (Google, Microsoft Natural) en español
      const pickWebVoice = (): SpeechSynthesisVoice | null => {
        const voices = window.speechSynthesis
          .getVoices()
          .filter((v) => v.lang.toLowerCase().startsWith('es'));
        if (voices.length === 0) return null;
        const score = (v: SpeechSynthesisVoice) =>
          (/natural|online|neural/i.test(v.name) ? 6 : 0) +
          (/google/i.test(v.name) ? 4 : 0) +
          (/es-(co|mx|419|us)/i.test(v.lang) ? 2 : /es-es/i.test(v.lang) ? 1 : 0) +
          (/sabina|paulina|helena|dalia|elena|camila|salome|monica|m[oó]nica|lucia|luc[ií]a/i.test(v.name)
            ? 1
            : 0);
        return [...voices].sort((x, y) => score(y) - score(x))[0];
      };

      // Se reintenta si el sistema cancela la voz justo al arrancar (ocurre al cambiar de lección)
      const attempt = (n: number) => {
        if (token !== speakTokenRef.current) return;
        let started = false;
        const markStarted = () => {
          started = true;
        };

        if (isWeb) {
          try {
            // No se cancela aquí: hacer cancel() + speak() seguidos deja trabado el motor de voz
            // de Chrome (solo hablaba la primera vez). La cancelación se hace antes, con espera.
            if (window.speechSynthesis.paused) window.speechSynthesis.resume();
            const voice = pickWebVoice();
            const sentences = text.match(/[^.:]+[.:]?/g)?.map((t) => t.trim()).filter(Boolean) ?? [text];
            utterancesRef.current = sentences.map((sentence, i) => {
              const u = new SpeechSynthesisUtterance(sentence);
              u.lang = voice?.lang ?? 'es-ES';
              if (voice) u.voice = voice;
              u.rate = 0.95;
              u.pitch = 1.02;
              u.onstart = markStarted;
              if (i === sentences.length - 1) {
                u.onend = () => {
                  if (token === speakTokenRef.current) setIsSpeaking(false);
                };
              }
              u.onerror = (ev) => {
                if (ev.error === 'canceled' || ev.error === 'interrupted') return;
                if (token === speakTokenRef.current) setIsSpeaking(false);
              };
              return u;
            });
            utterancesRef.current.forEach((u) => window.speechSynthesis.speak(u));
          } catch {
            setIsSpeaking(false);
            return;
          }
        } else {
          try {
            Speech.speak(text, {
              language: nativeLangRef.current ?? 'es-MX',
              voice: nativeVoiceRef.current,
              rate: 0.95,
              pitch: 1.0,
              onStart: markStarted,
              onDone: () => {
                if (token === speakTokenRef.current) setIsSpeaking(false);
              },
              onStopped: () => {},
              onError: () => {
                // Si la voz elegida falla, se descarta y se reintenta solo con el idioma
                nativeVoiceRef.current = undefined;
                nativeLangRef.current = 'es-MX';
              },
            });
          } catch {
            setIsSpeaking(false);
            return;
          }
        }

        watchdogRef.current = setTimeout(() => {
          if (token !== speakTokenRef.current) return;
          if (!started && n < 4) {
            try {
              if (isWeb) window.speechSynthesis.cancel();
              else Speech.stop();
            } catch {
              // Ignore
            }
            // Pausa tras cancelar para que el motor de voz se libere antes de reintentar
            speakTimerRef.current = setTimeout(() => attempt(n + 1), 400);
          } else if (!started) {
            setIsSpeaking(false);
          }
        }, 1300);
      };

      // Espera a que termine el sonido de cambio de lección antes de hablar (evita que lo corte)
      speakTimerRef.current = setTimeout(() => {
        speakTimerRef.current = null;
        attempt(0);
      }, 700);
    },
    [stopVoiceNarration]
  );

  // Reproduce automáticamente la voz de fondo explicando qué pasa y cómo se soluciona al cambiar de estación
  useEffect(() => {
    if (!voiceEnabled) return;
    const kickoff = setTimeout(() => speakNarration(STATIONS[activeIndex].voiceSummary), 0);
    return () => {
      clearTimeout(kickoff);
      stopVoiceNarration();
    };
  }, [activeIndex, speakNarration, stopVoiceNarration, voiceEnabled]);

  const solvedCount = useMemo(
    () => STATIONS.filter((s) => solvedMap[s.id]).length,
    [solvedMap]
  );

  const handleSelectStation = (index: number) => {
    const target = STATIONS[index];
    setActiveIndex(index);
    setViewMode(solvedMap[target.id] ? 'SOLUTION' : 'PROBLEM');
    playLeftSignal();
  };

  const handleApplySolution = () => {
    const updated = { ...solvedMap, [currentStation.id]: true };
    setSolvedMap(updated);
    setViewMode('SOLUTION');

    if (voiceEnabled) {
      speakNarration(currentStation.voiceSolvedConfirmation);
    }

    const totalNow = STATIONS.filter((s) => updated[s.id]).length;
    if (totalNow === STATIONS.length) {
      playSuccess();
      const grade: AptitudeGrade = 'EXCELENTE';
      setCertifiedGrade(grade);
      setPreoperationalResult({
        checkedCount: STATIONS.length,
        totalCount: STATIONS.length,
        anomaliesFixed: STATIONS.length,
        scorePct: 100,
        grade,
        completedAt: new Date().toLocaleTimeString(),
      });
    } else {
      playRightSignal();
      setPreoperationalResult({
        checkedCount: totalNow,
        totalCount: STATIONS.length,
        anomaliesFixed: totalNow,
        scorePct: Math.round((totalNow / STATIONS.length) * 100),
        grade: totalNow >= 5 ? 'APTO' : 'PENDIENTE',
        completedAt: new Date().toLocaleTimeString(),
      });
    }
  };

  /**
   * Renderiza la ilustración técnica interactiva ENCIMA del componente seleccionado,
   * cambiando dinámicamente entre la vista del PROBLEMA y cómo queda la SOLUCIÓN.
   */
  const renderInteractiveComponentScene = () => {
    switch (currentStation.id) {
      case 'ENGINE':
        return (
          <Svg width="100%" height={205} viewBox="0 0 540 205">
            <Rect x={4} y={4} width={532} height={197} rx={14} fill="#070E1B" stroke="#1E3150" strokeWidth={1.5} />
            {/* Bloque del motor */}
            <Rect x={35} y={42} width={190} height={130} rx={12} fill="#1E293B" stroke="#64748B" strokeWidth={2.5} />
            <Rect x={52} y={28} width={156} height={20} rx={6} fill="#334155" stroke="#94A3B8" strokeWidth={1.5} />
            <SvgText x={130} y={42} fill="#F8FAFC" fontSize="11" fontWeight="bold" textAnchor="middle">
              BLOQUE MOTOR DOHC 16V
            </SvgText>

            {/* Tapa de aceite y bayoneta */}
            <Circle
              cx={95}
              cy={88}
              r={20}
              fill="#0F172A"
              stroke={showingSolution ? PsychoPalette.mint : PsychoPalette.amberWarning}
              strokeWidth={2.5}
            />
            <SvgText x={95} y={92} fill="#FFFFFF" fontSize="9" fontWeight="bold" textAnchor="middle">
              OIL 5W30
            </SvgText>

            {/* Medidor de bayoneta de aceite */}
            <Rect x={140} y={66} width={66} height={86} rx={8} fill="#0F172A" stroke="#475569" strokeWidth={1.5} />
            <SvgText x={173} y={82} fill="#94A3B8" fontSize="9" fontWeight="bold" textAnchor="middle">
              BAYONETA
            </SvgText>
            <Line x1={155} y1={98} x2={191} y2={98} stroke={PsychoPalette.mint} strokeWidth={1.5} />
            <SvgText x={173} y={95} fill={PsychoPalette.mint} fontSize="8" textAnchor="middle">
              FULL
            </SvgText>
            <Rect
              x={160}
              y={showingSolution ? 100 : 132}
              width={26}
              height={showingSolution ? 40 : 8}
              rx={3}
              fill={showingSolution ? PsychoPalette.amberWarning : PsychoPalette.redSignalBright}
            />
            <Line x1={155} y1={140} x2={191} y2={140} stroke={PsychoPalette.redSignalBright} strokeWidth={1.5} />

            {/* Mangueras hacia el vaso de expansión del refrigerante */}
            <Path
              d="M 225 78 C 265 78, 270 68, 305 68"
              stroke={showingSolution ? PsychoPalette.cyan : PsychoPalette.redSignalBright}
              strokeWidth={7}
              fill="none"
            />
            <Path
              d="M 225 138 C 265 138, 270 148, 305 148"
              stroke="#475569"
              strokeWidth={7}
              fill="none"
            />

            {/* Vaso de expansión transparente del Líquido Refrigerante */}
            <Rect
              x={305}
              y={36}
              width={195}
              height={140}
              rx={16}
              fill="#0B1528"
              stroke={showingSolution ? PsychoPalette.mint : PsychoPalette.redSignalBright}
              strokeWidth={3}
            />
            <Rect x={372} y={20} width={60} height={18} rx={5} fill="#1E293B" stroke={PsychoPalette.cyan} strokeWidth={2} />
            <SvgText x={402} y={32} fill="#FFFFFF" fontSize="9" fontWeight="bold" textAnchor="middle">
              COOLANT CAP
            </SvgText>

            {/* Líquido dentro del depósito: Bajo en PROBLEMA vs Lleno en SOLUCIÓN */}
            <Rect
              x={311}
              y={showingSolution ? 68 : 142}
              width={183}
              height={showingSolution ? 102 : 28}
              rx={10}
              fill={showingSolution ? 'rgba(0, 245, 160, 0.42)' : 'rgba(239, 68, 68, 0.55)'}
            />

            {/* Líneas de referencia FULL y MIN */}
            <Line x1={315} y1={70} x2={490} y2={70} stroke={PsychoPalette.mint} strokeWidth={2} strokeDasharray="6 4" />
            <SvgText x={402} y={64} fill={PsychoPalette.mint} fontSize="11" fontWeight="bold" textAnchor="middle">
              ▲ NIVEL MÁXIMO / FULL (ÓPTIMO)
            </SvgText>

            <Line x1={315} y1={134} x2={490} y2={134} stroke={PsychoPalette.redSignalBright} strokeWidth={2} strokeDasharray="6 4" />
            <SvgText x={402} y={128} fill={PsychoPalette.redSignalBright} fontSize="10" fontWeight="bold" textAnchor="middle">
              ▼ NIVEL MÍNIMO (PELIGRO)
            </SvgText>

            {!showingSolution ? (
              <G>
                <SvgText x={402} y={102} fill="#FF3B5C" fontSize="13" fontWeight="bold" textAnchor="middle">
                  ¡REFRIGERANTE BAJO! (108°C)
                </SvgText>
              </G>
            ) : (
              <G>
                <SvgText x={402} y={105} fill="#FFFFFF" fontSize="13" fontWeight="bold" textAnchor="middle">
                  ✓ NIVEL FULL CALIBRADO (88°C)
                </SvgText>
              </G>
            )}
          </Svg>
        );

      case 'TIRES':
        return (
          <Svg width="100%" height={205} viewBox="0 0 540 205">
            <Rect x={4} y={4} width={532} height={197} rx={14} fill="#070E1B" stroke="#1E3150" strokeWidth={1.5} />
            {/* Superficie de la carretera bajo la llanta */}
            <Line x1={25} y1={174} x2={515} y2={174} stroke="#475569" strokeWidth={4} />

            {/* Rueda / Neumático (Deformado abajo cuando está en 21 PSI vs Redondo firme en 32 PSI) */}
            {!showingSolution ? (
              <G>
                {/* Neumático desinflado con panza inferior */}
                <Path
                  d="M 95 45 C 50 45, 38 115, 52 155 C 58 172, 75 174, 145 174 C 215 174, 232 172, 238 155 C 252 115, 240 45, 195 45 Z"
                  fill="#0F172A"
                  stroke={PsychoPalette.redSignalBright}
                  strokeWidth={3.5}
                />
                <SvgText x={145} y={192} fill={PsychoPalette.redSignalBright} fontSize="11" fontWeight="bold" textAnchor="middle">
                  ¡DEFORMACIÓN POR BAJA PRESIÓN (21 PSI)!
                </SvgText>
              </G>
            ) : (
              <G>
                {/* Neumático correctamente inflado a 32 PSI */}
                <Circle
                  cx={145}
                  cy={108}
                  r={65}
                  fill="#0F172A"
                  stroke={PsychoPalette.mint}
                  strokeWidth={3.5}
                />
                <SvgText x={145} y={192} fill={PsychoPalette.mint} fontSize="11" fontWeight="bold" textAnchor="middle">
                  ✓ APOYO UNIFORME Y FIRME A 32 PSI
                </SvgText>
              </G>
            )}

            {/* Rin de aluminio */}
            <Circle cx={145} cy={112} r={36} fill="#1E293B" stroke="#94A3B8" strokeWidth={3} />
            <Circle cx={145} cy={112} r={10} fill="#0F172A" stroke={PsychoPalette.cyan} strokeWidth={2} />

            {/* Manguera del calibrador de aire conectada a la válvula */}
            <Path
              d="M 181 112 L 290 112"
              stroke={showingSolution ? PsychoPalette.mint : PsychoPalette.amberWarning}
              strokeWidth={4}
              strokeDasharray="6 4"
            />

            {/* Manómetro Digital de Presión PSI */}
            <Rect
              x={290}
              y={34}
              width={215}
              height={140}
              rx={16}
              fill="#0B1528"
              stroke={showingSolution ? PsychoPalette.mint : PsychoPalette.redSignalBright}
              strokeWidth={3}
            />
            <SvgText x={397} y={58} fill="#94A3B8" fontSize="10" fontWeight="bold" textAnchor="middle">
              MANÓMETRO DIGITAL DE LLANTAS
            </SvgText>
            <SvgText
              x={397}
              y={104}
              fill={showingSolution ? PsychoPalette.mint : PsychoPalette.redSignalBright}
              fontSize="34"
              fontWeight="bold"
              textAnchor="middle">
              {showingSolution ? '32 PSI' : '21 PSI'}
            </SvgText>
            <SvgText
              x={397}
              y={128}
              fill="#F8FAFC"
              fontSize="11"
              fontWeight="bold"
              textAnchor="middle">
              {showingSolution
                ? '✓ PRESIÓN REGLAMENTARIA OK'
                : '⚠ BAJA PRESIÓN (-11 PSI)'}
            </SvgText>
            <SvgText x={397} y={154} fill={PsychoPalette.cyan} fontSize="10" fontWeight="bold" textAnchor="middle">
              LABRADO VERIFICADO: 4.2 mm (NORMA &gt; 1.6 mm)
            </SvgText>
          </Svg>
        );

      case 'LIGHTS':
        return (
          <Svg width="100%" height={205} viewBox="0 0 540 205">
            <Rect x={4} y={4} width={532} height={197} rx={14} fill="#070E1B" stroke="#1E3150" strokeWidth={1.5} />

            {/* Vista frontal del carro y proyección de haces de luz */}
            <Rect x={40} y={55} width={160} height={96} rx={18} fill="#1E3A8A" stroke="#60A5FA" strokeWidth={2.5} />
            <Rect x={60} y={65} width={120} height={36} rx={8} fill="#0F172A" stroke="#93C5FD" strokeWidth={1.5} />
            <SvgText x={120} y={88} fill="#FFFFFF" fontSize="10" fontWeight="bold" textAnchor="middle">
              FRENTE DEL VEHÍCULO
            </SvgText>

            {/* Faro Izquierdo */}
            <Circle cx={66} cy={122} r={12} fill="#FEF08A" stroke="#FFFFFF" strokeWidth={2} />
            {/* Faro Derecho (Apagado en PROBLEMA vs Encendido en SOLUCIÓN) */}
            <Circle
              cx={174}
              cy={122}
              r={12}
              fill={showingSolution ? '#FEF08A' : '#334155'}
              stroke={showingSolution ? '#FFFFFF' : PsychoPalette.redSignalBright}
              strokeWidth={2}
            />

            {/* Proyección de los haces de luz sobre la vía */}
            {!showingSolution ? (
              <G>
                {/* Solo un haz corto y desalineado */}
                <Polygon points="200,115 335,145 335,175 200,135" fill="rgba(254, 240, 138, 0.22)" />
                <SvgText x={370} y={82} fill={PsychoPalette.redSignalBright} fontSize="13" fontWeight="bold" textAnchor="middle">
                  ✗ FAROLA DERECHA APAGADA
                </SvgText>
                <SvgText x={370} y={104} fill="#F8FAFC" fontSize="11" textAnchor="middle">
                  60% de la carretera queda a oscuras
                </SvgText>
              </G>
            ) : (
              <G>
                {/* Doble haz simétrico de largo alcance + direccionales */}
                <Polygon points="200,72 515,32 515,108 200,110" fill="rgba(0, 245, 160, 0.26)" />
                <Polygon points="200,116 515,102 515,178 200,152" fill="rgba(0, 217, 245, 0.26)" />
                <SvgText x={375} y={96} fill={PsychoPalette.mint} fontSize="13" fontWeight="bold" textAnchor="middle">
                  ✓ DOBLE HAZ SIMÉTRICO + DIRECCIONALES OK
                </SvgText>
                <SvgText x={375} y={118} fill="#FFFFFF" fontSize="11" fontWeight="bold" textAnchor="middle">
                  Bajas, Altas, Direccionales L/R y Freno 100%
                </SvgText>
              </G>
            )}
          </Svg>
        );

      case 'MIRRORS':
        return (
          <Svg width="100%" height={205} viewBox="0 0 540 205">
            <Rect x={4} y={4} width={532} height={197} rx={14} fill="#070E1B" stroke="#1E3150" strokeWidth={1.5} />

            {/* Vehículo central visto desde arriba con conos de visión de los 3 espejos */}
            <Rect x={225} y={62} width={90} height={115} rx={16} fill="#1D4ED8" stroke="#93C5FD" strokeWidth={2.5} />
            <SvgText x={270} y={122} fill="#FFFFFF" fontSize="10" fontWeight="bold" textAnchor="middle">
              TU CARRO
            </SvgText>

            {!showingSolution ? (
              <G>
                {/* Conos rojos estrechos apuntando al propio carro y zonas ciegas peligrosas */}
                <Polygon points="225,82 185,175 225,175" fill="rgba(239, 68, 68, 0.35)" />
                <Polygon points="315,82 315,175 355,175" fill="rgba(239, 68, 68, 0.35)" />
                <Rect x={60} y={85} width={115} height={78} rx={10} fill="rgba(239, 68, 68, 0.22)" stroke={PsychoPalette.redSignalBright} strokeWidth={2} strokeDasharray="5 4" />
                <SvgText x={117} y={122} fill={PsychoPalette.redSignalBright} fontSize="11" fontWeight="bold" textAnchor="middle">
                  ¡PUNTO CIEGO IZQ!
                </SvgText>
                <Rect x={365} y={85} width={115} height={78} rx={10} fill="rgba(239, 68, 68, 0.22)" stroke={PsychoPalette.redSignalBright} strokeWidth={2} strokeDasharray="5 4" />
                <SvgText x={422} y={122} fill={PsychoPalette.redSignalBright} fontSize="11" fontWeight="bold" textAnchor="middle">
                  ¡PUNTO CIEGO DER!
                </SvgText>
                <SvgText x={270} y={34} fill={PsychoPalette.redSignalBright} fontSize="12" fontWeight="bold" textAnchor="middle">
                  ✗ ESPEJOS CERRADOS: NO SE VEN LOS CARRILES VECINOS
                </SvgText>
              </G>
            ) : (
              <G>
                {/* Conos verdes amplios cubriendo los 3 ángulos traseros */}
                <Polygon points="225,82 45,190 215,190" fill="rgba(0, 245, 160, 0.28)" stroke={PsychoPalette.mint} strokeWidth={1.5} />
                <Polygon points="270,75 205,195 335,195" fill="rgba(0, 217, 245, 0.24)" stroke={PsychoPalette.cyan} strokeWidth={1.5} />
                <Polygon points="315,82 325,190 495,190" fill="rgba(0, 245, 160, 0.28)" stroke={PsychoPalette.mint} strokeWidth={1.5} />
                <SvgText x={125} y={155} fill={PsychoPalette.mint} fontSize="11" fontWeight="bold" textAnchor="middle">
                  ✓ ESPEJO IZQ OK
                </SvgText>
                <SvgText x={270} y={188} fill={PsychoPalette.cyan} fontSize="11" fontWeight="bold" textAnchor="middle">
                  ✓ CENTRAL PANORÁMICO
                </SvgText>
                <SvgText x={415} y={155} fill={PsychoPalette.mint} fontSize="11" fontWeight="bold" textAnchor="middle">
                  ✓ ESPEJO DER OK
                </SvgText>
                <SvgText x={270} y={34} fill={PsychoPalette.mint} fontSize="12" fontWeight="bold" textAnchor="middle">
                  ✓ VISIÓN 360° COMPLETA SIN PUNTOS CIEGOS
                </SvgText>
              </G>
            )}
          </Svg>
        );

      case 'CABIN':
        return (
          <Svg width="100%" height={205} viewBox="0 0 540 205">
            <Rect x={4} y={4} width={532} height={197} rx={14} fill="#070E1B" stroke="#1E3150" strokeWidth={1.5} />

            {/* Silla del conductor y Cinturón de Seguridad de 3 Puntos */}
            <Rect x={55} y={32} width={150} height={145} rx={14} fill="#0F172A" stroke="#475569" strokeWidth={2} />
            <SvgText x={130} y={54} fill="#94A3B8" fontSize="10" fontWeight="bold" textAnchor="middle">
              CINTURÓN DE 3 PUNTOS
            </SvgText>
            {!showingSolution ? (
              <G>
                <Line x1={75} y1={65} x2={92} y2={155} stroke={PsychoPalette.redSignalBright} strokeWidth={7} />
                <SvgText x={130} y={115} fill={PsychoPalette.redSignalBright} fontSize="12" fontWeight="bold" textAnchor="middle">
                  ✗ DESABROCHADO
                </SvgText>
              </G>
            ) : (
              <G>
                {/* Banda diagonal y pélvica abrochada */}
                <Line x1={75} y1={65} x2={180} y2={152} stroke={PsychoPalette.mint} strokeWidth={8} />
                <Line x1={75} y1={152} x2={180} y2={152} stroke={PsychoPalette.mint} strokeWidth={8} />
                <Circle cx={180} cy={152} r={9} fill={PsychoPalette.redSignalBright} stroke="#FFFFFF" strokeWidth={2} />
                <SvgText x={130} y={98} fill={PsychoPalette.mint} fontSize="12" fontWeight="bold" textAnchor="middle">
                  ✓ ANCLADO (CLICK)
                </SvgText>
              </G>
            )}

            {/* Palanca de Freno de Mano y Cluster */}
            <Rect x={245} y={32} width={250} height={145} rx={14} fill="#0F172A" stroke="#475569" strokeWidth={2} />
            <SvgText x={370} y={54} fill="#94A3B8" fontSize="10" fontWeight="bold" textAnchor="middle">
              FRENO DE MANO Y MANDOS DE CABINA
            </SvgText>
            <Line
              x1={310}
              y1={145}
              x2={showingSolution ? 395 : 425}
              y2={showingSolution ? 82 : 140}
              stroke={showingSolution ? PsychoPalette.mint : PsychoPalette.amberWarning}
              strokeWidth={10}
              strokeLinecap="round"
            />
            <Circle cx={310} cy={145} r={12} fill="#334155" stroke="#FFFFFF" strokeWidth={2} />
            <SvgText
              x={370}
              y={166}
              fill={showingSolution ? PsychoPalette.mint : PsychoPalette.amberWarning}
              fontSize="11"
              fontWeight="bold"
              textAnchor="middle">
              {showingSolution
                ? '✓ TENSIÓN CALIBRADA (6 CLICS) + PITO Y LIMPIABRISAS OK'
                : '⚠ PALANCA SIN TENSIÓN MECÁNica'}
            </SvgText>
          </Svg>
        );

      case 'KIT':
        return (
          <Svg width="100%" height={205} viewBox="0 0 540 205">
            <Rect x={4} y={4} width={532} height={197} rx={14} fill="#070E1B" stroke="#1E3150" strokeWidth={1.5} />

            {/* Cilindro del Extintor y Manómetro */}
            <Rect
              x={55}
              y={52}
              width={78}
              height={125}
              rx={16}
              fill="#DC2626"
              stroke="#FCA5A5"
              strokeWidth={2}
            />
            <Rect x={78} y={30} width={32} height={24} rx={5} fill="#334155" />
            {/* Manómetro del extintor */}
            <Circle
              cx={94}
              cy={85}
              r={20}
              fill="#0F172A"
              stroke={showingSolution ? PsychoPalette.mint : PsychoPalette.redSignalBright}
              strokeWidth={3}
            />
            <SvgText
              x={94}
              y={89}
              fill={showingSolution ? PsychoPalette.mint : PsychoPalette.redSignalBright}
              fontSize="9"
              fontWeight="bold"
              textAnchor="middle">
              {showingSolution ? 'VERDE OK' : '0 PSI !'}
            </SvgText>
            <SvgText x={94} y={142} fill="#FFFFFF" fontSize="10" fontWeight="bold" textAnchor="middle">
              EXTINTOR
            </SvgText>
            <SvgText x={94} y={156} fill="#FFFFFF" fontSize="9" textAnchor="middle">
              ABC 5 LB
            </SvgText>

            {/* 2 Triángulos Reflectivos y Botiquín */}
            <Polygon
              points="235,52 185,148 285,148"
              fill="none"
              stroke={showingSolution ? '#F97316' : '#475569'}
              strokeWidth={9}
              strokeLinejoin="round"
            />
            <Polygon
              points="345,52 295,148 395,148"
              fill="none"
              stroke={showingSolution ? '#F97316' : '#475569'}
              strokeWidth={9}
              strokeLinejoin="round"
            />

            {/* Botiquín y Gato */}
            <Rect
              x={415}
              y={68}
              width={92}
              height={80}
              rx={12}
              fill="#0F172A"
              stroke={showingSolution ? PsychoPalette.mint : '#475569'}
              strokeWidth={2.5}
            />
            <SvgText x={461} y={102} fill={PsychoPalette.mint} fontSize="18" fontWeight="bold" textAnchor="middle">
              +
            </SvgText>
            <SvgText x={461} y={122} fill="#FFFFFF" fontSize="9" fontWeight="bold" textAnchor="middle">
              BOTIQUÍN + GATO
            </SvgText>

            <SvgText
              x={335}
              y={182}
              fill={showingSolution ? PsychoPalette.mint : PsychoPalette.redSignalBright}
              fontSize="11"
              fontWeight="bold"
              textAnchor="middle">
              {showingSolution
                ? '✓ EXTINTOR PRESURIZADO + 2 TRIÁNGULOS + BOTIQUÍN Y HERRAMIENTA'
                : '✗ EXTINTOR DESCARGADO Y SEÑALES REFLECTIVAS FALTANTES'}
            </SvgText>
          </Svg>
        );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <TelemetryHeader
        title="LABORATORIO VISUAL PREOPERACIONAL"
        subtitle="Toque cada sistema del vehículo para ver el Problema y aplicar la Solución en vivo"
        moduleCode="MOD-00"
        showBack
        onTestAudio={playRightSignal}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* 1. MAPA INTERACTIVO DEL CARRO Y SELECTOR DE LAS 6 PIEZAS */}
        <View style={styles.carMapSelectorCard}>
          <View style={styles.carMapTopHeader}>
            <Text style={styles.carMapTitle}>
              SELECCIONE EL COMPONENTE DEL VEHÍCULO ({solvedCount}/{STATIONS.length} SOLUCIONADOS)
            </Text>
            <View style={styles.progressBadge}>
              <Text style={styles.progressBadgeText}>
                PROGRESO: {Math.round((solvedCount / STATIONS.length) * 100)}%
              </Text>
            </View>
          </View>

          {/* Mini Silueta del Vehículo con el punto activo resaltado encima */}
          <View style={styles.miniCarSvgBox}>
            <Svg width="100%" height={96} viewBox="0 0 360 96">
              <Defs>
                <LinearGradient id="carBodyGrad" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#1E3A8A" />
                  <Stop offset="1" stopColor="#172554" />
                </LinearGradient>
              </Defs>
              <Rect x={48} y={20} width={264} height={56} rx={16} fill="url(#carBodyGrad)" stroke="#60A5FA" strokeWidth={2} />
              <Rect x={140} y={25} width={105} height={46} rx={10} fill="#0F172A" stroke="#93C5FD" strokeWidth={1.5} />

              {STATIONS.map((st, idx) => {
                const isSelected = idx === activeIndex;
                const isDone = solvedMap[st.id];
                return (
                  <G key={st.id}>
                    {isSelected ? (
                      <Circle
                        cx={st.carZoneCoords.cx}
                        cy={st.carZoneCoords.cy}
                        r={16}
                        fill="rgba(0, 217, 245, 0.28)"
                        stroke={PsychoPalette.cyan}
                        strokeWidth={2}
                      />
                    ) : null}
                    <Circle
                      cx={st.carZoneCoords.cx}
                      cy={st.carZoneCoords.cy}
                      r={10}
                      fill={
                        isDone
                          ? PsychoPalette.mint
                          : isSelected
                            ? PsychoPalette.cyan
                            : PsychoPalette.amberWarning
                      }
                      stroke="#050A14"
                      strokeWidth={2}
                    />
                    <SvgText
                      x={st.carZoneCoords.cx}
                      y={st.carZoneCoords.cy + 3.5}
                      fill="#050A14"
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="middle">
                      {st.stepNum}
                    </SvgText>
                  </G>
                );
              })}
            </Svg>
          </View>

          {/* Pestañas horizontales de los 6 sistemas */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stationTabsRow}>
            {STATIONS.map((st, idx) => {
              const active = idx === activeIndex;
              const done = solvedMap[st.id];
              return (
                <Pressable
                  key={st.id}
                  onPress={() => handleSelectStation(idx)}
                  style={[
                    styles.stationTab,
                    active && styles.stationTabActive,
                    done && styles.stationTabDone,
                  ]}>
                  <Ionicons
                    name={done ? 'checkmark-circle' : 'alert-circle'}
                    size={14}
                    color={
                      done
                        ? PsychoPalette.mint
                        : active
                          ? PsychoPalette.cyan
                          : PsychoPalette.amberWarning
                    }
                  />
                  <Text
                    style={[
                      styles.stationTabText,
                      active && { color: PsychoPalette.cyan },
                      done && { color: PsychoPalette.mint },
                    ]}>
                    {st.shortTitle}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* 2. VISOR INTERACTIVO ENCIMA DE LA PIEZA: MUESTRA EL PROBLEMA Y CÓMO QUEDA LA SOLUCIÓN */}
        <View
          style={[
            styles.visualStageCard,
            showingSolution ? styles.visualStageCardSolved : styles.visualStageCardProblem,
          ]}>
          {/* Encabezado de la pieza e interruptor Problema vs Solución */}
          <View style={styles.stageTopBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.stageStepTag}>
                PUNTO {currentStation.stepNum} DE {STATIONS.length} • INSPECCIÓN VISUAL INTERACTIVA
              </Text>
              <Text style={styles.stageSystemTitle}>{currentStation.systemTitle}</Text>
            </View>

            {/* Interruptor para comparar cómo se ve el Problema vs la Solución encima de la pieza */}
            <View style={styles.compareSwitchGroup}>
              <Pressable
                onPress={() => setViewMode('PROBLEM')}
                style={[
                  styles.compareSwitchBtn,
                  !showingSolution && styles.compareSwitchBtnProblemActive,
                ]}>
                <Ionicons
                  name="warning-outline"
                  size={13}
                  color={!showingSolution ? '#FFFFFF' : PsychoPalette.textSecondary}
                />
                <Text
                  style={[
                    styles.compareSwitchText,
                    !showingSolution && { color: '#FFFFFF' },
                  ]}>
                  VER PROBLEMA
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  if (isCurrentSolved) {
                    setViewMode('SOLUTION');
                  } else {
                    handleApplySolution();
                  }
                }}
                style={[
                  styles.compareSwitchBtn,
                  showingSolution && styles.compareSwitchBtnSolutionActive,
                ]}>
                <Ionicons
                  name="checkmark-done"
                  size={13}
                  color={showingSolution ? '#050A14' : PsychoPalette.textSecondary}
                />
                <Text
                  style={[
                    styles.compareSwitchText,
                    showingSolution && { color: '#050A14' },
                  ]}>
                  VER SOLUCIÓN
                </Text>
              </Pressable>
            </View>
          </View>

          {/* BARRA DE VOZ DE FONDO RESUMIDA (NARRA QUÉ PASA Y CÓMO SE SOLUCIONA) */}
          <View style={styles.voiceNarratorBar}>
            <View style={styles.voiceNarratorLeft}>
              <View style={[styles.voicePulseCircle, isSpeaking && styles.voicePulseCircleActive]}>
                <Ionicons
                  name={voiceEnabled ? 'volume-high' : 'volume-mute'}
                  size={16}
                  color={voiceEnabled ? PsychoPalette.cyan : PsychoPalette.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.voiceNarratorTitle}>
                  {isSpeaking
                    ? 'VOZ DE FONDO EXPLICANDO EN VIVO (RESUMEN)...'
                    : 'RESUMEN DE VOZ (QUÉ PASA Y CÓMO SE SOLUCIONA)'}
                </Text>
                <Text style={styles.voiceNarratorTranscript}>{currentStation.voiceSummary}</Text>
              </View>
            </View>

            <View style={styles.voiceNarratorBtns}>
              <Pressable
                onPress={() => speakNarration(currentStation.voiceSummary)}
                style={styles.voiceReplayBtn}>
                <Ionicons name="play-circle" size={14} color={PsychoPalette.bgPrimary} />
                <Text style={styles.voiceReplayBtnText}>ESCUCHAR VOZ</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  const nextState = !voiceEnabled;
                  setVoiceEnabled(nextState);
                  if (!nextState) {
                    stopVoiceNarration();
                  } else {
                    speakNarration(currentStation.voiceSummary);
                  }
                }}
                style={[styles.voiceToggleBtn, !voiceEnabled && { opacity: 0.65 }]}>
                <Ionicons
                  name={voiceEnabled ? 'mic' : 'mic-off'}
                  size={13}
                  color={voiceEnabled ? PsychoPalette.mint : PsychoPalette.textSecondary}
                />
                <Text style={styles.voiceToggleBtnText}>
                  {voiceEnabled ? 'VOZ AUTO: ON' : 'VOZ AUTO: OFF'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* ESCENA GRÁFICA DINÁMICA ENCIMA DEL COMPONENTE */}
          <View style={styles.interactiveGraphicContainer}>
            {renderInteractiveComponentScene()}
            <View
              style={[
                styles.liveMetricBadge,
                showingSolution ? styles.liveMetricBadgeMint : styles.liveMetricBadgeRed,
              ]}>
              <Text
                style={[
                  styles.liveMetricBadgeText,
                  { color: showingSolution ? PsychoPalette.mint : PsychoPalette.redSignalBright },
                ]}>
                {showingSolution ? currentStation.solutionMetric : currentStation.problemMetric}
              </Text>
            </View>
          </View>

          {/* TARJETAS COMPARATIVAS DE APRENDIZAJE: EL PROBLEMA VS CÓMO QUEDA LA SOLUCIÓN */}
          <View style={styles.comparisonBoxesRow}>
            {/* Caja del Problema */}
            <View
              style={[
                styles.explanationBox,
                styles.problemBox,
                !showingSolution && styles.activeFocusBoxRed,
              ]}>
              <View style={styles.boxHeaderRow}>
                <Ionicons name="close-circle" size={16} color={PsychoPalette.redSignalBright} />
                <Text style={[styles.boxHeaderTitle, { color: PsychoPalette.redSignalBright }]}>
                  {currentStation.problemTitle}
                </Text>
              </View>
              <Text style={styles.boxBodyText}>{currentStation.problemExplanation}</Text>
              <Text style={styles.consequenceText}>
                Consecuencia: {currentStation.problemConsequence}
              </Text>
            </View>

            {/* Caja de la Solución */}
            <View
              style={[
                styles.explanationBox,
                styles.solutionBox,
                showingSolution && styles.activeFocusBoxMint,
              ]}>
              <View style={styles.boxHeaderRow}>
                <Ionicons name="checkmark-circle" size={16} color={PsychoPalette.mint} />
                <Text style={[styles.boxHeaderTitle, { color: PsychoPalette.mint }]}>
                  {currentStation.solutionTitle}
                </Text>
              </View>
              <Text style={styles.boxBodyText}>{currentStation.solutionExplanation}</Text>
              <Text style={styles.solutionStatusTag}>
                {isCurrentSolved
                  ? '✓ SOLUCIÓN APLICADA Y VERIFICADA EN EL VEHÍCULO'
                  : 'Pendiente: Presione el botón inferior para aplicar la solución'}
              </Text>
            </View>
          </View>

          {/* BOTÓN DE ACCIÓN PARA REPARAR LA FALLA Y NAVEGAR ENTRE COMPONENTES */}
          <View style={styles.stageActionFooter}>
            <Pressable
              onPress={() =>
                handleSelectStation((activeIndex - 1 + STATIONS.length) % STATIONS.length)
              }
              style={styles.navStepBtn}>
              <Ionicons name="chevron-back" size={16} color={PsychoPalette.textPrimary} />
              <Text style={styles.navStepBtnText}>ANTERIOR</Text>
            </Pressable>

            {!isCurrentSolved ? (
              <Pressable
                onPress={handleApplySolution}
                style={({ pressed }) => [
                  styles.applySolutionBtn,
                  pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
                ]}>
                <Ionicons name="construct" size={18} color={PsychoPalette.bgPrimary} />
                <Text style={styles.applySolutionBtnText}>{currentStation.actionButtonLabel}</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => {
                  if (activeIndex < STATIONS.length - 1) {
                    handleSelectStation(activeIndex + 1);
                  } else {
                    router.push('/maneuvers');
                  }
                }}
                style={styles.nextSolvedBtn}>
                <Ionicons name="checkmark-done-circle" size={18} color={PsychoPalette.bgPrimary} />
                <Text style={styles.applySolutionBtnText}>
                  {activeIndex < STATIONS.length - 1
                    ? 'SOLUCIONADO • PASAR AL SIGUIENTE SISTEMA'
                    : '¡PREOPERACIONAL 100%! IR AL SIMULADOR 3D'}
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => handleSelectStation((activeIndex + 1) % STATIONS.length)}
              style={styles.navStepBtn}>
              <Text style={styles.navStepBtnText}>SIGUIENTE</Text>
              <Ionicons name="chevron-forward" size={16} color={PsychoPalette.textPrimary} />
            </Pressable>
          </View>
        </View>

        {/* RESUMEN FINAL CUANDO SE COMPLETAN LAS 6 SOLUCIONES */}
        {certifiedGrade ? (
          <View style={styles.certifiedBanner}>
            <Ionicons name="shield-checkmark" size={26} color={PsychoPalette.mint} />
            <View style={{ flex: 1 }}>
              <Text style={styles.certifiedBannerTitle}>
                ¡VEHÍCULO 100% REVISADO Y APTO PARA OPERAR ({certifiedGrade})!
              </Text>
              <Text style={styles.certifiedBannerSub}>
                Ha inspeccionado visualmente cada sistema, identificado los problemas y aplicado las
                6 soluciones técnicas.
              </Text>
            </View>
            <Pressable onPress={() => router.push('/maneuvers')} style={styles.goSimBtn}>
              <Text style={styles.goSimBtnText}>IR A PISTA 3D</Text>
              <Ionicons name="arrow-forward" size={14} color={PsychoPalette.bgPrimary} />
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PsychoPalette.bgPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: 28,
    gap: 12,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  carMapSelectorCard: {
    backgroundColor: PsychoPalette.bgSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    padding: 12,
    gap: 8,
  },
  carMapTopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  carMapTitle: {
    color: PsychoPalette.textSecondary,
    fontSize: 10,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  progressBadge: {
    backgroundColor: PsychoPalette.mintDim,
    borderWidth: 1,
    borderColor: PsychoPalette.mint,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
  },
  progressBadgeText: {
    color: PsychoPalette.mint,
    fontSize: 10,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  miniCarSvgBox: {
    backgroundColor: PsychoPalette.bgPanel,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    paddingVertical: 2,
  },
  stationTabsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 2,
  },
  stationTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: PsychoPalette.bgCard,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 9,
  },
  stationTabActive: {
    backgroundColor: PsychoPalette.cyanDim,
    borderColor: PsychoPalette.cyan,
  },
  stationTabDone: {
    borderColor: PsychoPalette.mint,
  },
  stationTabText: {
    color: PsychoPalette.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
  visualStageCard: {
    backgroundColor: PsychoPalette.bgCard,
    borderRadius: 16,
    borderWidth: 2,
    padding: 14,
    gap: 12,
  },
  visualStageCardProblem: {
    borderColor: PsychoPalette.amberWarning,
  },
  visualStageCardSolved: {
    borderColor: PsychoPalette.mint,
  },
  stageTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  stageStepTag: {
    color: PsychoPalette.cyan,
    fontSize: 10,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  stageSystemTitle: {
    color: PsychoPalette.textPrimary,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 2,
  },
  compareSwitchGroup: {
    flexDirection: 'row',
    backgroundColor: PsychoPalette.bgPanel,
    borderRadius: 9,
    padding: 3,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    gap: 4,
  },
  compareSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
  },
  compareSwitchBtnProblemActive: {
    backgroundColor: PsychoPalette.redSignal,
  },
  compareSwitchBtnSolutionActive: {
    backgroundColor: PsychoPalette.mint,
  },
  compareSwitchText: {
    color: PsychoPalette.textSecondary,
    fontSize: 10,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  voiceNarratorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 245, 0.38)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  voiceNarratorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 220,
  },
  voicePulseCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: PsychoPalette.bgPanel,
    borderWidth: 1.5,
    borderColor: PsychoPalette.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voicePulseCircleActive: {
    borderColor: PsychoPalette.cyan,
    backgroundColor: 'rgba(0, 217, 245, 0.22)',
  },
  voiceNarratorTitle: {
    color: PsychoPalette.cyan,
    fontSize: 9.5,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  voiceNarratorTranscript: {
    color: PsychoPalette.textPrimary,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 2,
  },
  voiceNarratorBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  voiceReplayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PsychoPalette.cyan,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  voiceReplayBtnText: {
    color: PsychoPalette.bgPrimary,
    fontSize: 9.5,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  voiceToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PsychoPalette.bgPanel,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 8,
  },
  voiceToggleBtnText: {
    color: PsychoPalette.textPrimary,
    fontSize: 9.5,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
  interactiveGraphicContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 6,
  },
  liveMetricBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  liveMetricBadgeRed: {
    backgroundColor: PsychoPalette.redSignalDim,
    borderColor: PsychoPalette.redSignalBright,
  },
  liveMetricBadgeMint: {
    backgroundColor: PsychoPalette.mintDim,
    borderColor: PsychoPalette.mint,
  },
  liveMetricBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  comparisonBoxesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  explanationBox: {
    flex: 1,
    minWidth: 250,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    gap: 6,
  },
  problemBox: {
    backgroundColor: 'rgba(127, 29, 29, 0.16)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  solutionBox: {
    backgroundColor: 'rgba(6, 78, 59, 0.18)',
    borderColor: 'rgba(0, 245, 160, 0.35)',
  },
  activeFocusBoxRed: {
    borderColor: PsychoPalette.redSignalBright,
    backgroundColor: 'rgba(127, 29, 29, 0.28)',
  },
  activeFocusBoxMint: {
    borderColor: PsychoPalette.mint,
    backgroundColor: 'rgba(6, 78, 59, 0.32)',
  },
  boxHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  boxHeaderTitle: {
    fontSize: 12,
    fontWeight: '900',
    flex: 1,
  },
  boxBodyText: {
    color: PsychoPalette.textPrimary,
    fontSize: 12,
    lineHeight: 18,
  },
  consequenceText: {
    color: '#FCA5A5',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  solutionStatusTag: {
    color: PsychoPalette.mint,
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Fonts.mono,
    marginTop: 2,
  },
  stageActionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  navStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PsychoPalette.bgPanel,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
  },
  navStepBtnText: {
    color: PsychoPalette.textPrimary,
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
  applySolutionBtn: {
    flex: 1,
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PsychoPalette.amberWarning,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  nextSolvedBtn: {
    flex: 1,
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PsychoPalette.mint,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  applySolutionBtnText: {
    color: PsychoPalette.bgPrimary,
    fontSize: 11,
    fontWeight: '900',
    fontFamily: Fonts.mono,
    textAlign: 'center',
  },
  certifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: PsychoPalette.mintDim,
    borderWidth: 1.5,
    borderColor: PsychoPalette.mint,
    borderRadius: 14,
    padding: 14,
    flexWrap: 'wrap',
  },
  certifiedBannerTitle: {
    color: PsychoPalette.mint,
    fontSize: 13,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  certifiedBannerSub: {
    color: PsychoPalette.textPrimary,
    fontSize: 12,
    marginTop: 2,
  },
  goSimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: PsychoPalette.mint,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 8,
  },
  goSimBtnText: {
    color: PsychoPalette.bgPrimary,
    fontSize: 11,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
});
