import React, { createContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { useColorScheme, Platform } from 'react-native';
import { Colors } from '../constants/theme';
import { useSettings } from '../hooks/useSettings';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Appearance = 'System' | 'Light' | 'Dark';
type ColorScheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'app_appearance_preference';

interface ThemeContextType {
  colors: typeof Colors.light;
  isDark: boolean;
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
  colorScheme: ColorScheme;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const { settings, updateSetting } = useSettings();
  const [appearance, setAppearanceState] = useState<Appearance>('System');
  const [loaded, setLoaded] = useState(false);

  // Load persisted theme on mount (covers guest users with no DB settings)
  useEffect(() => {
    const loadPersistedTheme = async () => {
      try {
        if (Platform.OS !== 'web') {
          const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
          if (saved && (saved === 'System' || saved === 'Light' || saved === 'Dark')) {
            setAppearanceState(saved as Appearance);
          }
        }
      } catch (_e) {
        // ignore
      } finally {
        setLoaded(true);
      }
    };
    loadPersistedTheme();
  }, []);

  // Sync with DB settings once user is authenticated (DB wins over local cache)
  useEffect(() => {
    if (settings.appearance && (settings.appearance === 'System' || settings.appearance === 'Light' || settings.appearance === 'Dark')) {
      setAppearanceState(settings.appearance as Appearance);
    }
  }, [settings.appearance]);

  // Persist and propagate theme change
  const setAppearance = useCallback(async (newAppearance: Appearance) => {
    setAppearanceState(newAppearance);
    // Always persist locally so it survives app restarts
    try {
      if (Platform.OS !== 'web') {
        await AsyncStorage.setItem(THEME_STORAGE_KEY, newAppearance);
      }
    } catch (_e) {}
    // Also persist to DB if user is logged in (updateSetting is a no-op for guests)
    try {
      await updateSetting('appearance', newAppearance);
    } catch (_e) {}
  }, [updateSetting]);

  const getColorScheme = (): ColorScheme => {
    if (appearance === 'System') {
      return systemColorScheme === 'dark' ? 'dark' : 'light';
    }
    return appearance.toLowerCase() as ColorScheme;
  };

  const colorScheme = getColorScheme();
  const colors = Colors[colorScheme];

  return (
    <ThemeContext.Provider value={{ colors, isDark: colorScheme === 'dark', appearance, setAppearance, colorScheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
