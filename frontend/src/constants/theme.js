export const COLORS = {
  // Legacy aliases used by older screens (Water, Workout, Calorie, BMI)
  primary: '#8DC61E',
  primaryDark: '#5F8A0E',
  primaryLight: '#E8FCCC',
  secondary: '#0EA5E9',
  secondaryLight: '#E0F2FE',
  accent: '#F59E0B',
  accentLight: '#FEF3C7',
  purple: '#8B5CF6',
  purpleLight: '#EDE9FE',

  // Brand Lime & Dark accents (matching the reference UI)
  lime: '#B8F23E',          // Neon/pistachio bright lime
  limeDark: '#8DC61E',
  limeLight: '#E8FCCC',
  black: '#121214',         // Dark black pill dock & headings
  darkCard: '#1E1E24',

  // Clean background & cards
  bg: '#F3F5F1',            // Soft pastel grey-green background
  card: '#FFFFFF',
  cardMuted: '#F8FAF7',
  border: '#E8EBE5',

  // Text
  text: '#121214',
  textSecondary: '#5A6065',
  textMuted: '#8E959C',

  // Soft Pastel Badges for Icons
  pastelYellow: '#FEF08A',
  pastelBlue: '#BAE6FD',
  pastelPink: '#FBCFE8',
  pastelGreen: '#BBF7D0',
  pastelPurple: '#DDD6FE',
  pastelOrange: '#FED7AA',
  pastelMint: '#99F6E4',

  // State indicators
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  white: '#FFFFFF',
};

export const SIZES = {
  xs: 11,
  sm: 13,
  md: 14,
  base: 15,
  lg: 18,
  xl: 22,
  xxl: 26,
  title: 28,
  hero: 32,
  huge: 34,
  giant: 40,
};

export const SHADOWS = {
  soft: {
    shadowColor: '#121214',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  card: {
    shadowColor: '#121214',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
  dock: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
};

// Legacy alias used by older screens
export const SHADOW = SHADOWS.card;
