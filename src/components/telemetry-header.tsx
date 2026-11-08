import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, PsychoPalette } from '@/constants/theme';
import { useTelemetry } from '@/hooks/use-telemetry';

interface TelemetryHeaderProps {
  title: string;
  subtitle?: string;
  moduleCode?: string;
  showBack?: boolean;
  onTestAudio?: () => void;
}

export function TelemetryHeader({
  title,
  subtitle,
  moduleCode = 'SYS-CRC',
  showBack = false,
  onTestAudio,
}: TelemetryHeaderProps) {
  const { fps, audioLatencyMs, systemStatus } = useTelemetry();

  return (
    <View style={styles.headerContainer}>
      <View style={styles.topRow}>
        <View style={styles.titleSection}>
          {showBack ? (
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
              accessibilityRole="button"
              accessibilityLabel="Volver al Menú Principal">
              <Ionicons name="chevron-back" size={20} color={PsychoPalette.cyan} />
              <Text style={styles.backText}>TABLERO</Text>
            </Pressable>
          ) : (
            <View style={styles.codeBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.codeText}>{moduleCode}</Text>
            </View>
          )}
          <View style={styles.titleBlock}>
            <Text style={styles.titleText} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitleText} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.telemetryCluster}>
          <Pressable
            onPress={onTestAudio}
            disabled={!onTestAudio}
            style={({ pressed }) => [
              styles.metricPill,
              styles.metricPillCyan,
              pressed && onTestAudio && { opacity: 0.75 },
            ]}>
            <Ionicons name="pulse" size={13} color={PsychoPalette.cyan} />
            <View>
              <Text style={styles.metricLabel}>AUDIO LAT</Text>
              <Text style={[styles.metricValue, { color: PsychoPalette.cyan }]}>
                {audioLatencyMs} ms
              </Text>
            </View>
          </Pressable>

          <View style={[styles.metricPill, styles.metricPillMint]}>
            <Ionicons name="speedometer-outline" size={13} color={PsychoPalette.mint} />
            <View>
              <Text style={styles.metricLabel}> MOTOR 2D</Text>
              <Text style={[styles.metricValue, { color: PsychoPalette.mint }]}>{fps} FPS</Text>
            </View>
          </View>

          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{systemStatus}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: PsychoPalette.bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: PsychoPalette.borderSubtle,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PsychoPalette.cyanDim,
    borderWidth: 1,
    borderColor: PsychoPalette.cyan,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  backButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  backText: {
    color: PsychoPalette.cyan,
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Fonts.mono,
    letterSpacing: 0.6,
  },
  codeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PsychoPalette.mintDim,
    borderWidth: 1,
    borderColor: PsychoPalette.mint,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 5,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: PsychoPalette.mint,
  },
  codeText: {
    color: PsychoPalette.mint,
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Fonts.mono,
    letterSpacing: 0.8,
  },
  titleBlock: {
    flexShrink: 1,
  },
  titleText: {
    color: PsychoPalette.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  subtitleText: {
    color: PsychoPalette.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  telemetryCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    backgroundColor: PsychoPalette.bgPanel,
  },
  metricPillCyan: {
    borderColor: 'rgba(0, 217, 245, 0.4)',
  },
  metricPillMint: {
    borderColor: 'rgba(0, 245, 160, 0.4)',
  },
  metricLabel: {
    color: PsychoPalette.textMuted,
    fontSize: 8,
    fontWeight: '700',
    fontFamily: Fonts.mono,
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Fonts.mono,
  },
  statusBadge: {
    backgroundColor: 'rgba(0, 245, 160, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 160, 0.35)',
    paddingHorizontal: 7,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusBadgeText: {
    color: PsychoPalette.mint,
    fontSize: 9,
    fontWeight: '800',
    fontFamily: Fonts.mono,
    letterSpacing: 0.5,
  },
});

