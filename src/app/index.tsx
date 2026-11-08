import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TelemetryHeader } from '@/components/telemetry-header';
import { Fonts, OFFICIAL_BENCHMARKS, PsychoPalette } from '@/constants/theme';
import { AptitudeGrade, useEvaluation } from '@/context/evaluation-context';
import { usePsychAudio } from '@/hooks/use-psych-audio';
import { useTelemetry } from '@/hooks/use-telemetry';

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
  const { reactionResult, latheResult, maneuverResult, resetAllEvaluations } = useEvaluation();
  const { playLeftSignal, playRightSignal } = usePsychAudio();

  const completedCount = [reactionResult, latheResult, maneuverResult].filter(Boolean).length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <TelemetryHeader
        title="AUTOTEST PSICOTÉCNICO 2D"
        subtitle="Consola de Evaluación y Entrenamiento de Conductores"
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
            <Pressable
              onPress={() => {
                playLeftSignal();
                setTimeout(() => playRightSignal(), 220);
              }}
              style={({ pressed }) => [styles.calibrateBtn, pressed && { opacity: 0.75 }]}>
              <Ionicons name="volume-high-outline" size={14} color={PsychoPalette.cyan} />
              <Text style={styles.calibrateBtnText}>TEST AUDIO L/R</Text>
            </Pressable>
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
              <Text style={styles.telemetryHint}>Motor expo-audio • Buffer PCM</Text>
            </View>

            <View style={styles.telemetryBox}>
              <Text style={styles.telemetryBoxLabel}>FRECUENCIA DE CUADROS</Text>
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
                  {completedCount}/3
                </Text>
                <Text style={styles.telemetryUnit}>MÓDULOS</Text>
              </View>
              <Text style={styles.telemetryHint}>Estado: {systemStatus}</Text>
            </View>
          </View>
        </View>

        {/* SECCIÓN DE LAS 3 TARJETAS VISUALES DE GRAN TAMAÑO */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>MÓDULOS DE EVALUACIÓN OFICIAL</Text>
          {completedCount > 0 ? (
            <Pressable onPress={resetAllEvaluations} style={styles.resetButton}>
              <Ionicons name="refresh" size={13} color={PsychoPalette.textSecondary} />
              <Text style={styles.resetButtonText}>Reiniciar sesión</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.cardsColumn}>
          {/* TARJETA 1: PRUEBA DE REACCIÓN Y AUDIO */}
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
                <Text style={styles.moduleTechTag}>AUDIO BINAURAL • MULTITÁCTIL</Text>
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
                  name="ear-outline"
                  size={18}
                  color={PsychoPalette.cyan}
                  style={{ marginTop: 6 }}
                />
              </View>

              <View style={styles.cardInfoColumn}>
                <Text style={styles.cardTitle}>Prueba de Reacción y Audio</Text>
                <Text style={styles.cardDescription}>
                  Evaluación de velocidad de respuesta ante estímulos sonoros y visuales
                  discriminados por mano (Izquierda 440 Hz Roja / Derecha 880 Hz Verde).
                </Text>

                <View style={styles.cardSpecsRow}>
                  <View style={styles.specChip}>
                    <Ionicons name="flash-outline" size={12} color={PsychoPalette.mint} />
                    <Text style={styles.specChipText}>Baremo: &lt; 380 ms</Text>
                  </View>
                  <View style={styles.specChip}>
                    <Ionicons name="musical-notes-outline" size={12} color={PsychoPalette.cyan} />
                    <Text style={styles.specChipText}>Alertas L / R</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.cardActionHint}>
                {reactionResult
                  ? `Último registro: Izq ${reactionResult.leftAvgMs}ms | Der ${reactionResult.rightAvgMs}ms (${reactionResult.accuracyPct}% acierto)`
                  : 'Toque para abrir el banco de reflejos acústico-visual'}
              </Text>
              <View style={[styles.launchButton, { backgroundColor: PsychoPalette.cyan }]}>
                <Text style={styles.launchButtonText}>INICIAR PRUEBA</Text>
                <Ionicons name="arrow-forward" size={15} color={PsychoPalette.bgPrimary} />
              </View>
            </View>
          </Pressable>

          {/* TARJETA 2: PRUEBA DEL TORNO (COORDINACIÓN BIMANUAL) */}
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
                <Text style={styles.moduleTechTag}>DOBLE CARRIL • GESTOS SIMULTÁNEOS</Text>
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
                  Dos carriles verticales ondulados en movimiento continuo. Mantenga ambos anillos
                  guía dentro de la pista simultáneamente con control multitáctil.
                </Text>

                <View style={styles.cardSpecsRow}>
                  <View style={styles.specChip}>
                    <Ionicons name="analytics-outline" size={12} color={PsychoPalette.mint} />
                    <Text style={styles.specChipText}>Baremo: ≥ 75% precisión</Text>
                  </View>
                  <View style={styles.specChip}>
                    <Ionicons name="hand-left-outline" size={12} color={PsychoPalette.cyan} />
                    <Text style={styles.specChipText}>Control Bimanual</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.cardActionHint}>
                {latheResult
                  ? `Último registro: Izq ${latheResult.leftPrecisionPct}% | Der ${latheResult.rightPrecisionPct}% (Fuera: ${latheResult.offTrackSeconds}s)`
                  : 'Toque para iniciar el test visomotriz de doble trazado'}
              </Text>
              <View style={[styles.launchButton, { backgroundColor: PsychoPalette.mint }]}>
                <Text style={styles.launchButtonText}>INICIAR PRUEBA</Text>
                <Ionicons name="arrow-forward" size={15} color={PsychoPalette.bgPrimary} />
              </View>
            </View>
          </Pressable>

          {/* TARJETA 3: SIMULADOR DE MANIOBRAS 2D */}
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
                <Text style={styles.moduleTechTag}>VISTA SUPERIOR 2D • JOYSTICK + PEDALES</Text>
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
                  <Text style={styles.pendingPillText}>LISTO PARA INICIAR</Text>
                </View>
              )}
            </View>

            <View style={styles.cardBodyRow}>
              <View style={[styles.iconPreviewBox, { borderColor: 'rgba(37, 99, 235, 0.5)' }]}>
                <View style={styles.parkingPreviewZone}>
                  <View style={styles.carPreviewTopDown} />
                </View>
                <Ionicons
                  name="car-sport-outline"
                  size={20}
                  color={PsychoPalette.vehicleBlueLight}
                  style={{ marginTop: 4 }}
                />
              </View>

              <View style={styles.cardInfoColumn}>
                <Text style={styles.cardTitle}>Simulador de Maniobras 2D</Text>
                <Text style={styles.cardDescription}>
                  Circuito de orientación espacial en vista de pájaro (Top-Down) con vehículo azul,
                  zona de parqueo demarcada, joystick de dirección y pedales de avance/freno.
                </Text>

                <View style={styles.cardSpecsRow}>
                  <View style={styles.specChip}>
                    <Ionicons name="compass-outline" size={12} color={PsychoPalette.mint} />
                    <Text style={styles.specChipText}>Parqueo Exacto</Text>
                  </View>
                  <View style={styles.specChip}>
                    <Ionicons
                      name="game-controller-outline"
                      size={12}
                      color={PsychoPalette.cyan}
                    />
                    <Text style={styles.specChipText}>Joystick + Pedales</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.cardActionHint}>
                {maneuverResult
                  ? `Último registro: ${maneuverResult.scenarioTitle} en ${maneuverResult.elapsedSeconds}s (${maneuverResult.collisions} colisiones)`
                  : 'Toque para abrir la pista de maniobras y estacionamiento 2D'}
              </Text>
              <View style={[styles.launchButton, { backgroundColor: PsychoPalette.cyan }]}>
                <Text style={styles.launchButtonText}>INICIAR SIMULADOR</Text>
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
                RESUMEN DE BAREMOS OFICIALES PSICOTÉCNICOS
              </Text>
            </View>
            <Text style={styles.benchmarksSubtitle}>
              Parámetros normativos de aptitud psicofísica para obtención y renovación de licencias
              de conducción
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
});
