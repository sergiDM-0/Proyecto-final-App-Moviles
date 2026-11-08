import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { TelemetryHeader } from '@/components/telemetry-header';
import { Fonts, PsychoPalette } from '@/constants/theme';
import { AptitudeGrade, useEvaluation } from '@/context/evaluation-context';
import { usePsychAudio } from '@/hooks/use-psych-audio';

type InspectionCategory = 'ALL' | 'ENGINE' | 'TIRES' | 'LIGHTS_MIRRORS' | 'CABIN' | 'SAFETY_KIT';

interface PreopItem {
  id: string;
  category: Exclude<InspectionCategory, 'ALL'>;
  categoryLabel: string;
  title: string;
  detail: string;
  specValue: string;
  hasInitialAnomaly?: boolean;
  anomalyDescription?: string;
  fixActionLabel?: string;
}

const PREOP_ITEMS: PreopItem[] = [
  // 1. MOTOR Y FLUIDOS
  {
    id: 'engine-oil',
    category: 'ENGINE',
    categoryLabel: 'MOTOR Y FLUIDOS',
    title: 'Nivel y Estado del Aceite de Motor',
    detail: 'Medición con bayoneta en frío entre marcas MIN y FULL, sin presencia de residuos.',
    specValue: 'SAE 5W-30 • ÓPTIMO',
  },
  {
    id: 'engine-coolant',
    category: 'ENGINE',
    categoryLabel: 'MOTOR Y FLUIDOS',
    title: 'Líquido Refrigerante y Vaso de Expansión',
    detail: 'Verificación de nivel térmico y ausencia de fugas en mangueras del radiador.',
    specValue: 'NIVEL ÓPTIMO (50/50)',
    hasInitialAnomaly: true,
    anomalyDescription: 'ALERTA: Nivel de refrigerante por debajo del mínimo (Riesgo de recalentamiento)',
    fixActionLabel: 'RELLENAR REFRIGERANTE A NIVEL FULL',
  },
  {
    id: 'engine-brake-fluid',
    category: 'ENGINE',
    categoryLabel: 'MOTOR Y FLUIDOS',
    title: 'Líquido de Frenos y Batería 12V',
    detail: 'Depósito DOT-4 al máximo y bornes de batería limpios y firmemente sujetos.',
    specValue: 'DOT-4 • 12.6V OK',
  },

  // 2. LLANTAS Y SUSPENSIÓN
  {
    id: 'tires-front',
    category: 'TIRES',
    categoryLabel: 'LLANTAS Y FRENOS',
    title: 'Presión de Llantas Delanteras (Izq / Der)',
    detail: 'Calibración en frío según especificación del fabricante y verificación de válvulas.',
    specValue: '32 PSI / 32 PSI',
    hasInitialAnomaly: true,
    anomalyDescription: 'FALLA DETECTADA: Llanta Delantera Izquierda baja (21 PSI - Desbalanceo)',
    fixActionLabel: 'CALIBRAR AIRE A 32 PSI',
  },
  {
    id: 'tires-rear',
    category: 'TIRES',
    categoryLabel: 'LLANTAS Y FRENOS',
    title: 'Presión de Llantas Traseras y Tuercas',
    detail: 'Presión uniforme en eje trasero y torque completo en los 5 pernos por rueda.',
    specValue: '32 PSI • PERNOS OK',
  },
  {
    id: 'tires-tread',
    category: 'TIRES',
    categoryLabel: 'LLANTAS Y FRENOS',
    title: 'Profundidad de Labrado y Llanta de Repuesto',
    detail: 'Labrado mayor a 2.0 mm (norma > 1.6 mm) sin protuberancias ni cortes laterales.',
    specValue: '4.2 mm • REPUESTO OK',
  },

  // 3. LUCES, ESPEJOS Y VISIBILIDAD
  {
    id: 'lights-headlights',
    category: 'LIGHTS_MIRRORS',
    categoryLabel: 'LUCES Y ESPEJOS',
    title: 'Farolas Delanteras (Bajas, Altas y Exploradoras)',
    detail: 'Encendido simétrico de proyectores principales para conducción diurna/nocturna.',
    specValue: 'LED 6000K • FUNCIONAL',
  },
  {
    id: 'lights-signals',
    category: 'LIGHTS_MIRRORS',
    categoryLabel: 'LUCES Y ESPEJOS',
    title: 'Direccionales (Izq/Der), Estacionarias, Freno y Reversa',
    detail: 'Intermitencia sincronizada, stops traseros al pisar pedal y luz blanca de marcha atrás.',
    specValue: 'CIRCUITO L/R OK',
  },
  {
    id: 'mirrors-adjustment',
    category: 'LIGHTS_MIRRORS',
    categoryLabel: 'LUCES Y ESPEJOS',
    title: 'Espejos Retrovisores (Izquierdo, Central y Derecho)',
    detail: 'Regulación ergonómica desde el puesto del conductor para eliminar puntos ciegos.',
    specValue: '3 ESPEJOS ALINEADOS',
    hasInitialAnomaly: true,
    anomalyDescription: 'DESAJUSTE: Espejo retrovisor central y lateral derecho fuera de ángulo visual',
    fixActionLabel: 'GRADUAR LOS 3 ESPEJOS RETROVISORES',
  },

  // 4. CABINA Y MANDOS DE UN CARRO NORMAL
  {
    id: 'cabin-seatbelt',
    category: 'CABIN',
    categoryLabel: 'CABINA Y MANDOS',
    title: 'Cinturón de Seguridad de 3 Puntos y Silla del Conductor',
    detail: 'Bloqueo inercial del cinturón, distancia a los pedales y altura del apoyacabezas.',
    specValue: 'RETRÁCTIL • ANCLADO',
  },
  {
    id: 'cabin-handbrake',
    category: 'CABIN',
    categoryLabel: 'CABINA Y MANDOS',
    title: 'Freno de Mano (Estacionamiento), Volante y Pedales',
    detail: 'Recorrido firme de la palanca de freno de mano, holgura cero en dirección y retorno de pedales.',
    specValue: 'TENSIÓN MECÁNICA OK',
    hasInitialAnomaly: true,
    anomalyDescription: 'VERIFICACIÓN PENDIENTE: Calibrar tensión del freno de mano y retorno de embrague/freno',
    fixActionLabel: 'VERIFICAR Y DESTRABAR MANDOS DE CABINA',
  },
  {
    id: 'cabin-wipers-horn',
    category: 'CABIN',
    categoryLabel: 'CABINA Y MANDOS',
    title: 'Limpiaparabrisas, Líquido Lavaparabrisas, Claxon y Tablero',
    detail: 'Barrido limpio de plumillas, sonido de pito reglamentario y cero testigos de falla en cluster.',
    specValue: 'CLUSTER 0 FALLAS',
  },

  // 5. EQUIPO DE CARRETERA Y SEGURIDAD (PESV)
  {
    id: 'kit-extinguisher',
    category: 'SAFETY_KIT',
    categoryLabel: 'EQUIPO CARRETERA',
    title: 'Extintor Multipropósito ABC (Presurizado y Vigente)',
    detail: 'Manómetro en zona verde, pin de seguridad intacto y fecha de recarga vigente.',
    specValue: '5 LB ABC • VIGENTE',
    hasInitialAnomaly: true,
    anomalyDescription: 'OBSERVACIÓN: Soporte del extintor y triángulos desasegurados en el maletero',
    fixActionLabel: 'FIJAR EXTINTOR Y KIT DE EMERGENCIA',
  },
  {
    id: 'kit-triangles-tools',
    category: 'SAFETY_KIT',
    categoryLabel: 'EQUIPO CARRETERA',
    title: 'Gato Hidráulico, Cruceta, 2 Tacos y 2 Señales Reflectivas',
    detail: 'Herramientas completas para cambio de llanta y señalización de emergencia en vía.',
    specValue: 'KIT REGLAMENTARIO OK',
  },
  {
    id: 'kit-firstaid-docs',
    category: 'SAFETY_KIT',
    categoryLabel: 'EQUIPO CARRETERA',
    title: 'Botiquín de Primeros Auxilios, Linterna y Documentos (SOAT/RTM)',
    detail: 'Antisépticos, gasas estériles, chaleco reflectivo y documentación al día.',
    specValue: 'SOAT + RTM VIGENTES',
  },
];

