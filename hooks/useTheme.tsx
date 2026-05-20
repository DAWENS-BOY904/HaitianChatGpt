import { useContext } from 'react';
import { ThemeContext } from '../contexts/ThemeContext';

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    // Safe fallback instead of throwing - prevents white screen crashes
    return {
      colors: {
        background: '#000000',
        surface: '#1C1C1E',
        surfaceSecondary: '#2C2C2E',
        text: '#FFFFFF',
        textSecondary: '#8E8E93',
        border: '#38383A',
        primary: '#10A37F',
        primaryLight: '#1A3D34',
        danger: '#FF453A',
        overlay: 'rgba(0,0,0,0.7)',
        inputBackground: '#1C1C1E',
        card: '#1C1C1E',
        divider: '#38383A',
      },
      isDark: true,
      appearance: 'Dark' as const,
      setAppearance: () => {},
      colorScheme: 'dark' as const,
    };
  }
  return context;
}
