import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors as baseColors, water } from '@/lib/design-tokens';

export type ThemeMode = 'light' | 'dark';

export type Palette = {
  navy: string;
  navyLight: string;
  white: string;
  lightBlue: string;
  lightBlue2: string;
  border: string;
  text: string;
  textMuted: string;
  teal: string;
  tealLight: string;
  amber: string;
  amberLight: string;
  red: string;
  redLight: string;
  success: string;
  bg: string;
  surface: string;
  surfaceAlt: string;
  inputBg: string;
  heading: string;
  primary: string;
  onPrimary: string;
  secondaryBg: string;
  overlay: string;
  successBg: string;
  warningBg: string;
  criticalBg: string;
  infoBg: string;
  neutralBg: string;
  // Water theme extensions
  water100: string;
  water200: string;
  water300: string;
  water400: string;
  water500: string;
  water600: string;
  water700: string;
  water800: string;
  water900: string;
  waterDark100: string;
  waterDark200: string;
  waterDark300: string;
  waterDark400: string;
  waterDark500: string;
  waterDark600: string;
  waterDark700: string;
  waterDark800: string;
  waterDark900: string;
};

export const lightPalette: Palette = {
  ...baseColors,
  ...water,
  // Override with light water defaults
  water100: '#F0FDFF',
  water200: '#D6F0FA',
  water300: '#A5EAF2',
  water400: '#5AC8E1',
  water500: '#0FA3B1',
  water600: '#0A8FA6',
  water700: '#087B95',
  water800: '#066A84',
  water900: '#055A73',
  waterDark100: '#0D1320',
  waterDark200: '#141B2A',
  waterDark300: '#1A2535',
  waterDark400: '#213045',
  waterDark500: '#0FA3B1',
  waterDark600: '#0A8FA6',
  waterDark700: '#087B95',
  waterDark800: '#066A84',
  waterDark900: '#055A73',
  // Keep existing overrides
  surface: baseColors.white,
  surfaceAlt: baseColors.bg,
  inputBg: baseColors.white,
  heading: baseColors.navy,
  primary: baseColors.navy,
  onPrimary: '#FFFFFF',
  secondaryBg: baseColors.white,
  overlay: 'rgba(15, 23, 42, 0.45)',
  successBg: baseColors.tealLight,
  warningBg: baseColors.amberLight,
  criticalBg: baseColors.redLight,
  infoBg: baseColors.lightBlue,
  neutralBg: '#F1F5F9',
};

export const darkPalette: Palette = {
  navy: '#E6F0FF',
  navyLight: '#1E293B',
  white: '#111827',
  lightBlue: '#1E293B',
  lightBlue2: '#0F172A',
  border: '#243244',
  text: '#E5E7EB',
  textMuted: '#94A3B8',
  teal: '#2DD4BF',
  tealLight: '#0F2E2E',
  amber: '#FBBF24',
  amberLight: '#3A2A08',
  red: '#F87171',
  redLight: '#3A1414',
  success: '#34D399',
  bg: '#0B1220',
  surface: '#111827',
  surfaceAlt: '#172033',
  inputBg: '#0F172A',
  heading: '#F8FAFC',
  primary: '#0FA3B1',
  onPrimary: '#04121F',
  secondaryBg: '#111827',
  overlay: 'rgba(2, 6, 23, 0.72)',
  successBg: '#0F2E2E',
  warningBg: '#3A2A08',
  criticalBg: '#3A1414',
  infoBg: '#1E293B',
  neutralBg: '#1F2937',

  // Water dark overrides
  water100: '#0D1320',
  water200: '#141B2A',
  water300: '#1A2535',
  water400: '#213045',
  water500: '#0FA3B1',
  water600: '#0A8FA6',
  water700: '#087B95',
  water800: '#066A84',
  water900: '#055A73',
  waterDark100: '#051018',
  waterDark200: '#0A151E',
  waterDark300: '#10202B',
  waterDark400: '#162A3A',
  waterDark500: '#0FA3B1',
  waterDark600: '#0A8FA6',
  waterDark700: '#087B95',
  waterDark800: '#066A84',
  waterDark900: '#055A73',
};

type ThemeContextValue = {
  mode: ThemeMode;
  isDark: boolean;
  colors: Palette;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  isDark: false,
  colors: lightPalette,
  setMode: () => {},
  toggle: () => {},
});

const STORAGE_KEY = 'themeMode';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (mounted && (stored === 'dark' || stored === 'light')) setModeState(stored);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    setModeState((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      isDark: mode === 'dark',
      colors: mode === 'dark' ? darkPalette : lightPalette,
      setMode,
      toggle,
    }),
    [mode, setMode, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}