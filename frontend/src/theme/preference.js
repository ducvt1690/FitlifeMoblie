import { Appearance, DevSettings, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// The theme is read synchronously before any stylesheet is built, so every screen picks its palette at start-up.
// Changing it saves the choice and reloads the app.
const KEY = 'fitlife.theme';
export const THEMES = [
  { value: 'dark', label: 'Tối' },
  { value: 'light', label: 'Sáng' },
  { value: 'system', label: 'Theo máy' },
];

export function readTheme() {
  try {
    const v = Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) : SecureStore.getItem(KEY);
    return THEMES.some(t => t.value === v) ? v : 'dark';
  } catch { return 'dark'; }
}

export const themeChoice = readTheme();
export const scheme = themeChoice === 'system' ? (Appearance.getColorScheme() === 'light' ? 'light' : 'dark') : themeChoice;

// Returns false when the app could not restart itself (a release build without a dev menu): the change applies next launch.
export function applyTheme(value) {
  try {
    if (Platform.OS === 'web') { globalThis.localStorage?.setItem(KEY, value); globalThis.location?.reload(); return true; }
    SecureStore.setItem(KEY, value);
  } catch { return false; }
  if (__DEV__) { DevSettings.reload(); return true; }
  return false;
}
