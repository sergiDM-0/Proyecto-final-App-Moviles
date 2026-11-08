import '@/global.css';

import { Platform } from 'react-native';

/**
 * Paleta de colores estilo Tablero de Control Profesional (AutoTest Psicotécnico)
 * Oscura (azul marino profundo / negro) con acentos en verde menta y cian.
 */
export const PsychoPalette = {
  bgPrimary: '#050A14',
  bgSecondary: '#0A1222',
  bgCard: '#0F1A2E',
  bgCardElevated: '#15233D',
  bgPanel: '#080F1D',
  borderSubtle: '#1E3150',
  borderCyan: '#00D9F5',
  borderMint: '#00F5A0',
  mint: '#00F5A0',
  mintDim: 'rgba(0, 245, 160, 0.14)',
  mintGlow: 'rgba(0, 245, 160, 0.35)',
  cyan: '#00D9F5',
  cyanDim: 'rgba(0, 217, 245, 0.14)',
  cyanGlow: 'rgba(0, 217, 245, 0.35)',
  vehicleBlue: '#2563EB',
  vehicleBlueLight: '#60A5FA',
  redSignal: '#EF4444',
  redSignalBright: '#FF3B5C',
  redSignalDim: 'rgba(239, 68, 68, 0.18)',
  greenSignal: '#10B981',
  greenSignalBright: '#00F5A0',
  greenSignalDim: 'rgba(16, 185, 129, 0.18)',
  amberWarning: '#F59E0B',
  amberDim: 'rgba(245, 158, 11, 0.16)',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
} as const;

export const OFFICIAL_BENCHMARKS = [
  {
    id: 'reaction',
    code: 'MOD-01',
    title: 'Reacción Auditivo-Motora',
    metricLabel: 'Tiempo medio de respuesta',
    excellent: '< 260 ms',
    approved: '260 – 380 ms',
    rejected: '> 380 ms / >2 fallos',
    normRef: 'Anexo IV DGT / CRC',
  },
  {
    id: 'lathe',
    code: 'MOD-02',
    title: 'Coordinación Bimanual (Torno)',
    metricLabel: 'Permanencia simultánea en carril',
    excellent: '≥ 90% precisión',
    approved: '75% – 89% precisión',
    rejected: '< 75% precisión',
    normRef: 'Test Visomotriz Bimanual',
  },
  {
    id: 'maneuvers',
    code: 'MOD-03',
    title: 'Simulador de Maniobras 2D',
    metricLabel: 'Estacionamiento y orientación espacial',
    excellent: '< 25 s • 0 colisiones',
    approved: '25 – 50 s • ≤1 roce',
    rejected: '> 50 s o colisión grave',
    normRef: 'Prueba Práctica Espacial',
  },
] as const;

export const Colors = {
  light: {
    text: '#F1F5F9',
    background: '#050A14',
    backgroundElement: '#0F1A2E',
    backgroundSelected: '#15233D',
    textSecondary: '#94A3B8',
  },
  dark: {
    text: '#F1F5F9',
    background: '#050A14',
    backgroundElement: '#0F1A2E',
    backgroundSelected: '#15233D',
    textSecondary: '#94A3B8',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 960;
