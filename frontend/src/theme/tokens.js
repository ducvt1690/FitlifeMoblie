import { scheme } from './preference';

// Design tokens: dark and quiet by default, with a light palette the member can switch to. Content sits on flat surfaces; glass is kept for things that float
// (tab bar, controls over photos). Lime is the brand colour and is used sparingly.
const dark = {
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
  accentText: '#C6F432',
  inverse: '#07090C',
  shade: '7,9,12',
  track: 'rgba(255,255,255,0.08)',
  field: 'rgba(255,255,255,0.06)',
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

const light = {
  bg: '#F2F3F5',
  surface: '#FFFFFF',
  surfaceHigh: '#E8EAED',
  glass: 'rgba(255,255,255,0.72)',
  glassStrong: 'rgba(255,255,255,0.88)',
  stroke: 'rgba(11,14,18,0.12)',
  strokeSoft: 'rgba(11,14,18,0.07)',
  text: '#0B0E12',
  textDim: 'rgba(11,14,18,0.64)',
  textFaint: 'rgba(11,14,18,0.42)',
  ink: '#07090C',
  accent: '#B4E61E',
  accentInk: '#0A0D05',
  accentText: '#4D7C0F',
  inverse: '#FFFFFF',
  shade: '242,243,245',
  track: 'rgba(11,14,18,0.08)',
  field: 'rgba(11,14,18,0.04)',
  accentSoft: 'rgba(132,190,0,0.16)',
  danger: '#E5484D',
  dangerSoft: 'rgba(229,72,77,0.12)',
  move: '#F0384A',
  water: '#0FA8CC',
  sleep: '#7C6BF0',
  calories: '#F08A0C',
  steps: '#7FB800',
};

// Picked once at start-up from the saved choice (see preference.js).
export const colors = scheme === 'light' ? light : dark;
export { scheme };

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
