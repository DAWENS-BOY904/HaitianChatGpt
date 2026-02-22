import React, { createContext, ReactNode, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { Colors } from '../constants/theme';
import { useSettings } from '../hooks/useSettings';

type Appearance = 'System' | 'Light' | 'Dark';
type ColorScheme = 'light' | 'dark';

interface ThemeContextType {
  colors: typeof Colors.light;
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
  colorScheme: ColorScheme;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const { settings } = useSettings();
  const [appearance, setAppearance] = useState<Appearance>('System');

  // Sync with settings
  useEffect(() => {
    if (settings.appearance) {
      setAppearance(settings.appearance as Appearance);
    }
  }, [settings.appearance]);

  const getColorScheme = (): ColorScheme => {
    if (appearance === 'System') {
      // Follow system preference
      return systemColorScheme === 'dark' ? 'dark' : 'light';
    }
    // Use user's manual selection
    return appearance.toLowerCase() as ColorScheme;
  };

  const colorScheme = getColorScheme();
  const colors = Colors[colorScheme];

  return (
    <ThemeContext.Provider value={{ colors, appearance, setAppearance, colorScheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