const CATEGORY_TABS: { id: InspectionCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'ALL', label: 'TODOS (15)', icon: 'apps-outline' },
  { id: 'ENGINE', label: '1. MOTOR', icon: 'flame-outline' },
  { id: 'TIRES', label: '2. LLANTAS PSI', icon: 'disc-outline' },
  { id: 'LIGHTS_MIRRORS', label: '3. LUCES/ESPEJOS', icon: 'flashlight-outline' },
  { id: 'CABIN', label: '4. CABINA', icon: 'speedometer-outline' },
  { id: 'SAFETY_KIT', label: '5. KIT VIAL', icon: 'medkit-outline' },
];

export default function PreoperationalScreen() {
  const { setPreoperationalResult } = useEvaluation();
  const { playLeftSignal, playRightSignal, playSuccess, playError } = usePsychAudio();

  const [selectedCategory, setSelectedCategory] = useState<InspectionCategory>('ALL');
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});
  const [fixedAnomalies, setFixedAnomalies] = useState<Record<string, boolean>>({});
  const [statusMessage, setStatusMessage] = useState<string>(
    'Inspeccione cada sistema del vehículo, corrija las 5 anomalías detectadas y marque los 15 puntos para habilitar la conducción.'
  );
  const [certifiedGrade, setCertifiedGrade] = useState<AptitudeGrade | null>(null);

  const totalItems = PREOP_ITEMS.length;
  const totalInitialAnomalies = useMemo(
    () => PREOP_ITEMS.filter((i) => i.hasInitialAnomaly).length,
    []
  );

  const checkedCount = useMemo(
    () => PREOP_ITEMS.filter((i) => checkedIds[i.id]).length,
    [checkedIds]
  );

  const anomaliesFixedCount = useMemo(
    () => PREOP_ITEMS.filter((i) => i.hasInitialAnomaly && fixedAnomalies[i.id]).length,
    [fixedAnomalies]
  );

  const remainingAnomalies = totalInitialAnomalies - anomaliesFixedCount;

  const filteredItems = useMemo(() => {
    if (selectedCategory === 'ALL') return PREOP_ITEMS;
    return PREOP_ITEMS.filter((item) => item.category === selectedCategory);
  }, [selectedCategory]);

  // Check if a specific category is 100% done
  const isCategoryComplete = (cat: Exclude<InspectionCategory, 'ALL'>) => {
    const items = PREOP_ITEMS.filter((i) => i.category === cat);
    return items.every((i) => checkedIds[i.id] && (!i.hasInitialAnomaly || fixedAnomalies[i.id]));
  };

  const handleFixAnomaly = (item: PreopItem) => {
    playRightSignal();
    setFixedAnomalies((prev) => ({ ...prev, [item.id]: true }));
    setCheckedIds((prev) => ({ ...prev, [item.id]: true }));
    setStatusMessage(`Anomalía corregida: ${item.title} (${item.specValue}). Punto verificado.`);
  };

  const handleToggleCheck = (item: PreopItem) => {
    if (item.hasInitialAnomaly && !fixedAnomalies[item.id]) {
      playError();
      setStatusMessage(
        `¡Atención! Antes de aprobar "${item.title}", presione el botón naranja para corregir la falla detectada.`
      );
      return;
    }

    const nextState = !checkedIds[item.id];
    if (nextState) {
      playLeftSignal();
    }
    setCheckedIds((prev) => ({ ...prev, [item.id]: nextState }));
    setCertifiedGrade(null);
  };

  const handleCompleteAllQuick = () => {
    const allFixed: Record<string, boolean> = {};
    const allChecked: Record<string, boolean> = {};
    PREOP_ITEMS.forEach((item) => {
      if (item.hasInitialAnomaly) {
        allFixed[item.id] = true;
      }
      allChecked[item.id] = true;
    });
    setFixedAnomalies(allFixed);
    setCheckedIds(allChecked);
    playSuccess();
    setStatusMessage(
      '¡Los 15 puntos de control y las 5 correcciones mecánicas han sido verificados! Presione "CERTIFICAR VEHÍCULO".'
    );
  };

  const handleCertifyPreoperational = () => {
    const scorePct = Math.round(
      ((checkedCount / totalItems) * 0.7 + (anomaliesFixedCount / totalInitialAnomalies) * 0.3) * 100
    );

    let grade: AptitudeGrade = 'NO APTO';
    if (checkedCount === totalItems && remainingAnomalies === 0) {
      grade = 'EXCELENTE';
      playSuccess();
      setStatusMessage(
        '¡DICTAMEN PREOPERACIONAL EXCELENTE (100%)! El vehículo cumple todos los estándares de seguridad activa y pasiva.'
      );
    } else if (checkedCount >= 13 && remainingAnomalies === 0) {
      grade = 'APTO';
      playSuccess();
      setStatusMessage(
        `DICTAMEN PREOPERACIONAL APTO (${scorePct}%). Anomalías críticas corregidas; vehículo habilitado para pista.`
      );
    } else {
      grade = 'NO APTO';
      playError();
      setStatusMessage(
        `VEHÍCULO NO APTO (${scorePct}%). Quedan ${remainingAnomalies} fallas mecánicas sin corregir o puntos críticos sin revisar.`
      );
    }

    setCertifiedGrade(grade);
    setPreoperationalResult({
      checkedCount,
      totalCount: totalItems,
      anomaliesFixed: anomaliesFixedCount,
      scorePct,
      grade,
      completedAt: new Date().toLocaleTimeString(),
    });
  };

  const engineOk = isCategoryComplete('ENGINE');
  const tiresOk = isCategoryComplete('TIRES');
  const lightsOk = isCategoryComplete('LIGHTS_MIRRORS');
  const cabinOk = isCategoryComplete('CABIN');
  const kitOk = isCategoryComplete('SAFETY_KIT');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <TelemetryHeader
        title="NIVEL PREOPERACIONAL DEL VEHÍCULO"
        subtitle="Inspección Mecánica 360°, Fluidos, PSI de Llantas, Cabina y Kit Vial"
        moduleCode="MOD-00"
        showBack
        onTestAudio={playRightSignal}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* PANEL SUPERIOR DE MÉTRICAS Y ESQUEMA INTERACTIVO DEL CARRO */}
        <View style={styles.topOverviewCard}>
          <View style={styles.metricsRow}>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>PUNTOS REVISADOS</Text>
              <Text style={[styles.metricValue, { color: PsychoPalette.cyan }]}>
                {checkedCount}/{totalItems}
              </Text>
            </View>

            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>FALLAS CORREGIDAS</Text>
              <Text
                style={[
                  styles.metricValue,
                  {
                    color:
                      remainingAnomalies === 0 ? PsychoPalette.mint : PsychoPalette.amberWarning,
                  },
                ]}>
                {anomaliesFixedCount}/{totalInitialAnomalies}
              </Text>
            </View>

            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>PRESIÓN LLANTAS</Text>
              <Text
                style={[
                  styles.metricValue,
                  { color: fixedAnomalies['tires-front'] ? PsychoPalette.mint : PsychoPalette.redSignalBright },
                ]}>
                {fixedAnomalies['tires-front'] ? '32 PSI OK' : '21 PSI BAJA'}
              </Text>
            </View>

            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>ESTADO VEHÍCULO</Text>
              <Text
                style={[
                  styles.metricValue,
                  {
                    color:
                      checkedCount === totalItems && remainingAnomalies === 0
                        ? PsychoPalette.mint
                        : PsychoPalette.amberWarning,
                  },
                ]}>
                {checkedCount === totalItems && remainingAnomalies === 0 ? 'LISTO' : 'EN REVISIÓN'}
              </Text>
            </View>
          </View>

          {/* DIAGRAMA TÉCNICO INTERACTIVO DEL VEHÍCULO (TOQUE ZONAS PARA FILTRAR) */}
          <View style={styles.carBlueprintBox}>
            <View style={styles.blueprintHeader}>
              <Text style={styles.blueprintTitle}>
                ESQUEMA TÉCNICO 360° • TOQUE UNA ZONA DEL CARRO PARA INSPECCIONAR
              </Text>
              <Pressable onPress={handleCompleteAllQuick} style={styles.quickVerifyBtn}>
                <Ionicons name="checkmark-done-outline" size={14} color={PsychoPalette.mint} />
                <Text style={styles.quickVerifyBtnText}>INSPECCIONAR Y CALIBRAR TODO</Text>
              </Pressable>
            </View>

            <View style={styles.svgDiagramWrapper}>
              <Svg width="100%" height={150} viewBox="0 0 520 150">
                {/* Fondo cuadriculado de taller */}
                <Rect x={4} y={4} width={512} height={142} rx={12} fill="#070E1B" stroke="#1E3150" strokeWidth={1.5} />
                <Line x1={130} y1={4} x2={130} y2={146} stroke="rgba(30,49,80,0.4)" strokeDasharray="4 4" />
                <Line x1={260} y1={4} x2={260} y2={146} stroke="rgba(30,49,80,0.4)" strokeDasharray="4 4" />
                <Line x1={390} y1={4} x2={390} y2={146} stroke="rgba(30,49,80,0.4)" strokeDasharray="4 4" />

                {/* Haces de luces delanteras */}
                <Path
                  d="M 135 45 L 40 22 L 40 62 Z"
                  fill={lightsOk ? 'rgba(0, 245, 160, 0.22)' : 'rgba(0, 217, 245, 0.14)'}
                />
                <Path
                  d="M 135 105 L 40 88 L 40 128 Z"
                  fill={lightsOk ? 'rgba(0, 245, 160, 0.22)' : 'rgba(0, 217, 245, 0.14)'}
                />

                {/* 4 LLANTAS DEL VEHÍCULO */}
                <Rect
                  x={162}
                  y={20}
                  width={42}
                  height={12}
                  rx={4}
                  fill="#0F172A"
                  stroke={tiresOk ? PsychoPalette.mint : PsychoPalette.amberWarning}
                  strokeWidth={2}
                />
                <Rect
                  x={162}
                  y={118}
                  width={42}
                  height={12}
                  rx={4}
                  fill="#0F172A"
                  stroke={tiresOk ? PsychoPalette.mint : PsychoPalette.amberWarning}
                  strokeWidth={2}
                />
                <Rect
                  x={322}
                  y={20}
                  width={42}
                  height={12}
                  rx={4}
                  fill="#0F172A"
                  stroke={tiresOk ? PsychoPalette.mint : PsychoPalette.cyan}
                  strokeWidth={2}
                />
                <Rect
                  x={322}
                  y={118}
                  width={42}
                  height={12}
                  rx={4}
                  fill="#0F172A"
                  stroke={tiresOk ? PsychoPalette.mint : PsychoPalette.cyan}
                  strokeWidth={2}
                />

                {/* CARROCERÍA PRINCIPAL DEL CARRO */}
                <Rect
                  x={132}
                  y={30}
                  width={260}
                  height={90}
                  rx={22}
                  fill="#172554"
                  stroke={PsychoPalette.vehicleBlueLight}
                  strokeWidth={2.5}
                />

                {/* COMPARTIMIENTO DEL MOTOR (DELANTERO) */}
                <Rect
                  x={142}
                  y={38}
                  width={68}
                  height={74}
                  rx={10}
                  fill={engineOk ? 'rgba(0, 245, 160, 0.2)' : 'rgba(245, 158, 11, 0.22)'}
                  stroke={engineOk ? PsychoPalette.mint : PsychoPalette.amberWarning}
                  strokeWidth={2}
                />
                <SvgText x={176} y={72} fill="#FFFFFF" fontSize="10" fontWeight="bold" textAnchor="middle">
                  MOTOR
                </SvgText>
                <SvgText
                  x={176}
                  y={86}
                  fill={engineOk ? PsychoPalette.mint : PsychoPalette.amberWarning}
                  fontSize="8"
                  fontWeight="bold"
                  textAnchor="middle">
                  {engineOk ? 'FLUIDOS OK' : 'REVISAR'}
                </SvgText>

                {/* CABINA / MANDOS / ESPEJOS */}
                <Rect
                  x={218}
                  y={38}
                  width={96}
                  height={74}
                  rx={8}
                  fill={cabinOk ? 'rgba(0, 245, 160, 0.2)' : 'rgba(0, 217, 245, 0.18)'}
                  stroke={cabinOk ? PsychoPalette.mint : PsychoPalette.cyan}
                  strokeWidth={2}
                />
                <SvgText x={266} y={72} fill="#FFFFFF" fontSize="10" fontWeight="bold" textAnchor="middle">
                  CABINA &amp; MANDOS
                </SvgText>
                <SvgText
                  x={266}
                  y={86}
                  fill={cabinOk ? PsychoPalette.mint : PsychoPalette.cyan}
                  fontSize="8"
                  fontWeight="bold"
                  textAnchor="middle">
                  {cabinOk ? 'MANDOS OK' : 'ESPEJOS/FRENO'}
                </SvgText>

                {/* ESPEJOS LATERALES IZQUIERDO Y DERECHO */}
                <Circle
                  cx={222}
                  cy={24}
                  r={6}
                  fill={lightsOk ? PsychoPalette.mint : PsychoPalette.amberWarning}
                />
                <Circle
                  cx={222}
                  cy={126}
                  r={6}
                  fill={lightsOk ? PsychoPalette.mint : PsychoPalette.amberWarning}
                />

                {/* BAÚL / EQUIPO DE CARRETERA */}
                <Rect
                  x={322}
                  y={40}
                  width={60}
                  height={70}
                  rx={10}
                  fill={kitOk ? 'rgba(0, 245, 160, 0.2)' : 'rgba(245, 158, 11, 0.2)'}
                  stroke={kitOk ? PsychoPalette.mint : PsychoPalette.amberWarning}
                  strokeWidth={2}
                />
                <SvgText x={352} y={72} fill="#FFFFFF" fontSize="9" fontWeight="bold" textAnchor="middle">
                  KIT VIAL
                </SvgText>
                <SvgText
                  x={352}
                  y={85}
                  fill={kitOk ? PsychoPalette.mint : PsychoPalette.amberWarning}
                  fontSize="8"
                  fontWeight="bold"
                  textAnchor="middle">
                  {kitOk ? 'PESV OK' : 'EXTINTOR'}
                </SvgText>

                {/* Etiquetas de presión PSI en las esquinas */}
                <G>
                  <SvgText
                    x={86}
                    y={32}
                    fill={fixedAnomalies['tires-front'] ? PsychoPalette.mint : PsychoPalette.redSignalBright}
                    fontSize="10"
                    fontWeight="bold">
                    {fixedAnomalies['tires-front'] ? 'DEL-IZQ: 32 PSI' : 'DEL-IZQ: 21 PSI !'}
                  </SvgText>
                  <SvgText x={86} y={132} fill={PsychoPalette.mint} fontSize="10" fontWeight="bold">
                    DEL-DER: 32 PSI
                  </SvgText>
                  <SvgText x={405} y={32} fill={PsychoPalette.mint} fontSize="10" fontWeight="bold">
                    TRAS-IZQ: 32 PSI
                  </SvgText>
                  <SvgText x={405} y={132} fill={PsychoPalette.mint} fontSize="10" fontWeight="bold">
                    TRAS-DER: 32 PSI
                  </SvgText>
                </G>
              </Svg>
            </View>

            {/* PESTAÑAS DE ZONAS DE INSPECCIÓN */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryTabsRow}>
              {CATEGORY_TABS.map((tab) => {
                const active = selectedCategory === tab.id;
                const done =
                  tab.id === 'ALL'
                    ? checkedCount === totalItems && remainingAnomalies === 0
                    : isCategoryComplete(tab.id);
                return (
                  <Pressable
                    key={tab.id}
                    onPress={() => setSelectedCategory(tab.id)}
                    style={[
                      styles.categoryChip,
                      active && styles.categoryChipActive,
                      done && styles.categoryChipDone,
                    ]}>
                    <Ionicons
                      name={done ? 'checkmark-circle' : 'construct-outline'}
                      size={13}
                      color={
                        done
                          ? PsychoPalette.mint
                          : active
                            ? PsychoPalette.cyan
                            : PsychoPalette.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        active && styles.categoryChipTextActive,
                        done && { color: PsychoPalette.mint },
                      ]}>
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* BANNER DE ESTADO Y ALERTA DE FALLAS */}
          <View
            style={[
              styles.statusBanner,
              remainingAnomalies === 0 && checkedCount === totalItems && styles.statusBannerReady,
            ]}>
            <Ionicons
              name={
                remainingAnomalies === 0 && checkedCount === totalItems
                  ? 'shield-checkmark'
                  : 'alert-circle'
              }
              size={18}
              color={
                remainingAnomalies === 0 && checkedCount === totalItems
                  ? PsychoPalette.mint
                  : PsychoPalette.amberWarning
              }
            />
            <Text style={styles.statusBannerText}>{statusMessage}</Text>
          </View>
        </View>

        {/* LISTA DE LOS 15 PUNTOS DE CONTROL PREOPERACIONAL */}
        <View style={styles.checklistColumn}>
          {filteredItems.map((item, idx) => {
            const isChecked = !!checkedIds[item.id];
            const hasUnfixedAnomaly = !!item.hasInitialAnomaly && !fixedAnomalies[item.id];
            const wasAnomalyFixed = !!item.hasInitialAnomaly && !!fixedAnomalies[item.id];

            return (
              <View
                key={item.id}
                style={[
                  styles.checkCard,
                  isChecked && styles.checkCardDone,
                  hasUnfixedAnomaly && styles.checkCardAnomaly,
                ]}>
                <View style={styles.checkCardTop}>
                  <View style={styles.checkCategoryBadge}>
                    <Text style={styles.checkCategoryBadgeText}>
                      #{idx + 1} • {item.categoryLabel}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.specPill,
                      hasUnfixedAnomaly && {
                        borderColor: PsychoPalette.redSignalBright,
                        backgroundColor: PsychoPalette.redSignalDim,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.specPillText,
                        hasUnfixedAnomaly && { color: PsychoPalette.redSignalBright },
                      ]}>
                      {hasUnfixedAnomaly ? 'REQUIERE AJUSTE' : item.specValue}
                    </Text>
                  </View>
                </View>

                <View style={styles.checkMainRow}>
                  <View style={styles.checkTextCol}>
                    <Text style={styles.checkTitle}>{item.title}</Text>
                    <Text style={styles.checkDetail}>{item.detail}</Text>
                  </View>

                  <Pressable
                    onPress={() => handleToggleCheck(item)}
                    style={[
                      styles.verifyToggleBtn,
                      isChecked && styles.verifyToggleBtnActive,
                      hasUnfixedAnomaly && styles.verifyToggleBtnLocked,
                    ]}>
                    <Ionicons
                      name={
                        isChecked
                          ? 'checkmark-circle'
                          : hasUnfixedAnomaly
                            ? 'build-outline'
                            : 'ellipse-outline'
                      }
                      size={20}
                      color={
                        isChecked
                          ? PsychoPalette.bgPrimary
                          : hasUnfixedAnomaly
                            ? PsychoPalette.amberWarning
                            : PsychoPalette.cyan
                      }
                    />
                    <Text
                      style={[
                        styles.verifyToggleText,
                        isChecked && { color: PsychoPalette.bgPrimary },
                      ]}>
                      {isChecked ? 'VERIFICADO' : 'VERIFICAR'}
                    </Text>
                  </Pressable>
                </View>

                {/* SI TIENE UNA FALLA SIMULADA, MOSTRAR EL BOTÓN DE CORRECCIÓN MECÁNICA */}
                {hasUnfixedAnomaly ? (
                  <View style={styles.anomalyActionBox}>
                    <View style={styles.anomalyTextRow}>
                      <Ionicons name="warning" size={16} color={PsychoPalette.amberWarning} />
                      <Text style={styles.anomalyAlertText}>{item.anomalyDescription}</Text>
                    </View>
                    <Pressable
                      onPress={() => handleFixAnomaly(item)}
                      style={({ pressed }) => [
                        styles.fixAnomalyBtn,
                        pressed && { opacity: 0.85 },
                      ]}>
                      <Ionicons name="construct" size={14} color={PsychoPalette.bgPrimary} />
                      <Text style={styles.fixAnomalyBtnText}>{item.fixActionLabel}</Text>
                    </Pressable>
                  </View>
                ) : wasAnomalyFixed ? (
                  <View style={styles.anomalyFixedBar}>
                    <Ionicons name="checkmark-done" size={14} color={PsychoPalette.mint} />
                    <Text style={styles.anomalyFixedText}>
                      Anomalía técnica corregida y calibrada según norma ({item.specValue})
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* BOTÓN DE CERTIFICACIÓN FINAL Y NAVEGACIÓN AL SIMULADOR 3D */}
        <View style={styles.footerCertifyPanel}>
          <Pressable
            onPress={handleCertifyPreoperational}
            style={({ pressed }) => [
              styles.certifyPrimaryBtn,
              pressed && { opacity: 0.88 },
            ]}>
            <Ionicons name="shield-checkmark" size={20} color={PsychoPalette.bgPrimary} />
            <Text style={styles.certifyPrimaryBtnText}>
              CERTIFICAR INSPECCIÓN PREOPERACIONAL ({checkedCount}/{totalItems})
            </Text>
          </Pressable>

          {certifiedGrade ? (
            <View style={styles.certifiedResultBox}>
              <Text
                style={[
                  styles.certifiedGradeText,
                  {
                    color:
                      certifiedGrade === 'EXCELENTE'
                        ? PsychoPalette.mint
                        : certifiedGrade === 'APTO'
                          ? PsychoPalette.cyan
                          : PsychoPalette.redSignalBright,
                  },
                ]}>
                RESULTADO REGISTRADO: {certifiedGrade}
              </Text>
              <View style={styles.nextButtonsRow}>
                <Pressable
                  onPress={() => router.push('/reaction')}
                  style={styles.goReactionBtn}>
                  <Ionicons name="headset" size={15} color={PsychoPalette.bgPrimary} />
                  <Text style={styles.goNextBtnText}>IR A PRUEBA DE SONIDO</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/maneuvers')}
                  style={styles.goSim3DBtn}>
                  <Ionicons name="car-sport" size={15} color={PsychoPalette.bgPrimary} />
                  <Text style={styles.goNextBtnText}>ENTRAR AL SIMULADOR 3D</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
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
    paddingBottom: 32,
    gap: 12,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  topOverviewCard: {
    backgroundColor: PsychoPalette.bgSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    padding: 12,
    gap: 10,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metricCell: {
    flex: 1,
    minWidth: 100,
    backgroundColor: PsychoPalette.bgPanel,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    paddingVertical: 7,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  metricLabel: {
    color: PsychoPalette.textMuted,
    fontSize: 9,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '900',
    fontFamily: Fonts.mono,
    marginTop: 2,
  },
  carBlueprintBox: {
    backgroundColor: PsychoPalette.bgPanel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    padding: 10,
    gap: 8,
  },
  blueprintHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  blueprintTitle: {
    color: PsychoPalette.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
  quickVerifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: PsychoPalette.mintDim,
    borderWidth: 1,
    borderColor: PsychoPalette.mint,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
  },
  quickVerifyBtnText: {
    color: PsychoPalette.mint,
    fontSize: 10,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  svgDiagramWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  categoryTabsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 2,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: PsychoPalette.bgCard,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  categoryChipActive: {
    backgroundColor: PsychoPalette.cyanDim,
    borderColor: PsychoPalette.cyan,
  },
  categoryChipDone: {
    borderColor: PsychoPalette.mint,
  },
  categoryChipText: {
    color: PsychoPalette.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
  categoryChipTextActive: {
    color: PsychoPalette.cyan,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: PsychoPalette.amberWarning,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusBannerReady: {
    backgroundColor: PsychoPalette.mintDim,
    borderColor: PsychoPalette.mint,
  },
  statusBannerText: {
    color: PsychoPalette.textPrimary,
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  checklistColumn: {
    gap: 9,
  },
  checkCard: {
    backgroundColor: PsychoPalette.bgCard,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: PsychoPalette.borderSubtle,
    padding: 12,
    gap: 8,
  },
  checkCardDone: {
    borderColor: 'rgba(0, 245, 160, 0.45)',
    backgroundColor: '#0B192C',
  },
  checkCardAnomaly: {
    borderColor: PsychoPalette.amberWarning,
  },
  checkCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  checkCategoryBadge: {
    backgroundColor: PsychoPalette.bgPanel,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
  },
  checkCategoryBadgeText: {
    color: PsychoPalette.cyan,
    fontSize: 9,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
  specPill: {
    backgroundColor: PsychoPalette.mintDim,
    borderWidth: 1,
    borderColor: PsychoPalette.mint,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 5,
  },
  specPillText: {
    color: PsychoPalette.mint,
    fontSize: 9,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  checkMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  checkTextCol: {
    flex: 1,
    gap: 3,
  },
  checkTitle: {
    color: PsychoPalette.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  checkDetail: {
    color: PsychoPalette.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  verifyToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: PsychoPalette.bgPanel,
    borderWidth: 1.5,
    borderColor: PsychoPalette.cyan,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 9,
  },
  verifyToggleBtnActive: {
    backgroundColor: PsychoPalette.mint,
    borderColor: PsychoPalette.mint,
  },
  verifyToggleBtnLocked: {
    borderColor: PsychoPalette.amberWarning,
  },
  verifyToggleText: {
    color: PsychoPalette.cyan,
    fontSize: 10,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  anomalyActionBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderWidth: 1,
    borderColor: PsychoPalette.amberWarning,
    borderRadius: 9,
    padding: 9,
    gap: 7,
  },
  anomalyTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  anomalyAlertText: {
    color: '#FDE68A',
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  fixAnomalyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: PsychoPalette.amberWarning,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 7,
  },
  fixAnomalyBtnText: {
    color: PsychoPalette.bgPrimary,
    fontSize: 11,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  anomalyFixedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PsychoPalette.mintDim,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
  },
  anomalyFixedText: {
    color: PsychoPalette.mint,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Fonts.mono,
  },
  footerCertifyPanel: {
    backgroundColor: PsychoPalette.bgSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    padding: 14,
    gap: 12,
    marginTop: 4,
  },
  certifyPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PsychoPalette.mint,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 11,
  },
  certifyPrimaryBtnText: {
    color: PsychoPalette.bgPrimary,
    fontSize: 13,
    fontWeight: '900',
    fontFamily: Fonts.mono,
    letterSpacing: 0.5,
  },
  certifiedResultBox: {
    backgroundColor: PsychoPalette.bgPanel,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    padding: 12,
    alignItems: 'center',
    gap: 10,
  },
  certifiedGradeText: {
    fontSize: 15,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  nextButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  goReactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PsychoPalette.cyan,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 8,
  },
  goSim3DBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PsychoPalette.mint,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 8,
  },
  goNextBtnText: {
    color: PsychoPalette.bgPrimary,
    fontSize: 11,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
});
