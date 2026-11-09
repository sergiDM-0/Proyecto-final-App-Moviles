import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TelemetryHeader } from '@/components/telemetry-header';
import { Fonts, OFFICIAL_BENCHMARKS, PsychoPalette } from '@/constants/theme';
import { AptitudeGrade, useEvaluation } from '@/context/evaluation-context';
import { usePsychAudio } from '@/hooks/use-psych-audio';
import { useTelemetry } from '@/hooks/use-telemetry';

const welcomeHeroImage = require('../../assets/images/welcome-hero.jpg');

function getGradeBadgeStyle(grade: AptitudeGrade) {
  switch (grade) {
    case 'EXCELENTE':
      return {
        bg: PsychoPalette.mintDim,
        border: PsychoPalette.mint,
        text: PsychoPalette.mint,
      };
    case 'APTO':
      return {
        bg: PsychoPalette.cyanDim,
        border: PsychoPalette.cyan,
        text: PsychoPalette.cyan,
      };
    case 'NO APTO':
      return {
        bg: PsychoPalette.redSignalDim,
        border: PsychoPalette.redSignalBright,
        text: PsychoPalette.redSignalBright,
      };
    default:
      return {
        bg: 'rgba(148, 163, 184, 0.12)',
        border: PsychoPalette.borderSubtle,
        text: PsychoPalette.textSecondary,
      };
  }
}

