// Design tokens: dark and quiet. Content sits on flat surfaces; glass is kept for things that float
// (tab bar, controls over photos). Lime is the brand colour and is used sparingly.
export const colors = {
  bg: '#07090C',
  surface: '#111418',
  surfaceHigh: '#191D22',
  glass: 'rgba(255,255,255,0.08)',
  glassStrong: 'rgba(255,255,255,0.14)',
  stroke: 'rgba(255,255,255,0.14)',
  strokeSoft: 'rgba(255,255,255,0.07)',
  text: '#F5F7FA',
  textDim: 'rgba(245,247,250,0.66)',
  textFaint: 'rgba(245,247,250,0.40)',
  ink: '#07090C',
  accent: '#C6F432',
  accentInk: '#0A0D05',
  accentSoft: 'rgba(198,244,50,0.14)',
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
export const radius = { sm: 12, md: 18, lg: 24, pill: 999 };

// Barlow for reading, Barlow Condensed for headlines and numbers. Both cover Vietnamese.
export const fonts = {
  regular: 'Barlow_400Regular',
  medium: 'Barlow_500Medium',
  semibold: 'Barlow_600SemiBold',
  bold: 'Barlow_700Bold',
  display: 'BarlowCondensed_700Bold',
  displayMedium: 'BarlowCondensed_600SemiBold',
};

// Base sizes before responsive scaling (see useLayout). Condensed lines get extra height for stacked diacritics.
export const type = {
  display: { size: 56, line: 58, font: fonts.display, tracking: -0.5 },
  title: { size: 34, line: 40, font: fonts.display, tracking: -0.2 },
  heading: { size: 19, line: 25, font: fonts.semibold, tracking: -0.1 },
  body: { size: 16, line: 23, font: fonts.regular, tracking: 0 },
  label: { size: 15, line: 20, font: fonts.medium, tracking: 0 },
  caption: { size: 13, line: 17, font: fonts.medium, tracking: 0.1 },
  metric: { size: 40, line: 44, font: fonts.display, tracking: -0.3 },
};
