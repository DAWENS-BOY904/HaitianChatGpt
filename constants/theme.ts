export const Colors = {
  light: {
    background: '#FFFFFF',
    surface: '#F7F7F8',
    surfaceSecondary: '#ECECEC',
    text: '#000000',
    textSecondary: '#8E8E93',
    border: '#E5E5EA',
    primary: '#10A37F',
    primaryLight: '#E6F7F2',
    danger: '#FF3B30',
    overlay: 'rgba(0, 0, 0, 0.5)',
    inputBackground: '#F7F7F8',
    card: '#FFFFFF',
    divider: '#E5E5EA',
  },
  dark: {
    background: '#000000',
    surface: '#1C1C1E',
    surfaceSecondary: '#2C2C2E',
    text: '#FFFFFF',
    textSecondary: '#8E8E93',
    border: '#38383A',
    primary: '#10A37F',
    primaryLight: '#1A3D34',
    danger: '#FF453A',
    overlay: 'rgba(0, 0, 0, 0.7)',
    inputBackground: '#1C1C1E',
    card: '#1C1C1E',
    divider: '#38383A',
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Typography = {
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 26,
  },
  heading: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 25,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 22,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
  },
  small: {
    fontSize: 11,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 20,
  full: 9999,
};
