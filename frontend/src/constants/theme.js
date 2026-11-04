import { Platform } from 'react-native';

export const FONT_FAMILY = Platform.select({
  web: "'Be Vietnam Pro', 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  default: undefined,
});

export const COLORS = {
  // Primary & Brand Accents
  primary: '#84CC16',
  primaryDark: '#4D7C0F',
  primaryLight: '#ECFCCB',
  secondary: '#0EA5E9',
  secondaryLight: '#E0F2FE',
  accent: '#F59E0B',
  accentLight: '#FEF3C7',
  purple: '#8B5CF6',
  purpleLight: '#EDE9FE',

  // Signature FitLife Neon Lime & Obsidian Slate
  lime: '#BCEF39',
  limeDark: '#84CC16',
  limeLight: '#F2FCE2',
  emerald: '#10B981',
  emeraldDark: '#059669',
  emeraldLight: '#ECFDF5',
  black: '#0F172A',         // Deep slate-black for crisp contrast
  darkCard: '#1E293B',

  // Clean surfaces & borders
  bg: '#F4F7F4',            // Refined soft sage-white background
  card: '#FFFFFF',
  cardMuted: '#F8FAFC',
  border: '#E2E8F0',

  // Typography hierarchy
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',

  // Soft Pastel Badges for Icons
  pastelYellow: '#FEF3C7',
  pastelBlue: '#E0F2FE',
  pastelPink: '#FCE7F3',
  pastelGreen: '#DCFCE7',
  pastelPurple: '#EDE9FE',
  pastelOrange: '#FFEDD5',
  pastelMint: '#CCFBF1',

  // State indicators
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  white: '#FFFFFF',
};

export const SIZES = {
  xs: 12,
  sm: 13.5,
  md: 14.5,
  base: 15.5,
  lg: 18,
  xl: 21,
  xxl: 25,
  title: 28,
  hero: 30,
  huge: 34,
  giant: 40,
};

export const SHADOWS = {
  soft: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  dock: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 8,
  },
};

// Legacy alias used by older screens
export const SHADOW = SHADOWS.card;
