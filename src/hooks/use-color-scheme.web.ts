import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * La aplicación utiliza una estética oscura constante de tablero psicotécnico.
 */
export function useColorScheme() {
  const colorScheme = useRNColorScheme();
  return colorScheme ?? 'dark';
}
