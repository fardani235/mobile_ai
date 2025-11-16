import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useColorScheme } from 'react-native';
import { Provider as PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import React, { createContext, useCallback, useMemo, useState } from 'react';

export const AppThemeContext = createContext<{
  isDark: boolean;
  toggleTheme: () => void;
}>({ isDark: false, toggleTheme: () => {} });

export default function RootLayout() {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState<boolean>(systemScheme === 'dark');
  const toggleTheme = useCallback(() => setIsDark((v) => !v), []);

  const navTheme = isDark ? DarkTheme : DefaultTheme;
  const basePaper = isDark ? MD3DarkTheme : MD3LightTheme;
  const paperTheme = {
    ...basePaper,
    colors: {
      ...basePaper.colors,
      // Modern blue palette
      primary: isDark ? '#90CAF9' : '#1E88E5',
      primaryContainer: isDark ? '#0D47A1' : '#D6E4FF',
      onPrimary: isDark ? '#003B6B' : '#FFFFFF',
    },
  } as typeof basePaper;

  const ctx = useMemo(() => ({ isDark, toggleTheme }), [isDark, toggleTheme]);

  return (
    <AppThemeContext.Provider value={ctx}>
      <PaperProvider theme={paperTheme}>
        <ThemeProvider value={navTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)/login" />
            <Stack.Screen name="(app)" />
          </Stack>
          <StatusBar style={isDark ? 'light' : 'dark'} />
        </ThemeProvider>
      </PaperProvider>
    </AppThemeContext.Provider>
  );
}
