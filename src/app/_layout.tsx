import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { PsychoPalette } from '@/constants/theme';
import { EvaluationProvider } from '@/context/evaluation-context';

SplashScreen.preventAutoHideAsync().catch(() => {});

const AutoTestDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: PsychoPalette.bgPrimary,
    card: PsychoPalette.bgSecondary,
    text: PsychoPalette.textPrimary,
    border: PsychoPalette.borderSubtle,
    primary: PsychoPalette.mint,
  },
};

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <EvaluationProvider>
        <ThemeProvider value={AutoTestDarkTheme}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: PsychoPalette.bgPrimary },
              animation: 'fade',
            }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="preoperational" />
            <Stack.Screen name="reaction" />
            <Stack.Screen name="lathe" />
            <Stack.Screen name="maneuvers" />
          </Stack>
        </ThemeProvider>
      </EvaluationProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PsychoPalette.bgPrimary,
  },
});