export default function DashboardScreen() {
  const { fps, frameTimeMs, audioLatencyMs, systemStatus } = useTelemetry();
  const {
    hasStartedApp,
    setHasStartedApp,
    preoperationalResult,
    reactionResult,
    latheResult,
    maneuverResult,
    resetAllEvaluations,
  } = useEvaluation();
  const { playLeftSignal, playRightSignal, playSuccess } = usePsychAudio();

  const completedCount = [
    preoperationalResult,
    reactionResult,
    latheResult,
    maneuverResult,
  ].filter(Boolean).length;

  const moduleEvaluations = [
    {
      id: 'preop',
      label: 'Preoperacional',
      done: Boolean(preoperationalResult),
      grade: preoperationalResult?.grade ?? 'PENDIENTE',
      scorePct: preoperationalResult ? preoperationalResult.scorePct : 0,
      metricText: preoperationalResult ? `${preoperationalResult.scorePct}%` : 'Pendiente',
    },
    {
      id: 'reaction',
      label: 'Reacción y Audio',
      done: Boolean(reactionResult),
      grade: reactionResult?.grade ?? 'PENDIENTE',
      scorePct: reactionResult
        ? reactionResult.grade === 'EXCELENTE'
          ? Math.max(92, reactionResult.accuracyPct)
          : reactionResult.grade === 'APTO'
            ? Math.max(80, reactionResult.accuracyPct)
            : Math.min(60, reactionResult.accuracyPct)
        : 0,
      metricText: reactionResult ? `${reactionResult.avgMs} ms` : 'Pendiente',
    },
    {
      id: 'lathe',
      label: 'Torno Bimanual',
      done: Boolean(latheResult),
      grade: latheResult?.grade ?? 'PENDIENTE',
      scorePct: latheResult ? latheResult.precisionPct : 0,
      metricText: latheResult ? `${latheResult.precisionPct}%` : 'Pendiente',
    },
    {
      id: 'maneuver',
      label: 'Maniobras 3D',
      done: Boolean(maneuverResult),
      grade: maneuverResult?.grade ?? 'PENDIENTE',
      scorePct: maneuverResult
        ? maneuverResult.grade === 'EXCELENTE'
          ? 98
          : maneuverResult.grade === 'APTO'
            ? 84
            : 50
        : 0,
      metricText: maneuverResult
        ? `${maneuverResult.elapsedSeconds}s (${maneuverResult.collisions} col.)`
        : 'Pendiente',
    },
  ];

  const completedModules = moduleEvaluations.filter((m) => m.done);
  const failedModules = completedModules.filter((m) => m.grade === 'NO APTO');
  const averageScorePct =
    completedModules.length > 0
      ? Math.round(
          completedModules.reduce((acc, item) => acc + item.scorePct, 0) / completedModules.length
        )
      : 0;
  const isApproved = completedModules.length > 0 && failedModules.length === 0 && averageScorePct >= 75;

  // PANTALLA DE BIENVENIDA CON IMAGEN ANTES DE ENTRAR A LAS PRUEBAS
  if (!hasStartedApp) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.welcomeScrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.welcomeCard}>
            <View style={styles.welcomeTopBadgeRow}>
              <View style={styles.welcomeLivePill}>
                <View style={styles.welcomeDot} />
                <Text style={styles.welcomeLiveText}>SISTEMA CRC • SIMULADOR VIAL 3D</Text>
              </View>
              <Text style={styles.welcomeTelemetryTag}>
                {fps} FPS • AUDIO {audioLatencyMs} ms
              </Text>
            </View>

            <Pressable
              onPress={() => {
                playSuccess();
                setHasStartedApp(true);
              }}
              style={({ pressed }) => [
                styles.heroImageContainer,
                pressed && { opacity: 0.92, transform: [{ scale: 0.995 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Toque la imagen para iniciar y pasar a las pruebas">
              <Image
                source={welcomeHeroImage}
                style={styles.heroImage}
                contentFit="cover"
                transition={250}
              />
              <View style={styles.heroCenterStartPill}>
                <Ionicons name="play" size={18} color={PsychoPalette.bgPrimary} />
                <Text style={styles.heroCenterStartText}>TOQUE PARA INICIAR</Text>
              </View>
              <View style={styles.heroOverlayBadge}>
                <Ionicons name="car-sport" size={16} color={PsychoPalette.mint} />
                <Text style={styles.heroOverlayText}>
                  CABINA 3D INTERACTIVA + EVALUACIÓN PSICOTÉCNICA OFICIAL
                </Text>
              </View>
            </Pressable>

            <View style={styles.welcomeTextSection}>
              <Text style={styles.welcomeTitle}>
                AUTOTEST PSICOTÉCNICO Y SIMULADOR DE CONDUCCIÓN 3D
              </Text>
              <Text style={styles.welcomeDescription}>
                Plataforma integral de evaluación para aspirantes y conductores. Incluye inspección
                preoperacional del vehículo, prueba auditiva con audífonos, torno bimanual de
                velocidad adaptativa y simulador 3D en carretera con cabina completa y espejos.
              </Text>
            </View>

            <View style={styles.welcomeFeaturesGrid}>
              <View style={styles.welcomeFeatureItem}>
                <Ionicons name="construct-outline" size={18} color={PsychoPalette.amberWarning} />
                <View style={styles.welcomeFeatureTextCol}>
                  <Text style={styles.welcomeFeatureTitle}>Nivel Preoperacional</Text>
                  <Text style={styles.welcomeFeatureSub}>Revisión de motor, PSI, luces y kit</Text>
                </View>
              </View>

              <View style={styles.welcomeFeatureItem}>
                <Ionicons name="headset-outline" size={18} color={PsychoPalette.cyan} />
                <View style={styles.welcomeFeatureTextCol}>
                  <Text style={styles.welcomeFeatureTitle}>Audio con Audífonos</Text>
                  <Text style={styles.welcomeFeatureSub}>Estímulos L/R de alta precisión</Text>
                </View>
              </View>

              <View style={styles.welcomeFeatureItem}>
                <Ionicons name="speedometer-outline" size={18} color={PsychoPalette.mint} />
                <View style={styles.welcomeFeatureTextCol}>
                  <Text style={styles.welcomeFeatureTitle}>Torno Adaptativo</Text>
                  <Text style={styles.welcomeFeatureSub}>Velocidad dinámica por desempeño</Text>
                </View>
              </View>

              <View style={styles.welcomeFeatureItem}>
                <Ionicons name="car-sport-outline" size={18} color={PsychoPalette.vehicleBlueLight} />
                <View style={styles.welcomeFeatureTextCol}>
                  <Text style={styles.welcomeFeatureTitle}>Simulador 3D + Cabina</Text>
                  <Text style={styles.welcomeFeatureSub}>Espejos, mandos y 3 niveles en 3D</Text>
                </View>
              </View>
            </View>

            <Pressable
              onPress={() => {
                playSuccess();
                setHasStartedApp(true);
              }}
              style={({ pressed }) => [
                styles.welcomeStartButton,
                pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Iniciar y pasar a las pruebas">
              <Ionicons name="play-circle" size={24} color={PsychoPalette.bgPrimary} />
              <Text style={styles.welcomeStartButtonText}>
                INICIAR Y PASAR A LAS PRUEBAS
              </Text>
              <Ionicons name="arrow-forward" size={20} color={PsychoPalette.bgPrimary} />
            </Pressable>

            <View style={styles.authorFooterWrap}>
              <Ionicons name="code-slash-outline" size={14} color={PsychoPalette.cyan} />
              <Text style={styles.authorFooterText}>by sergiDM-0</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <TelemetryHeader
        title="AUTOTEST PSICOTÉCNICO & 3D"
        subtitle="Consola de Evaluación Psicofísica, Preoperacional y Maniobras 3D"
        moduleCode="CRC-PRO"
        onTestAudio={playRightSignal}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* PANEL SUPERIOR DE TELEMETRÍA EN TIEMPO REAL */}
        <View style={styles.telemetryBanner}>
          <View style={styles.telemetryBannerHeader}>
            <View style={styles.telemetryTitleRow}>
              <Ionicons name="hardware-chip-outline" size={16} color={PsychoPalette.mint} />
              <Text style={styles.telemetryBannerTitle}>
                DIAGNÓSTICO DE HARDWARE Y TELEMETRÍA EN TIEMPO REAL
              </Text>
            </View>
            <View style={styles.bannerRightBtns}>
              <Pressable
                onPress={() => setHasStartedApp(false)}
                style={({ pressed }) => [styles.coverBtn, pressed && { opacity: 0.75 }]}>
                <Ionicons name="image-outline" size={13} color={PsychoPalette.textSecondary} />
                <Text style={styles.coverBtnText}>PORTADA</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  playLeftSignal();
                  setTimeout(() => playRightSignal(), 220);
                }}
                style={({ pressed }) => [styles.calibrateBtn, pressed && { opacity: 0.75 }]}>
                <Ionicons name="headset-outline" size={14} color={PsychoPalette.cyan} />
                <Text style={styles.calibrateBtnText}>TEST AUDIO L/R</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.telemetryGrid}>
            <View style={styles.telemetryBox}>
              <Text style={styles.telemetryBoxLabel}>LATENCIA DE AUDIO</Text>
              <View style={styles.telemetryValueRow}>
                <Text style={[styles.telemetryBigValue, { color: PsychoPalette.cyan }]}>
                  {audioLatencyMs}
                </Text>
                <Text style={styles.telemetryUnit}>ms</Text>
              </View>
              <Text style={styles.telemetryHint}>Motor expo-audio • Binaural</Text>
            </View>

            <View style={styles.telemetryBox}>
              <Text style={styles.telemetryBoxLabel}>MOTOR GRÁFICO 3D/2D</Text>
              <View style={styles.telemetryValueRow}>
                <Text style={[styles.telemetryBigValue, { color: PsychoPalette.mint }]}>{fps}</Text>
                <Text style={styles.telemetryUnit}>FPS</Text>
              </View>
              <Text style={styles.telemetryHint}>Frame time: {frameTimeMs} ms</Text>
            </View>

            <View style={styles.telemetryBox}>
              <Text style={styles.telemetryBoxLabel}>PROGRESO DE EXAMEN</Text>
              <View style={styles.telemetryValueRow}>
                <Text style={[styles.telemetryBigValue, { color: PsychoPalette.textPrimary }]}>
                  {completedCount}/4
                </Text>
                <Text style={styles.telemetryUnit}>MÓDULOS</Text>
              </View>
              <Text style={styles.telemetryHint}>Estado: {systemStatus}</Text>
            </View>
          </View>
        </View>

        {/* LETRERO DE DICTAMEN: APROBADO / DESAPROBADO SEGÚN PUNTAJES */}
        {completedCount > 0 ? (
          <View
            style={[
              styles.verdictBanner,
              isApproved ? styles.verdictBannerApproved : styles.verdictBannerRejected,
            ]}>
            <View style={styles.verdictTopRow}>
              <View style={styles.verdictBadgeRow}>
                <Ionicons
                  name={isApproved ? 'checkmark-circle' : 'close-circle'}
                  size={34}
                  color={isApproved ? PsychoPalette.mint : PsychoPalette.redSignalBright}
                />
                <View style={styles.verdictTitleCol}>
                  <Text style={styles.verdictSubLabel}>
                    {completedCount === 4
                      ? 'DICTAMEN FINAL DE EVALUACIÓN (4/4 PRUEBAS)'
                      : `RESULTADO ACUMULADO (${completedCount}/4 PRUEBAS REALIZADAS)`}
                  </Text>
                  <Text
                    style={[
                      styles.verdictMainSign,
                      { color: isApproved ? PsychoPalette.mint : PsychoPalette.redSignalBright },
                    ]}>
                    {isApproved ? '¡APROBADO!' : 'DESAPROBADO'}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.verdictScoreBox,
                  {
                    borderColor: isApproved ? PsychoPalette.mint : PsychoPalette.redSignalBright,
                    backgroundColor: isApproved ? PsychoPalette.mintDim : PsychoPalette.redSignalDim,
                  },
                ]}>
                <Text style={styles.verdictScoreLabel}>PUNTAJE GLOBAL</Text>
                <Text
                  style={[
                    styles.verdictScoreValue,
                    { color: isApproved ? PsychoPalette.mint : PsychoPalette.redSignalBright },
                  ]}>
                  {averageScorePct}%
                </Text>
              </View>
            </View>

            <Text style={styles.verdictExplanation}>
              {isApproved
                ? completedCount === 4
                  ? 'El aspirante superó satisfactoriamente todos los módulos psicotécnicos, preoperacionales y de maniobras 3D dentro de los baremos oficiales.'
                  : `Promedio actual aprobatorio (${averageScorePct}%). Complete los ${4 - completedCount} módulos restantes para emitir el certificado definitivo.`
                : failedModules.length > 0
                  ? `No alcanzó el puntaje mínimo requerido en: ${failedModules.map((m) => m.label).join(', ')}. Repita las pruebas con estado NO APTO.`
                  : `El promedio general (${averageScorePct}%) es inferior al mínimo requerido (75%).`}
            </Text>

            <View style={styles.verdictBreakdownGrid}>
              {moduleEvaluations.map((mod) => {
                const badge = getGradeBadgeStyle(mod.grade);
                return (
                  <View
                    key={mod.id}
                    style={[
                      styles.verdictModChip,
                      { backgroundColor: badge.bg, borderColor: badge.border },
                    ]}>
                    <Text style={styles.verdictModName}>{mod.label}</Text>
                    <Text style={[styles.verdictModGrade, { color: badge.text }]}>
                      {mod.done ? `${mod.grade} (${mod.metricText})` : 'PENDIENTE'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* SECCIÓN DE LAS 4 TARJETAS VISUALES DE GRAN TAMAÑO */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>MÓDULOS DE EVALUACIÓN Y SIMULACIÓN</Text>
          {completedCount > 0 ? (
            <Pressable onPress={resetAllEvaluations} style={styles.resetButton}>
              <Ionicons name="refresh" size={13} color={PsychoPalette.textSecondary} />
              <Text style={styles.resetButtonText}>Reiniciar sesión</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.cardsColumn}>
          {/* TARJETA NUEVA (NIVEL PREOPERACIONAL): INSPECCIÓN PREOPERACIONAL DEL VEHÍCULO */}
          <Pressable
            onPress={() => router.push('/preoperational')}
            style={({ pressed }) => [
              styles.moduleCard,
              styles.moduleCardAmber,
              pressed && styles.cardPressed,
            ]}>
            <View style={styles.cardTopBar}>
              <View style={styles.moduleTagRow}>
                <View style={[styles.moduleNumBadge, { backgroundColor: PsychoPalette.amberDim }]}>
                  <Text style={[styles.moduleNumText, { color: PsychoPalette.amberWarning }]}>
                    NIVEL PREOPERACIONAL
                  </Text>
                </View>
                <Text style={styles.moduleTechTag}>INSPECCIÓN TÉCNICA 360° • CHECKLIST</Text>
              </View>
              {preoperationalResult ? (
                <View
                  style={[
                    styles.gradePill,
                    {
                      backgroundColor: getGradeBadgeStyle(preoperationalResult.grade).bg,
                      borderColor: getGradeBadgeStyle(preoperationalResult.grade).border,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.gradePillText,
                      { color: getGradeBadgeStyle(preoperationalResult.grade).text },
                    ]}>
                    {preoperationalResult.grade} • {preoperationalResult.scorePct}%
                  </Text>
                </View>
              ) : (
                <View style={styles.pendingPill}>
                  <Text style={styles.pendingPillText}>RECOMENDADO PRIMERO</Text>
                </View>
              )}
            </View>

            <View style={styles.cardBodyRow}>
              <View style={[styles.iconPreviewBox, { borderColor: 'rgba(245, 158, 11, 0.45)' }]}>
                <Ionicons name="construct" size={28} color={PsychoPalette.amberWarning} />
                <Text style={styles.previewMiniTag}>PSI • MOTOR</Text>
              </View>

              <View style={styles.cardInfoColumn}>
                <Text style={styles.cardTitle}>Inspección Preoperacional del Carro</Text>
                <Text style={styles.cardDescription}>
                  Verifique niveles de fluidos bajo el capó, calibración de llantas (PSI), sistema de
                  luces, espejos, cabina y equipo de carretera antes de encender el vehículo.
                </Text>

                <View style={styles.cardSpecsRow}>
                  <View style={styles.specChip}>
                    <Ionicons name="checkmark-done" size={12} color={PsychoPalette.amberWarning} />
                    <Text style={styles.specChipText}>15 Puntos + Corrección de Fallas</Text>
                  </View>
                  <View style={styles.specChip}>
                    <Ionicons name="shield-checkmark-outline" size={12} color={PsychoPalette.mint} />
                    <Text style={styles.specChipText}>Protocolo Vial PESV</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.cardActionHint}>
                {preoperationalResult
                  ? `Último registro: ${preoperationalResult.checkedCount}/${preoperationalResult.totalCount} puntos (${preoperationalResult.anomaliesFixed} fallas corregidas)`
                  : 'Toque para realizar la inspección mecánica y de seguridad previa'}
              </Text>
              <View style={[styles.launchButton, { backgroundColor: PsychoPalette.amberWarning }]}>
                <Text style={styles.launchButtonText}>ABRIR PREOPERACIONAL</Text>
                <Ionicons name="arrow-forward" size={15} color={PsychoPalette.bgPrimary} />
              </View>
            </View>
          </Pressable>

          {/* TARJETA 1: PRUEBA DE REACCIÓN Y AUDIO (CON SOLICITUD DE AUDÍFONOS) */}
          <Pressable
            onPress={() => router.push('/reaction')}
            style={({ pressed }) => [
              styles.moduleCard,
              styles.moduleCardCyan,
              pressed && styles.cardPressed,
            ]}>
            <View style={styles.cardTopBar}>
              <View style={styles.moduleTagRow}>
                <View style={[styles.moduleNumBadge, { backgroundColor: PsychoPalette.cyanDim }]}>
                  <Text style={[styles.moduleNumText, { color: PsychoPalette.cyan }]}>
                    MÓDULO 01
                  </Text>
                </View>
                <Text style={styles.moduleTechTag}>REQUIERE AUDÍFONOS • L/R BINAURAL</Text>
              </View>
              {reactionResult ? (
                <View
                  style={[
                    styles.gradePill,
                    {
                      backgroundColor: getGradeBadgeStyle(reactionResult.grade).bg,
                      borderColor: getGradeBadgeStyle(reactionResult.grade).border,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.gradePillText,
                      { color: getGradeBadgeStyle(reactionResult.grade).text },
                    ]}>
                    {reactionResult.grade} • {reactionResult.avgMs} ms
                  </Text>
                </View>
              ) : (
                <View style={styles.pendingPill}>
                  <Text style={styles.pendingPillText}>LISTO PARA INICIAR</Text>
                </View>
              )}
            </View>

            <View style={styles.cardBodyRow}>
              <View style={[styles.iconPreviewBox, { borderColor: 'rgba(0, 217, 245, 0.35)' }]}>
                <View style={styles.splitPreviewContainer}>
                  <View style={styles.splitPreviewLeft}>
                    <Text style={styles.splitPreviewLabel}>L</Text>
                  </View>
                  <View style={styles.splitPreviewRight}>
                    <Text style={styles.splitPreviewLabel}>R</Text>
                  </View>
                </View>
                <Ionicons
                  name="headset"
                  size={18}
                  color={PsychoPalette.cyan}
                  style={{ marginTop: 6 }}
                />
              </View>

              <View style={styles.cardInfoColumn}>
                <Text style={styles.cardTitle}>Prueba de Reacción y Audio (Con Audífonos)</Text>
                <Text style={styles.cardDescription}>
                  Solicita el uso de audífonos para discriminar estímulos auditivos por oído
                  (Izquierda 440 Hz Roja / Derecha 880 Hz Verde) con respuesta inmediata.
                </Text>

                <View style={styles.cardSpecsRow}>
                  <View style={styles.specChip}>
                    <Ionicons name="headset-outline" size={12} color={PsychoPalette.cyan} />
                    <Text style={styles.specChipText}>Verificación de Audífonos</Text>
                  </View>
                  <View style={styles.specChip}>
                    <Ionicons name="flash-outline" size={12} color={PsychoPalette.mint} />
                    <Text style={styles.specChipText}>Baremo: &lt; 380 ms</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.cardActionHint}>
                {reactionResult
                  ? `Último registro: Izq ${reactionResult.leftAvgMs}ms | Der ${reactionResult.rightAvgMs}ms (${reactionResult.accuracyPct}% acierto)`
                  : 'Colóquese los audífonos y toque para iniciar la evaluación'}
              </Text>
              <View style={[styles.launchButton, { backgroundColor: PsychoPalette.cyan }]}>
                <Text style={styles.launchButtonText}>INICIAR PRUEBA</Text>
                <Ionicons name="arrow-forward" size={15} color={PsychoPalette.bgPrimary} />
              </View>
            </View>
          </Pressable>

          {/* TARJETA 2: PRUEBA DEL TORNO (VELOCIDAD ADAPTATIVA + ANILLOS COMPACTOS) */}
          <Pressable
            onPress={() => router.push('/lathe')}
            style={({ pressed }) => [
              styles.moduleCard,
              styles.moduleCardMint,
              pressed && styles.cardPressed,
            ]}>
            <View style={styles.cardTopBar}>
              <View style={styles.moduleTagRow}>
                <View style={[styles.moduleNumBadge, { backgroundColor: PsychoPalette.mintDim }]}>
                  <Text style={[styles.moduleNumText, { color: PsychoPalette.mint }]}>
                    MÓDULO 02
                  </Text>
                </View>
                <Text style={styles.moduleTechTag}>VELOCIDAD DINÁMICA POR DESEMPEÑO</Text>
              </View>
              {latheResult ? (
                <View
                  style={[
                    styles.gradePill,
                    {
                      backgroundColor: getGradeBadgeStyle(latheResult.grade).bg,
                      borderColor: getGradeBadgeStyle(latheResult.grade).border,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.gradePillText,
                      { color: getGradeBadgeStyle(latheResult.grade).text },
                    ]}>
                    {latheResult.grade} • {latheResult.precisionPct}%
                  </Text>
                </View>
              ) : (
                <View style={styles.pendingPill}>
                  <Text style={styles.pendingPillText}>LISTO PARA INICIAR</Text>
                </View>
              )}
            </View>

            <View style={styles.cardBodyRow}>
              <View style={[styles.iconPreviewBox, { borderColor: 'rgba(0, 245, 160, 0.35)' }]}>
                <View style={styles.lanesPreview}>
                  <View style={styles.laneWaveLine} />
                  <View style={styles.laneWaveLineMint} />
                </View>
                <Ionicons
                  name="git-compare-outline"
                  size={20}
                  color={PsychoPalette.mint}
                  style={{ marginTop: 4 }}
                />
              </View>

              <View style={styles.cardInfoColumn}>
                <Text style={styles.cardTitle}>Prueba del Torno (Coordinación Bimanual)</Text>
                <Text style={styles.cardDescription}>
                  Doble carril ondulado con cursores de precisión compactos. La velocidad aumenta o
                  se regula automáticamente en tiempo real según su desempeño.
                </Text>

                <View style={styles.cardSpecsRow}>
                  <View style={styles.specChip}>
                    <Ionicons name="trending-up-outline" size={12} color={PsychoPalette.mint} />
                    <Text style={styles.specChipText}>Velocidad Adaptativa 0.8x–2.2x</Text>
                  </View>
                  <View style={styles.specChip}>
                    <Ionicons name="radio-button-on-outline" size={12} color={PsychoPalette.cyan} />
                    <Text style={styles.specChipText}>Punteros de Precisión</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.cardActionHint}>
                {latheResult
                  ? `Último registro: Izq ${latheResult.leftPrecisionPct}% | Der ${latheResult.rightPrecisionPct}% (${latheResult.speedLevel})`
                  : 'Toque para iniciar el test visomotriz con velocidad adaptativa'}
              </Text>
              <View style={[styles.launchButton, { backgroundColor: PsychoPalette.mint }]}>
                <Text style={styles.launchButtonText}>INICIAR PRUEBA</Text>
                <Ionicons name="arrow-forward" size={15} color={PsychoPalette.bgPrimary} />
              </View>
            </View>
          </Pressable>

          {/* TARJETA 3: SIMULADOR DE MANIOBRAS 3D Y CABINA CON ESPEJOS */}
          <Pressable
            onPress={() => router.push('/maneuvers')}
            style={({ pressed }) => [
              styles.moduleCard,
              styles.moduleCardCyan,
              pressed && styles.cardPressed,
            ]}>
            <View style={styles.cardTopBar}>
              <View style={styles.moduleTagRow}>
                <View style={[styles.moduleNumBadge, { backgroundColor: PsychoPalette.cyanDim }]}>
                  <Text style={[styles.moduleNumText, { color: PsychoPalette.cyan }]}>
                    MÓDULO 03
                  </Text>
                </View>
                <Text style={styles.moduleTechTag}>CARRETERA 3D • CABINA + ESPEJOS + MANDOS</Text>
              </View>
              {maneuverResult ? (
                <View
                  style={[
                    styles.gradePill,
                    {
                      backgroundColor: getGradeBadgeStyle(maneuverResult.grade).bg,
                      borderColor: getGradeBadgeStyle(maneuverResult.grade).border,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.gradePillText,
                      { color: getGradeBadgeStyle(maneuverResult.grade).text },
                    ]}>
                    {maneuverResult.grade} • {maneuverResult.elapsedSeconds}s
                  </Text>
                </View>
              ) : (
                <View style={styles.pendingPill}>
                  <Text style={styles.pendingPillText}>3 NIVELES EN 3D</Text>
                </View>
              )}
            </View>

            <View style={styles.cardBodyRow}>
              <View style={[styles.iconPreviewBox, { borderColor: 'rgba(37, 99, 235, 0.5)' }]}>
                <View style={styles.parkingPreviewZone}>
                  <View style={styles.carPreviewTopDown} />
                </View>
                <Ionicons
                  name="car-sport"
                  size={20}
                  color={PsychoPalette.vehicleBlueLight}
                  style={{ marginTop: 4 }}
                />
              </View>

              <View style={styles.cardInfoColumn}>
                <Text style={styles.cardTitle}>Simulador de Maniobras 3D + Cabina Real</Text>
                <Text style={styles.cardDescription}>
                  Conduzca en perspectiva 3D por los 3 niveles (Batería 90°, Paralelo y Eslalon) con
                  cabina completa: espejos retrovisores activos, direccionales, luces, cinturón,
                  freno de mano, volante, joystick compacto y pedales.
                </Text>

                <View style={styles.cardSpecsRow}>
                  <View style={styles.specChip}>
                    <Ionicons name="eye-outline" size={12} color={PsychoPalette.mint} />
                    <Text style={styles.specChipText}>3 Espejos Retrovisores</Text>
                  </View>
                  <View style={styles.specChip}>
                    <Ionicons
                      name="game-controller-outline"
                      size={12}
                      color={PsychoPalette.cyan}
                    />
                    <Text style={styles.specChipText}>Mandos de Carro Normal</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.cardActionHint}>
                {maneuverResult
                  ? `Último registro: ${maneuverResult.scenarioTitle} en ${maneuverResult.elapsedSeconds}s (${maneuverResult.collisions} colisiones)`
                  : 'Toque para entrar a la cabina 3D y superar los 3 niveles'}
              </Text>
              <View style={[styles.launchButton, { backgroundColor: PsychoPalette.cyan }]}>
                <Text style={styles.launchButtonText}>ENTRAR A CABINA 3D</Text>
                <Ionicons name="arrow-forward" size={15} color={PsychoPalette.bgPrimary} />
              </View>
            </View>
          </Pressable>
        </View>

        {/* RESUMEN DE BAREMOS OFICIALES EN LA PARTE INFERIOR */}
        <View style={styles.benchmarksPanel}>
          <View style={styles.benchmarksHeader}>
            <View style={styles.benchmarksTitleRow}>
              <Ionicons name="shield-checkmark-outline" size={18} color={PsychoPalette.mint} />
              <Text style={styles.benchmarksTitle}>
                RESUMEN DE BAREMOS OFICIALES PSICOTÉCNICOS Y VIALES
              </Text>
            </View>
            <Text style={styles.benchmarksSubtitle}>
              Parámetros normativos de aptitud psicofísica, protocolo preoperacional y destreza en
              conducción 3D
            </Text>
          </View>

          <View style={styles.benchmarksTable}>
            {OFFICIAL_BENCHMARKS.map((item) => (
              <View key={item.id} style={styles.benchmarkRow}>
                <View style={styles.benchmarkTopLine}>
                  <View style={styles.benchmarkTitleGroup}>
                    <Text style={styles.benchmarkCode}>{item.code}</Text>
                    <Text style={styles.benchmarkName}>{item.title}</Text>
                  </View>
                  <Text style={styles.benchmarkNorm}>{item.normRef}</Text>
                </View>

                <Text style={styles.benchmarkMetricDesc}>{item.metricLabel}</Text>

                <View style={styles.benchmarkRangesRow}>
                  <View style={[styles.rangeBox, styles.rangeBoxMint]}>
                    <Text style={styles.rangeTag}>EXCELENTE</Text>
                    <Text style={[styles.rangeVal, { color: PsychoPalette.mint }]}>
                      {item.excellent}
                    </Text>
                  </View>

                  <View style={[styles.rangeBox, styles.rangeBoxCyan]}>
                    <Text style={styles.rangeTag}>APTO OFICIAL</Text>
                    <Text style={[styles.rangeVal, { color: PsychoPalette.cyan }]}>
                      {item.approved}
                    </Text>
                  </View>

                  <View style={[styles.rangeBox, styles.rangeBoxRed]}>
                    <Text style={styles.rangeTag}>NO APTO</Text>
                    <Text style={[styles.rangeVal, { color: PsychoPalette.redSignalBright }]}>
                      {item.rejected}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.authorFooterWrap}>
          <Ionicons name="code-slash-outline" size={14} color={PsychoPalette.cyan} />
          <Text style={styles.authorFooterText}>by sergiDM-0</Text>
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
  welcomeScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    maxWidth: 820,
    width: '100%',
    alignSelf: 'center',
  },
  welcomeCard: {
    backgroundColor: PsychoPalette.bgSecondary,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 217, 245, 0.4)',
    padding: 18,
    gap: 16,
  },
  welcomeTopBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  welcomeLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PsychoPalette.mintDim,
    borderWidth: 1,
    borderColor: PsychoPalette.mint,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  welcomeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PsychoPalette.mint,
  },
  welcomeLiveText: {
    color: PsychoPalette.mint,
    fontSize: 10,
    fontWeight: '900',
    fontFamily: Fonts.mono,
    letterSpacing: 0.6,
  },
  welcomeTelemetryTag: {
    color: PsychoPalette.cyan,
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
  heroImageContainer: {
    width: '100%',
    height: 240,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: PsychoPalette.borderSubtle,
    position: 'relative',
    backgroundColor: '#050A14',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroCenterStartPill: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PsychoPalette.mint,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  heroCenterStartText: {
    color: PsychoPalette.bgPrimary,
    fontSize: 11,
    fontWeight: '900',
    fontFamily: Fonts.mono,
    letterSpacing: 0.6,
  },
  heroOverlayBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(5, 10, 20, 0.86)',
    borderWidth: 1,
    borderColor: PsychoPalette.mint,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  heroOverlayText: {
    color: PsychoPalette.textPrimary,
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Fonts.mono,
    flex: 1,
  },
  welcomeTextSection: {
    gap: 8,
  },
  welcomeTitle: {
    color: PsychoPalette.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  welcomeDescription: {
    color: PsychoPalette.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  welcomeFeaturesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  welcomeFeatureItem: {
    flex: 1,
    minWidth: 150,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: PsychoPalette.bgPanel,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    padding: 10,
    borderRadius: 12,
  },
  welcomeFeatureTextCol: {
    flex: 1,
  },
  welcomeFeatureTitle: {
    color: PsychoPalette.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  welcomeFeatureSub: {
    color: PsychoPalette.textMuted,
    fontSize: 10,
    marginTop: 1,
  },
  welcomeStartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: PsychoPalette.mint,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 14,
    marginTop: 4,
  },
  welcomeStartButtonText: {
    color: PsychoPalette.bgPrimary,
    fontSize: 15,
    fontWeight: '900',
    fontFamily: Fonts.mono,
    letterSpacing: 0.8,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 32,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
    gap: 14,
  },
  telemetryBanner: {
    backgroundColor: PsychoPalette.bgSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    padding: 12,
    gap: 10,
  },
  telemetryBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  telemetryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  telemetryBannerTitle: {
    color: PsychoPalette.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Fonts.mono,
    letterSpacing: 0.7,
  },
  bannerRightBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PsychoPalette.bgPanel,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
  },
  coverBtnText: {
    color: PsychoPalette.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
  calibrateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: PsychoPalette.cyanDim,
    borderWidth: 1,
    borderColor: PsychoPalette.cyan,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  calibrateBtnText: {
    color: PsychoPalette.cyan,
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
  telemetryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  telemetryBox: {
    flex: 1,
    minWidth: 105,
    backgroundColor: PsychoPalette.bgPanel,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    padding: 10,
  },
  telemetryBoxLabel: {
    color: PsychoPalette.textMuted,
    fontSize: 9,
    fontWeight: '800',
    fontFamily: Fonts.mono,
    letterSpacing: 0.5,
  },
  telemetryValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 4,
  },
  telemetryBigValue: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  telemetryUnit: {
    color: PsychoPalette.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Fonts.mono,
  },
  telemetryHint: {
    color: PsychoPalette.textMuted,
    fontSize: 10,
    marginTop: 3,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionHeaderTitle: {
    color: PsychoPalette.mint,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: Fonts.mono,
    letterSpacing: 1,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: PsychoPalette.bgCard,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
  },
  resetButtonText: {
    color: PsychoPalette.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  cardsColumn: {
    gap: 14,
  },
  moduleCard: {
    backgroundColor: PsychoPalette.bgCard,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 15,
    gap: 12,
  },
  moduleCardCyan: {
    borderColor: 'rgba(0, 217, 245, 0.35)',
  },
  moduleCardMint: {
    borderColor: 'rgba(0, 245, 160, 0.35)',
  },
  moduleCardAmber: {
    borderColor: 'rgba(245, 158, 11, 0.45)',
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.992 }],
  },
  cardTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  moduleTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  moduleNumBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  moduleNumText: {
    fontSize: 10,
    fontWeight: '900',
    fontFamily: Fonts.mono,
    letterSpacing: 0.6,
  },
  moduleTechTag: {
    color: PsychoPalette.textMuted,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Fonts.mono,
  },
  gradePill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  gradePillText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
  pendingPill: {
    backgroundColor: PsychoPalette.bgPanel,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pendingPillText: {
    color: PsychoPalette.textSecondary,
    fontSize: 9,
    fontWeight: '700',
    fontFamily: Fonts.mono,
  },
  cardBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconPreviewBox: {
    width: 78,
    height: 78,
    borderRadius: 14,
    backgroundColor: PsychoPalette.bgPanel,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  previewMiniTag: {
    color: PsychoPalette.amberWarning,
    fontSize: 8,
    fontWeight: '900',
    fontFamily: Fonts.mono,
    marginTop: 5,
  },
  splitPreviewContainer: {
    flexDirection: 'row',
    width: 54,
    height: 32,
    borderRadius: 6,
    overflow: 'hidden',
    gap: 3,
  },
  splitPreviewLeft: {
    flex: 1,
    backgroundColor: PsychoPalette.redSignal,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  splitPreviewRight: {
    flex: 1,
    backgroundColor: PsychoPalette.greenSignal,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  splitPreviewLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  lanesPreview: {
    flexDirection: 'row',
    gap: 12,
    height: 34,
    alignItems: 'center',
  },
  laneWaveLine: {
    width: 10,
    height: 32,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: PsychoPalette.cyan,
    backgroundColor: PsychoPalette.cyanDim,
  },
  laneWaveLineMint: {
    width: 10,
    height: 32,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: PsychoPalette.mint,
    backgroundColor: PsychoPalette.mintDim,
  },
  parkingPreviewZone: {
    width: 48,
    height: 34,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: PsychoPalette.mint,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 245, 160, 0.08)',
  },
  carPreviewTopDown: {
    width: 24,
    height: 14,
    borderRadius: 4,
    backgroundColor: PsychoPalette.vehicleBlue,
    borderWidth: 1,
    borderColor: PsychoPalette.vehicleBlueLight,
  },
  cardInfoColumn: {
    flex: 1,
    gap: 6,
  },
  cardTitle: {
    color: PsychoPalette.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  cardDescription: {
    color: PsychoPalette.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  cardSpecsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  specChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PsychoPalette.bgPanel,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
  },
  specChipText: {
    color: PsychoPalette.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: PsychoPalette.borderSubtle,
    paddingTop: 10,
    gap: 10,
    flexWrap: 'wrap',
  },
  cardActionHint: {
    color: PsychoPalette.textSecondary,
    fontSize: 11,
    flex: 1,
    minWidth: 160,
  },
  launchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  launchButtonText: {
    color: PsychoPalette.bgPrimary,
    fontSize: 12,
    fontWeight: '900',
    fontFamily: Fonts.mono,
    letterSpacing: 0.6,
  },
  benchmarksPanel: {
    backgroundColor: PsychoPalette.bgSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    padding: 14,
    gap: 12,
    marginTop: 4,
  },
  benchmarksHeader: {
    gap: 4,
  },
  benchmarksTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  benchmarksTitle: {
    color: PsychoPalette.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    fontFamily: Fonts.mono,
    letterSpacing: 0.6,
  },
  benchmarksSubtitle: {
    color: PsychoPalette.textSecondary,
    fontSize: 12,
  },
  benchmarksTable: {
    gap: 10,
  },
  benchmarkRow: {
    backgroundColor: PsychoPalette.bgPanel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PsychoPalette.borderSubtle,
    padding: 11,
    gap: 6,
  },
  benchmarkTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  benchmarkTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benchmarkCode: {
    color: PsychoPalette.cyan,
    fontSize: 10,
    fontWeight: '900',
    fontFamily: Fonts.mono,
    backgroundColor: PsychoPalette.cyanDim,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  benchmarkName: {
    color: PsychoPalette.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  benchmarkNorm: {
    color: PsychoPalette.textMuted,
    fontSize: 10,
    fontFamily: Fonts.mono,
  },
  benchmarkMetricDesc: {
    color: PsychoPalette.textSecondary,
    fontSize: 11,
  },
  benchmarkRangesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  rangeBox: {
    flex: 1,
    minWidth: 92,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
  },
  rangeBoxMint: {
    backgroundColor: 'rgba(0, 245, 160, 0.07)',
    borderColor: 'rgba(0, 245, 160, 0.3)',
  },
  rangeBoxCyan: {
    backgroundColor: 'rgba(0, 217, 245, 0.07)',
    borderColor: 'rgba(0, 217, 245, 0.3)',
  },
  rangeBoxRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.07)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  rangeTag: {
    color: PsychoPalette.textMuted,
    fontSize: 8,
    fontWeight: '800',
    fontFamily: Fonts.mono,
    letterSpacing: 0.4,
  },
  rangeVal: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Fonts.mono,
    marginTop: 2,
  },
  authorFooterWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 6,
    paddingBottom: 4,
  },
  authorFooterText: {
    color: PsychoPalette.cyan,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: Fonts.mono,
    letterSpacing: 1,
  },
  verdictBanner: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 16,
    gap: 12,
  },
  verdictBannerApproved: {
    backgroundColor: 'rgba(0, 245, 160, 0.1)',
    borderColor: PsychoPalette.mint,
  },
  verdictBannerRejected: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: PsychoPalette.redSignalBright,
  },
  verdictTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  verdictBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  verdictTitleCol: {
    flex: 1,
    gap: 2,
  },
  verdictSubLabel: {
    color: PsychoPalette.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Fonts.mono,
    letterSpacing: 0.6,
  },
  verdictMainSign: {
    fontSize: 26,
    fontWeight: '900',
    fontFamily: Fonts.mono,
    letterSpacing: 1.2,
  },
  verdictScoreBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  verdictScoreLabel: {
    color: PsychoPalette.textSecondary,
    fontSize: 9,
    fontWeight: '800',
    fontFamily: Fonts.mono,
    letterSpacing: 0.5,
  },
  verdictScoreValue: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
  verdictExplanation: {
    color: PsychoPalette.textPrimary,
    fontSize: 12,
    lineHeight: 18,
  },
  verdictBreakdownGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  verdictModChip: {
    flex: 1,
    minWidth: 135,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    gap: 2,
  },
  verdictModName: {
    color: PsychoPalette.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  verdictModGrade: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: Fonts.mono,
  },
});
