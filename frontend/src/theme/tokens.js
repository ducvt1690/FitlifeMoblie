// Design tokens: dark, minimal, glass surfaces over imagery. Every screen reads from here.
export const colors = {
  bg: '#07090C',
  bgRaised: '#0E1116',
  glass: 'rgba(255,255,255,0.08)',
  glassStrong: 'rgba(255,255,255,0.14)',
  stroke: 'rgba(255,255,255,0.14)',
  strokeSoft: 'rgba(255,255,255,0.07)',
  text: '#F5F7FA',
  textDim: 'rgba(245,247,250,0.68)',
  textFaint: 'rgba(245,247,250,0.42)',
  accent: '#C6F432',
  accentInk: '#0A0D05',
  accentSoft: 'rgba(198,244,50,0.16)',
  danger: '#FF5A5F',
  dangerSoft: 'rgba(255,90,95,0.14)',
  // Data colours, one per metric, used for rings and charts.
  move: '#FF4D5E',
  water: '#38D6F5',
  sleep: '#9B8CFF',
  calories: '#FF9F2E',
  steps: '#C6F432',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 14, md: 20, lg: 28, pill: 999 };

export const fonts = {
  regular: 'BeVietnamPro_400Regular',
  medium: 'BeVietnamPro_500Medium',
  semibold: 'BeVietnamPro_600SemiBold',
  bold: 'BeVietnamPro_700Bold',
  heavy: 'BeVietnamPro_800ExtraBold',
};

// Base sizes before responsive scaling (see useLayout).
export const type = {
  display: { size: 40, line: 44, font: fonts.heavy, tracking: -1.2 },
  title: { size: 28, line: 34, font: fonts.bold, tracking: -0.6 },
  heading: { size: 20, line: 26, font: fonts.semibold, tracking: -0.3 },
  body: { size: 16, line: 23, font: fonts.regular, tracking: 0 },
  label: { size: 14, line: 19, font: fonts.medium, tracking: 0 },
  caption: { size: 12, line: 16, font: fonts.medium, tracking: 0.2 },
  metric: { size: 34, line: 38, font: fonts.heavy, tracking: -1 },
};
